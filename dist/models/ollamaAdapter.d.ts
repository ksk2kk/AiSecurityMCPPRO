import { BaseOpenAIAdapter } from './baseAdapter';
import { ModelCapabilities, ModelAdapter, ModelInfo } from './types';
import { ModelProvider } from '../types';
export declare class OllamaAdapter extends BaseOpenAIAdapter implements ModelAdapter {
    private cachedContextWindow;
    private cachedCapabilities;
    constructor(provider: ModelProvider);
    isAvailable(): Promise<boolean>;
    getModels(): Promise<ModelInfo[]>;
    getModelCapabilities(model?: string): Promise<ModelCapabilities>;
    getContextWindow(model?: string): Promise<number>;
    private getOllamaModelInfo;
    private detectContextWindowFromFamily;
    clearCache(): void;
}
//# sourceMappingURL=ollamaAdapter.d.ts.map