import { ToolChain, ToolExecution, LogEntry } from '../types';
export interface ToolExecutionOptions {
    timeout?: number;
    workingDirectory?: string;
    env?: Record<string, string>;
    onLog?: (log: LogEntry) => void;
    onOutput?: (data: string) => void;
    onError?: (data: string) => void;
}
export interface InstallationProgress {
    toolName: string;
    phase: 'checking' | 'downloading' | 'installing' | 'verifying' | 'complete' | 'failed';
    message: string;
    progress?: number;
}
export declare class ToolExecutor {
    private static instance;
    private toolRegistry;
    private activeExecutions;
    private executionHistory;
    private constructor();
    static getInstance(): ToolExecutor;
    checkToolInstalled(tool: ToolChain): Promise<{
        installed: boolean;
        version?: string;
    }>;
    installTool(tool: ToolChain, onProgress?: (progress: InstallationProgress) => void): Promise<boolean>;
    updateTool(tool: ToolChain, onProgress?: (progress: InstallationProgress) => void): Promise<boolean>;
    installAllTools(onProgress?: (progress: InstallationProgress, index: number, total: number) => void): Promise<{
        installed: number;
        failed: number;
        total: number;
    }>;
    executeTool(toolName: string, args: Record<string, unknown>, options?: ToolExecutionOptions): Promise<ToolExecution>;
    private buildCommand;
    private formatArgument;
    private parseOutput;
    private executeCommand;
    getActiveExecutions(): ToolExecution[];
    getExecutionHistory(): ToolExecution[];
    getExecution(id: string): ToolExecution | undefined;
    cancelExecution(id: string): boolean;
}
export declare function getToolExecutor(): ToolExecutor;
//# sourceMappingURL=toolExecutor.d.ts.map