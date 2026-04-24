import { BaseOpenAIAdapter } from './baseAdapter';
import { ModelCapabilities, ModelAdapter } from './types';
import { ModelProvider } from '../types';
export declare class LMStudioAdapter extends BaseOpenAIAdapter implements ModelAdapter {
    private cachedContextWindow;
    private cachedCapabilities;
    constructor(provider: ModelProvider);
    isAvailable(): Promise<boolean>;
    getModelCapabilities(model?: string): Promise<ModelCapabilities>;
    getContextWindow(model?: string): Promise<number>;
    detectModelContextWindow(): Promise<number>;
    private generateTestMessage;
    clearCache(): void;
}
//# sourceMappingURL=lmstudioAdapter.d.ts.map