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
import { getI18n } from '../i18n';
import { ChatCompletionUsage } from '../models/types';
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
    actualUsage?: ChatCompletionUsage;
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

const systemPrompts: Record<string, string> = {
  zh: `你是一个专业的安全专家AI助手，专注于漏洞挖掘和安全评估。

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

重要：当用户明确指定目标并要求执行扫描时，直接使用工具调用，不要追问额外信息。
注意：在执行任何工具之前，确保目标已经明确指定。`,

  en: `You are a professional security expert AI assistant focused on vulnerability mining and security assessment.

Your core capabilities:
1. Automatically analyze user requirements and generate detailed task plans
2. Use various security tools for scanning and testing
3. Automatically manage conversation context, including compression and summarization
4. Display context usage in real-time
5. Proactively ask users when information is insufficient
6. Detect and report vulnerabilities

Working principles:
- Security first: In safe mode, only perform non-intrusive scans
- Precision: Use available tools and interpret results correctly
- Transparency: Show what you're doing and why
- Proactive: Ask for more information when needed
- Responsible: Do not perform dangerous operations unless explicitly authorized

When a user requests a security scan:
1. First analyze requirements, identify targets and scan type
2. If information is incomplete, ask the user for clarification
3. Generate a detailed todo list
4. Execute tasks in order
5. Analyze results and report vulnerabilities
6. Provide remediation suggestions

You have access to the following tools (via function calls):
- nmap: Port scanning and service identification
- nikto: Web server vulnerability scanning
- sqlmap: SQL injection detection
- gobuster: Directory and DNS busting
- whatweb: Web technology identification
- testssl: SSL/TLS security testing
- subfinder: Subdomain discovery
- httpx: HTTP probing
- nuclei: Template-based vulnerability scanning
- wpscan: WordPress security scanning

Important: When user explicitly specifies target and asks to perform scan, use tool calls directly, do not ask for extra information.
Note: Before executing any tool, ensure the target is clearly specified.`
};

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
  private i18n = getI18n();
  
  private initialized = false;
  private lastActualUsage?: ChatCompletionUsage;
  
  private constructor() {}
  
  static getInstance(): SecurityAgent {
    if (!SecurityAgent.instance) {
      SecurityAgent.instance = new SecurityAgent();
    }
    return SecurityAgent.instance;
  }
  
  private getSystemPrompt(): string {
    const lang = this.i18n.getLanguage();
    return systemPrompts[lang] || systemPrompts['en'];
  }
  
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    
    logInfo('SecurityAgent', 'Initializing security agent...');
    
    await this.contextManager.initialize();
    
    const providers = await this.modelManager.checkAllProviders();
    const availableProviders = Array.from(providers.entries())
      .filter(([, available]) => available)
      .map(([name]) => name);
    
    if (availableProviders.length === 0) {
      logWarn('SecurityAgent', 'No model providers available. Please start LMStudio or Ollama.');
    } else {
      logInfo('SecurityAgent', `Available model providers: ${availableProviders.join(', ')}`);
      
      const currentProvider = this.modelManager.getActiveProviderName();
      if (!providers.get(currentProvider)) {
        await this.modelManager.switchProvider(availableProviders[0]!);
      }
    }
    
    this.contextManager.addMessage({
      role: 'system',
      content: this.getSystemPrompt()
    });
    
    this.initialized = true;
    logInfo('SecurityAgent', 'Security agent initialized successfully');
  }
  
  async processMessage(userMessage: string): Promise<AgentResponse> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    logInfo('SecurityAgent', `Processing user message: ${userMessage.substring(0, 100)}...`);
    
    const pendingClarifications = this.requirementAnalyzer.getPendingClarifications();
    
    if (pendingClarifications.length > 0) {
      logInfo('SecurityAgent', `Answering clarification for previous request`);
      return await this.answerClarificationInternal(userMessage);
    }
    
    if (this.shouldTriggerRequirementAnalysis(userMessage)) {
      logInfo('SecurityAgent', 'Detected new security scan request, triggering requirement analysis');
      return await this.processWithRequirementAnalysis(userMessage);
    }
    
    this.contextManager.addMessage({
      role: 'user',
      content: userMessage
    });
    
    await this.contextManager.checkAndCompressIfNeeded();
    
    return await this.runModelInteractionLoop();
  }
  
  private shouldTriggerRequirementAnalysis(message: string): boolean {
    const lowerMsg = message.toLowerCase();
    
    const scanKeywords = [
      'scan', '扫描',
      'penetration', '渗透',
      'vulnerability', '漏洞',
      'security', '安全',
      'audit', '审计',
      'test', '测试',
      '检查', 'check',
      '检测', 'detect'
    ];
    
    for (const keyword of scanKeywords) {
      if (lowerMsg.includes(keyword)) {
        return true;
      }
    }
    
    if (this.looksLikeTarget(message)) {
      return true;
    }
    
    return false;
  }
  
  private looksLikeTarget(message: string): boolean {
    const ipPattern = /\b(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2})?\b/;
    if (ipPattern.test(message)) {
      return true;
    }
    
    const domainPattern = /\b[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?\b/;
    if (domainPattern.test(message)) {
      const match = message.match(domainPattern);
      if (match) {
        const domain = match[0].toLowerCase();
        if (!domain.endsWith('.txt') && 
            !domain.endsWith('.json') && 
            !domain.endsWith('.log') &&
            !domain.endsWith('.js') &&
            !domain.endsWith('.css') &&
            !domain.endsWith('.html')) {
          return true;
        }
      }
    }
    
    const urlPattern = /https?:\/\//;
    if (urlPattern.test(message)) {
      return true;
    }
    
    return false;
  }
  
  private async processWithRequirementAnalysis(userMessage: string): Promise<AgentResponse> {
    this.contextManager.addMessage({
      role: 'user',
      content: userMessage
    });
    
    await this.contextManager.checkAndCompressIfNeeded();
    
    const analysis = await this.requirementAnalyzer.analyzeRequest(
      userMessage,
      this.contextManager.getMessages()
    );
    
    const pendingClarifications = this.requirementAnalyzer.getPendingClarifications();
    
    if (pendingClarifications.length > 0) {
      logInfo('SecurityAgent', `Need ${pendingClarifications.length} clarifications`);
      
      return this.buildResponse(
        this.generateClarificationResponse(pendingClarifications),
        undefined,
        pendingClarifications
      );
    }
    
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
    
    return await this.runModelInteractionLoop();
  }
  
  private async answerClarificationInternal(answer: string): Promise<AgentResponse> {
    const pendingClarifications = this.requirementAnalyzer.getPendingClarifications();
    
    if (pendingClarifications.length === 0) {
      return await this.processMessage(answer);
    }
    
    const clarification = pendingClarifications[0];
    
    const analysis = await this.requirementAnalyzer.answerClarification(clarification.id, answer);
    const isChinese = this.i18n.isChinese();
    
    if (!analysis) {
      const msg = isChinese 
        ? '未找到对应的澄清问题。请重新提供信息。'
        : 'No matching clarification found. Please provide information again.';
      return this.buildResponse(msg);
    }
    
    this.contextManager.addMessage({
      role: 'user',
      content: answer
    });
    
    this.contextManager.addMessage({
      role: 'assistant',
      content: isChinese ? '收到，我已经记录了这些信息。' : 'Received, I have recorded this information.'
    });
    
    const stillPending = this.requirementAnalyzer.getPendingClarifications();
    
    if (stillPending.length > 0) {
      return this.buildResponse(
        this.generateClarificationResponse(stillPending),
        undefined,
        stillPending
      );
    }
    
    const todoPrompt = this.requirementAnalyzer.generateTodoListPrompt();
    const tools = this.toolRegistry.getInstalledToolDefinitions();
    
    const todoList = await this.todoManager.generateTodoListFromContext({
      context: todoPrompt,
      tools: tools.length > 0 ? tools : undefined
    });
    
    if (todoList) {
      this.todoManager.setActiveTodoList(todoList.id);
    }
    
    return await this.runModelInteractionLoop();
  }
  
  private async runModelInteractionLoop(): Promise<AgentResponse> {
    const maxIterations = 10;
    let iterations = 0;
    let finalContent = '';
    let finalToolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }> | undefined;
    
    while (iterations < maxIterations) {
      iterations++;
      logInfo('SecurityAgent', `Model interaction loop - iteration ${iterations}`);
      
      const tools = this.toolRegistry.getAllToolDefinitions();
      const messages = this.contextManager.prepareMessagesForCompletion();
      
      const result = await this.modelManager.chatCompletionWithUsage({
        model: this.modelManager.getActiveAdapter().defaultModel,
        messages,
        tools: tools.length > 0 ? tools : undefined,
        max_tokens: 2048,
        temperature: 0.7
      });
      
      this.lastActualUsage = result.usage;
      
      if (result.usage) {
        logInfo('SecurityAgent', `API actual usage: prompt=${result.usage.prompt_tokens}, completion=${result.usage.completion_tokens}, total=${result.usage.total_tokens}`);
      }
      
      const choice = result.response.choices[0];
      if (!choice) {
        throw new Error('No response from model');
      }
      
      finalContent = result.content;
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: result.content || ''
      };
      
      if (result.toolCalls && result.toolCalls.length > 0) {
        assistantMessage.tool_calls = result.toolCalls;
        finalToolCalls = result.toolCalls.map(tc => ({
          id: tc.id,
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments || '{}')
        }));
      }
      
      this.contextManager.addMessage(assistantMessage);
      
      const toolCalls = result.toolCalls;
      
      if (toolCalls && toolCalls.length > 0) {
        logInfo('SecurityAgent', `Model requested ${toolCalls.length} tool call(s)`);
        
        for (const toolCall of toolCalls) {
          const toolResult = await this.executeToolCall(toolCall);
          
          this.contextManager.addMessage({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: toolResult
          });
        }
        
        await this.contextManager.checkAndCompressIfNeeded();
        
        continue;
      }
      
      break;
    }
    
    if (iterations >= maxIterations) {
      logWarn('SecurityAgent', 'Reached max iterations in model interaction loop');
    }
    
    return this.buildResponse(finalContent, finalToolCalls);
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
        },
        onOutput: (data) => {
          logDebug('SecurityAgent', `[${toolName}] ${data.substring(0, 100)}...`);
        }
      });
      
      if (execution.status === 'completed') {
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
    const isChinese = this.i18n.isChinese();
    
    let response = isChinese 
      ? '我需要更多信息来帮助你完成这个任务：\n\n'
      : 'I need more information to help you complete this task:\n\n';
    
    clarifications.forEach((c, i) => {
      response += `${i + 1}. ${c.question}\n`;
      if (c.options && c.options.length > 0) {
        response += isChinese 
          ? `   选项: ${c.options.join(', ')}\n`
          : `   Options: ${c.options.join(', ')}\n`;
      }
      response += '\n';
    });
    
    response += isChinese
      ? '请提供上述信息，或者告诉我你想如何进行。'
      : 'Please provide the above information, or tell me how you want to proceed.';
    
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
    
    let currentTokens = contextInfo.currentTokens;
    let maxTokens = contextInfo.maxTokens;
    
    if (this.lastActualUsage) {
      currentTokens = this.lastActualUsage.total_tokens;
    }
    
    return {
      content,
      toolCalls,
      contextInfo: {
        currentTokens,
        maxTokens,
        usagePercentage: currentTokens / maxTokens,
        actualUsage: this.lastActualUsage
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
    
    const tools = this.toolRegistry.getAllToolDefinitions();
    
    const success = await this.todoExecutor.executeList(activeTodo.id, {
      onItemStart: (item) => {
        logInfo('SecurityAgent', `Starting task: ${item.content}`);
      },
      onItemComplete: (item, result) => {
        logInfo('SecurityAgent', `Completed task: ${item.content}`);
        
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
    const isChinese = this.i18n.isChinese();
    
    if (!analysis) {
      const msg = isChinese 
        ? '未找到对应的澄清问题。请重新提供信息。'
        : 'No matching clarification found. Please provide information again.';
      return this.buildResponse(msg);
    }
    
    this.contextManager.addMessage({
      role: 'user',
      content: answer
    });
    
    this.contextManager.addMessage({
      role: 'assistant',
      content: isChinese ? '收到，我已经记录了这些信息。' : 'Received, I have recorded this information.'
    });
    
    const pending = this.requirementAnalyzer.getPendingClarifications();
    
    if (pending.length > 0) {
      return this.buildResponse(
        this.generateClarificationResponse(pending),
        undefined,
        pending
      );
    }
    
    const todoPrompt = this.requirementAnalyzer.generateTodoListPrompt();
    const tools = this.toolRegistry.getInstalledToolDefinitions();
    
    const todoList = await this.todoManager.generateTodoListFromContext({
      context: todoPrompt,
      tools: tools.length > 0 ? tools : undefined
    });
    
    if (todoList) {
      this.todoManager.setActiveTodoList(todoList.id);
    }
    
    return await this.runModelInteractionLoop();
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
    this.lastActualUsage = undefined;
    
    this.contextManager.addMessage({
      role: 'system',
      content: this.getSystemPrompt()
    });
    
    logInfo('SecurityAgent', 'Context cleared');
  }
}

export function getSecurityAgent(): SecurityAgent {
  return SecurityAgent.getInstance();
}
