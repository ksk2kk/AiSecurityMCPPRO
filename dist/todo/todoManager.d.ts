import { TodoItem, TodoList, ToolDefinition } from '../types';
export interface TodoGenerationOptions {
    context: string;
    tools?: ToolDefinition[];
    maxItems?: number;
    priorityBias?: 'security' | 'efficiency' | 'comprehensive';
}
export interface TodoExecutionResult {
    success: boolean;
    itemId: string;
    result?: string;
    error?: string;
}
export declare class TodoManager {
    private static instance;
    private todoLists;
    private activeTodoListId?;
    private modelManager;
    private constructor();
    static getInstance(): TodoManager;
    createTodoList(title: string, description?: string): TodoList;
    getTodoList(id: string): TodoList | undefined;
    getAllTodoLists(): TodoList[];
    setActiveTodoList(id: string): boolean;
    getActiveTodoList(): TodoList | undefined;
    addItemToList(listId: string, item: Omit<TodoItem, 'id' | 'createdAt' | 'status'>): TodoItem | null;
    addItemsToList(listId: string, items: Array<Omit<TodoItem, 'id' | 'createdAt' | 'status'>>): TodoItem[];
    updateItemStatus(listId: string, itemId: string, status: TodoItem['status'], result?: string, error?: string): boolean;
    private checkListCompletion;
    getNextItem(listId: string): TodoItem | undefined;
    getProgress(listId: string): {
        total: number;
        completed: number;
        failed: number;
        pending: number;
        inProgress: number;
        percentage: number;
    };
    generateTodoListFromContext(options: TodoGenerationOptions): Promise<TodoList | null>;
    private formatToolsForPrompt;
    private parseTodoListResponse;
    deleteTodoList(id: string): boolean;
    clearAll(): void;
}
export declare function getTodoManager(): TodoManager;
//# sourceMappingURL=todoManager.d.ts.map