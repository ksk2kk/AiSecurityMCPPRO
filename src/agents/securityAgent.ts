import { Message, ToolDefinition, TodoItem, Vulnerability, ScanResult } from '../types';
import { getModelManager } from '../models/modelManager';
import { getContextManager } from '../context/contextManager';
import { getTodoManager } from '../todo/todoManager';
import { getTodoExecutor } from '../todo/todoExecutor';
import { getToolRegistry } from '../tools/toolRegistry';
import { getToolExecutor } from '../tools/toolExecutor';
import { getVulnerabilityAnalyzer } from '../vulnerability/vulnerabilityAnalyzer';
import { getRequirementAnalyzer } from '../requirements/requirementAnalyzer';
import { getConfig } from '../config';
import { logInfo, logWarn, logDebug, logError } from '../utils/logger';

export interface AgentResponse {
  content: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
  contextInfo: {
    currentTokens: number;
    maxTokens: number;
    usagePercentage: number;
  };
  todoList?: {
    id: string;
    title: string;
    progress: {
      total: number;
      completed: number;
      percentage: number;
    };
  };
  vulnerabilities?: Vulnerability[];
  clarifications?: Array<{
    id: string;
    question: string;
    options?: string[];
  }>;
}

export class SecurityAgent {
  private static instance: SecurityAgent;
  private modelManager = getModelManager();
  private contextManager = getContextManager();
  private todoManager = getTodoManager();
  private todoExecutor = getTodoExecutor();
  private toolRegistry = getToolRegistry();
  private toolExecutor = getToolExecutor();
  private vulnerabilityAnalyzer = getVulnerabilityAnalyzer();
  private requirementAnalyzer = getRequirementAnalyzer();
  
  private systemPrompt: string = `你是一个专业的安全专家AI助手，专注于漏洞挖掘和安全评估。

你的核心能力：
1. 自动分析用户需求并生成详细的任务计划
2. 使用各种安全工具进行扫描和测试
3. 自动管理对话上下文，包括压缩和总结
4. 实时显示上下文使用情况
5. 在信息不足时主动追问用户
6. 检测并报告漏洞

工作原则：
- 安全第一：在安全模式下，只执行非侵入性扫描
- 精确：使用可用工具并正确解释结果
- 透明：显示正在做什么和为什么
- 主动：在需要时询问更多信息
- 负责：不执行危险操作除非明确授权

当用户要求进行安全扫描时：
1. 首先分析需求，识别目标和扫描类型
2. 如果信息不完整，向用户追问
3. 生成详细的待办事项列表
4. 按顺序执行任务
5. 分析结果并报告漏洞
6. 提供修复建议

你可以访问以下工具（通过函数调用）：
- nmap: 端口扫描和服务识别
- nikto: Web服务器漏洞扫描
- sqlmap: SQL注入检测
- gobuster: 目录和DNS爆破
- whatweb: Web技术识别
- testssl: SSL/TLS安全测试
- subfinder: 子域名发现
- httpx: HTTP探测
- nuclei: 基于模板的漏洞扫描
- wpscan: WordPress安全扫描

注意：在执行任何工具之前，确保目标已经明确指定。`;

  private initialized = false;
  
  private constructor() {}
  
  static getInstance(): SecurityAgent {
    if (!SecurityAgent.instance) {
      SecurityAgent.instance = new SecurityAgent();
    }
    return SecurityAgent.instance;
  }
  
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    
    logInfo('SecurityAgent', 'Initializing security agent...');
    
    // Initialize context manager
    await this.contextManager.initialize();
    
    // Check available model providers
    const providers = await this.modelManager.checkAllProviders();
    const availableProviders = Array.from(providers.entries())
      .filter(([, available]) => available)
      .map(([name]) => name);
    
    if (availableProviders.length === 0) {
      logWarn('SecurityAgent', 'No model providers available. Please start LMStudio or Ollama.');
    } else {
      logInfo('SecurityAgent', `Available model providers: ${availableProviders.join(', ')}`);
      
      // Switch to first available if current is not available
      const currentProvider = this.modelManager.getActiveProviderName();
      if (!providers.get(currentProvider)) {
        await this.modelManager.switchProvider(availableProviders[0]!);
      }
    }
    
    // Add system prompt to context
    this.contextManager.addMessage({
      role: 'system',
      content: this.systemPrompt
    });
    
    this.initialized = true;
    logInfo('SecurityAgent', 'Security agent initialized successfully');
  }
  
  async processMessage(userMessage: string): Promise<AgentResponse> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    logInfo('SecurityAgent', `Processing user message: ${userMessage.substring(0, 100)}...`);
    
    // Add user message to context
    this.contextManager.addMessage({
      role: 'user',
      content: userMessage
    });
    
    // Check and compress context if needed
    const compressionResult = await this.contextManager.checkAndCompressIfNeeded();
    if (compressionResult?.compressed) {
      logInfo('SecurityAgent', `Context compressed: ${Math.round(compressionResult.compressionRatio * 100)}% reduction`);
    }
    
    // Analyze requirements
    const analysis = await this.requirementAnalyzer.analyzeRequest(
      userMessage,
      this.contextManager.getMessages()
    );
    
    // Check for pending clarifications
    const pendingClarifications = this.requirementAnalyzer.getPendingClarifications();
    
    if (pendingClarifications.length > 0) {
      logInfo('SecurityAgent', `Need ${pendingClarifications.length} clarifications`);
      
      return this.buildResponse(
        this.generateClarificationResponse(pendingClarifications),
        undefined,
        pendingClarifications
      );
    }
    
    // Generate todo list if needed
    const activeTodo = this.todoManager.getActiveTodoList();
    if (!activeTodo && analysis.isComplete) {
      const todoPrompt = this.requirementAnalyzer.generateTodoListPrompt();
      const tools = this.toolRegistry.getInstalledToolDefinitions();
      
      const newTodoList = await this.todoManager.generateTodoListFromContext({
        context: todoPrompt,
        tools: tools.length > 0 ? tools : undefined
      });
      
      if (newTodoList) {
        this.todoManager.setActiveTodoList(newTodoList.id);
        logInfo('SecurityAgent', `Generated todo list: ${newTodoList.title}`);
      }
    }
    
    // Get available tools
    const tools = this.toolRegistry.getInstalledToolDefinitions();
    
    // Prepare messages for completion
    const messages = this.contextManager.prepareMessagesForCompletion();
    
    // Call model
    const response = await this.modelManager.chatCompletion({
      model: this.modelManager.getActiveAdapter().defaultModel,
      messages,
      tools: tools.length > 0 ? tools : undefined,
      max_tokens: 2048,
      temperature: 0.7
    });
    
    const choice = response.choices[0];
    if (!choice) {
      throw new Error('No response from model');
    }
    
    // Add assistant response to context
    const assistantMessage: Message = {
      role: 'assistant',
      content: choice.message.content || ''
    };
    
    if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
      assistantMessage.tool_calls = choice.message.tool_calls;
    }
    
    this.contextManager.addMessage(assistantMessage);
    
    // Handle tool calls
    const toolCalls = choice.message.tool_calls;
    let toolResults: Array<{
      toolCallId: string;
      toolName: string;
      result: string;
    }> = [];
    
    if (toolCalls && toolCalls.length > 0) {
      logInfo('SecurityAgent', `Model requested ${toolCalls.length} tool call(s)`);
      
      for (const toolCall of toolCalls) {
        const result = await this.executeToolCall(toolCall);
        toolResults.push({
          toolCallId: toolCall.id,
          toolName: toolCall.function.name,
          result
        });
        
        // Add tool result to context
        this.contextManager.addMessage({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
          content: result
        });
      }
    }
    
    // Check context again after adding responses
    await this.contextManager.checkAndCompressIfNeeded();
    
    return this.buildResponse(
      choice.message.content || '',
      toolCalls?.map(tc => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments)
      }))
    );
  }
  
  private async executeToolCall(toolCall: {
    id: string;
    function: { name: string; arguments: string };
  }): Promise<string> {
    const toolName = toolCall.function.name;
    let args: Record<string, unknown> = {};
    
    try {
      args = JSON.parse(toolCall.function.arguments);
    } catch (error) {
      logError('SecurityAgent', `Failed to parse tool arguments: ${toolCall.function.arguments}`, error);
      return `Error: Failed to parse arguments. Error: ${error}`;
    }
    
    logInfo('SecurityAgent', `Executing tool: ${toolName} with args: ${JSON.stringify(args)}`);
    
    try {
      const execution = await this.toolExecutor.executeTool(toolName, args, {
        onLog: (log) => {
          logDebug('SecurityAgent', `[${log.source}] ${log.message.substring(0, 100)}...`);
        }
      });
      
      // Analyze for vulnerabilities
      if (execution.status === 'completed') {
        // Try to extract target from arguments
        const target = this.extractTargetFromArgs(args) || 'unknown';
        await this.vulnerabilityAnalyzer.analyzeToolOutput(execution, target);
      }
      
      return `Tool execution ${execution.status}:\n` +
             `Exit Code: ${execution.exitCode}\n` +
             `Output:\n${String(execution.output || '(no output)')}\n` +
             (execution.error ? `Error:\n${execution.error}` : '');
    } catch (error) {
      logError('SecurityAgent', `Tool execution failed: ${toolName}`, error);
      return `Tool execution failed:\n${error instanceof Error ? error.message : String(error)}`;
    }
  }
  
  private extractTargetFromArgs(args: Record<string, unknown>): string | undefined {
    const targetKeys = ['target', 'host', 'url', 'domain', 'ip'];
    
    for (const key of targetKeys) {
      const value = args[key];
      if (value && typeof value === 'string') {
        return value;
      }
    }
    
    return undefined;
  }
  
  private generateClarificationResponse(
    clarifications: Array<{ id: string; question: string; options?: string[] }>
  ): string {
    let response = '我需要更多信息来帮助你完成这个任务：\n\n';
    
    clarifications.forEach((c, i) => {
      response += `${i + 1}. ${c.question}\n`;
      if (c.options && c.options.length > 0) {
        response += `   选项: ${c.options.join(', ')}\n`;
      }
      response += '\n';
    });
    
    response += '请提供上述信息，或者告诉我你想如何进行。';
    
    return response;
  }
  
  private buildResponse(
    content: string,
    toolCalls?: Array<{
      id: string;
      name: string;
      arguments: Record<string, unknown>;
    }>,
    clarifications?: Array<{
      id: string;
      question: string;
      options?: string[];
    }>
  ): AgentResponse {
    const contextInfo = this.contextManager.getContextInfo();
    const activeTodo = this.todoManager.getActiveTodoList();
    const vulnerabilities = this.vulnerabilityAnalyzer.getAllVulnerabilities();
    
    let todoListInfo: AgentResponse['todoList'] | undefined;
    
    if (activeTodo) {
      const progress = this.todoManager.getProgress(activeTodo.id);
      todoListInfo = {
        id: activeTodo.id,
        title: activeTodo.title,
        progress: {
          total: progress.total,
          completed: progress.completed,
          percentage: progress.percentage
        }
      };
    }
    
    return {
      content,
      toolCalls,
      contextInfo: {
        currentTokens: contextInfo.currentTokens,
        maxTokens: contextInfo.maxTokens,
        usagePercentage: contextInfo.currentTokens / contextInfo.maxTokens
      },
      todoList: todoListInfo,
      vulnerabilities: vulnerabilities.length > 0 ? vulnerabilities : undefined,
      clarifications
    };
  }
  
  async executeActiveTodoList(): Promise<boolean> {
    const activeTodo = this.todoManager.getActiveTodoList();
    if (!activeTodo) {
      logWarn('SecurityAgent', 'No active todo list to execute');
      return false;
    }
    
    logInfo('SecurityAgent', `Executing todo list: ${activeTodo.title}`);
    
    const tools = this.toolRegistry.getInstalledToolDefinitions();
    
    const success = await this.todoExecutor.executeList(activeTodo.id, {
      onItemStart: (item) => {
        logInfo('SecurityAgent', `Starting task: ${item.content}`);
      },
      onItemComplete: (item, result) => {
        logInfo('SecurityAgent', `Completed task: ${item.content}`);
        
        // Add result to context
        this.contextManager.addMessage({
          role: 'system',
          content: `Task completed: ${item.content}\nResult: ${result.result?.substring(0, 500) || '(no result)'}`
        });
      },
      onItemFail: (item, error) => {
        logError('SecurityAgent', `Task failed: ${item.content}`, error);
        
        this.contextManager.addMessage({
          role: 'system',
          content: `Task failed: ${item.content}\nError: ${error.message}`
        });
      },
      onProgress: (progress) => {
        logInfo('SecurityAgent', `Progress: ${progress.percentage}% (${progress.current}/${progress.total})`);
      },
      onListComplete: (list) => {
        logInfo('SecurityAgent', `Todo list complete: ${list.title}`);
      }
    }, tools);
    
    return success;
  }
  
  async answerClarification(clarificationId: string, answer: string): Promise<AgentResponse> {
    const analysis = await this.requirementAnalyzer.answerClarification(clarificationId, answer);
    
    if (!analysis) {
      return this.buildResponse('未找到对应的澄清问题。请重新提供信息。');
    }
    
    // Add to context
    this.contextManager.addMessage({
      role: 'user',
      content: answer
    });
    
    this.contextManager.addMessage({
      role: 'assistant',
      content: '收到，我已经记录了这些信息。'
    });
    
    const pending = this.requirementAnalyzer.getPendingClarifications();
    
    if (pending.length > 0) {
      return this.buildResponse(
        this.generateClarificationResponse(pending),
        undefined,
        pending
      );
    }
    
    // All clarifications answered, generate todo list
    const todoPrompt = this.requirementAnalyzer.generateTodoListPrompt();
    const tools = this.toolRegistry.getInstalledToolDefinitions();
    
    const todoList = await this.todoManager.generateTodoListFromContext({
      context: todoPrompt,
      tools: tools.length > 0 ? tools : undefined
    });
    
    if (todoList) {
      this.todoManager.setActiveTodoList(todoList.id);
    }
    
    return this.buildResponse(
      '好的，我已经收集到了所有需要的信息。我已经为你生成了一个任务计划。' +
      (todoList ? `\n\n任务计划: ${todoList.title}\n包含 ${todoList.items.length} 个任务。` : '')
    );
  }
  
  getContextStatus(): string {
    return this.contextManager.getStatusDisplay();
  }
  
  getVulnerabilities(): Vulnerability[] {
    return this.vulnerabilityAnalyzer.getAllVulnerabilities();
  }
  
  clearContext(): void {
    this.contextManager.clearMessages();
    this.vulnerabilityAnalyzer.clearVulnerabilities();
    this.todoManager.clearAll();
    this.requirementAnalyzer.clearCurrentAnalysis();
    
    // Re-add system prompt
    this.contextManager.addMessage({
      role: 'system',
      content: this.systemPrompt
    });
    
    logInfo('SecurityAgent', 'Context cleared');
  }
}

export function getSecurityAgent(): SecurityAgent {
  return SecurityAgent.getInstance();
}
