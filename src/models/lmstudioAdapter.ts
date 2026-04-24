import { BaseOpenAIAdapter } from './baseAdapter';
import { ModelCapabilities, ModelAdapter } from './types';
import { ModelProvider } from '../types';
import { logDebug, logInfo, logWarn } from '../utils/logger';

export class LMStudioAdapter extends BaseOpenAIAdapter implements ModelAdapter {
  private cachedContextWindow: number | null = null;
  private cachedCapabilities: Map<string, ModelCapabilities> = new Map();
  
  constructor(provider: ModelProvider) {
    super(provider);
  }
  
  async isAvailable(): Promise<boolean> {
    try {
      const response = await this.client.get('/models', { timeout: 5000 });
      const available = response.status === 200;
      logInfo('LMStudioAdapter', `LMStudio availability check: ${available ? 'available' : 'unavailable'}`);
      return available;
    } catch (error) {
      logWarn('LMStudioAdapter', 'LMStudio is not available', error);
      return false;
    }
  }
  
  async getModelCapabilities(model?: string): Promise<ModelCapabilities> {
    const modelName = model || this.defaultModel;
    
    if (this.cachedCapabilities.has(modelName)) {
      return this.cachedCapabilities.get(modelName)!;
    }
    
    const contextWindow = await this.getContextWindow(modelName);
    
    const capabilities: ModelCapabilities = {
      supportsTools: true,
      supportsStreaming: true,
      supportsFunctionCalling: true,
      supportsVision: false,
      maxContextWindow: contextWindow,
      maxOutputTokens: Math.floor(contextWindow / 2)
    };
    
    this.cachedCapabilities.set(modelName, capabilities);
    logDebug('LMStudioAdapter', `Model capabilities for ${modelName}`, capabilities);
    
    return capabilities;
  }
  
  async getContextWindow(model?: string): Promise<number> {
    const modelName = model || this.defaultModel;
    
    // Try to get from model info first
    try {
      const models = await this.getModels();
      const targetModel = models.find(m => 
        m.id === modelName || 
        m.name === modelName ||
        m.id.toLowerCase().includes(modelName.toLowerCase())
      );
      
      if (targetModel) {
        // Some models expose context window in their info
        // This is model-specific, so we'll use a heuristic
        const modelId = targetModel.id.toLowerCase();
        
        // Common model context windows
        if (modelId.includes('gpt-4')) {
          if (modelId.includes('32k')) return 32768;
          if (modelId.includes('128k')) return 128000;
          return 8192;
        }
        
        if (modelId.includes('gpt-3.5')) {
          if (modelId.includes('16k')) return 16384;
          return 4096;
        }
        
        if (modelId.includes('llama')) {
          if (modelId.includes('70b')) return 4096;
          if (modelId.includes('13b')) return 4096;
          if (modelId.includes('34b')) return 8192;
          return 4096;
        }
        
        if (modelId.includes('mistral')) {
          return 8192;
        }
        
        if (modelId.includes('mixtral')) {
          return 32768;
        }
      }
    } catch (error) {
      logDebug('LMStudioAdapter', 'Failed to detect context window from model info', error);
    }
    
    // Return cached or default value
    if (this.cachedContextWindow) {
      return this.cachedContextWindow;
    }
    
    // Default for LMStudio - try to read from provider config
    const defaultWindow = 4096;
    this.cachedContextWindow = defaultWindow;
    
    logWarn('LMStudioAdapter', `Using default context window: ${defaultWindow}. Consider setting it in config for accuracy.`);
    
    return defaultWindow;
  }
  
  async detectModelContextWindow(): Promise<number> {
    // Try to detect by sending increasing token counts until error
    // This is a fallback method
    try {
      const testSizes = [2000, 4000, 8000, 16000, 32000, 64000, 128000];
      
      for (const size of testSizes) {
        try {
          const testMessage = this.generateTestMessage(size);
          await this.chatCompletion({
            model: this.defaultModel,
            messages: [{ role: 'user', content: testMessage }],
            max_tokens: 10
          });
          logDebug('LMStudioAdapter', `Model accepts ${size} token context`);
        } catch (error) {
          // Context exceeded, return previous size
          const detectedSize = testSizes[testSizes.indexOf(size) - 1] || 2000;
          logInfo('LMStudioAdapter', `Detected context window: ${detectedSize}`);
          this.cachedContextWindow = detectedSize;
          return detectedSize;
        }
      }
      
      return 128000;
    } catch (error) {
      logWarn('LMStudioAdapter', 'Failed to detect context window, using default', error);
      return 4096;
    }
  }
  
  private generateTestMessage(tokenCount: number): string {
    // Rough estimate: 1 token ~= 4 chars in English
    const charCount = Math.floor(tokenCount * 3.5);
    const baseWord = 'test ';
    const repetitions = Math.floor(charCount / baseWord.length);
    
    return 'Please respond with "OK". Here is some filler text: ' + 
           baseWord.repeat(repetitions);
  }
  
  clearCache(): void {
    this.cachedContextWindow = null;
    this.cachedCapabilities.clear();
  }
}
