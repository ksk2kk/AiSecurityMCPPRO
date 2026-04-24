import { 
  ModelAdapter, 
  ChatCompletionRequest, 
  ChatCompletionResponse, 
  ModelInfo, 
  ModelCapabilities,
  ChatCompletionResult,
  ChatCompletionUsage
} from './types';
import { LMStudioAdapter } from './lmstudioAdapter';
import { OllamaAdapter } from './ollamaAdapter';
import { ModelProvider, ToolCall } from '../types';
import { getConfig, getActiveProvider, updateActiveProvider, addModelProvider, removeModelProvider } from '../config';
import { logInfo, logError, logWarn, logDebug } from '../utils/logger';

export class ModelManager {
  private adapters: Map<string, ModelAdapter> = new Map();
  private activeAdapterName: string = '';
  
  constructor() {
    this.initializeAdapters();
  }
  
  private initializeAdapters(): void {
    const config = getConfig();
    
    for (const provider of config.modelProviders) {
      try {
        const adapter = this.createAdapter(provider);
        this.adapters.set(provider.name, adapter);
        logInfo('ModelManager', `Registered model provider: ${provider.name} (${provider.type})`);
      } catch (error) {
        logError('ModelManager', `Failed to create adapter for ${provider.name}`, error);
      }
    }
    
    this.activeAdapterName = config.activeProvider;
    
    // Validate active provider exists
    if (!this.adapters.has(this.activeAdapterName)) {
      const firstAvailable = Array.from(this.adapters.keys())[0];
      if (firstAvailable) {
        logWarn('ModelManager', `Active provider ${this.activeAdapterName} not found, switching to ${firstAvailable}`);
        this.activeAdapterName = firstAvailable;
        updateActiveProvider(firstAvailable);
      } else {
        throw new Error('No model providers available');
      }
    }
  }
  
  private createAdapter(provider: ModelProvider): ModelAdapter {
    switch (provider.type) {
      case 'lmstudio':
        return new LMStudioAdapter(provider);
      case 'ollama':
        return new OllamaAdapter(provider);
      case 'openai':
        // TODO: Implement OpenAI adapter
        throw new Error('OpenAI adapter not yet implemented');
      case 'anthropic':
        // TODO: Implement Anthropic adapter
        throw new Error('Anthropic adapter not yet implemented');
      default:
        throw new Error(`Unknown provider type: ${provider.type}`);
    }
  }
  
  getActiveAdapter(): ModelAdapter {
    const adapter = this.adapters.get(this.activeAdapterName);
    if (!adapter) {
      throw new Error(`Active adapter ${this.activeAdapterName} not found`);
    }
    return adapter;
  }
  
  getAdapter(name: string): ModelAdapter | undefined {
    return this.adapters.get(name);
  }
  
  getAvailableAdapters(): string[] {
    return Array.from(this.adapters.keys());
  }
  
  async switchProvider(providerName: string): Promise<boolean> {
    const adapter = this.adapters.get(providerName);
    if (!adapter) {
      throw new Error(`Provider ${providerName} not found`);
    }
    
    const isAvailable = await adapter.isAvailable();
    if (!isAvailable) {
      logWarn('ModelManager', `Provider ${providerName} is not available`);
      return false;
    }
    
    this.activeAdapterName = providerName;
    updateActiveProvider(providerName);
    logInfo('ModelManager', `Switched to provider: ${providerName}`);
    
    return true;
  }
  
  async checkAllProviders(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    for (const [name, adapter] of this.adapters) {
      try {
        const isAvailable = await adapter.isAvailable();
        results.set(name, isAvailable);
        logInfo('ModelManager', `Provider ${name}: ${isAvailable ? 'available' : 'unavailable'}`);
      } catch (error) {
        results.set(name, false);
        logError('ModelManager', `Failed to check provider ${name}`, error);
      }
    }
    
    return results;
  }
  
  async getAvailableModels(): Promise<ModelInfo[]> {
    try {
      const adapter = this.getActiveAdapter();
      return await adapter.getModels();
    } catch (error) {
      logError('ModelManager', 'Failed to get models', error);
      return [];
    }
  }
  
  async getModelCapabilities(model?: string): Promise<ModelCapabilities> {
    const adapter = this.getActiveAdapter();
    return await adapter.getModelCapabilities(model);
  }
  
  async getContextWindow(model?: string): Promise<number> {
    const adapter = this.getActiveAdapter();
    return await adapter.getContextWindow(model);
  }
  
  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const adapter = this.getActiveAdapter();
    return await adapter.chatCompletion(request);
  }
  
  async chatCompletionWithUsage(request: ChatCompletionRequest): Promise<ChatCompletionResult> {
    const adapter = this.getActiveAdapter();
    if ('chatCompletionWithUsage' in adapter && typeof adapter.chatCompletionWithUsage === 'function') {
      return await adapter.chatCompletionWithUsage(request);
    }
    // Fallback
    const response = await adapter.chatCompletion(request);
    const choice = response.choices[0];
    return {
      response,
      content: choice?.message.content || '',
      toolCalls: choice?.message.tool_calls,
      usage: response.usage
    };
  }
  
  async *chatCompletionStream(
    request: ChatCompletionRequest
  ): AsyncIterable<{ content?: string; tool_calls?: ToolCall[]; finish_reason?: string; usage?: ChatCompletionUsage }> {
    const adapter = this.getActiveAdapter();
    yield* adapter.chatCompletionStream(request);
  }
  
  addProvider(provider: ModelProvider): void {
    const adapter = this.createAdapter(provider);
    this.adapters.set(provider.name, adapter);
    addModelProvider(provider);
    logInfo('ModelManager', `Added new provider: ${provider.name}`);
  }
  
  removeProvider(providerName: string): void {
    if (providerName === this.activeAdapterName) {
      throw new Error('Cannot remove active provider');
    }
    
    this.adapters.delete(providerName);
    removeModelProvider(providerName);
    logInfo('ModelManager', `Removed provider: ${providerName}`);
  }
  
  getActiveProviderName(): string {
    return this.activeAdapterName;
  }
}

// Singleton instance
let modelManagerInstance: ModelManager | null = null;

export function getModelManager(): ModelManager {
  if (!modelManagerInstance) {
    modelManagerInstance = new ModelManager();
  }
  return modelManagerInstance;
}
