import { SystemConfig, ModelProvider } from '../types';
export declare function getConfig(): SystemConfig;
export declare function loadConfig(): SystemConfig;
export declare function saveConfig(newConfig?: Partial<SystemConfig>): void;
export declare function getActiveProvider(): ModelProvider;
export declare function updateActiveProvider(providerName: string): void;
export declare function addModelProvider(provider: ModelProvider): void;
export declare function removeModelProvider(providerName: string): void;
//# sourceMappingURL=index.d.ts.map