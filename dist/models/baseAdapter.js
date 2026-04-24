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
class BaseOpenAIAdapter {
    name;
    type;
    baseUrl;
    defaultModel;
    apiKey;
    client;
    constructor(provider) {
        this.name = provider.name;
        this.type = provider.type;
        this.baseUrl = provider.baseUrl;
        this.defaultModel = provider.defaultModel;
        this.apiKey = provider.apiKey;
        this.client = axios_1.default.create({
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
            (0, logger_1.logInfo)('ModelAdapter', `Chat completion successful. Usage: ${JSON.stringify(response.data.usage)}`);
            return response.data;
        }
        catch (error) {
            (0, logger_1.logError)('ModelAdapter', 'Chat completion failed', error);
            throw this.normalizeError(error);
        }
    }
    async *chatCompletionStream(request) {
        const model = request.model || this.defaultModel;
        (0, logger_1.logInfo)('ModelAdapter', `Starting streaming chat completion to model: ${model}`);
        const requestBody = {
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
            const stream = response.data;
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
                        }
                        catch (parseError) {
                            (0, logger_1.logDebug)('ModelAdapter', 'Failed to parse stream chunk', parseError);
                        }
                    }
                }
            }
        }
        catch (error) {
            (0, logger_1.logError)('ModelAdapter', 'Streaming chat completion failed', error);
            throw this.normalizeError(error);
        }
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