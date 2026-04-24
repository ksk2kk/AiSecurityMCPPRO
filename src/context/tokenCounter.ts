import { Message } from '../types';
import { logDebug, logInfo } from '../utils/logger';

// Simple token estimation based on OpenAI's approximation
// 1 token ≈ 4 characters in English
// 1 token ≈ 0.75 words
// This is a rough estimate for models without native tokenizers

const SPECIAL_TOKEN_COST = 4; // Approximate cost for special tokens

export class TokenCounter {
  private static instance: TokenCounter;
  
  private constructor() {}
  
  static getInstance(): TokenCounter {
    if (!TokenCounter.instance) {
      TokenCounter.instance = new TokenCounter();
    }
    return TokenCounter.instance;
  }
  
  countTokens(text: string): number {
    if (!text || text.length === 0) {
      return 0;
    }
    
    // Count characters (approximate)
    const charCount = text.length;
    
    // Count words
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
    
    // Use the more conservative estimate
    const charBased = Math.ceil(charCount / 4);
    const wordBased = Math.ceil(wordCount / 0.75);
    
    const tokenCount = Math.max(charBased, wordBased);
    
    logDebug('TokenCounter', `Token count for text (${charCount} chars, ${wordCount} words): ${tokenCount}`);
    
    return tokenCount;
  }
  
  countMessage(message: Message): number {
    let totalTokens = 0;
    
    // Base tokens for message structure
    totalTokens += SPECIAL_TOKEN_COST;
    
    // Count role token
    totalTokens += this.countTokens(message.role);
    
    // Count content
    if (message.content) {
      totalTokens += this.countTokens(message.content);
    }
    
    // Count name if present
    if (message.name) {
      totalTokens += this.countTokens(message.name);
      totalTokens += 2; // Name field overhead
    }
    
    // Count tool_calls if present
    if (message.tool_calls && message.tool_calls.length > 0) {
      for (const toolCall of message.tool_calls) {
        totalTokens += this.countTokens(toolCall.function.name);
        totalTokens += this.countTokens(toolCall.function.arguments);
        totalTokens += 4; // Tool call structure overhead
      }
    }
    
    // Count tool_call_id if present
    if (message.tool_call_id) {
      totalTokens += this.countTokens(message.tool_call_id);
      totalTokens += 2;
    }
    
    logDebug('TokenCounter', `Message token count: ${totalTokens} (role: ${message.role})`);
    
    return totalTokens;
  }
  
  countMessages(messages: Message[]): number {
    if (!messages || messages.length === 0) {
      return 0;
    }
    
    let totalTokens = 0;
    
    // Add base tokens for the entire conversation
    totalTokens += 3; // Conversation wrapper
    
    for (const message of messages) {
      totalTokens += this.countMessage(message);
    }
    
    // Add reply overhead
    totalTokens += 3;
    
    logDebug('TokenCounter', `Total message count for ${messages.length} messages: ${totalTokens}`);
    
    return totalTokens;
  }
  
  estimateMaxMessagesForTokens(messages: Message[], maxTokens: number, reserveTokens: number = 0): Message[] {
    const availableTokens = maxTokens - reserveTokens;
    
    if (availableTokens <= 0) {
      return [];
    }
    
    // Always keep system messages
    const systemMessages = messages.filter(m => m.role === 'system');
    const systemTokens = this.countMessages(systemMessages);
    
    if (systemTokens > availableTokens) {
      logInfo('TokenCounter', 'System messages exceed available tokens, returning only system messages');
      return systemMessages;
    }
    
    const remainingTokens = availableTokens - systemTokens;
    
    // Work backwards from the end for non-system messages
    const nonSystemMessages = messages.filter(m => m.role !== 'system');
    const selectedNonSystem: Message[] = [];
    let currentTokens = 0;
    
    for (let i = nonSystemMessages.length - 1; i >= 0; i--) {
      const message = nonSystemMessages[i];
      if (!message) continue;
      
      const messageTokens = this.countMessage(message);
      
      if (currentTokens + messageTokens <= remainingTokens) {
        selectedNonSystem.unshift(message);
        currentTokens += messageTokens;
      } else {
        // Try to include partial if it's the last message
        if (i === nonSystemMessages.length - 1) {
          // Truncate content to fit
          const truncatedMessage = this.truncateMessageToTokens(message, remainingTokens - currentTokens);
          if (truncatedMessage) {
            selectedNonSystem.unshift(truncatedMessage);
          }
        }
        break;
      }
    }
    
    const result = [...systemMessages, ...selectedNonSystem];
    
    logInfo('TokenCounter', `Selected ${result.length} messages (${systemMessages.length} system, ${selectedNonSystem.length} user/assistant) using ~${systemTokens + currentTokens} tokens`);
    
    return result;
  }
  
  private truncateMessageToTokens(message: Message, maxTokens: number): Message | null {
    if (!message.content) {
      return null;
    }
    
    const content = message.content;
    const baseTokens = this.countMessage({ ...message, content: '' });
    
    const availableContentTokens = maxTokens - baseTokens;
    
    if (availableContentTokens <= 0) {
      return null;
    }
    
    // Approximate characters needed
    const maxChars = availableContentTokens * 4;
    
    if (content.length <= maxChars) {
      return message;
    }
    
    const truncatedContent = content.substring(0, maxChars) + '... [truncated]';
    
    logDebug('TokenCounter', `Truncated message from ${content.length} to ${truncatedContent.length} chars`);
    
    return {
      ...message,
      content: truncatedContent
    };
  }
}

export function getTokenCounter(): TokenCounter {
  return TokenCounter.getInstance();
}
