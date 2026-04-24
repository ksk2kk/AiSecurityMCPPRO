import { ModelAdapter, ChatCompletionRequest, ChatCompletionResponse, ModelInfo, ModelCapabilities, ChatCompletionResult, ChatCompletionUsage } from './types';
import { ModelProvider, ToolCall } from '../types';
export declare class ModelManager {
    private adapters;
    private activeAdapterName;
    constructor();
    private initializeAdapters;
    private createAdapter;
    getActiveAdapter(): ModelAdapter;
    getAdapter(name: string): ModelAdapter | undefined;
    getAvailableAdapters(): string[];
    switchProvider(providerName: string): Promise<boolean>;
    checkAllProviders(): Promise<Map<string, boolean>>;
    getAvailableModels(): Promise<ModelInfo[]>;
    getModelCapabilities(model?: string): Promise<ModelCapabilities>;
    getContextWindow(model?: string): Promise<number>;
    chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
    chatCompletionWithUsage(request: ChatCompletionRequest): Promise<ChatCompletionResult>;
    chatCompletionStream(request: ChatCompletionRequest): AsyncIterable<{
        content?: string;
        tool_calls?: ToolCall[];
        finish_reason?: string;
        usage?: ChatCompletionUsage;
    }>;
    addProvider(provider: ModelProvider): void;
    removeProvider(providerName: string): void;
    getActiveProviderName(): string;
}
export declare function getModelManager(): ModelManager;
//# sourceMappingURL=modelManager.d.ts.map