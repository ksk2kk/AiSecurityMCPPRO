import { v4 as uuidv4 } from 'uuid';
import { UserClarification, Message, ToolDefinition } from '../types';
import { getModelManager } from '../models/modelManager';
import { getToolRegistry } from '../tools/toolRegistry';
import { logInfo, logWarn, logDebug, logError } from '../utils/logger';

export interface RequirementAnalysis {
  id: string;
  originalRequest: string;
  targets: string[];
  scanType: 'full' | 'recon' | 'vulnerability' | 'exploit' | 'custom';
  requiredTools: string[];
  depth: 'quick' | 'standard' | 'deep';
  timeConstraints?: number;
  riskTolerance: 'low' | 'medium' | 'high';
  constraints: string[];
  clarificationsNeeded: UserClarification[];
  isComplete: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClarificationQuestion {
  id: string;
  question: string;
  type: 'target' | 'scope' | 'timing' | 'risk' | 'tools' | 'other';
  options?: string[];
  context: string;
}

interface ParsedAnalysisResponse {
  targets?: string[];
  scanType?: 'full' | 'recon' | 'vulnerability' | 'exploit' | 'custom';
  requiredTools?: string[];
  depth?: 'quick' | 'standard' | 'deep';
  timeConstraints?: number;
  riskTolerance?: 'low' | 'medium' | 'high';
  constraints?: string[];
  missingInfo?: string[];
  questions?: Array<{
    question: string;
    type?: string;
    options?: string[];
  }>;
}

export class RequirementAnalyzer {
  private static instance: RequirementAnalyzer;
  private modelManager = getModelManager();
  private toolRegistry = getToolRegistry();
  private currentAnalysis?: RequirementAnalysis;
  private analysisHistory: RequirementAnalysis[] = [];
  
  private constructor() {}
  
  static getInstance(): RequirementAnalyzer {
    if (!RequirementAnalyzer.instance) {
      RequirementAnalyzer.instance = new RequirementAnalyzer();
    }
    return RequirementAnalyzer.instance;
  }
  
  async analyzeRequest(
    userRequest: string,
    contextMessages?: Message[]
  ): Promise<RequirementAnalysis> {
    logInfo('RequirementAnalyzer', `Analyzing request: ${userRequest.substring(0, 100)}...`);
    
    const tools = this.toolRegistry.getAllToolDefinitions();
    const toolNames = tools.map(t => t.function.name).join(', ');
    
    const systemPrompt = `You are a security requirements analyst. Analyze the user's request for a security scan/penetration test and extract structured requirements.

AVAILABLE TOOLS:
${toolNames}

SECURITY SCAN TYPES:
- recon: Information gathering, subdomain enumeration, technology detection
- vulnerability: Vulnerability scanning and detection
- full: Comprehensive scan including recon and vulnerability scanning
- exploit: Active exploitation (requires explicit permission)
- custom: Custom scan based on specific requirements

SCAN DEPTH:
- quick: Fast scan, common ports only, basic checks
- standard: Balanced scan, most common ports and checks
- deep: Thorough scan, all ports, extensive checks

RISK TOLERANCE:
- low: Only safe, non-intrusive scans
- medium: Standard vulnerability scans, may cause minor load
- high: Aggressive scans, may cause service disruption

RESPOND WITH A JSON OBJECT containing:
{
  "targets": ["array of target IPs/domains"],
  "scanType": "full|recon|vulnerability|exploit|custom",
  "requiredTools": ["array of tool names"],
  "depth": "quick|standard|deep",
  "timeConstraints": null or number in minutes,
  "riskTolerance": "low|medium|high",
  "constraints": ["array of constraints/limitations"],
  "missingInfo": ["array of missing critical information"],
  "questions": [
    {
      "question": "specific question to ask user",
      "type": "target|scope|timing|risk|tools|other",
      "options": ["array of possible answers or null"]
    }
  ]
}`;

    const contextStr = contextMessages && contextMessages.length > 0
      ? `\n\nCONVERSATION CONTEXT:\n${contextMessages.map(m => `${m.role}: ${m.content}`).join('\n')}`
      : '';
    
    const userPrompt = `USER REQUEST:
${userRequest}${contextStr}

Analyze this request and provide the JSON response.`;

    try {
      const response = await this.modelManager.chatCompletion({
        model: this.modelManager.getActiveAdapter().defaultModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 2048
      });
      
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from model');
      }
      
      const parsed = this.parseAnalysisResponse(content);
      
      const analysis: RequirementAnalysis = {
        id: uuidv4(),
        originalRequest: userRequest,
        targets: parsed.targets || [],
        scanType: parsed.scanType || 'full',
        requiredTools: parsed.requiredTools || [],
        depth: parsed.depth || 'standard',
        timeConstraints: parsed.timeConstraints,
        riskTolerance: parsed.riskTolerance || 'medium',
        constraints: parsed.constraints || [],
        clarificationsNeeded: (parsed.questions || []).map((q: Record<string, unknown>) => ({
          id: uuidv4(),
          question: String(q.question),
          context: userRequest,
          options: q.options as string[] | undefined,
          status: 'pending',
          askedAt: new Date()
        })),
        isComplete: (parsed.missingInfo || []).length === 0 && (parsed.questions || []).length === 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      this.currentAnalysis = analysis;
      this.analysisHistory.push(analysis);
      
      logInfo('RequirementAnalyzer', 
        `Analysis complete. Targets: ${analysis.targets.length}, ` +
        `Type: ${analysis.scanType}, ` +
        `Complete: ${analysis.isComplete}, ` +
        `Questions: ${analysis.clarificationsNeeded.length}`
      );
      
      return analysis;
    } catch (error) {
      logError('RequirementAnalyzer', 'Failed to analyze request', error);
      
      // Fallback: create basic analysis
      const fallbackAnalysis: RequirementAnalysis = {
        id: uuidv4(),
        originalRequest: userRequest,
        targets: this.extractTargetsFromText(userRequest),
        scanType: 'full',
        requiredTools: [],
        depth: 'standard',
        riskTolerance: 'medium',
        constraints: [],
        clarificationsNeeded: [{
          id: uuidv4(),
          question: 'Could you provide more details about what you want to scan?',
          context: userRequest,
          status: 'pending',
          askedAt: new Date()
        }],
        isComplete: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      this.currentAnalysis = fallbackAnalysis;
      return fallbackAnalysis;
    }
  }
  
  private parseAnalysisResponse(content: string): ParsedAnalysisResponse {
    try {
      // Try to find JSON object
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON object found');
      }
      
      return JSON.parse(jsonMatch[0]) as ParsedAnalysisResponse;
    } catch (error) {
      logWarn('RequirementAnalyzer', 'Failed to parse JSON response', error);
      return {};
    }
  }
  
  private extractTargetsFromText(text: string): string[] {
    // Simple regex patterns for common target formats
    const targets: string[] = [];
    
    // IP address pattern
    const ipPattern = /\b(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2})?\b/g;
    const ipMatches = text.matchAll(ipPattern);
    for (const match of ipMatches) {
      targets.push(match[0]);
    }
    
    // Domain pattern (simple)
    const domainPattern = /\b[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?\b/g;
    const domainMatches = text.matchAll(domainPattern);
    for (const match of domainMatches) {
      const domain = match[0];
      // Skip common false positives
      if (!domain.endsWith('.txt') && 
          !domain.endsWith('.json') && 
          !domain.endsWith('.log') &&
          !domain.endsWith('.js') &&
          !domain.endsWith('.css') &&
          !domain.endsWith('.html')) {
        targets.push(domain);
      }
    }
    
    // URL pattern
    const urlPattern = /https?:\/\/[^\s]+/g;
    const urlMatches = text.matchAll(urlPattern);
    for (const match of urlMatches) {
      targets.push(match[0]);
    }
    
    // Remove duplicates
    return [...new Set(targets)];
  }
  
  getCurrentAnalysis(): RequirementAnalysis | undefined {
    return this.currentAnalysis;
  }
  
  async answerClarification(
    clarificationId: string,
    answer: string
  ): Promise<RequirementAnalysis | null> {
    if (!this.currentAnalysis) {
      return null;
    }
    
    const clarification = this.currentAnalysis.clarificationsNeeded.find(
      c => c.id === clarificationId
    );
    
    if (!clarification) {
      return null;
    }
    
    clarification.answer = answer;
    clarification.answeredAt = new Date();
    clarification.status = 'answered';
    
    logInfo('RequirementAnalyzer', `Answered clarification: ${clarification.question.substring(0, 50)}...`);
    
    // Check if all clarifications are answered
    const allAnswered = this.currentAnalysis.clarificationsNeeded.every(
      c => c.status === 'answered' || c.status === 'skipped'
    );
    
    if (allAnswered) {
      // Re-analyze with all answers
      const fullContext = `${this.currentAnalysis.originalRequest}\n\nAdditional clarifications:\n` +
        this.currentAnalysis.clarificationsNeeded
          .filter(c => c.answer)
          .map(c => `- Q: ${c.question}\n  A: ${c.answer}`)
          .join('\n');
      
      const reAnalysis = await this.analyzeRequest(fullContext);
      reAnalysis.id = this.currentAnalysis.id;
      reAnalysis.createdAt = this.currentAnalysis.createdAt;
      
      this.currentAnalysis = reAnalysis;
      
      logInfo('RequirementAnalyzer', 'Re-analysis complete with all clarifications');
    }
    
    this.currentAnalysis.updatedAt = new Date();
    
    return this.currentAnalysis;
  }
  
  skipClarification(clarificationId: string): boolean {
    if (!this.currentAnalysis) {
      return false;
    }
    
    const clarification = this.currentAnalysis.clarificationsNeeded.find(
      c => c.id === clarificationId
    );
    
    if (!clarification) {
      return false;
    }
    
    clarification.status = 'skipped';
    clarification.answeredAt = new Date();
    
    logInfo('RequirementAnalyzer', `Skipped clarification: ${clarification.question.substring(0, 50)}...`);
    
    this.currentAnalysis.updatedAt = new Date();
    
    return true;
  }
  
  needsClarification(): boolean {
    if (!this.currentAnalysis) {
      return true;
    }
    
    return !this.currentAnalysis.isComplete && 
           this.currentAnalysis.clarificationsNeeded.some(c => c.status === 'pending');
  }
  
  getPendingClarifications(): UserClarification[] {
    if (!this.currentAnalysis) {
      return [];
    }
    
    return this.currentAnalysis.clarificationsNeeded.filter(c => c.status === 'pending');
  }
  
  generateTodoListPrompt(): string {
    if (!this.currentAnalysis) {
      return 'Perform a basic security scan.';
    }
    
    const analysis = this.currentAnalysis;
    
    let prompt = `Security scan requirements:
- Request: ${analysis.originalRequest}
- Targets: ${analysis.targets.join(', ') || 'Not specified'}
- Scan Type: ${analysis.scanType}
- Depth: ${analysis.depth}
- Risk Tolerance: ${analysis.riskTolerance}`;

    if (analysis.timeConstraints) {
      prompt += `\n- Time Limit: ${analysis.timeConstraints} minutes`;
    }
    
    if (analysis.requiredTools.length > 0) {
      prompt += `\n- Suggested Tools: ${analysis.requiredTools.join(', ')}`;
    }
    
    if (analysis.constraints.length > 0) {
      prompt += `\n- Constraints: ${analysis.constraints.join('; ')}`;
    }
    
    return prompt;
  }
  
  getAnalysisHistory(): RequirementAnalysis[] {
    return [...this.analysisHistory];
  }
  
  clearCurrentAnalysis(): void {
    this.currentAnalysis = undefined;
    logInfo('RequirementAnalyzer', 'Cleared current analysis');
  }
}

export function getRequirementAnalyzer(): RequirementAnalyzer {
  return RequirementAnalyzer.getInstance();
}
