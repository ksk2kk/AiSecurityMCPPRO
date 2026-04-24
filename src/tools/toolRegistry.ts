import { v4 as uuidv4 } from 'uuid';
import { ToolChain, ToolDefinition } from '../types';
import { logInfo, logWarn, logDebug, logError } from '../utils/logger';
import * as path from 'path';
import * as fs from 'fs';

const defaultTools: Omit<ToolChain, 'id' | 'installed' | 'lastUpdated'>[] = [
  {
    name: 'nmap',
    description: 'Network exploration tool and security/port scanner',
    category: 'scanner',
    version: '7.94',
    source: 'chocolatey',
    checkCommand: 'nmap --version',
    executeCommand: 'nmap',
    arguments: [
      {
        name: 'target',
        type: 'string',
        description: 'Target IP address or hostname',
        required: true
      },
      {
        name: 'ports',
        type: 'string',
        description: 'Ports to scan (e.g., 1-1000)',
        required: false,
        default: '1-1000'
      },
      {
        name: 'scanType',
        type: 'string',
        description: 'Scan type',
        required: false,
        default: '-sV',
        options: ['-sS', '-sT', '-sU', '-sV', '-sC', '-A']
      },
      {
        name: 'timing',
        type: 'string',
        description: 'Timing template',
        required: false,
        default: '-T3',
        options: ['-T0', '-T1', '-T2', '-T3', '-T4', '-T5']
      },
      {
        name: 'outputFormat',
        type: 'string',
        description: 'Output format',
        required: false,
        default: '-oX',
        options: ['-oN', '-oX', '-oG', '-oA']
      }
    ],
    outputParser: {
      type: 'xml',
      fields: ['host', 'port', 'service', 'version']
    }
  },
  {
    name: 'nikto',
    description: 'Web server vulnerability scanner',
    category: 'scanner',
    version: '2.1.6',
    source: 'custom',
    installCommand: 'git clone https://github.com/sullo/nikto.git',
    checkCommand: 'perl nikto/program/nikto.pl -Version',
    executeCommand: 'perl nikto/program/nikto.pl',
    arguments: [
      {
        name: 'host',
        type: 'string',
        description: 'Target host',
        required: true
      },
      {
        name: 'port',
        type: 'number',
        description: 'Target port',
        required: false,
        default: 80
      },
      {
        name: 'ssl',
        type: 'boolean',
        description: 'Use SSL',
        required: false,
        default: false
      },
      {
        name: 'output',
        type: 'string',
        description: 'Output file',
        required: false
      }
    ],
    outputParser: {
      type: 'regex',
      pattern: 'OSVDB-\\d+:|\\[\\+\\]|\\[\\*\\]'
    }
  },
  {
    name: 'sqlmap',
    description: 'Automatic SQL injection and database takeover tool',
    category: 'exploit',
    version: '1.7.12',
    source: 'custom',
    installCommand: 'git clone --depth 1 https://github.com/sqlmapproject/sqlmap.git',
    checkCommand: 'python sqlmap/sqlmap.py --version',
    executeCommand: 'python sqlmap/sqlmap.py',
    arguments: [
      {
        name: 'url',
        type: 'string',
        description: 'Target URL',
        required: true
      },
      {
        name: 'data',
        type: 'string',
        description: 'POST data',
        required: false
      },
      {
        name: 'level',
        type: 'number',
        description: 'Level of tests (1-5)',
        required: false,
        default: 1
      },
      {
        name: 'risk',
        type: 'number',
        description: 'Risk of tests (1-3)',
        required: false,
        default: 1
      },
      {
        name: 'dbs',
        type: 'boolean',
        description: 'Enumerate DBMS databases',
        required: false,
        default: false
      },
      {
        name: 'tables',
        type: 'boolean',
        description: 'Enumerate DBMS database tables',
        required: false,
        default: false
      },
      {
        name: 'dump',
        type: 'boolean',
        description: 'Dump DBMS database table entries',
        required: false,
        default: false
      }
    ],
    outputParser: {
      type: 'regex',
      pattern: '\\[\\*\\]|\\[\\+\\]|\\[!\\]'
    }
  },
  {
    name: 'gobuster',
    description: 'Directory/file & DNS busting tool',
    category: 'recon',
    version: '3.6',
    source: 'custom',
    installCommand: 'go install github.com/OJ/gobuster/v3@latest',
    checkCommand: 'gobuster --version',
    executeCommand: 'gobuster',
    arguments: [
      {
        name: 'mode',
        type: 'string',
        description: 'Operation mode',
        required: true,
        options: ['dir', 'dns', 'vhost', 's3', 'fuzz']
      },
      {
        name: 'url',
        type: 'string',
        description: 'Target URL/domain',
        required: true
      },
      {
        name: 'wordlist',
        type: 'string',
        description: 'Path to wordlist',
        required: true
      },
      {
        name: 'threads',
        type: 'number',
        description: 'Number of concurrent threads',
        required: false,
        default: 10
      }
    ],
    outputParser: {
      type: 'regex',
      pattern: 'Status:|\\d+|Size:'
    }
  },
  {
    name: 'whatweb',
    description: 'Web technology identification tool',
    category: 'recon',
    version: '0.5.5',
    source: 'custom',
    installCommand: 'git clone https://github.com/urbanadventurer/WhatWeb.git',
    checkCommand: 'ruby WhatWeb/whatweb --version',
    executeCommand: 'ruby WhatWeb/whatweb',
    arguments: [
      {
        name: 'target',
        type: 'string',
        description: 'Target URL or IP',
        required: true
      },
      {
        name: 'aggression',
        type: 'number',
        description: 'Aggression level (1-4)',
        required: false,
        default: 1
      },
      {
        name: 'output',
        type: 'string',
        description: 'Output file',
        required: false
      }
    ],
    outputParser: {
      type: 'regex',
      pattern: '\\[\\d+\\]|Title:|HTTP Status:'
    }
  },
  {
    name: 'testssl',
    description: 'TLS/SSL security testing tool',
    category: 'scanner',
    version: '3.2',
    source: 'custom',
    installCommand: 'git clone --depth 1 https://github.com/drwetter/testssl.sh.git',
    checkCommand: 'bash testssl.sh/testssl.sh --version',
    executeCommand: 'bash testssl.sh/testssl.sh',
    arguments: [
      {
        name: 'target',
        type: 'string',
        description: 'Target host:port',
        required: true
      },
      {
        name: 'output',
        type: 'string',
        description: 'Output format',
        required: false,
        options: ['--json', '--csv', '--html']
      }
    ],
    outputParser: {
      type: 'regex',
      pattern: '\\[\\*\\]|\\[\\+\\]|\\[!!\\]|VULNERABLE'
    }
  },
  {
    name: 'subfinder',
    description: 'Subdomain discovery tool',
    category: 'recon',
    version: '2.6.3',
    source: 'custom',
    installCommand: 'go install github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest',
    checkCommand: 'subfinder -version',
    executeCommand: 'subfinder',
    arguments: [
      {
        name: 'domain',
        type: 'string',
        description: 'Target domain',
        required: true
      },
      {
        name: 'output',
        type: 'string',
        description: 'Output file',
        required: false
      },
      {
        name: 'threads',
        type: 'number',
        description: 'Number of threads',
        required: false,
        default: 10
      }
    ],
    outputParser: {
      type: 'regex',
      pattern: '^[a-zA-Z0-9][a-zA-Z0-9-]*\\.[a-zA-Z]{2,}$'
    }
  },
  {
    name: 'httpx',
    description: 'HTTP toolkit',
    category: 'recon',
    version: '1.6.0',
    source: 'custom',
    installCommand: 'go install github.com/projectdiscovery/httpx/cmd/httpx@latest',
    checkCommand: 'httpx -version',
    executeCommand: 'httpx',
    arguments: [
      {
        name: 'list',
        type: 'string',
        description: 'Input file with hosts',
        required: false
      },
      {
        name: 'target',
        type: 'string',
        description: 'Single target URL',
        required: false
      },
      {
        name: 'ports',
        type: 'string',
        description: 'Ports to probe',
        required: false
      },
      {
        name: 'tech',
        type: 'boolean',
        description: 'Detect technologies',
        required: false,
        default: true
      },
      {
        name: 'status',
        type: 'boolean',
        description: 'Show status code',
        required: false,
        default: true
      },
      {
        name: 'title',
        type: 'boolean',
        description: 'Show page title',
        required: false,
        default: false
      }
    ],
    outputParser: {
      type: 'regex',
      pattern: '\\[\\d+\\]|\\[.*\\]'
    }
  },
  {
    name: 'nuclei',
    description: 'Vulnerability scanner based on templates',
    category: 'scanner',
    version: '3.2.0',
    source: 'custom',
    installCommand: 'go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest',
    checkCommand: 'nuclei -version',
    executeCommand: 'nuclei',
    arguments: [
      {
        name: 'target',
        type: 'string',
        description: 'Target URL/IP',
        required: false
      },
      {
        name: 'list',
        type: 'string',
        description: 'List of targets',
        required: false
      },
      {
        name: 'templates',
        type: 'string',
        description: 'Templates to run',
        required: false
      },
      {
        name: 'severity',
        type: 'string',
        description: 'Filter by severity',
        required: false,
        options: ['info', 'low', 'medium', 'high', 'critical']
      },
      {
        name: 'update',
        type: 'boolean',
        description: 'Update templates',
        required: false,
        default: false
      }
    ],
    outputParser: {
      type: 'regex',
      pattern: '\\[.*\\]|critical|high|medium|low|info'
    }
  },
  {
    name: 'wpscan',
    description: 'WordPress security scanner',
    category: 'scanner',
    version: '3.8.25',
    source: 'custom',
    installCommand: 'gem install wpscan',
    checkCommand: 'wpscan --version',
    executeCommand: 'wpscan',
    arguments: [
      {
        name: 'url',
        type: 'string',
        description: 'Target WordPress URL',
        required: true
      },
      {
        name: 'enumerate',
        type: 'string',
        description: 'Enumeration options',
        required: false,
        default: 'vp,vt,tt,cb,dbe,u,m',
        options: ['vp', 'vt', 'tt', 'cb', 'dbe', 'u', 'm']
      },
      {
        name: 'api',
        type: 'string',
        description: 'WPVulnDB API token',
        required: false
      },
      {
        name: 'output',
        type: 'string',
        description: 'Output file',
        required: false
      }
    ],
    outputParser: {
      type: 'regex',
      pattern: '\\[\\+\\]|\\[!\\]|Vulnerability|vulnerable'
    }
  }
];

export class ToolRegistry {
  private static instance: ToolRegistry;
  private tools: Map<string, ToolChain> = new Map();
  private toolsDirectory: string;
  
  private constructor() {
    this.toolsDirectory = this.getDefaultToolsDirectory();
    this.initializeDefaultTools();
  }
  
  static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }
  
  private getDefaultToolsDirectory(): string {
    const cwd = process.cwd();
    const toolsDir = path.join(cwd, 'tools');
    return toolsDir;
  }
  
  private initializeDefaultTools(): void {
    for (const tool of defaultTools) {
      const toolChain: ToolChain = {
        ...tool,
        id: uuidv4(),
        installed: false,
        lastUpdated: undefined
      };
      this.tools.set(tool.name, toolChain);
    }
    logDebug('ToolRegistry', `Initialized ${defaultTools.length} default tools`);
  }
  
  getTool(name: string): ToolChain | undefined {
    return this.tools.get(name);
  }
  
  getAllTools(): ToolChain[] {
    return Array.from(this.tools.values());
  }
  
  getToolsByCategory(category: ToolChain['category']): ToolChain[] {
    return this.getAllTools().filter(t => t.category === category);
  }
  
  getInstalledTools(): ToolChain[] {
    return this.getAllTools().filter(t => t.installed);
  }
  
  addTool(tool: Omit<ToolChain, 'id' | 'installed' | 'lastUpdated'>): ToolChain {
    const toolChain: ToolChain = {
      ...tool,
      id: uuidv4(),
      installed: false,
      lastUpdated: undefined
    };
    
    this.tools.set(tool.name, toolChain);
    logInfo('ToolRegistry', `Added tool: ${tool.name}`);
    
    return toolChain;
  }
  
  removeTool(name: string): boolean {
    const tool = this.tools.get(name);
    if (!tool) {
      return false;
    }
    
    this.tools.delete(name);
    logInfo('ToolRegistry', `Removed tool: ${name}`);
    
    return true;
  }
  
  updateToolStatus(name: string, installed: boolean, version?: string): boolean {
    const tool = this.tools.get(name);
    if (!tool) {
      return false;
    }
    
    tool.installed = installed;
    tool.lastUpdated = new Date();
    if (version) {
      tool.version = version;
    }
    
    logInfo('ToolRegistry', `Updated tool status: ${name} (installed: ${installed})`);
    
    return true;
  }
  
  getToolAsMCPDefinition(tool: ToolChain): ToolDefinition {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    
    for (const arg of tool.arguments) {
      const prop: Record<string, unknown> = {
        type: arg.type === 'array' ? 'array' : arg.type === 'object' ? 'object' : 'string',
        description: arg.description
      };
      
      if (arg.options && arg.options.length > 0) {
        prop['enum'] = arg.options;
      }
      
      if (arg.default !== undefined) {
        prop['default'] = arg.default;
      }
      
      properties[arg.name] = prop;
      
      if (arg.required) {
        required.push(arg.name);
      }
    }
    
    return {
      type: 'function',
      function: {
        name: tool.name,
        description: `${tool.description} (Category: ${tool.category}, Version: ${tool.version})`,
        parameters: {
          type: 'object',
          properties,
          required: required.length > 0 ? required : undefined
        }
      }
    };
  }
  
  getAllToolDefinitions(): ToolDefinition[] {
    return this.getAllTools().map(t => this.getToolAsMCPDefinition(t));
  }
  
  getInstalledToolDefinitions(): ToolDefinition[] {
    return this.getInstalledTools().map(t => this.getToolAsMCPDefinition(t));
  }
  
  getToolsDirectory(): string {
    return this.toolsDirectory;
  }
  
  setToolsDirectory(dir: string): void {
    this.toolsDirectory = dir;
    logInfo('ToolRegistry', `Tools directory set to: ${dir}`);
  }
}

export function getToolRegistry(): ToolRegistry {
  return ToolRegistry.getInstance();
}
