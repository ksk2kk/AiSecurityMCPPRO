import { Message, ToolDefinition, ToolCall } from '../types';
export interface ChatCompletionRequest {
    model: string;
    messages: Message[];
    tools?: ToolDefinition[];
    tool_choice?: 'auto' | 'none' | {
        type: 'function';
        function: {
            name: string;
        };
    };
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
    stop?: string | string[];
    stream?: boolean;
}
export interface ChatCompletionChoice {
    index: number;
    message: {
        role: 'assistant';
        content: string | null;
        tool_calls?: ToolCall[];
    };
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
}
export interface ChatCompletionResponse {
    id: string;
    object: 'chat.completion';
    created: number;
    model: string;
    choices: ChatCompletionChoice[];
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
    system_fingerprint?: string;
}
export interface ModelInfo {
    id: string;
    name: string;
    object: 'model';
    created: number;
    owned_by: string;
    permission: unknown[];
    root: string;
    parent: string | null;
}
export interface ModelsResponse {
    object: 'list';
    data: ModelInfo[];
}
export interface ModelCapabilities {
    supportsTools: boolean;
    supportsStreaming: boolean;
    supportsFunctionCalling: boolean;
    supportsVision: boolean;
    maxContextWindow: number;
    maxOutputTokens: number;
}
export interface ModelAdapter {
    readonly name: string;
    readonly type: 'lmstudio' | 'ollama' | 'openai' | 'anthropic';
    readonly baseUrl: string;
    readonly defaultModel: string;
    isAvailable(): Promise<boolean>;
    getModels(): Promise<ModelInfo[]>;
    getModelCapabilities(model?: string): Promise<ModelCapabilities>;
    chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
    chatCompletionStream(request: ChatCompletionRequest): AsyncIterable<{
        content?: string;
        tool_calls?: ToolCall[];
        finish_reason?: string;
    }>;
    getContextWindow(model?: string): Promise<number>;
}
//# sourceMappingURL=types.d.ts.map