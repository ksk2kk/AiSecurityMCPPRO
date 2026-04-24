"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseOpenAIAdapter = void 0;
const axios_1 = __importStar(require("axios"));
const logger_1 = require("../utils/logger");
const tokenCounter_1 = require("../context/tokenCounter");
class BaseOpenAIAdapter {
    name;
    type;
    baseUrl;
    defaultModel;
    apiKey;
    client;
    lastUsage;
    constructor(provider) {
        this.name = provider.name;
        this.type = provider.type;
        this.baseUrl = provider.baseUrl;
        this.defaultModel = provider.defaultModel;
        this.apiKey = provider.apiKey;
        this.client = axios_1.default.create({
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
            (0, logger_1.logDebug)('ModelAdapter', `Request: ${config.method?.toUpperCase()} ${config.url}`);
            return config;
        });
        this.client.interceptors.response.use((response) => response, (error) => {
            (0, logger_1.logError)('ModelAdapter', `Request failed: ${error.message}`, {
                url: error.config?.url,
                status: error.response?.status
            });
            throw error;
        });
    }
    async getModels() {
        try {
            const response = await this.client.get('/models');
            return response.data.data;
        }
        catch (error) {
            (0, logger_1.logError)('ModelAdapter', 'Failed to get models', error);
            return [];
        }
    }
    async chatCompletion(request) {
        const model = request.model || this.defaultModel;
        (0, logger_1.logInfo)('ModelAdapter', `Sending chat completion request to model: ${model}`);
        (0, logger_1.logDebug)('ModelAdapter', 'Request details', {
            messageCount: request.messages.length,
            hasTools: !!request.tools,
            maxTokens: request.max_tokens
        });
        const requestBody = {
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
            const response = await this.client.post('/chat/completions', requestBody);
            this.lastUsage = response.data.usage;
            if (response.data.usage) {
                (0, logger_1.logInfo)('ModelAdapter', `Chat completion successful. Usage: prompt=${response.data.usage.prompt_tokens}, completion=${response.data.usage.completion_tokens}, total=${response.data.usage.total_tokens}`);
            }
            else {
                (0, logger_1.logWarn)('ModelAdapter', 'API response missing usage data. LMStudio may require stream_options: { include_usage: true }');
                const tokenCounter = (0, tokenCounter_1.getTokenCounter)();
                const estimatedPrompt = tokenCounter.countMessages(request.messages);
                const estimatedCompletion = response.data.choices[0]?.message?.content
                    ? tokenCounter.countTokens(response.data.choices[0].message.content)
                    : 0;
                this.lastUsage = {
                    prompt_tokens: estimatedPrompt,
                    completion_tokens: estimatedCompletion,
                    total_tokens: estimatedPrompt + estimatedCompletion
                };
                (0, logger_1.logInfo)('ModelAdapter', `Using estimated usage: prompt=${this.lastUsage.prompt_tokens}, completion=${this.lastUsage.completion_tokens}, total=${this.lastUsage.total_tokens}`);
            }
            return response.data;
        }
        catch (error) {
            (0, logger_1.logError)('ModelAdapter', 'Chat completion failed', error);
            throw this.normalizeError(error);
        }
    }
    async chatCompletionWithUsage(request) {
        const response = await this.chatCompletion(request);
        const choice = response.choices[0];
        if (!choice) {
            throw new Error('No response from model');
        }
        const result = {
            response,
            content: choice.message.content || '',
            toolCalls: choice.message.tool_calls,
            usage: this.lastUsage
        };
        return result;
    }
    async *chatCompletionStream(request) {
        const model = request.model || this.defaultModel;
        (0, logger_1.logInfo)('ModelAdapter', `Starting streaming chat completion to model: ${model}`);
        const requestBody = {
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
            const stream = response.data;
            let buffer = '';
            let fullContent = '';
            let accumulatedToolCalls = [];
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
                                this.lastUsage = parsed.usage;
                                (0, logger_1.logInfo)('ModelAdapter', `Stream usage: prompt=${this.lastUsage.prompt_tokens}, completion=${this.lastUsage.completion_tokens}, total=${this.lastUsage.total_tokens}`);
                                yield {
                                    usage: this.lastUsage
                                };
                            }
                            if (choice) {
                                const delta = choice.delta;
                                if (!delta)
                                    continue;
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
                        }
                        catch (parseError) {
                            (0, logger_1.logDebug)('ModelAdapter', 'Failed to parse stream chunk', parseError);
                        }
                    }
                }
            }
            if (!this.lastUsage) {
                (0, logger_1.logWarn)('ModelAdapter', 'Stream did not return usage data, using estimation');
                const tokenCounter = (0, tokenCounter_1.getTokenCounter)();
                const estimatedPrompt = tokenCounter.countMessages(request.messages);
                const estimatedCompletion = tokenCounter.countTokens(fullContent);
                this.lastUsage = {
                    prompt_tokens: estimatedPrompt,
                    completion_tokens: estimatedCompletion,
                    total_tokens: estimatedPrompt + estimatedCompletion
                };
            }
        }
        catch (error) {
            (0, logger_1.logError)('ModelAdapter', 'Streaming chat completion failed', error);
            throw this.normalizeError(error);
        }
    }
    getLastUsage() {
        return this.lastUsage;
    }
    normalizeError(error) {
        if (error instanceof axios_1.AxiosError) {
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
exports.BaseOpenAIAdapter = BaseOpenAIAdapter;
//# sourceMappingURL=baseAdapter.js.map