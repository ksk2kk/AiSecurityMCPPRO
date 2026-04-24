import { Message, ContextInfo, ContextCompressionRule } from '../types';
import { getTokenCounter } from './tokenCounter';
import { getModelManager } from '../models/modelManager';
import { getConfig } from '../config';
import { logInfo, logWarn, logDebug, logError } from '../utils/logger';

export interface CompressionResult {
  messages: Message[];
  compressed: boolean;
  summary?: string;
  compressionRatio: number;
  originalTokens: number;
  compressedTokens: number;
}

export class ContextManager {
  private static instance: ContextManager;
  private tokenCounter = getTokenCounter();
  private modelManager = getModelManager();
  
  private messages: Message[] = [];
  private summary: string = '';
  private lastCompressedAt?: Date;
  private maxContextTokens: number = 4096;
  private warningThreshold: number = 0.7;
  
  private constructor() {
    this.initializeFromConfig();
  }
  
  static getInstance(): ContextManager {
    if (!ContextManager.instance) {
      ContextManager.instance = new ContextManager();
    }
    return ContextManager.instance;
  }
  
  private initializeFromConfig(): void {
    const config = getConfig();
    this.maxContextTokens = config.contextWindow.maxTokens;
    this.warningThreshold = config.contextWindow.warningThreshold;
  }
  
  async initialize(): Promise<void> {
    try {
      const contextWindow = await this.modelManager.getContextWindow();
      this.maxContextTokens = contextWindow;
      logInfo('ContextManager', `Initialized with context window: ${contextWindow} tokens`);
    } catch (error) {
      logWarn('ContextManager', 'Failed to get context window from model, using default', error);
    }
  }
  
  getMessages(): Message[] {
    return [...this.messages];
  }
  
  addMessage(message: Message): void {
    this.messages.push(message);
    logDebug('ContextManager', `Added message (role: ${message.role}), total: ${this.messages.length}`);
  }
  
  addMessages(messages: Message[]): void {
    this.messages.push(...messages);
    logDebug('ContextManager', `Added ${messages.length} messages, total: ${this.messages.length}`);
  }
  
  clearMessages(): void {
    this.messages = [];
    this.summary = '';
    this.lastCompressedAt = undefined;
    logInfo('ContextManager', 'Context cleared');
  }
  
  getContextInfo(): ContextInfo {
    const currentTokens = this.tokenCounter.countMessages(this.messages);
    const compressionRatio = this.lastCompressedAt ? 
      (this.summary.length > 0 ? 0.5 : 1) : 1;
    
    return {
      currentTokens,
      maxTokens: this.maxContextTokens,
      compressionRatio,
      lastCompressedAt: this.lastCompressedAt,
      summary: this.summary || undefined
    };
  }
  
  getCurrentTokenCount(): number {
    return this.tokenCounter.countMessages(this.messages);
  }
  
  getMaxContextTokens(): number {
    return this.maxContextTokens;
  }
  
  getAvailableTokens(reserveForOutput: number = 1024): number {
    const current = this.getCurrentTokenCount();
    return Math.max(0, this.maxContextTokens - current - reserveForOutput);
  }
  
  getUsagePercentage(): number {
    return this.getCurrentTokenCount() / this.maxContextTokens;
  }
  
  isNearLimit(): boolean {
    return this.getUsagePercentage() >= this.warningThreshold;
  }
  
  isOverLimit(): boolean {
    return this.getUsagePercentage() >= 1.0;
  }
  
  getStatusDisplay(): string {
    const info = this.getContextInfo();
    const percentage = Math.round((info.currentTokens / info.maxTokens) * 100);
    const status = this.isOverLimit() ? 'OVER LIMIT' : 
                   this.isNearLimit() ? 'WARNING' : 'OK';
    
    return `[${status}] Context: ${info.currentTokens}/${info.maxTokens} tokens (${percentage}%)`;
  }
  
  async checkAndCompressIfNeeded(): Promise<CompressionResult | null> {
    const config = getConfig();
    
    if (!config.contextWindow.autoCompression) {
      logDebug('ContextManager', 'Auto-compression is disabled');
      return null;
    }
    
    const usage = this.getUsagePercentage();
    const rules = config.contextWindow.compressionRules.filter(r => r.enabled);
    
    // Sort rules by threshold descending
    rules.sort((a, b) => b.triggerThreshold - a.triggerThreshold);
    
    for (const rule of rules) {
      if (usage >= rule.triggerThreshold) {
        logInfo('ContextManager', `Triggering compression rule: ${rule.name} (threshold: ${rule.triggerThreshold * 100}%)`);
        return await this.compress(rule);
      }
    }
    
    return null;
  }
  
  async compress(rule: ContextCompressionRule): Promise<CompressionResult> {
    logInfo('ContextManager', `Starting compression with ratio: ${rule.compressionRatio}`);
    
    const originalTokens = this.getCurrentTokenCount();
    const originalMessageCount = this.messages.length;
    
    // Separate system messages to preserve them
    const systemMessages = this.messages.filter(m => m.role === 'system');
    const nonSystemMessages = this.messages.filter(m => m.role !== 'system');
    
    // Calculate how many messages to preserve
    const preserveCount = Math.min(rule.preserveRecentMessages, nonSystemMessages.length);
    const messagesToPreserve = nonSystemMessages.slice(-preserveCount);
    const messagesToSummarize = nonSystemMessages.slice(0, -preserveCount);
    
    if (messagesToSummarize.length === 0) {
      logDebug('ContextManager', 'No messages to summarize');
      return {
        messages: this.messages,
        compressed: false,
        compressionRatio: 0,
        originalTokens,
        compressedTokens: originalTokens
      };
    }
    
    // Generate summary of old messages
    const summary = await this.generateSummary(messagesToSummarize);
    this.summary = summary;
    this.lastCompressedAt = new Date();
    
    // Rebuild messages with summary
    const newMessages: Message[] = [...systemMessages];
    
    if (summary && summary.length > 0) {
      newMessages.push({
        role: 'system',
        content: `CONVERSATION SUMMARY (prior to recent messages):\n${summary}\n\n--- END OF SUMMARY ---`
      });
    }
    
    newMessages.push(...messagesToPreserve);
    
    const compressedTokens = this.tokenCounter.countMessages(newMessages);
    const actualCompression = 1 - (compressedTokens / originalTokens);
    
    logInfo('ContextManager', `Compression complete: ${originalMessageCount} -> ${newMessages.length} messages, ${originalTokens} -> ${compressedTokens} tokens (${Math.round(actualCompression * 100)}% reduction)`);
    
    this.messages = newMessages;
    
    return {
      messages: newMessages,
      compressed: true,
      summary,
      compressionRatio: actualCompression,
      originalTokens,
      compressedTokens
    };
  }
  
  private async generateSummary(messages: Message[]): Promise<string> {
    if (messages.length === 0) {
      return '';
    }
    
    logInfo('ContextManager', `Generating summary for ${messages.length} messages`);
    
    const conversationText = messages.map(m => {
      const role = m.role.toUpperCase();
      const content = m.content || '[no content]';
      return `${role}: ${content}`;
    }).join('\n\n');
    
    const summaryPrompt = `Please provide a concise summary of the following conversation history. Focus on:
1. The main topics discussed
2. Key decisions made
3. Important findings or results
4. Any pending items or action items

Keep the summary under 500 words.

CONVERSATION:
${conversationText}

SUMMARY:`;

    try {
      const response = await this.modelManager.chatCompletion({
        model: this.modelManager.getActiveAdapter().defaultModel,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that summarizes conversations concisely and accurately.'
          },
          {
            role: 'user',
            content: summaryPrompt
          }
        ],
        max_tokens: 500,
        temperature: 0.3
      });
      
      const summary = response.choices[0]?.message?.content || '';
      logInfo('ContextManager', `Generated summary (${summary.length} chars)`);
      
      return summary;
    } catch (error) {
      logError('ContextManager', 'Failed to generate summary with model, using fallback', error);
      
      // Fallback: simple truncation with message count
      return `[Auto-summary] Previous conversation contained ${messages.length} messages covering topics that are now summarized. The most recent messages have been preserved.`;
    }
  }
  
  prepareMessagesForCompletion(maxTokens?: number, reserveOutput: number = 1024): Message[] {
    const effectiveMax = maxTokens || this.maxContextTokens;
    const availableForMessages = effectiveMax - reserveOutput;
    
    if (availableForMessages <= 0) {
      logWarn('ContextManager', 'Not enough tokens available for messages after reserving output');
      return this.messages.filter(m => m.role === 'system');
    }
    
    const currentTokens = this.getCurrentTokenCount();
    
    if (currentTokens <= availableForMessages) {
      return [...this.messages];
    }
    
    // Need to select subset
    logInfo('ContextManager', `Selecting message subset: ${currentTokens} tokens needed, ${availableForMessages} available`);
    
    return this.tokenCounter.estimateMaxMessagesForTokens(
      this.messages,
      availableForMessages,
      0
    );
  }
  
  updateMaxContextTokens(newMax: number): void {
    this.maxContextTokens = newMax;
    logInfo('ContextManager', `Max context tokens updated to: ${newMax}`);
  }
}

export function getContextManager(): ContextManager {
  return ContextManager.getInstance();
}
