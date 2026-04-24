import { TodoItem, TodoList, Message, ToolDefinition, ToolCall } from '../types';
import { TodoManager, TodoExecutionResult } from './todoManager';
import { getModelManager } from '../models/modelManager';
import { getConfig } from '../config';
import { logInfo, logWarn, logDebug, logError } from '../utils/logger';

export interface ExecutionCallbacks {
  onItemStart?: (item: TodoItem) => void;
  onItemComplete?: (item: TodoItem, result: TodoExecutionResult) => void;
  onItemFail?: (item: TodoItem, error: Error) => void;
  onListComplete?: (list: TodoList) => void;
  onProgress?: (progress: { current: number; total: number; percentage: number }) => void;
}

export class TodoExecutor {
  private static instance: TodoExecutor;
  private todoManager = TodoManager.getInstance();
  private modelManager = getModelManager();
  private isRunning = false;
  private shouldStop = false;
  
  private constructor() {}
  
  static getInstance(): TodoExecutor {
    if (!TodoExecutor.instance) {
      TodoExecutor.instance = new TodoExecutor();
    }
    return TodoExecutor.instance;
  }
  
  async executeList(
    listId: string,
    callbacks?: ExecutionCallbacks,
    tools?: ToolDefinition[]
  ): Promise<boolean> {
    const config = getConfig();
    const list = this.todoManager.getTodoList(listId);
    
    if (!list) {
      logError('TodoExecutor', `Todo list not found: ${listId}`);
      return false;
    }
    
    if (this.isRunning) {
      logWarn('TodoExecutor', 'Executor is already running');
      return false;
    }
    
    this.isRunning = true;
    this.shouldStop = false;
    
    logInfo('TodoExecutor', `Starting execution of list: ${list.title}`);
    
    try {
      let completedCount = 0;
      const totalCount = list.items.length;
      
      while (!this.shouldStop) {
        const nextItem = this.todoManager.getNextItem(listId);
        
        if (!nextItem) {
          // Check if all items are done
          const progress = this.todoManager.getProgress(listId);
          if (progress.pending === 0 && progress.inProgress === 0) {
            break;
          }
          
          // Wait and retry
          await this.sleep(1000);
          continue;
        }
        
        // Mark item as in progress
        this.todoManager.updateItemStatus(listId, nextItem.id, 'in_progress');
        
        if (callbacks?.onItemStart) {
          callbacks.onItemStart(nextItem);
        }
        
        logInfo('TodoExecutor', `Executing task: ${nextItem.content}`);
        
        let retryCount = 0;
        const maxRetries = config.todoList.retryOnFailure ? config.todoList.maxRetries : 0;
        let success = false;
        
        while (!success && retryCount <= maxRetries && !this.shouldStop) {
          try {
            const result = await this.executeItem(nextItem, tools);
            
            this.todoManager.updateItemStatus(
              listId,
              nextItem.id,
              'completed',
              result.result,
              undefined
            );
            
            if (callbacks?.onItemComplete) {
              callbacks.onItemComplete(nextItem, result);
            }
            
            success = true;
          } catch (error) {
            retryCount++;
            
            if (retryCount > maxRetries) {
              logError('TodoExecutor', `Task failed after ${maxRetries} retries: ${nextItem.content}`, error);
              
              this.todoManager.updateItemStatus(
                listId,
                nextItem.id,
                'failed',
                undefined,
                error instanceof Error ? error.message : String(error)
              );
              
              if (callbacks?.onItemFail) {
                callbacks.onItemFail(nextItem, error instanceof Error ? error : new Error(String(error)));
              }
            } else {
              logWarn('TodoExecutor', `Task failed, retry ${retryCount}/${maxRetries}: ${nextItem.content}`);
              await this.sleep(1000 * retryCount); // Exponential backoff
            }
          }
        }
        
        completedCount++;
        
        if (callbacks?.onProgress) {
          const progress = this.todoManager.getProgress(listId);
          callbacks.onProgress({
            current: completedCount,
            total: totalCount,
            percentage: progress.percentage
          });
        }
        
        // Small delay between tasks
        if (!this.shouldStop) {
          await this.sleep(500);
        }
      }
      
      const finalList = this.todoManager.getTodoList(listId);
      if (finalList && callbacks?.onListComplete) {
        callbacks.onListComplete(finalList);
      }
      
      logInfo('TodoExecutor', `Execution complete for list: ${list.title}`);
      
      return true;
    } finally {
      this.isRunning = false;
    }
  }
  
  private async executeItem(
    item: TodoItem,
    tools?: ToolDefinition[]
  ): Promise<TodoExecutionResult> {
    // If the item has a tool specified, execute it via the model with function calling
    if (item.tool && tools && tools.length > 0) {
      return this.executeWithTool(item, tools);
    }
    
    // Otherwise, use the model to interpret and execute the task
    return this.executeWithModel(item, tools);
  }
  
  private async executeWithTool(
    item: TodoItem,
    tools: ToolDefinition[]
  ): Promise<TodoExecutionResult> {
    const tool = tools.find(t => t.function.name === item.tool);
    
    if (!tool) {
      throw new Error(`Tool not found: ${item.tool}`);
    }
    
    logInfo('TodoExecutor', `Executing with tool: ${item.tool}`);
    
    // Build messages for the model
    const messages: Message[] = [
      {
        role: 'system',
        content: `You are a security automation assistant. The user wants to execute the following task:
"${item.content}"

You have access to tools to help complete this task. Use the appropriate tool to execute the task.`
      }
    ];
    
    // If there are existing results, include them
    if (item.result) {
      messages.push({
        role: 'assistant',
        content: `Previous result: ${item.result}`
      });
    }
    
    messages.push({
      role: 'user',
      content: `Execute the task: ${item.content}${
        item.toolArguments ? `\nArguments: ${JSON.stringify(item.toolArguments)}` : ''
      }`
    });
    
    const response = await this.modelManager.chatCompletion({
      model: this.modelManager.getActiveAdapter().defaultModel,
      messages,
      tools: [tool],
      tool_choice: { type: 'function', function: { name: item.tool! } }
    });
    
    const choice = response.choices[0];
    if (!choice) {
      throw new Error('No response from model');
    }
    
    const toolCalls = choice.message.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      return {
        success: true,
        itemId: item.id,
        result: choice.message.content || 'Task completed (no tool call needed)'
      };
    }
    
    // Return the tool call for the caller to execute
    return {
      success: true,
      itemId: item.id,
      result: JSON.stringify({
        toolCalls: toolCalls.map(tc => ({
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments)
        }))
      })
    };
  }
  
  private async executeWithModel(
    item: TodoItem,
    tools?: ToolDefinition[]
  ): Promise<TodoExecutionResult> {
    logInfo('TodoExecutor', `Executing with model interpretation: ${item.content}`);
    
    const messages: Message[] = [
      {
        role: 'system',
        content: `You are a security expert assistant. The user wants to complete the following task:
"${item.content}"

Analyze the task and provide:
1. A detailed plan for completing the task
2. Any specific commands or tools that should be used
3. Expected results and how to verify them
4. Potential risks or considerations

${tools && tools.length > 0 
  ? `You also have access to the following tools: ${tools.map(t => t.function.name).join(', ')}` 
  : ''}

Be practical and specific. If you need clarification, ask specific questions.`
      },
      {
        role: 'user',
        content: `Help me complete this task: ${item.content}`
      }
    ];
    
    const request: Parameters<typeof this.modelManager.chatCompletion>[0] = {
      model: this.modelManager.getActiveAdapter().defaultModel,
      messages,
      temperature: 0.5,
      max_tokens: 2048
    };
    
    if (tools && tools.length > 0) {
      request.tools = tools;
    }
    
    const response = await this.modelManager.chatCompletion(request);
    
    const choice = response.choices[0];
    if (!choice) {
      throw new Error('No response from model');
    }
    
    const toolCalls = choice.message.tool_calls;
    const content = choice.message.content;
    
    let result: string;
    if (toolCalls && toolCalls.length > 0) {
      result = JSON.stringify({
        toolCalls: toolCalls.map(tc => ({
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments)
        })),
        context: content
      });
    } else {
      result = content || 'Task analyzed successfully';
    }
    
    return {
      success: true,
      itemId: item.id,
      result
    };
  }
  
  stop(): void {
    this.shouldStop = true;
    logInfo('TodoExecutor', 'Stopping execution...');
  }
  
  isExecuting(): boolean {
    return this.isRunning;
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export function getTodoExecutor(): TodoExecutor {
  return TodoExecutor.getInstance();
}
