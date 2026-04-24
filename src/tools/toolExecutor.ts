import { v4 as uuidv4 } from 'uuid';
import * as childProcess from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { ToolChain, ToolExecution, LogEntry } from '../types';
import { ToolRegistry, getToolRegistry } from './toolRegistry';
import { getConfig } from '../config';
import { logInfo, logWarn, logDebug, logError } from '../utils/logger';

export interface ToolExecutionOptions {
  timeout?: number;
  workingDirectory?: string;
  env?: Record<string, string>;
  onLog?: (log: LogEntry) => void;
  onOutput?: (data: string) => void;
  onError?: (data: string) => void;
}

export interface InstallationProgress {
  toolName: string;
  phase: 'checking' | 'downloading' | 'installing' | 'verifying' | 'complete' | 'failed';
  message: string;
  progress?: number;
}

export class ToolExecutor {
  private static instance: ToolExecutor;
  private toolRegistry: ToolRegistry;
  private activeExecutions: Map<string, ToolExecution> = new Map();
  private executionHistory: ToolExecution[] = [];
  
  private constructor() {
    this.toolRegistry = getToolRegistry();
  }
  
  static getInstance(): ToolExecutor {
    if (!ToolExecutor.instance) {
      ToolExecutor.instance = new ToolExecutor();
    }
    return ToolExecutor.instance;
  }
  
  async checkToolInstalled(tool: ToolChain): Promise<{ installed: boolean; version?: string }> {
    logDebug('ToolExecutor', `Checking if ${tool.name} is installed...`);
    
    try {
      const result = await this.executeCommand(tool.checkCommand, {
        timeout: 30000,
        workingDirectory: this.toolRegistry.getToolsDirectory()
      });
      
      const output = result.output || '';
      const installed = result.exitCode === 0;
      
      // Try to extract version from output
      const versionMatch = output.match(/(?:version|v)?\s*(\d+\.\d+(?:\.\d+)?)/i);
      const version = versionMatch ? versionMatch[1] : undefined;
      
      logInfo('ToolExecutor', `${tool.name} check: installed=${installed}${version ? `, version=${version}` : ''}`);
      
      return { installed, version };
    } catch (error) {
      logDebug('ToolExecutor', `${tool.name} not installed: ${error}`);
      return { installed: false };
    }
  }
  
  async installTool(
    tool: ToolChain,
    onProgress?: (progress: InstallationProgress) => void
  ): Promise<boolean> {
    const config = getConfig();
    
    if (!config.toolChain.autoInstall) {
      logWarn('ToolExecutor', 'Auto-install is disabled in config');
      return false;
    }
    
    logInfo('ToolExecutor', `Installing ${tool.name}...`);
    
    if (onProgress) {
      onProgress({
        toolName: tool.name,
        phase: 'checking',
        message: 'Checking if already installed...'
      });
    }
    
    // Check if already installed
    const { installed, version } = await this.checkToolInstalled(tool);
    if (installed) {
      this.toolRegistry.updateToolStatus(tool.name, true, version);
      
      if (onProgress) {
        onProgress({
          toolName: tool.name,
          phase: 'complete',
          message: 'Already installed',
          progress: 100
        });
      }
      
      return true;
    }
    
    // Ensure tools directory exists
    const toolsDir = this.toolRegistry.getToolsDirectory();
    if (!fs.existsSync(toolsDir)) {
      fs.mkdirSync(toolsDir, { recursive: true });
    }
    
    // No install command specified
    if (!tool.installCommand) {
      logError('ToolExecutor', `${tool.name} has no install command`);
      
      if (onProgress) {
        onProgress({
          toolName: tool.name,
          phase: 'failed',
          message: 'No install command available'
        });
      }
      
      return false;
    }
    
    if (onProgress) {
      onProgress({
        toolName: tool.name,
        phase: 'downloading',
        message: 'Downloading and installing...',
        progress: 25
      });
    }
    
    try {
      const result = await this.executeCommand(tool.installCommand, {
        timeout: 300000, // 5 minutes
        workingDirectory: toolsDir
      });
      
      if (result.exitCode !== 0) {
        throw new Error(`Install command failed with exit code ${result.exitCode}: ${result.error}`);
      }
      
      if (onProgress) {
        onProgress({
          toolName: tool.name,
          phase: 'verifying',
          message: 'Verifying installation...',
          progress: 75
        });
      }
      
      // Verify installation
      const verifyResult = await this.checkToolInstalled(tool);
      
      if (!verifyResult.installed) {
        throw new Error('Installation verification failed');
      }
      
      this.toolRegistry.updateToolStatus(tool.name, true, verifyResult.version);
      
      if (onProgress) {
        onProgress({
          toolName: tool.name,
          phase: 'complete',
          message: 'Installation complete',
          progress: 100
        });
      }
      
      logInfo('ToolExecutor', `Successfully installed ${tool.name}`);
      return true;
    } catch (error) {
      logError('ToolExecutor', `Failed to install ${tool.name}`, error);
      
      if (onProgress) {
        onProgress({
          toolName: tool.name,
          phase: 'failed',
          message: error instanceof Error ? error.message : 'Installation failed'
        });
      }
      
      return false;
    }
  }
  
  async updateTool(
    tool: ToolChain,
    onProgress?: (progress: InstallationProgress) => void
  ): Promise<boolean> {
    const config = getConfig();
    
    if (!config.toolChain.autoUpdate) {
      logWarn('ToolExecutor', 'Auto-update is disabled in config');
      return false;
    }
    
    logInfo('ToolExecutor', `Updating ${tool.name}...`);
    
    // For now, re-run install as update
    return this.installTool(tool, onProgress);
  }
  
  async installAllTools(
    onProgress?: (progress: InstallationProgress, index: number, total: number) => void
  ): Promise<{ installed: number; failed: number; total: number }> {
    const tools = this.toolRegistry.getAllTools();
    let installed = 0;
    let failed = 0;
    
    for (let i = 0; i < tools.length; i++) {
      const tool = tools[i];
      if (!tool) continue;
      
      try {
        const success = await this.installTool(tool, (p) => {
          if (onProgress) {
            onProgress(p, i, tools.length);
          }
        });
        
        if (success) {
          installed++;
        } else {
          failed++;
        }
      } catch (error) {
        logError('ToolExecutor', `Error installing ${tool.name}`, error);
        failed++;
      }
    }
    
    logInfo('ToolExecutor', `Installed ${installed}/${tools.length} tools (${failed} failed)`);
    
    return { installed, failed, total: tools.length };
  }
  
  async executeTool(
    toolName: string,
    args: Record<string, unknown>,
    options?: ToolExecutionOptions
  ): Promise<ToolExecution> {
    const tool = this.toolRegistry.getTool(toolName);
    
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }
    
    // Check if installed
    const { installed } = await this.checkToolInstalled(tool);
    if (!installed) {
      const installSuccess = await this.installTool(tool);
      if (!installSuccess) {
        throw new Error(`Tool ${toolName} is not installed and could not be installed`);
      }
    }
    
    // Build command
    const command = this.buildCommand(tool, args);
    
    logInfo('ToolExecutor', `Executing ${toolName}: ${command}`);
    
    // Create execution record
    const execution: ToolExecution = {
      id: uuidv4(),
      toolId: tool.id,
      toolName: tool.name,
      arguments: args,
      startTime: new Date(),
      status: 'running',
      logs: []
    };
    
    this.activeExecutions.set(execution.id, execution);
    
    try {
      const config = getConfig();
      const timeout = options?.timeout || config.toolChain.maxExecutionTime * 1000;
      
      const result = await this.executeCommand(command, {
        timeout,
        workingDirectory: options?.workingDirectory || this.toolRegistry.getToolsDirectory(),
        env: options?.env,
        onLog: (log) => {
          execution.logs.push(log);
          if (options?.onLog) {
            options.onLog(log);
          }
        },
        onOutput: options?.onOutput,
        onError: options?.onError
      });
      
      execution.endTime = new Date();
      execution.exitCode = result.exitCode;
      execution.output = this.parseOutput(tool, result.output || '');
      execution.error = result.error;
      execution.status = result.exitCode === 0 ? 'completed' : 'failed';
      
      logInfo('ToolExecutor', `${toolName} execution ${execution.status} (exit code: ${result.exitCode})`);
      
      // Move to history
      this.activeExecutions.delete(execution.id);
      this.executionHistory.push(execution);
      
      return execution;
    } catch (error) {
      execution.endTime = new Date();
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : String(error);
      
      logError('ToolExecutor', `${toolName} execution failed`, error);
      
      this.activeExecutions.delete(execution.id);
      this.executionHistory.push(execution);
      
      return execution;
    }
  }
  
  private buildCommand(tool: ToolChain, args: Record<string, unknown>): string {
    let command = tool.executeCommand;
    
    for (const argDef of tool.arguments) {
      const value = args[argDef.name];
      
      if (value === undefined || value === null) {
        // Use default if available
        if (argDef.default !== undefined) {
          command += ` ${this.formatArgument(argDef.name, argDef.default, argDef.type)}`;
        }
        continue;
      }
      
      // Skip if boolean false
      if (argDef.type === 'boolean' && value === false) {
        continue;
      }
      
      command += ` ${this.formatArgument(argDef.name, value, argDef.type)}`;
    }
    
    return command;
  }
  
  private formatArgument(name: string, value: unknown, type: string): string {
    if (type === 'boolean') {
      // Boolean flags are just the flag
      return `--${name}`;
    }
    
    // Quote string values
    const stringValue = String(value);
    const needsQuotes = stringValue.includes(' ') || stringValue.includes('"') || stringValue.includes("'");
    
    if (needsQuotes) {
      return `--${name}="${stringValue.replace(/"/g, '\\"')}"`;
    }
    
    return `--${name}=${stringValue}`;
  }
  
  private parseOutput(tool: ToolChain, rawOutput: string): unknown {
    const parser = tool.outputParser;
    
    switch (parser.type) {
      case 'json':
        try {
          return JSON.parse(rawOutput);
        } catch {
          return rawOutput;
        }
        
      case 'xml':
      case 'regex':
      case 'csv':
      case 'custom':
      default:
        // For now, return raw output
        // Could implement regex-based parsing in the future
        return rawOutput;
    }
  }
  
  private async executeCommand(
    command: string,
    options: {
      timeout: number;
      workingDirectory?: string;
      env?: Record<string, string>;
      onLog?: (log: LogEntry) => void;
      onOutput?: (data: string) => void;
      onError?: (data: string) => void;
    }
  ): Promise<{ exitCode: number; output: string; error: string }> {
    return new Promise((resolve, reject) => {
      const isWindows = process.platform === 'win32';
      const shell = isWindows ? 'powershell' : 'bash';
      const shellArg = isWindows ? ['-Command'] : ['-c'];
      
      const proc = childProcess.spawn(shell, [...shellArg, command], {
        cwd: options.workingDirectory || process.cwd(),
        env: {
          ...process.env,
          ...options.env
        },
        stdio: 'pipe'
      });
      
      let output = '';
      let error = '';
      let timedOut = false;
      
      const timeout = setTimeout(() => {
        timedOut = true;
        proc.kill('SIGTERM');
        logWarn('ToolExecutor', `Command timed out after ${options.timeout}ms: ${command}`);
      }, options.timeout);
      
      proc.stdout?.on('data', (data: Buffer) => {
        const text = data.toString();
        output += text;
        
        if (options.onOutput) {
          options.onOutput(text);
        }
        
        if (options.onLog) {
          options.onLog({
            timestamp: new Date(),
            level: 'info',
            source: 'stdout',
            message: text.trim()
          });
        }
      });
      
      proc.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();
        error += text;
        
        if (options.onError) {
          options.onError(text);
        }
        
        if (options.onLog) {
          options.onLog({
            timestamp: new Date(),
            level: 'warn',
            source: 'stderr',
            message: text.trim()
          });
        }
      });
      
      proc.on('close', (code) => {
        clearTimeout(timeout);
        
        if (timedOut) {
          reject(new Error(`Command timed out: ${command}`));
          return;
        }
        
        resolve({
          exitCode: code ?? -1,
          output,
          error
        });
      });
      
      proc.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }
  
  getActiveExecutions(): ToolExecution[] {
    return Array.from(this.activeExecutions.values());
  }
  
  getExecutionHistory(): ToolExecution[] {
    return [...this.executionHistory];
  }
  
  getExecution(id: string): ToolExecution | undefined {
    return this.activeExecutions.get(id) || this.executionHistory.find(e => e.id === id);
  }
  
  cancelExecution(id: string): boolean {
    const execution = this.activeExecutions.get(id);
    if (!execution) {
      return false;
    }
    
    // Note: We can't actually kill the process here since we don't track it
    // In a real implementation, we would track the child process
    execution.status = 'failed';
    execution.error = 'Cancelled by user';
    execution.endTime = new Date();
    
    this.activeExecutions.delete(id);
    this.executionHistory.push(execution);
    
    logInfo('ToolExecutor', `Cancelled execution: ${id}`);
    
    return true;
  }
}

export function getToolExecutor(): ToolExecutor {
  return ToolExecutor.getInstance();
}
