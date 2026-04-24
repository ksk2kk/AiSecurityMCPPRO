import { TodoItem, TodoList, ToolDefinition } from '../types';
import { TodoExecutionResult } from './todoManager';
export interface ExecutionCallbacks {
    onItemStart?: (item: TodoItem) => void;
    onItemComplete?: (item: TodoItem, result: TodoExecutionResult) => void;
    onItemFail?: (item: TodoItem, error: Error) => void;
    onListComplete?: (list: TodoList) => void;
    onProgress?: (progress: {
        current: number;
        total: number;
        percentage: number;
    }) => void;
}
export declare class TodoExecutor {
    private static instance;
    private todoManager;
    private modelManager;
    private isRunning;
    private shouldStop;
    private constructor();
    static getInstance(): TodoExecutor;
    executeList(listId: string, callbacks?: ExecutionCallbacks, tools?: ToolDefinition[]): Promise<boolean>;
    private executeItem;
    private executeWithTool;
    private executeWithModel;
    stop(): void;
    isExecuting(): boolean;
    private sleep;
}
export declare function getTodoExecutor(): TodoExecutor;
//# sourceMappingURL=todoExecutor.d.ts.map