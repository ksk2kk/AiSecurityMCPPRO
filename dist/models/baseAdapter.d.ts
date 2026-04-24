import { AxiosInstance } from 'axios';
import { ModelAdapter, ChatCompletionRequest, ChatCompletionResponse, ModelInfo, ModelCapabilities, ChatCompletionUsage, ChatCompletionResult } from './types';
import { ModelProvider, ToolCall } from '../types';
export declare abstract class BaseOpenAIAdapter implements ModelAdapter {
    readonly name: string;
    readonly type: 'lmstudio' | 'ollama' | 'openai' | 'anthropic';
    readonly baseUrl: string;
    readonly defaultModel: string;
    readonly apiKey?: string;
    protected readonly client: AxiosInstance;
    private lastUsage?;
    constructor(provider: ModelProvider);
    abstract isAvailable(): Promise<boolean>;
    getModels(): Promise<ModelInfo[]>;
    abstract getModelCapabilities(model?: string): Promise<ModelCapabilities>;
    chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
    chatCompletionWithUsage(request: ChatCompletionRequest): Promise<ChatCompletionResult>;
    chatCompletionStream(request: ChatCompletionRequest): AsyncIterable<{
        content?: string;
        tool_calls?: ToolCall[];
        finish_reason?: string;
        usage?: ChatCompletionUsage;
    }>;
    getLastUsage(): ChatCompletionUsage | undefined;
    abstract getContextWindow(model?: string): Promise<number>;
    protected normalizeError(error: unknown): Error;
}
//# sourceMappingURL=baseAdapter.d.ts.map