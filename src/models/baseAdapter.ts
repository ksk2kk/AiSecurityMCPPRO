import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  ModelAdapter,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ModelInfo,
  ModelsResponse,
  ModelCapabilities
} from './types';
import { ModelProvider, ToolCall } from '../types';
import { logDebug, logError, logInfo } from '../utils/logger';

export abstract class BaseOpenAIAdapter implements ModelAdapter {
  readonly name: string;
  readonly type: 'lmstudio' | 'ollama' | 'openai' | 'anthropic';
  readonly baseUrl: string;
  readonly defaultModel: string;
  readonly apiKey?: string;
  
  protected readonly client: AxiosInstance;
  
  constructor(provider: ModelProvider) {
    this.name = provider.name;
    this.type = provider.type;
    this.baseUrl = provider.baseUrl;
    this.defaultModel = provider.defaultModel;
    this.apiKey = provider.apiKey;
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (this.apiKey) {
      this.client.defaults.headers.common['Authorization'] = `Bearer ${this.apiKey}`;
    }
    
    // Add request interceptor for logging
    this.client.interceptors.request.use((config) => {
      logDebug('ModelAdapter', `Request: ${config.method?.toUpperCase()} ${config.url}`);
      return config;
    });
    
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        logError('ModelAdapter', `Request failed: ${error.message}`, {
          url: error.config?.url,
          status: error.response?.status
        });
        throw error;
      }
    );
  }
  
  abstract isAvailable(): Promise<boolean>;
  
  async getModels(): Promise<ModelInfo[]> {
    try {
      const response = await this.client.get<ModelsResponse>('/models');
      return response.data.data;
    } catch (error) {
      logError('ModelAdapter', 'Failed to get models', error);
      return [];
    }
  }
  
  abstract getModelCapabilities(model?: string): Promise<ModelCapabilities>;
  
  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const model = request.model || this.defaultModel;
    
    logInfo('ModelAdapter', `Sending chat completion request to model: ${model}`);
    logDebug('ModelAdapter', 'Request details', {
      messageCount: request.messages.length,
      hasTools: !!request.tools,
      maxTokens: request.max_tokens
    });
    
    const requestBody: Record<string, unknown> = {
      model,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.max_tokens ?? 1024,
      stream: false
    };
    
    if (request.tools && request.tools.length > 0) {
      requestBody['tools'] = request.tools;
      if (request.tool_choice) {
        requestBody['tool_choice'] = request.tool_choice;
      }
    }
    
    if (request.top_p !== undefined) {
      requestBody['top_p'] = request.top_p;
    }
    
    if (request.frequency_penalty !== undefined) {
      requestBody['frequency_penalty'] = request.frequency_penalty;
    }
    
    if (request.presence_penalty !== undefined) {
      requestBody['presence_penalty'] = request.presence_penalty;
    }
    
    if (request.stop !== undefined) {
      requestBody['stop'] = request.stop;
    }
    
    try {
      const response = await this.client.post<ChatCompletionResponse>(
        '/chat/completions',
        requestBody
      );
      
      logInfo('ModelAdapter', `Chat completion successful. Usage: ${JSON.stringify(response.data.usage)}`);
      
      return response.data;
    } catch (error) {
      logError('ModelAdapter', 'Chat completion failed', error);
      throw this.normalizeError(error);
    }
  }
  
  async *chatCompletionStream(
    request: ChatCompletionRequest
  ): AsyncIterable<{ content?: string; tool_calls?: ToolCall[]; finish_reason?: string }> {
    const model = request.model || this.defaultModel;
    
    logInfo('ModelAdapter', `Starting streaming chat completion to model: ${model}`);
    
    const requestBody: Record<string, unknown> = {
      model,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.max_tokens ?? 1024,
      stream: true
    };
    
    if (request.tools && request.tools.length > 0) {
      requestBody['tools'] = request.tools;
      if (request.tool_choice) {
        requestBody['tool_choice'] = request.tool_choice;
      }
    }
    
    try {
      const response = await this.client.post('/chat/completions', requestBody, {
        responseType: 'stream'
      });
      
      const stream = response.data as NodeJS.ReadableStream;
      let buffer = '';
      
      for await (const chunk of stream) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              return;
            }
            
            try {
              const parsed = JSON.parse(data);
              const choice = parsed.choices?.[0];
              
              if (choice) {
                yield {
                  content: choice.delta?.content,
                  tool_calls: choice.delta?.tool_calls,
                  finish_reason: choice.finish_reason
                };
              }
            } catch (parseError) {
              logDebug('ModelAdapter', 'Failed to parse stream chunk', parseError);
            }
          }
        }
      }
    } catch (error) {
      logError('ModelAdapter', 'Streaming chat completion failed', error);
      throw this.normalizeError(error);
    }
  }
  
  abstract getContextWindow(model?: string): Promise<number>;
  
  protected normalizeError(error: unknown): Error {
    if (error instanceof AxiosError) {
      const status = error.response?.status;
      const message = error.response?.data?.error?.message || error.message;
      
      if (status === 401) {
        return new Error(`Authentication failed: ${message}`);
      }
      if (status === 404) {
        return new Error(`Model or endpoint not found: ${message}`);
      }
      if (status === 429) {
        return new Error(`Rate limit exceeded: ${message}`);
      }
      if (status && status >= 500) {
        return new Error(`Server error (${status}): ${message}`);
      }
      
      return new Error(`API error: ${message}`);
    }
    
    if (error instanceof Error) {
      return error;
    }
    
    return new Error(String(error));
  }
}
