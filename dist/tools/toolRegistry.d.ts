import { ToolChain, ToolDefinition } from '../types';
export declare class ToolRegistry {
    private static instance;
    private tools;
    private toolsDirectory;
    private constructor();
    static getInstance(): ToolRegistry;
    private getDefaultToolsDirectory;
    private initializeDefaultTools;
    getTool(name: string): ToolChain | undefined;
    getAllTools(): ToolChain[];
    getToolsByCategory(category: ToolChain['category']): ToolChain[];
    getInstalledTools(): ToolChain[];
    addTool(tool: Omit<ToolChain, 'id' | 'installed' | 'lastUpdated'>): ToolChain;
    removeTool(name: string): boolean;
    updateToolStatus(name: string, installed: boolean, version?: string): boolean;
    getToolAsMCPDefinition(tool: ToolChain): ToolDefinition;
    getAllToolDefinitions(): ToolDefinition[];
    getInstalledToolDefinitions(): ToolDefinition[];
    getToolsDirectory(): string;
    setToolsDirectory(dir: string): void;
}
export declare function getToolRegistry(): ToolRegistry;
//# sourceMappingURL=toolRegistry.d.ts.map