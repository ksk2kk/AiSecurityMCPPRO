"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModelManager = void 0;
exports.getModelManager = getModelManager;
const lmstudioAdapter_1 = require("./lmstudioAdapter");
const ollamaAdapter_1 = require("./ollamaAdapter");
const config_1 = require("../config");
const logger_1 = require("../utils/logger");
class ModelManager {
    adapters = new Map();
    activeAdapterName = '';
    constructor() {
        this.initializeAdapters();
    }
    initializeAdapters() {
        const config = (0, config_1.getConfig)();
        for (const provider of config.modelProviders) {
            try {
                const adapter = this.createAdapter(provider);
                this.adapters.set(provider.name, adapter);
                (0, logger_1.logInfo)('ModelManager', `Registered model provider: ${provider.name} (${provider.type})`);
            }
            catch (error) {
                (0, logger_1.logError)('ModelManager', `Failed to create adapter for ${provider.name}`, error);
            }
        }
        this.activeAdapterName = config.activeProvider;
        // Validate active provider exists
        if (!this.adapters.has(this.activeAdapterName)) {
            const firstAvailable = Array.from(this.adapters.keys())[0];
            if (firstAvailable) {
                (0, logger_1.logWarn)('ModelManager', `Active provider ${this.activeAdapterName} not found, switching to ${firstAvailable}`);
                this.activeAdapterName = firstAvailable;
                (0, config_1.updateActiveProvider)(firstAvailable);
            }
            else {
                throw new Error('No model providers available');
            }
        }
    }
    createAdapter(provider) {
        switch (provider.type) {
            case 'lmstudio':
                return new lmstudioAdapter_1.LMStudioAdapter(provider);
            case 'ollama':
                return new ollamaAdapter_1.OllamaAdapter(provider);
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
    getActiveAdapter() {
        const adapter = this.adapters.get(this.activeAdapterName);
        if (!adapter) {
            throw new Error(`Active adapter ${this.activeAdapterName} not found`);
        }
        return adapter;
    }
    getAdapter(name) {
        return this.adapters.get(name);
    }
    getAvailableAdapters() {
        return Array.from(this.adapters.keys());
    }
    async switchProvider(providerName) {
        const adapter = this.adapters.get(providerName);
        if (!adapter) {
            throw new Error(`Provider ${providerName} not found`);
        }
        const isAvailable = await adapter.isAvailable();
        if (!isAvailable) {
            (0, logger_1.logWarn)('ModelManager', `Provider ${providerName} is not available`);
            return false;
        }
        this.activeAdapterName = providerName;
        (0, config_1.updateActiveProvider)(providerName);
        (0, logger_1.logInfo)('ModelManager', `Switched to provider: ${providerName}`);
        return true;
    }
    async checkAllProviders() {
        const results = new Map();
        for (const [name, adapter] of this.adapters) {
            try {
                const isAvailable = await adapter.isAvailable();
                results.set(name, isAvailable);
                (0, logger_1.logInfo)('ModelManager', `Provider ${name}: ${isAvailable ? 'available' : 'unavailable'}`);
            }
            catch (error) {
                results.set(name, false);
                (0, logger_1.logError)('ModelManager', `Failed to check provider ${name}`, error);
            }
        }
        return results;
    }
    async getAvailableModels() {
        try {
            const adapter = this.getActiveAdapter();
            return await adapter.getModels();
        }
        catch (error) {
            (0, logger_1.logError)('ModelManager', 'Failed to get models', error);
            return [];
        }
    }
    async getModelCapabilities(model) {
        const adapter = this.getActiveAdapter();
        return await adapter.getModelCapabilities(model);
    }
    async getContextWindow(model) {
        const adapter = this.getActiveAdapter();
        return await adapter.getContextWindow(model);
    }
    async chatCompletion(request) {
        const adapter = this.getActiveAdapter();
        return await adapter.chatCompletion(request);
    }
    async *chatCompletionStream(request) {
        const adapter = this.getActiveAdapter();
        yield* adapter.chatCompletionStream(request);
    }
    addProvider(provider) {
        const adapter = this.createAdapter(provider);
        this.adapters.set(provider.name, adapter);
        (0, config_1.addModelProvider)(provider);
        (0, logger_1.logInfo)('ModelManager', `Added new provider: ${provider.name}`);
    }
    removeProvider(providerName) {
        if (providerName === this.activeAdapterName) {
            throw new Error('Cannot remove active provider');
        }
        this.adapters.delete(providerName);
        (0, config_1.removeModelProvider)(providerName);
        (0, logger_1.logInfo)('ModelManager', `Removed provider: ${providerName}`);
    }
    getActiveProviderName() {
        return this.activeAdapterName;
    }
}
exports.ModelManager = ModelManager;
// Singleton instance
let modelManagerInstance = null;
function getModelManager() {
    if (!modelManagerInstance) {
        modelManagerInstance = new ModelManager();
    }
    return modelManagerInstance;
}
//# sourceMappingURL=modelManager.js.map