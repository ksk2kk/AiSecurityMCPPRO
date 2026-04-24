import { UserClarification, Message } from '../types';
export interface RequirementAnalysis {
    id: string;
    originalRequest: string;
    targets: string[];
    scanType: 'full' | 'recon' | 'vulnerability' | 'exploit' | 'custom';
    requiredTools: string[];
    depth: 'quick' | 'standard' | 'deep';
    timeConstraints?: number;
    riskTolerance: 'low' | 'medium' | 'high';
    constraints: string[];
    clarificationsNeeded: UserClarification[];
    isComplete: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface ClarificationQuestion {
    id: string;
    question: string;
    type: 'target' | 'scope' | 'timing' | 'risk' | 'tools' | 'other';
    options?: string[];
    context: string;
}
export declare class RequirementAnalyzer {
    private static instance;
    private modelManager;
    private toolRegistry;
    private currentAnalysis?;
    private analysisHistory;
    private constructor();
    static getInstance(): RequirementAnalyzer;
    analyzeRequest(userRequest: string, contextMessages?: Message[]): Promise<RequirementAnalysis>;
    private parseAnalysisResponse;
    private extractTargetsFromText;
    getCurrentAnalysis(): RequirementAnalysis | undefined;
    answerClarification(clarificationId: string, answer: string): Promise<RequirementAnalysis | null>;
    skipClarification(clarificationId: string): boolean;
    needsClarification(): boolean;
    getPendingClarifications(): UserClarification[];
    generateTodoListPrompt(): string;
    getAnalysisHistory(): RequirementAnalysis[];
    clearCurrentAnalysis(): void;
}
export declare function getRequirementAnalyzer(): RequirementAnalyzer;
//# sourceMappingURL=requirementAnalyzer.d.ts.map