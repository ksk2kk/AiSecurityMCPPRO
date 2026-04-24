import { Message, ContextInfo, ContextCompressionRule } from '../types';
export interface CompressionResult {
    messages: Message[];
    compressed: boolean;
    summary?: string;
    compressionRatio: number;
    originalTokens: number;
    compressedTokens: number;
}
export declare class ContextManager {
    private static instance;
    private tokenCounter;
    private modelManager;
    private messages;
    private summary;
    private lastCompressedAt?;
    private maxContextTokens;
    private warningThreshold;
    private constructor();
    static getInstance(): ContextManager;
    private initializeFromConfig;
    initialize(): Promise<void>;
    getMessages(): Message[];
    addMessage(message: Message): void;
    addMessages(messages: Message[]): void;
    clearMessages(): void;
    getContextInfo(): ContextInfo;
    getCurrentTokenCount(): number;
    getMaxContextTokens(): number;
    getAvailableTokens(reserveForOutput?: number): number;
    getUsagePercentage(): number;
    isNearLimit(): boolean;
    isOverLimit(): boolean;
    getStatusDisplay(): string;
    checkAndCompressIfNeeded(): Promise<CompressionResult | null>;
    compress(rule: ContextCompressionRule): Promise<CompressionResult>;
    private generateSummary;
    prepareMessagesForCompletion(maxTokens?: number, reserveOutput?: number): Message[];
    updateMaxContextTokens(newMax: number): void;
}
export declare function getContextManager(): ContextManager;
//# sourceMappingURL=contextManager.d.ts.map