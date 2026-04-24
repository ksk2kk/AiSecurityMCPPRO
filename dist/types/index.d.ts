export interface Message {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    name?: string;
    tool_calls?: ToolCall[];
    tool_call_id?: string;
}
export interface ToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string;
    };
}
export interface ToolDefinition {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: {
            type: 'object';
            properties: Record<string, unknown>;
            required?: string[];
        };
    };
}
export interface ModelProvider {
    name: string;
    type: 'lmstudio' | 'ollama' | 'openai' | 'anthropic';
    baseUrl: string;
    apiKey?: string;
    defaultModel: string;
    maxContextWindow: number;
    maxOutputTokens: number;
}
export interface ContextInfo {
    currentTokens: number;
    maxTokens: number;
    compressionRatio: number;
    lastCompressedAt?: Date;
    summary?: string;
}
export interface TodoItem {
    id: string;
    content: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    priority: 'high' | 'medium' | 'low';
    createdAt: Date;
    completedAt?: Date;
    dependencies?: string[];
    tool?: string;
    toolArguments?: Record<string, unknown>;
    result?: string;
    error?: string;
}
export interface TodoList {
    id: string;
    title: string;
    description: string;
    items: TodoItem[];
    createdAt: Date;
    updatedAt: Date;
    status: 'active' | 'paused' | 'completed' | 'failed';
}
export interface ToolChain {
    id: string;
    name: string;
    description: string;
    category: 'scanner' | 'exploit' | 'recon' | 'analysis' | 'other';
    version: string;
    source: 'github' | 'pip' | 'npm' | 'apt' | 'chocolatey' | 'custom';
    installCommand?: string;
    checkCommand: string;
    executeCommand: string;
    arguments: ToolArgument[];
    outputParser: OutputParser;
    dependencies?: string[];
    installed: boolean;
    lastUpdated?: Date;
}
export interface ToolArgument {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    description: string;
    required: boolean;
    default?: unknown;
    options?: string[];
}
export interface OutputParser {
    type: 'json' | 'regex' | 'xml' | 'csv' | 'custom';
    pattern?: string;
    fields?: string[];
}
export interface ToolExecution {
    id: string;
    toolId: string;
    toolName: string;
    arguments: Record<string, unknown>;
    startTime: Date;
    endTime?: Date;
    status: 'pending' | 'running' | 'completed' | 'failed';
    logs: LogEntry[];
    output?: unknown;
    error?: string;
    exitCode?: number;
}
export interface LogEntry {
    timestamp: Date;
    level: 'debug' | 'info' | 'warn' | 'error';
    source: string;
    message: string;
    data?: unknown;
}
export interface Vulnerability {
    id: string;
    name: string;
    cveId?: string;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    description: string;
    affectedTarget: string;
    affectedComponent?: string;
    proofOfConcept?: string;
    remediation?: string;
    references?: string[];
    discoveredAt: Date;
    discoveredBy: string;
    status: 'new' | 'confirmed' | 'exploited' | 'remediated' | 'false_positive';
    cvssScore?: number;
    cvssVector?: string;
}
export interface ScanResult {
    id: string;
    target: string;
    scanType: string;
    toolUsed: string;
    startTime: Date;
    endTime: Date;
    status: 'completed' | 'failed' | 'partial';
    vulnerabilities: Vulnerability[];
    rawOutput: string;
    summary: string;
}
export interface ContextCompressionRule {
    id: string;
    name: string;
    description: string;
    triggerThreshold: number;
    compressionRatio: number;
    preserveSystemMessages: boolean;
    preserveRecentMessages: number;
    enabled: boolean;
}
export interface UserClarification {
    id: string;
    question: string;
    context: string;
    options?: string[];
    answer?: string;
    askedAt: Date;
    answeredAt?: Date;
    status: 'pending' | 'answered' | 'skipped';
}
export interface SystemConfig {
    modelProviders: ModelProvider[];
    activeProvider: string;
    contextWindow: {
        maxTokens: number;
        warningThreshold: number;
        autoCompression: boolean;
        compressionRules: ContextCompressionRule[];
    };
    todoList: {
        autoGenerate: boolean;
        maxConcurrentTasks: number;
        retryOnFailure: boolean;
        maxRetries: number;
    };
    toolChain: {
        autoInstall: boolean;
        autoUpdate: boolean;
        logLevel: 'debug' | 'info' | 'warn' | 'error';
        maxExecutionTime: number;
        toolsDirectory: string;
    };
    security: {
        safeMode: boolean;
        allowDangerousTools: boolean;
        maxExploitAttempts: number;
        targetWhitelist?: string[];
    };
    ui: {
        showContextLength: boolean;
        showTokenCount: boolean;
        colorOutput: boolean;
    };
}
export interface ConversationState {
    id: string;
    messages: Message[];
    contextInfo: ContextInfo;
    todoLists: TodoList[];
    activeTodoList?: string;
    toolExecutions: ToolExecution[];
    vulnerabilities: Vulnerability[];
    clarifications: UserClarification[];
    createdAt: Date;
    updatedAt: Date;
    metadata: Record<string, unknown>;
}
//# sourceMappingURL=index.d.ts.map