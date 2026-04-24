"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TodoManager = void 0;
exports.getTodoManager = getTodoManager;
const uuid_1 = require("uuid");
const modelManager_1 = require("../models/modelManager");
const config_1 = require("../config");
const logger_1 = require("../utils/logger");
class TodoManager {
    static instance;
    todoLists = new Map();
    activeTodoListId;
    modelManager = (0, modelManager_1.getModelManager)();
    constructor() { }
    static getInstance() {
        if (!TodoManager.instance) {
            TodoManager.instance = new TodoManager();
        }
        return TodoManager.instance;
    }
    createTodoList(title, description = '') {
        const todoList = {
            id: (0, uuid_1.v4)(),
            title,
            description,
            items: [],
            createdAt: new Date(),
            updatedAt: new Date(),
            status: 'active'
        };
        this.todoLists.set(todoList.id, todoList);
        (0, logger_1.logInfo)('TodoManager', `Created todo list: ${title} (${todoList.id})`);
        return todoList;
    }
    getTodoList(id) {
        return this.todoLists.get(id);
    }
    getAllTodoLists() {
        return Array.from(this.todoLists.values());
    }
    setActiveTodoList(id) {
        const list = this.todoLists.get(id);
        if (!list) {
            (0, logger_1.logWarn)('TodoManager', `Todo list not found: ${id}`);
            return false;
        }
        this.activeTodoListId = id;
        (0, logger_1.logInfo)('TodoManager', `Set active todo list: ${list.title}`);
        return true;
    }
    getActiveTodoList() {
        if (!this.activeTodoListId) {
            return undefined;
        }
        return this.todoLists.get(this.activeTodoListId);
    }
    addItemToList(listId, item) {
        const list = this.todoLists.get(listId);
        if (!list) {
            (0, logger_1.logWarn)('TodoManager', `Cannot add item to non-existent list: ${listId}`);
            return null;
        }
        const newItem = {
            id: (0, uuid_1.v4)(),
            content: item.content,
            status: 'pending',
            priority: item.priority || 'medium',
            createdAt: new Date(),
            dependencies: item.dependencies,
            tool: item.tool,
            toolArguments: item.toolArguments,
            result: undefined,
            error: undefined
        };
        list.items.push(newItem);
        list.updatedAt = new Date();
        (0, logger_1.logDebug)('TodoManager', `Added item to list ${listId}: ${item.content.substring(0, 50)}...`);
        return newItem;
    }
    addItemsToList(listId, items) {
        const results = [];
        for (const item of items) {
            const newItem = this.addItemToList(listId, item);
            if (newItem) {
                results.push(newItem);
            }
        }
        return results;
    }
    updateItemStatus(listId, itemId, status, result, error) {
        const list = this.todoLists.get(listId);
        if (!list) {
            return false;
        }
        const item = list.items.find(i => i.id === itemId);
        if (!item) {
            return false;
        }
        item.status = status;
        if (result !== undefined) {
            item.result = result;
        }
        if (error !== undefined) {
            item.error = error;
        }
        if (status === 'completed' || status === 'failed') {
            item.completedAt = new Date();
        }
        list.updatedAt = new Date();
        (0, logger_1.logInfo)('TodoManager', `Updated item ${itemId} status: ${status}`);
        // Check if entire list is complete
        this.checkListCompletion(listId);
        return true;
    }
    checkListCompletion(listId) {
        const list = this.todoLists.get(listId);
        if (!list) {
            return;
        }
        const allItems = list.items;
        const completedCount = allItems.filter(i => i.status === 'completed').length;
        const failedCount = allItems.filter(i => i.status === 'failed').length;
        if (completedCount + failedCount === allItems.length) {
            if (failedCount > 0) {
                list.status = 'failed';
                (0, logger_1.logWarn)('TodoManager', `Todo list ${list.title} completed with failures (${failedCount} failed)`);
            }
            else {
                list.status = 'completed';
                (0, logger_1.logInfo)('TodoManager', `Todo list ${list.title} completed successfully`);
            }
        }
    }
    getNextItem(listId) {
        const list = this.todoLists.get(listId);
        if (!list) {
            return undefined;
        }
        // Filter pending items
        const pendingItems = list.items.filter(i => i.status === 'pending');
        // Check dependencies
        const availableItems = pendingItems.filter(item => {
            if (!item.dependencies || item.dependencies.length === 0) {
                return true;
            }
            // Check if all dependencies are completed
            return item.dependencies.every(depId => {
                const depItem = list.items.find(i => i.id === depId);
                return depItem && depItem.status === 'completed';
            });
        });
        // Sort by priority
        availableItems.sort((a, b) => {
            const priorityOrder = { 'high': 0, 'medium': 1, 'low': 2 };
            return (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1);
        });
        return availableItems[0];
    }
    getProgress(listId) {
        const list = this.todoLists.get(listId);
        if (!list) {
            return { total: 0, completed: 0, failed: 0, pending: 0, inProgress: 0, percentage: 0 };
        }
        const total = list.items.length;
        const completed = list.items.filter(i => i.status === 'completed').length;
        const failed = list.items.filter(i => i.status === 'failed').length;
        const pending = list.items.filter(i => i.status === 'pending').length;
        const inProgress = list.items.filter(i => i.status === 'in_progress').length;
        const percentage = total > 0 ? Math.round(((completed + failed) / total) * 100) : 0;
        return { total, completed, failed, pending, inProgress, percentage };
    }
    async generateTodoListFromContext(options) {
        const config = (0, config_1.getConfig)();
        if (!config.todoList.autoGenerate) {
            (0, logger_1.logWarn)('TodoManager', 'Auto-generation is disabled in config');
            return null;
        }
        (0, logger_1.logInfo)('TodoManager', 'Generating todo list from context...');
        const toolsDescription = options.tools?.length
            ? this.formatToolsForPrompt(options.tools)
            : 'No specific tools available';
        const maxItems = options.maxItems || 10;
        const systemPrompt = `You are a security expert task planner. Analyze the given context and create a structured todo list for vulnerability scanning and penetration testing.

Available tools:
${toolsDescription}

GUIDELINES:
1. Create logical, sequential tasks
2. Start with reconnaissance, then scanning, then analysis
3. Consider dependencies between tasks
4. Use the available tools where appropriate
5. Keep tasks specific and actionable
6. Prioritize by security impact

Respond with ONLY a JSON array of task objects. Each task should have:
- "content": string (the task description)
- "priority": "high" | "medium" | "low"
- "tool": string (optional tool name to use)
- "toolArguments": object (optional arguments for the tool)
- "dependencies": string[] (optional indices of prerequisite tasks, 0-based)

Do NOT include any other text or explanation.`;
        const userPrompt = `Context: ${options.context}

Priority bias: ${options.priorityBias || 'security'}
Maximum tasks: ${maxItems}

Generate the todo list as JSON:`;
        try {
            const response = await this.modelManager.chatCompletion({
                model: this.modelManager.getActiveAdapter().defaultModel,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.3,
                max_tokens: 2048
            });
            const content = response.choices[0]?.message?.content;
            if (!content) {
                throw new Error('Empty response from model');
            }
            // Parse JSON response
            const tasks = this.parseTodoListResponse(content);
            if (tasks.length === 0) {
                throw new Error('No tasks generated');
            }
            // Create todo list
            const todoList = this.createTodoList(`Auto-generated: ${options.context.substring(0, 50)}...`, options.context);
            // Add tasks
            for (const task of tasks.slice(0, maxItems)) {
                this.addItemToList(todoList.id, {
                    content: task.content,
                    priority: task.priority || 'medium',
                    tool: task.tool,
                    toolArguments: task.toolArguments
                });
            }
            (0, logger_1.logInfo)('TodoManager', `Generated todo list with ${tasks.length} tasks`);
            return todoList;
        }
        catch (error) {
            (0, logger_1.logError)('TodoManager', 'Failed to generate todo list', error);
            return null;
        }
    }
    formatToolsForPrompt(tools) {
        return tools.map(tool => {
            const name = tool.function.name;
            const desc = tool.function.description;
            const params = JSON.stringify(tool.function.parameters, null, 2);
            return `\n- ${name}: ${desc}\n  Parameters: ${params}`;
        }).join('');
    }
    parseTodoListResponse(content) {
        try {
            // Try to find JSON in the response
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                throw new Error('No JSON array found in response');
            }
            const parsed = JSON.parse(jsonMatch[0]);
            if (!Array.isArray(parsed)) {
                throw new Error('Response is not an array');
            }
            return parsed.map((item, index) => {
                const obj = item;
                return {
                    content: String(obj.content || `Task ${index + 1}`),
                    priority: obj.priority || 'medium',
                    tool: obj.tool ? String(obj.tool) : undefined,
                    toolArguments: obj.toolArguments
                };
            });
        }
        catch (error) {
            (0, logger_1.logError)('TodoManager', 'Failed to parse todo list response', error);
            return [];
        }
    }
    deleteTodoList(id) {
        const list = this.todoLists.get(id);
        if (!list) {
            return false;
        }
        this.todoLists.delete(id);
        if (this.activeTodoListId === id) {
            this.activeTodoListId = undefined;
        }
        (0, logger_1.logInfo)('TodoManager', `Deleted todo list: ${list.title}`);
        return true;
    }
    clearAll() {
        this.todoLists.clear();
        this.activeTodoListId = undefined;
        (0, logger_1.logInfo)('TodoManager', 'Cleared all todo lists');
    }
}
exports.TodoManager = TodoManager;
function getTodoManager() {
    return TodoManager.getInstance();
}
//# sourceMappingURL=todoManager.js.map