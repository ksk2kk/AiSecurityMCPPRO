import { ModelAdapter, ChatCompletionRequest, ChatCompletionResponse, ModelInfo, ModelCapabilities } from './types';
import { ModelProvider } from '../types';
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
    chatCompletionStream(request: ChatCompletionRequest): AsyncIterable<{
        content?: string;
        tool_calls?: unknown[];
        finish_reason?: string;
    }>;
    addProvider(provider: ModelProvider): void;
    removeProvider(providerName: string): void;
    getActiveProviderName(): string;
}
export declare function getModelManager(): ModelManager;
//# sourceMappingURL=modelManager.d.ts.map