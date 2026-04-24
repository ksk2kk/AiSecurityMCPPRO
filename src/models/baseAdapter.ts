import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  ModelAdapter,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ModelInfo,
  ModelsResponse,
  ModelCapabilities,
  ChatCompletionUsage,
  ChatCompletionResult
} from './types';
import { ModelProvider, ToolCall } from '../types';
import { logDebug, logError, logInfo, logWarn } from '../utils/logger';
import { getTokenCounter } from '../context/tokenCounter';

export abstract class BaseOpenAIAdapter implements ModelAdapter {
  readonly name: string;
  readonly type: 'lmstudio' | 'ollama' | 'openai' | 'anthropic';
  readonly baseUrl: string;
  readonly defaultModel: string;
  readonly apiKey?: string;
  
  protected readonly client: AxiosInstance;
  private lastUsage?: ChatCompletionUsage;
  
  constructor(provider: ModelProvider) {
    this.name = provider.name;
    this.type = provider.type;
    this.baseUrl = provider.baseUrl;
    this.defaultModel = provider.defaultModel;
    this.apiKey = provider.apiKey;
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 120000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (this.apiKey) {
      this.client.defaults.headers.common['Authorization'] = `Bearer ${this.apiKey}`;
    }
    
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
      
      this.lastUsage = response.data.usage;
      
      if (response.data.usage) {
        logInfo('ModelAdapter', `Chat completion successful. Usage: prompt=${response.data.usage.prompt_tokens}, completion=${response.data.usage.completion_tokens}, total=${response.data.usage.total_tokens}`);
      } else {
        logWarn('ModelAdapter', 'API response missing usage data. LMStudio may require stream_options: { include_usage: true }');
        const tokenCounter = getTokenCounter();
        const estimatedPrompt = tokenCounter.countMessages(request.messages);
        const estimatedCompletion = response.data.choices[0]?.message?.content 
          ? tokenCounter.countTokens(response.data.choices[0].message.content) 
          : 0;
        this.lastUsage = {
          prompt_tokens: estimatedPrompt,
          completion_tokens: estimatedCompletion,
          total_tokens: estimatedPrompt + estimatedCompletion
        };
        logInfo('ModelAdapter', `Using estimated usage: prompt=${this.lastUsage.prompt_tokens}, completion=${this.lastUsage.completion_tokens}, total=${this.lastUsage.total_tokens}`);
      }
      
      return response.data;
    } catch (error) {
      logError('ModelAdapter', 'Chat completion failed', error);
      throw this.normalizeError(error);
    }
  }
  
  async chatCompletionWithUsage(request: ChatCompletionRequest): Promise<ChatCompletionResult> {
    const response = await this.chatCompletion(request);
    
    const choice = response.choices[0];
    if (!choice) {
      throw new Error('No response from model');
    }
    
    const result: ChatCompletionResult = {
      response,
      content: choice.message.content || '',
      toolCalls: choice.message.tool_calls,
      usage: this.lastUsage
    };
    
    return result;
  }
  
  async *chatCompletionStream(
    request: ChatCompletionRequest
  ): AsyncIterable<{ content?: string; tool_calls?: ToolCall[]; finish_reason?: string; usage?: ChatCompletionUsage }> {
    const model = request.model || this.defaultModel;
    
    logInfo('ModelAdapter', `Starting streaming chat completion to model: ${model}`);
    
    const requestBody: Record<string, unknown> = {
      model,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.max_tokens ?? 1024,
      stream: true,
      stream_options: { include_usage: true }
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
      const response = await this.client.post('/chat/completions', requestBody, {
        responseType: 'stream'
      });
      
      const stream = response.data as NodeJS.ReadableStream;
      let buffer = '';
      let fullContent = '';
      let accumulatedToolCalls: ToolCall[] = [];
      
      for await (const chunk of stream) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              continue;
            }
            
            try {
              const parsed = JSON.parse(data);
              const choice = parsed.choices?.[0];
              
              if (parsed.usage) {
                this.lastUsage = parsed.usage as ChatCompletionUsage;
                logInfo('ModelAdapter', `Stream usage: prompt=${this.lastUsage.prompt_tokens}, completion=${this.lastUsage.completion_tokens}, total=${this.lastUsage.total_tokens}`);
                yield {
                  usage: this.lastUsage
                };
              }
              
              if (choice) {
                const delta = choice.delta;
                if (!delta) continue;
                
                if (delta.content) {
                  fullContent += delta.content;
                  yield {
                    content: delta.content
                  };
                }
                
                if (delta.tool_calls && delta.tool_calls.length > 0) {
                  for (const toolCallDelta of delta.tool_calls) {
                    const idx = toolCallDelta.index ?? 0;
                    if (!accumulatedToolCalls[idx]) {
                      accumulatedToolCalls[idx] = {
                        id: '',
                        type: 'function',
                        function: { name: '', arguments: '' }
                      };
                    }
                    
                    if (toolCallDelta.id) {
                      accumulatedToolCalls[idx].id = toolCallDelta.id;
                    }
                    if (toolCallDelta.function?.name) {
                      accumulatedToolCalls[idx].function.name = toolCallDelta.function.name;
                    }
                    if (toolCallDelta.function?.arguments) {
                      accumulatedToolCalls[idx].function.arguments += toolCallDelta.function.arguments;
                    }
                  }
                  
                  yield {
                    tool_calls: accumulatedToolCalls.filter(tc => tc && tc.id)
                  };
                }
                
                if (choice.finish_reason) {
                  yield {
                    finish_reason: choice.finish_reason,
                    tool_calls: accumulatedToolCalls.length > 0 ? accumulatedToolCalls : undefined
                  };
                }
              }
            } catch (parseError) {
              logDebug('ModelAdapter', 'Failed to parse stream chunk', parseError);
            }
          }
        }
      }
      
      if (!this.lastUsage) {
        logWarn('ModelAdapter', 'Stream did not return usage data, using estimation');
        const tokenCounter = getTokenCounter();
        const estimatedPrompt = tokenCounter.countMessages(request.messages);
        const estimatedCompletion = tokenCounter.countTokens(fullContent);
        this.lastUsage = {
          prompt_tokens: estimatedPrompt,
          completion_tokens: estimatedCompletion,
          total_tokens: estimatedPrompt + estimatedCompletion
        };
      }
      
    } catch (error) {
      logError('ModelAdapter', 'Streaming chat completion failed', error);
      throw this.normalizeError(error);
    }
  }
  
  getLastUsage(): ChatCompletionUsage | undefined {
    return this.lastUsage;
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
