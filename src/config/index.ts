import { SystemConfig, ContextCompressionRule, ModelProvider } from '../types';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

const CONFIG_FILE_NAME = 'ai-security-mcp-config.yaml';
const CONFIG_DIRECTORY = path.join(process.cwd(), 'config');

const defaultCompressionRules: ContextCompressionRule[] = [
  {
    id: 'rule-1',
    name: '轻度压缩',
    description: '当上下文使用达到70%时启用轻度压缩',
    triggerThreshold: 0.7,
    compressionRatio: 0.3,
    preserveSystemMessages: true,
    preserveRecentMessages: 10,
    enabled: true
  },
  {
    id: 'rule-2',
    name: '中度压缩',
    description: '当上下文使用达到85%时启用中度压缩',
    triggerThreshold: 0.85,
    compressionRatio: 0.5,
    preserveSystemMessages: true,
    preserveRecentMessages: 5,
    enabled: true
  },
  {
    id: 'rule-3',
    name: '紧急压缩',
    description: '当上下文使用达到95%时启用紧急压缩',
    triggerThreshold: 0.95,
    compressionRatio: 0.7,
    preserveSystemMessages: true,
    preserveRecentMessages: 3,
    enabled: true
  }
];

const defaultModelProviders: ModelProvider[] = [
  {
    name: 'lmstudio',
    type: 'lmstudio',
    baseUrl: 'http://localhost:1234/v1',
    defaultModel: 'local-model',
    maxContextWindow: 4096,
    maxOutputTokens: 2048
  },
  {
    name: 'ollama',
    type: 'ollama',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama2',
    maxContextWindow: 4096,
    maxOutputTokens: 2048
  }
];

const defaultConfig: SystemConfig = {
  modelProviders: defaultModelProviders,
  activeProvider: 'lmstudio',
  contextWindow: {
    maxTokens: 4096,
    warningThreshold: 0.7,
    autoCompression: true,
    compressionRules: defaultCompressionRules
  },
  todoList: {
    autoGenerate: true,
    maxConcurrentTasks: 3,
    retryOnFailure: true,
    maxRetries: 3
  },
  toolChain: {
    autoInstall: true,
    autoUpdate: true,
    logLevel: 'info',
    maxExecutionTime: 3600,
    toolsDirectory: path.join(process.cwd(), 'tools')
  },
  security: {
    safeMode: true,
    allowDangerousTools: false,
    maxExploitAttempts: 0,
    targetWhitelist: undefined
  },
  ui: {
    showContextLength: true,
    showTokenCount: true,
    colorOutput: true
  }
};

let config: SystemConfig = defaultConfig;
let configLoaded = false;

export function getConfig(): SystemConfig {
  if (!configLoaded) {
    loadConfig();
  }
  return { ...config };
}

export function loadConfig(): SystemConfig {
  const configPath = path.join(CONFIG_DIRECTORY, CONFIG_FILE_NAME);
  
  try {
    if (fs.existsSync(configPath)) {
      const fileContent = fs.readFileSync(configPath, 'utf8');
      const loadedConfig = yaml.load(fileContent) as Partial<SystemConfig>;
      config = mergeConfigs(defaultConfig, loadedConfig);
    } else {
      config = { ...defaultConfig };
      saveConfig();
    }
  } catch (error) {
    console.warn('加载配置文件失败，使用默认配置:', error);
    config = { ...defaultConfig };
  }
  
  configLoaded = true;
  return config;
}

export function saveConfig(newConfig?: Partial<SystemConfig>): void {
  if (newConfig) {
    config = mergeConfigs(config, newConfig);
  }
  
  try {
    if (!fs.existsSync(CONFIG_DIRECTORY)) {
      fs.mkdirSync(CONFIG_DIRECTORY, { recursive: true });
    }
    
    const configPath = path.join(CONFIG_DIRECTORY, CONFIG_FILE_NAME);
    const yamlContent = yaml.dump(config, { indent: 2 });
    fs.writeFileSync(configPath, yamlContent, 'utf8');
  } catch (error) {
    console.error('保存配置文件失败:', error);
    throw error;
  }
}

export function getActiveProvider(): ModelProvider {
  const cfg = getConfig();
  const provider = cfg.modelProviders.find(p => p.name === cfg.activeProvider);
  
  if (!provider) {
    const fallback = cfg.modelProviders[0];
    if (!fallback) {
      throw new Error('没有配置可用的模型提供商');
    }
    return fallback;
  }
  
  return provider;
}

export function updateActiveProvider(providerName: string): void {
  const cfg = getConfig();
  const provider = cfg.modelProviders.find(p => p.name === providerName);
  
  if (!provider) {
    throw new Error(`未找到模型提供商: ${providerName}`);
  }
  
  saveConfig({ activeProvider: providerName });
}

export function addModelProvider(provider: ModelProvider): void {
  const cfg = getConfig();
  const existingIndex = cfg.modelProviders.findIndex(p => p.name === provider.name);
  
  if (existingIndex >= 0) {
    cfg.modelProviders[existingIndex] = provider;
  } else {
    cfg.modelProviders.push(provider);
  }
  
  saveConfig({ modelProviders: cfg.modelProviders });
}

export function removeModelProvider(providerName: string): void {
  const cfg = getConfig();
  
  if (cfg.activeProvider === providerName) {
    throw new Error('不能删除当前正在使用的模型提供商');
  }
  
  const newProviders = cfg.modelProviders.filter(p => p.name !== providerName);
  saveConfig({ modelProviders: newProviders });
}

function mergeConfigs(base: SystemConfig, override: Partial<SystemConfig>): SystemConfig {
  const result = { ...base };
  
  if (override.modelProviders) {
    result.modelProviders = override.modelProviders;
  }
  
  if (override.activeProvider) {
    result.activeProvider = override.activeProvider;
  }
  
  if (override.contextWindow) {
    result.contextWindow = {
      ...result.contextWindow,
      ...override.contextWindow
    };
  }
  
  if (override.todoList) {
    result.todoList = {
      ...result.todoList,
      ...override.todoList
    };
  }
  
  if (override.toolChain) {
    result.toolChain = {
      ...result.toolChain,
      ...override.toolChain
    };
  }
  
  if (override.security) {
    result.security = {
      ...result.security,
      ...override.security
    };
  }
  
  if (override.ui) {
    result.ui = {
      ...result.ui,
      ...override.ui
    };
  }
  
  return result;
}
