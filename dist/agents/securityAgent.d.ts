import { Vulnerability } from '../types';
import { ChatCompletionUsage } from '../models/types';
export interface AgentResponse {
    content: string;
    toolCalls?: Array<{
        id: string;
        name: string;
        arguments: Record<string, unknown>;
    }>;
    contextInfo: {
        currentTokens: number;
        maxTokens: number;
        usagePercentage: number;
        actualUsage?: ChatCompletionUsage;
    };
    todoList?: {
        id: string;
        title: string;
        progress: {
            total: number;
            completed: number;
            percentage: number;
        };
    };
    vulnerabilities?: Vulnerability[];
    clarifications?: Array<{
        id: string;
        question: string;
        options?: string[];
    }>;
}
export declare class SecurityAgent {
    private static instance;
    private modelManager;
    private contextManager;
    private todoManager;
    private todoExecutor;
    private toolRegistry;
    private toolExecutor;
    private vulnerabilityAnalyzer;
    private requirementAnalyzer;
    private i18n;
    private initialized;
    private lastActualUsage?;
    private constructor();
    static getInstance(): SecurityAgent;
    private getSystemPrompt;
    initialize(): Promise<void>;
    processMessage(userMessage: string): Promise<AgentResponse>;
    private shouldTriggerRequirementAnalysis;
    private looksLikeTarget;
    private processWithRequirementAnalysis;
    private answerClarificationInternal;
    private runModelInteractionLoop;
    private executeToolCall;
    private extractTargetFromArgs;
    private generateClarificationResponse;
    private buildResponse;
    executeActiveTodoList(): Promise<boolean>;
    answerClarification(clarificationId: string, answer: string): Promise<AgentResponse>;
    getContextStatus(): string;
    getVulnerabilities(): Vulnerability[];
    clearContext(): void;
}
export declare function getSecurityAgent(): SecurityAgent;
//# sourceMappingURL=securityAgent.d.ts.map