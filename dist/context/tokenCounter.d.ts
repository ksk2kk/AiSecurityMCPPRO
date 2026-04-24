import { Message } from '../types';
export declare class TokenCounter {
    private static instance;
    private constructor();
    static getInstance(): TokenCounter;
    countTokens(text: string): number;
    countMessage(message: Message): number;
    countMessages(messages: Message[]): number;
    estimateMaxMessagesForTokens(messages: Message[], maxTokens: number, reserveTokens?: number): Message[];
    private truncateMessageToTokens;
}
export declare function getTokenCounter(): TokenCounter;
//# sourceMappingURL=tokenCounter.d.ts.map