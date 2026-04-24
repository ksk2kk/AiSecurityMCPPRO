"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OllamaAdapter = void 0;
const baseAdapter_1 = require("./baseAdapter");
const logger_1 = require("../utils/logger");
const axios_1 = __importDefault(require("axios"));
class OllamaAdapter extends baseAdapter_1.BaseOpenAIAdapter {
    cachedContextWindow = null;
    cachedCapabilities = new Map();
    constructor(provider) {
        super(provider);
    }
    async isAvailable() {
        try {
            // Ollama has a different health check endpoint
            const response = await axios_1.default.get('http://localhost:11434/api/tags', {
                timeout: 5000,
                validateStatus: () => true
            });
            const available = response.status === 200;
            (0, logger_1.logInfo)('OllamaAdapter', `Ollama availability check: ${available ? 'available' : 'unavailable'}`);
            return available;
        }
        catch (error) {
            (0, logger_1.logWarn)('OllamaAdapter', 'Ollama is not available', error);
            return false;
        }
    }
    async getModels() {
        try {
            // Ollama uses a different endpoint for listing models
            const response = await axios_1.default.get('http://localhost:11434/api/tags', {
                timeout: 10000
            });
            const ollamaModels = response.data.models;
            return ollamaModels.map(m => ({
                id: m.name,
                name: m.model,
                object: 'model',
                created: Math.floor(new Date(m.modified_at).getTime() / 1000),
                owned_by: 'ollama',
                permission: [],
                root: m.digest,
                parent: null
            }));
        }
        catch (error) {
            (0, logger_1.logError)('OllamaAdapter', 'Failed to get Ollama models', error);
            return [];
        }
    }
    async getModelCapabilities(model) {
        const modelName = model || this.defaultModel;
        if (this.cachedCapabilities.has(modelName)) {
            return this.cachedCapabilities.get(modelName);
        }
        const contextWindow = await this.getContextWindow(modelName);
        // Check model family for capabilities
        let supportsVision = false;
        let supportsTools = true;
        let supportsFunctionCalling = true;
        const modelLower = modelName.toLowerCase();
        // Vision support detection
        if (modelLower.includes('llava') ||
            modelLower.includes('vision') ||
            modelLower.includes('bakllava')) {
            supportsVision = true;
        }
        // Tool/function calling support
        if (modelLower.includes('mistral') && modelLower.includes('7b')) {
            // Some Mistral 7B variants have limited function calling
            supportsTools = true;
            supportsFunctionCalling = true;
        }
        const capabilities = {
            supportsTools,
            supportsStreaming: true,
            supportsFunctionCalling,
            supportsVision,
            maxContextWindow: contextWindow,
            maxOutputTokens: Math.floor(contextWindow / 2)
        };
        this.cachedCapabilities.set(modelName, capabilities);
        (0, logger_1.logDebug)('OllamaAdapter', `Model capabilities for ${modelName}`, capabilities);
        return capabilities;
    }
    async getContextWindow(model) {
        const modelName = model || this.defaultModel;
        if (this.cachedContextWindow) {
            return this.cachedContextWindow;
        }
        // Try to get from Ollama model info
        try {
            const modelInfo = await this.getOllamaModelInfo(modelName);
            if (modelInfo) {
                // Check for context window in model info
                const details = modelInfo.details;
                if (details) {
                    // Ollama models typically have standard context windows
                    const parameterSize = details.parameter_size?.toLowerCase() || '';
                    const family = details.family?.toLowerCase() || '';
                    // Detect based on model family
                    const detectedWindow = this.detectContextWindowFromFamily(family, parameterSize);
                    if (detectedWindow) {
                        this.cachedContextWindow = detectedWindow;
                        return detectedWindow;
                    }
                }
            }
        }
        catch (error) {
            (0, logger_1.logDebug)('OllamaAdapter', 'Failed to get context window from Ollama model info', error);
        }
        // Default based on common Ollama models
        const modelLower = modelName.toLowerCase();
        let defaultWindow = 4096;
        if (modelLower.includes('llama3')) {
            defaultWindow = 8192;
        }
        else if (modelLower.includes('llama2')) {
            defaultWindow = 4096;
        }
        else if (modelLower.includes('mistral')) {
            defaultWindow = 8192;
        }
        else if (modelLower.includes('mixtral')) {
            defaultWindow = 32768;
        }
        else if (modelLower.includes('gemma')) {
            defaultWindow = 8192;
        }
        else if (modelLower.includes('phi')) {
            defaultWindow = 2048;
        }
        this.cachedContextWindow = defaultWindow;
        (0, logger_1.logWarn)('OllamaAdapter', `Using estimated context window: ${defaultWindow} for model ${modelName}`);
        return defaultWindow;
    }
    async getOllamaModelInfo(modelName) {
        try {
            const response = await axios_1.default.post('http://localhost:11434/api/show', { name: modelName }, { timeout: 10000 });
            return response.data;
        }
        catch (error) {
            (0, logger_1.logDebug)('OllamaAdapter', 'Failed to get model info from Ollama', error);
            return null;
        }
    }
    detectContextWindowFromFamily(family, parameterSize) {
        const familyLower = family.toLowerCase();
        // Llama family
        if (familyLower.includes('llama')) {
            if (familyLower.includes('llama3')) {
                return 8192;
            }
            return 4096;
        }
        // Mistral family
        if (familyLower.includes('mistral')) {
            if (familyLower.includes('mixtral')) {
                return 32768;
            }
            return 8192;
        }
        // Gemma family
        if (familyLower.includes('gemma')) {
            return 8192;
        }
        // Phi family
        if (familyLower.includes('phi')) {
            return 2048;
        }
        return null;
    }
    clearCache() {
        this.cachedContextWindow = null;
        this.cachedCapabilities.clear();
    }
}
exports.OllamaAdapter = OllamaAdapter;
//# sourceMappingURL=ollamaAdapter.js.map