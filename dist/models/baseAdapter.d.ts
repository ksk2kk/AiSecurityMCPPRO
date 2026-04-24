import { AxiosInstance } from 'axios';
import { ModelAdapter, ChatCompletionRequest, ChatCompletionResponse, ModelInfo, ModelCapabilities } from './types';
import { ModelProvider, ToolCall } from '../types';
export declare abstract class BaseOpenAIAdapter implements ModelAdapter {
    readonly name: string;
    readonly type: 'lmstudio' | 'ollama' | 'openai' | 'anthropic';
    readonly baseUrl: string;
    readonly defaultModel: string;
    readonly apiKey?: string;
    protected readonly client: AxiosInstance;
    constructor(provider: ModelProvider);
    abstract isAvailable(): Promise<boolean>;
    getModels(): Promise<ModelInfo[]>;
    abstract getModelCapabilities(model?: string): Promise<ModelCapabilities>;
    chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
    chatCompletionStream(request: ChatCompletionRequest): AsyncIterable<{
        content?: string;
        tool_calls?: ToolCall[];
        finish_reason?: string;
    }>;
    abstract getContextWindow(model?: string): Promise<number>;
    protected normalizeError(error: unknown): Error;
}
//# sourceMappingURL=baseAdapter.d.ts.map