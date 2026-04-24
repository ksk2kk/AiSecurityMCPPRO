import { Message } from '../types';
import { logDebug, logInfo, logWarn } from '../utils/logger';

let encoder: { encode: (text: string) => number[]; decode: (tokens: number[]) => string } | null = null;

function loadEncoder(): void {
  if (encoder) return;
  
  try {
    // Try to load gpt-3-encoder
    const GPT3Encoder = require('gpt-3-encoder');
    encoder = {
      encode: GPT3Encoder.encode,
      decode: GPT3Encoder.decode
    };
    logInfo('TokenCounter', 'Using gpt-3-encoder for precise token counting');
  } catch (error) {
    logWarn('TokenCounter', 'gpt-3-encoder not available, using fallback estimation method');
    encoder = null;
  }
}

const SPECIAL_TOKEN_COST = 4;

export class TokenCounter {
  private static instance: TokenCounter;
  
  private constructor() {
    loadEncoder();
  }
  
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
    
    if (encoder) {
      try {
        const tokens = encoder.encode(text);
        const count = tokens.length;
        logDebug('TokenCounter', `gpt-3-encoder counted ${count} tokens for text of ${text.length} chars`);
        return count;
      } catch (error) {
        logDebug('TokenCounter', 'gpt-3-encoder failed, using fallback');
      }
    }
    
    return this.countTokensFallback(text);
  }
  
  private countTokensFallback(text: string): number {
    // Improved fallback based on OpenAI's guidelines
    // For English: ~1 token = 4 characters or 0.75 words
    // For Chinese/Japanese/Korean: ~1 token = 1-2 characters
    
    const hasCJK = /[\u4e00-\u9fff\u3040-\u30ff\u3130-\u318f]/.test(text);
    
    if (hasCJK) {
      // Count CJK characters more accurately
      let cjkCount = 0;
      let nonCjkCount = 0;
      
      for (const char of text) {
        if (/[\u4e00-\u9fff\u3040-\u30ff\u3130-\u318f]/.test(char)) {
          cjkCount++;
        } else {
          nonCjkCount++;
        }
      }
      
      // CJK: ~1-2 tokens per character, use 1.5 as estimate
      // Non-CJK: ~1 token per 4 characters
      const cjkTokens = Math.ceil(cjkCount * 1.5);
      const nonCjkTokens = Math.ceil(nonCjkCount / 4);
      
      const total = cjkTokens + nonCjkTokens;
      logDebug('TokenCounter', `Fallback counted ${total} tokens (CJK: ${cjkCount}, non-CJK: ${nonCjkCount})`);
      
      return total;
    }
    
    // Non-CJK text
    const charCount = text.length;
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
    
    const charBased = Math.ceil(charCount / 4);
    const wordBased = Math.ceil(wordCount / 0.75);
    
    const tokenCount = Math.max(charBased, wordBased);
    
    logDebug('TokenCounter', `Fallback counted ${tokenCount} tokens (${charCount} chars, ${wordCount} words)`);
    
    return tokenCount;
  }
  
  countMessage(message: Message): number {
    let totalTokens = 0;
    
    // Base tokens for message structure
    // According to OpenAI's counting:
    // Every message follows <|start|>{role/name}\n{content}<|end|>\n
    
    totalTokens += 4; // Base overhead for the message wrapper
    
    // Count role
    totalTokens += this.countTokens(message.role);
    totalTokens += 1; // For the colon and newline
    
    // Count content
    if (message.content) {
      totalTokens += this.countTokens(message.content);
    }
    
    // Count name if present
    if (message.name) {
      // If there's a name, it replaces the role in the format
      // <|start|>name:{name}\n{content}<|end|>\n
      totalTokens += this.countTokens(message.name);
      totalTokens += 2; // For "name:" prefix
    }
    
    // Count tool_calls if present
    if (message.tool_calls && message.tool_calls.length > 0) {
      for (const toolCall of message.tool_calls) {
        totalTokens += this.countTokens(toolCall.function.name);
        totalTokens += this.countTokens(toolCall.function.arguments);
        totalTokens += 6; // Tool call structure overhead
      }
    }
    
    // Count tool_call_id if present
    if (message.tool_call_id) {
      totalTokens += this.countTokens(message.tool_call_id);
      totalTokens += 3; // Tool call ID overhead
    }
    
    logDebug('TokenCounter', `Message token count: ${totalTokens} (role: ${message.role})`);
    
    return totalTokens;
  }
  
  countMessages(messages: Message[]): number {
    if (!messages || messages.length === 0) {
      return 0;
    }
    
    let totalTokens = 0;
    
    // According to OpenAI's format:
    // <|start|>system\n{system_message}<|end|>\n
    // <|start|>user\n{user_message}<|end|>\n
    // <|start|>assistant\n{assistant_message}<|end|>\n
    // Plus an additional 3 tokens for the final assistant prompt
    
    for (const message of messages) {
      totalTokens += this.countMessage(message);
    }
    
    // Add 3 tokens for the final assistant prompt
    totalTokens += 3;
    
    logDebug('TokenCounter', `Total tokens for ${messages.length} messages: ${totalTokens}`);
    
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
    
    const baseTokens = this.countMessage({ ...message, content: '' });
    const availableContentTokens = maxTokens - baseTokens;
    
    if (availableContentTokens <= 0) {
      return null;
    }
    
    const content = message.content;
    
    if (encoder) {
      try {
        const tokens = encoder.encode(content);
        if (tokens.length <= availableContentTokens) {
          return message;
        }
        
        const truncatedTokens = tokens.slice(0, availableContentTokens - 3);
        const truncatedContent = encoder.decode(truncatedTokens) + '... [truncated]';
        
        logDebug('TokenCounter', `Truncated message using encoder from ${tokens.length} to ${availableContentTokens} tokens`);
        
        return {
          ...message,
          content: truncatedContent
        };
      } catch {
        // Fall through to char-based truncation
      }
    }
    
    // Char-based truncation fallback
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
