#!/usr/bin/env node

import { Command } from 'commander';
import * as readline from 'readline';
import { getSecurityAgent, AgentResponse } from './agents/securityAgent';
import { getModelManager } from './models/modelManager';
import { getToolRegistry } from './tools/toolRegistry';
import { ToolChain } from './types';
import { getToolExecutor, InstallationProgress } from './tools/toolExecutor';
import { getContextManager } from './context/contextManager';
import { getTodoManager } from './todo/todoManager';
import { getVulnerabilityAnalyzer } from './vulnerability/vulnerabilityAnalyzer';
import { getRequirementAnalyzer } from './requirements/requirementAnalyzer';
import { getConfig, saveConfig } from './config';
import { loadConfig } from './config';
import { Vulnerability } from './types';

const program = new Command();

program
  .name('ai-security-mcp')
  .description('基于MCP的AI自动化漏洞挖掘系统')
  .version('1.0.0');

// Interactive mode command
program
  .command('interactive')
  .alias('i')
  .description('启动交互式模式')
  .action(async () => {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║          AI Security MCP - 自动化漏洞挖掘系统              ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log('║  可用命令:                                                   ║');
    console.log('║    /status  - 显示当前状态                                   ║');
    console.log('║    /context - 显示上下文信息                                 ║');
    console.log('║    /tools   - 管理工具                                       ║');
    console.log('║    /models  - 管理模型提供商                                 ║');
    console.log('║    /vulns   - 显示发现的漏洞                                 ║');
    console.log('║    /todo    - 管理任务列表                                   ║');
    console.log('║    /execute - 执行当前任务列表                               ║');
    console.log('║    /clear   - 清除上下文                                     ║');
    console.log('║    /config  - 显示/修改配置                                  ║');
    console.log('║    /help    - 显示帮助                                       ║');
    console.log('║    /exit    - 退出程序                                       ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    const agent = getSecurityAgent();
    await agent.initialize();
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: 'SecurityMCP> '
    });
    
    console.log('正在初始化... 请确保 LMStudio 或 Ollama 正在运行。\n');
    
    // Check model availability
    const modelManager = getModelManager();
    const providers = await modelManager.checkAllProviders();
    const availableProviders = Array.from(providers.entries())
      .filter(([, available]) => available)
      .map(([name]) => name);
    
    if (availableProviders.length === 0) {
      console.warn('⚠️  警告: 没有检测到可用的模型提供商。');
      console.warn('   请启动 LMStudio (http://localhost:1234) 或 Ollama (http://localhost:11434)');
      console.warn('   然后在 LMStudio 中加载一个模型。\n');
    } else {
      console.log(`✅  检测到可用的模型提供商: ${availableProviders.join(', ')}\n`);
    }
    
    // Show context status
    const contextManager = getContextManager();
    console.log(`📊  上下文状态: ${contextManager.getStatusDisplay()}\n`);
    
    rl.prompt();
    
    rl.on('line', async (line) => {
      const input = line.trim();
      
      try {
        if (input.startsWith('/')) {
          await handleCommand(input, rl);
        } else if (input.length > 0) {
          await handleUserMessage(input, rl);
        }
      } catch (error) {
        console.error('\n❌  错误:', error instanceof Error ? error.message : String(error));
      }
      
      rl.prompt();
    }).on('close', () => {
      console.log('\n👋  再见!');
      process.exit(0);
    });
  });

// Scan command
program
  .command('scan <target>')
  .description('对目标执行安全扫描')
  .option('-t, --type <type>', '扫描类型: recon, vulnerability, full (默认: full)', 'full')
  .option('-d, --depth <depth>', '扫描深度: quick, standard, deep (默认: standard)', 'standard')
  .option('-o, --output <file>', '输出报告文件')
  .action(async (target, options) => {
    console.log(`\n🚀  开始扫描目标: ${target}`);
    console.log(`   扫描类型: ${options.type}`);
    console.log(`   扫描深度: ${options.depth}\n`);
    
    const agent = getSecurityAgent();
    await agent.initialize();
    
    const userMessage = `请对目标 ${target} 执行 ${options.type} 扫描，扫描深度为 ${options.depth}。`;
    
    const response = await agent.processMessage(userMessage);
    printResponse(response);
    
    // If there's an active todo list, execute it
    const todoManager = getTodoManager();
    const activeTodo = todoManager.getActiveTodoList();
    
    if (activeTodo && activeTodo.items.length > 0) {
      console.log('\n⚙️  准备执行任务列表...\n');
      
      const success = await agent.executeActiveTodoList();
      
      if (success) {
        console.log('\n✅  任务列表执行完成!');
        
        // Show vulnerabilities
        const vulnerabilities = agent.getVulnerabilities();
        if (vulnerabilities.length > 0) {
          console.log(`\n🔍  发现 ${vulnerabilities.length} 个潜在漏洞:\n`);
          printVulnerabilities(vulnerabilities);
        } else {
          console.log('\n✅  未发现明显漏洞。');
        }
      } else {
        console.log('\n❌  任务列表执行失败。');
      }
    }
  });

// Tools command
program
  .command('tools')
  .description('管理安全工具')
  .option('-l, --list', '列出所有工具')
  .option('-i, --install <tool>', '安装指定工具')
  .option('-a, --install-all', '安装所有工具')
  .option('-c, --check <tool>', '检查工具是否安装')
  .action(async (options) => {
    const toolRegistry = getToolRegistry();
    const toolExecutor = getToolExecutor();
    
    if (options.list) {
      const tools = toolRegistry.getAllTools();
      console.log('\n📋  可用工具:\n');
      
      tools.forEach((tool, i) => {
        const statusIcon = tool.installed ? '✅' : '❌';
        console.log(`${i + 1}. ${statusIcon} ${tool.name} (${tool.category})`);
        console.log(`   描述: ${tool.description}`);
        console.log(`   版本: ${tool.version}`);
        console.log(`   状态: ${tool.installed ? '已安装' : '未安装'}\n`);
      });
      
    } else if (options.install) {
      const tool = toolRegistry.getTool(options.install);
      if (!tool) {
        console.error(`❌  未找到工具: ${options.install}`);
        return;
      }
      
      console.log(`📦  正在安装工具: ${tool.name}...\n`);
      
      const success = await toolExecutor.installTool(tool, (progress) => {
        const progressBar = progress.progress 
          ? `[${'='.repeat(Math.floor(progress.progress / 10))}${' '.repeat(10 - Math.floor(progress.progress / 10))}]`
          : '';
        process.stdout.write(`\r   ${progress.phase}: ${progress.message} ${progressBar}`);
      });
      
      console.log('\n');
      console.log(success ? `✅  工具安装成功: ${tool.name}` : `❌  工具安装失败: ${tool.name}`);
      
    } else if (options.installAll) {
      console.log('📦  正在安装所有工具...\n');
      
      const result = await toolExecutor.installAllTools((progress, index, total) => {
        process.stdout.write(`\r   [${index + 1}/${total}] ${progress.toolName}: ${progress.phase}`);
      });
      
      console.log(`\n\n✅  安装完成: ${result.installed}/${result.total} 成功, ${result.failed} 失败`);
      
    } else if (options.check) {
      const tool = toolRegistry.getTool(options.check);
      if (!tool) {
        console.error(`❌  未找到工具: ${options.check}`);
        return;
      }
      
      console.log(`🔍  检查工具: ${tool.name}...`);
      
      const result = await toolExecutor.checkToolInstalled(tool);
      
      console.log(`   状态: ${result.installed ? '✅ 已安装' : '❌ 未安装'}`);
      if (result.version) {
        console.log(`   版本: ${result.version}`);
      }
      
      // Update registry
      if (result.installed) {
        toolRegistry.updateToolStatus(tool.name, true, result.version);
      }
    } else {
      // Default: show help
      console.log('\n📋  工具管理命令:\n');
      console.log('  tools --list          列出所有工具');
      console.log('  tools --install <name>  安装指定工具');
      console.log('  tools --install-all   安装所有工具');
      console.log('  tools --check <name>  检查工具是否安装\n');
    }
  });

// Parse command line
program.parse(process.argv);

// Command handlers
async function handleCommand(input: string, rl: readline.Interface): Promise<void> {
  const parts = input.split(' ');
  const command = parts[0]?.toLowerCase();
  
  switch (command) {
    case '/status':
      await showStatus();
      break;
      
    case '/context':
      showContext();
      break;
      
    case '/tools':
      await handleToolsCommand(parts.slice(1));
      break;
      
    case '/models':
      await handleModelsCommand(parts.slice(1));
      break;
      
    case '/vulns':
      showVulnerabilities();
      break;
      
    case '/todo':
      handleTodoCommand(parts.slice(1));
      break;
      
    case '/execute':
      await executeTodoList();
      break;
      
    case '/clear':
      clearContext();
      break;
      
    case '/config':
      handleConfigCommand(parts.slice(1));
      break;
      
    case '/help':
      showHelp();
      break;
      
    case '/exit':
      console.log('\n👋  再见!');
      process.exit(0);
      break;
      
    default:
      console.log(`❌  未知命令: ${command}`);
      console.log('输入 /help 查看可用命令。');
  }
}

async function handleUserMessage(input: string, rl: readline.Interface): Promise<void> {
  const agent = getSecurityAgent();
  
  console.log('\n🤔  正在处理...\n');
  
  const response = await agent.processMessage(input);
  printResponse(response);
}

function printResponse(response: AgentResponse): void {
  console.log('🤖  回复:');
  console.log(response.content);
  console.log('');
  
  // Show context info
  const pct = Math.round(response.contextInfo.usagePercentage * 100);
  const status = pct >= 95 ? '🔴' : pct >= 80 ? '🟡' : '🟢';
  
  console.log(`${status}  上下文: ${response.contextInfo.currentTokens}/${response.contextInfo.maxTokens} tokens (${pct}%)`);
  
  // Show todo list if available
  if (response.todoList) {
    console.log(`📋  任务列表: ${response.todoList.title}`);
    console.log(`   进度: ${response.todoList.progress.completed}/${response.todoList.progress.total} (${response.todoList.progress.percentage}%)`);
  }
  
  // Show vulnerabilities
  if (response.vulnerabilities && response.vulnerabilities.length > 0) {
    console.log(`\n🔍  发现 ${response.vulnerabilities.length} 个漏洞:`);
    printVulnerabilities(response.vulnerabilities);
  }
  
  // Show clarifications
  if (response.clarifications && response.clarifications.length > 0) {
    console.log('\n❓  需要更多信息:');
    response.clarifications.forEach((c, i) => {
      console.log(`${i + 1}. ${c.question}`);
      if (c.options && c.options.length > 0) {
        console.log(`   选项: ${c.options.join(', ')}`);
      }
    });
  }
  
  console.log('');
}

function printVulnerabilities(vulnerabilities: Vulnerability[]): void {
  // Group by severity
  const bySeverity: Record<string, Vulnerability[]> = {};
  
  for (const vuln of vulnerabilities) {
    if (!bySeverity[vuln.severity]) {
      bySeverity[vuln.severity] = [];
    }
    bySeverity[vuln.severity].push(vuln);
  }
  
  const severityOrder = ['critical', 'high', 'medium', 'low', 'info'];
  const severityLabels: Record<string, string> = {
    critical: '🔴 严重',
    high: '🟠 高危',
    medium: '🟡 中危',
    low: '🔵 低危',
    info: 'ℹ️  信息'
  };
  
  for (const severity of severityOrder) {
    const vulns = bySeverity[severity];
    if (!vulns || vulns.length === 0) continue;
    
    console.log(`\n${severityLabels[severity]} (${vulns.length}):`);
    
    vulns.forEach((vuln, i) => {
      console.log(`  ${i + 1}. ${vuln.name}`);
      console.log(`     目标: ${vuln.affectedTarget}`);
      console.log(`     描述: ${vuln.description.substring(0, 100)}...`);
      if (vuln.proofOfConcept) {
        console.log(`     证据: ${vuln.proofOfConcept.substring(0, 80)}...`);
      }
    });
  }
}

async function showStatus(): Promise<void> {
  const modelManager = getModelManager();
  const contextManager = getContextManager();
  const toolRegistry = getToolRegistry();
  const todoManager = getTodoManager();
  const vulnerabilityAnalyzer = getVulnerabilityAnalyzer();
  
  console.log('\n📊  系统状态:\n');
  
  // Model status
  const providers = await modelManager.checkAllProviders();
  const activeProvider = modelManager.getActiveProviderName();
  
  console.log('🤖  模型提供商:');
  for (const [name, available] of providers.entries()) {
    const isActive = name === activeProvider;
    const icon = available ? '✅' : '❌';
    const activeMarker = isActive ? ' [当前]' : '';
    console.log(`   ${icon} ${name}${activeMarker}`);
  }
  
  // Context status
  console.log(`\n📝  上下文: ${contextManager.getStatusDisplay()}`);
  
  // Tools status
  const tools = toolRegistry.getAllTools();
  const installed = tools.filter(t => t.installed).length;
  console.log(`🔧  工具: ${installed}/${tools.length} 已安装`);
  
  // Todo status
  const activeTodo = todoManager.getActiveTodoList();
  if (activeTodo) {
    const progress = todoManager.getProgress(activeTodo.id);
    console.log(`📋  任务列表: ${activeTodo.title} (${progress.percentage}%)`);
  } else {
    console.log('📋  任务列表: 无活动任务');
  }
  
  // Vulnerabilities
  const vulns = vulnerabilityAnalyzer.getAllVulnerabilities();
  console.log(`🔍  漏洞: ${vulns.length} 个发现`);
  
  console.log('');
}

function showContext(): void {
  const contextManager = getContextManager();
  const messages = contextManager.getMessages();
  
  console.log('\n📝  上下文内容:\n');
  console.log(`状态: ${contextManager.getStatusDisplay()}\n`);
  console.log(`消息数量: ${messages.length}\n`);
  
  messages.forEach((msg, i) => {
    const roleLabel = msg.role === 'system' ? '系统' : 
                      msg.role === 'user' ? '用户' : 
                      msg.role === 'assistant' ? '助手' : '工具';
    
    const preview = msg.content?.substring(0, 100) || '(无内容)';
    const truncated = msg.content && msg.content.length > 100 ? '...' : '';
    
    console.log(`[${i + 1}] ${roleLabel}: ${preview}${truncated}`);
  });
  
  console.log('');
}

async function handleToolsCommand(args: string[]): Promise<void> {
  const toolRegistry = getToolRegistry();
  const toolExecutor = getToolExecutor();
  
  const subCommand = args[0]?.toLowerCase();
  
  switch (subCommand) {
    case 'list':
    case 'ls':
      const tools = toolRegistry.getAllTools();
      console.log('\n📋  工具列表:\n');
      tools.forEach((tool, i) => {
        const status = tool.installed ? '✅' : '❌';
        console.log(`${i + 1}. ${status} ${tool.name} (${tool.category}) - ${tool.description}`);
      });
      console.log('');
      break;
      
    case 'install':
    case 'i':
      if (args.length < 2) {
        console.log('❌  请指定要安装的工具名称。');
        console.log('用法: /tools install <工具名>');
        return;
      }
      
      const toolName = args[1];
      const tool = toolRegistry.getTool(toolName);
      
      if (!tool) {
        console.log(`❌  未找到工具: ${toolName}`);
        return;
      }
      
      console.log(`📦  正在安装 ${tool.name}...`);
      
      const success = await toolExecutor.installTool(tool, (progress) => {
        process.stdout.write(`\r   ${progress.phase}: ${progress.message}`);
      });
      
      console.log('');
      console.log(success ? `✅  ${tool.name} 安装成功` : `❌  ${tool.name} 安装失败`);
      break;
      
    case 'install-all':
      console.log('📦  正在安装所有工具...\n');
      const result = await toolExecutor.installAllTools((progress, index, total) => {
        process.stdout.write(`\r   [${index + 1}/${total}] ${progress.toolName}: ${progress.phase}`);
      });
      console.log(`\n\n✅  完成: ${result.installed}/${result.total} 成功, ${result.failed} 失败`);
      break;
      
    case 'check':
      if (args.length < 2) {
        console.log('❌  请指定要检查的工具名称。');
        return;
      }
      
      const checkName = args[1];
      const checkTool = toolRegistry.getTool(checkName);
      
      if (!checkTool) {
        console.log(`❌  未找到工具: ${checkName}`);
        return;
      }
      
      console.log(`🔍  检查 ${checkTool.name}...`);
      const checkResult = await toolExecutor.checkToolInstalled(checkTool);
      console.log(`   状态: ${checkResult.installed ? '✅ 已安装' : '❌ 未安装'}`);
      if (checkResult.version) {
        console.log(`   版本: ${checkResult.version}`);
      }
      break;
      
    default:
      console.log('\n📋  工具管理命令:');
      console.log('  /tools list          列出所有工具');
      console.log('  /tools install <名>  安装指定工具');
      console.log('  /tools install-all   安装所有工具');
      console.log('  /tools check <名>    检查工具状态\n');
  }
}

async function handleModelsCommand(args: string[]): Promise<void> {
  const modelManager = getModelManager();
  
  const subCommand = args[0]?.toLowerCase();
  
  switch (subCommand) {
    case 'list':
    case 'ls':
      const providers = await modelManager.checkAllProviders();
      const active = modelManager.getActiveProviderName();
      
      console.log('\n🤖  模型提供商:\n');
      for (const [name, available] of providers.entries()) {
        const isActive = name === active;
        const statusIcon = available ? '✅' : '❌';
        const activeMarker = isActive ? ' [当前]' : '';
        console.log(`   ${statusIcon} ${name}${activeMarker}`);
      }
      
      // Show available models for active provider
      try {
        const models = await modelManager.getAvailableModels();
        if (models.length > 0) {
          console.log(`\n📦  当前提供商可用模型:\n`);
          models.forEach(m => console.log(`   - ${m.id}`));
        }
      } catch {
        // Ignore
      }
      console.log('');
      break;
      
    case 'switch':
    case 'use':
      if (args.length < 2) {
        console.log('❌  请指定要切换的提供商名称。');
        console.log('用法: /models switch <提供商名>');
        return;
      }
      
      const providerName = args[1];
      const switched = await modelManager.switchProvider(providerName);
      
      if (switched) {
        console.log(`✅  已切换到 ${providerName}`);
      } else {
        console.log(`❌  无法切换到 ${providerName}（不可用）`);
      }
      break;
      
    default:
      console.log('\n🤖  模型管理命令:');
      console.log('  /models list           列出所有提供商');
      console.log('  /models switch <名>    切换到指定提供商\n');
  }
}

function showVulnerabilities(): void {
  const vulnerabilityAnalyzer = getVulnerabilityAnalyzer();
  const vulns = vulnerabilityAnalyzer.getAllVulnerabilities();
  
  if (vulns.length === 0) {
    console.log('\n✅  暂无发现的漏洞。\n');
    return;
  }
  
  console.log(`\n🔍  发现 ${vulns.length} 个漏洞:\n`);
  printVulnerabilities(vulns);
  console.log('');
}

function handleTodoCommand(args: string[]): void {
  const todoManager = getTodoManager();
  
  const subCommand = args[0]?.toLowerCase();
  
  switch (subCommand) {
    case 'list':
    case 'ls':
      const lists = todoManager.getAllTodoLists();
      const active = todoManager.getActiveTodoList();
      
      if (lists.length === 0) {
        console.log('\n📋  暂无任务列表。\n');
        return;
      }
      
      console.log('\n📋  任务列表:\n');
      lists.forEach((list, i) => {
        const isActive = active?.id === list.id;
        const progress = todoManager.getProgress(list.id);
        console.log(`${i + 1}. ${isActive ? '▶️ ' : ''}${list.title} (${progress.percentage}%)`);
        console.log(`   ${list.description.substring(0, 80)}${list.description.length > 80 ? '...' : ''}`);
        console.log(`   任务: ${progress.completed}/${progress.total} 已完成\n`);
      });
      break;
      
    case 'show':
      const activeList = todoManager.getActiveTodoList();
      if (!activeList) {
        console.log('\n❌  没有活动的任务列表。\n');
        return;
      }
      
      console.log(`\n📋  ${activeList.title}:\n`);
      activeList.items.forEach((item, i) => {
        const statusIcon = item.status === 'completed' ? '✅' : 
                           item.status === 'in_progress' ? '🔄' :
                           item.status === 'failed' ? '❌' : '⏳';
        const priorityIcon = item.priority === 'high' ? '🔴' : 
                             item.priority === 'medium' ? '🟡' : '🔵';
        
        console.log(`${i + 1}. ${statusIcon} ${priorityIcon} ${item.content}`);
        if (item.tool) {
          console.log(`   工具: ${item.tool}`);
        }
        if (item.result) {
          console.log(`   结果: ${item.result.substring(0, 100)}...`);
        }
        console.log('');
      });
      break;
      
    default:
      console.log('\n📋  任务列表命令:');
      console.log('  /todo list        列出所有任务列表');
      console.log('  /todo show        显示当前任务列表详情');
      console.log('  /execute          执行当前任务列表\n');
  }
}

async function executeTodoList(): Promise<void> {
  const todoManager = getTodoManager();
  const agent = getSecurityAgent();
  
  const activeTodo = todoManager.getActiveTodoList();
  if (!activeTodo) {
    console.log('\n❌  没有活动的任务列表。\n');
    return;
  }
  
  if (activeTodo.items.length === 0) {
    console.log('\n❌  任务列表为空。\n');
    return;
  }
  
  console.log(`\n⚙️  正在执行任务列表: ${activeTodo.title}\n`);
  
  const success = await agent.executeActiveTodoList();
  
  if (success) {
    console.log('\n✅  任务列表执行完成!');
    
    const vulns = agent.getVulnerabilities();
    if (vulns.length > 0) {
      console.log(`\n🔍  发现 ${vulns.length} 个漏洞:\n`);
      printVulnerabilities(vulns);
    } else {
      console.log('\n✅  未发现明显漏洞。');
    }
  } else {
    console.log('\n❌  任务列表执行失败。');
  }
  
  console.log('');
}

function clearContext(): void {
  const agent = getSecurityAgent();
  agent.clearContext();
  console.log('\n🗑️  上下文已清除。\n');
}

function handleConfigCommand(args: string[]): void {
  const config = getConfig();
  const subCommand = args[0]?.toLowerCase();
  
  if (subCommand === 'set') {
    // TODO: Implement config set
    console.log('⚠️  配置修改功能开发中。\n');
    return;
  }
  
  // Show current config
  console.log('\n⚙️  当前配置:\n');
  console.log('🤖  模型提供商:');
  console.log(`   活动: ${config.activeProvider}`);
  config.modelProviders.forEach(p => {
    console.log(`   - ${p.name} (${p.type}): ${p.baseUrl}`);
  });
  
  console.log('\n📝  上下文窗口:');
  console.log(`   最大 tokens: ${config.contextWindow.maxTokens}`);
  console.log(`   警告阈值: ${Math.round(config.contextWindow.warningThreshold * 100)}%`);
  console.log(`   自动压缩: ${config.contextWindow.autoCompression ? '启用' : '禁用'}`);
  
  console.log('\n📋  任务列表:');
  console.log(`   自动生成: ${config.todoList.autoGenerate ? '启用' : '禁用'}`);
  console.log(`   最大并发: ${config.todoList.maxConcurrentTasks}`);
  console.log(`   失败重试: ${config.todoList.retryOnFailure ? `启用 (最多 ${config.todoList.maxRetries} 次)` : '禁用'}`);
  
  console.log('\n🔧  工具链:');
  console.log(`   自动安装: ${config.toolChain.autoInstall ? '启用' : '禁用'}`);
  console.log(`   自动更新: ${config.toolChain.autoUpdate ? '启用' : '禁用'}`);
  console.log(`   日志级别: ${config.toolChain.logLevel}`);
  console.log(`   工具目录: ${config.toolChain.toolsDirectory}`);
  
  console.log('\n🔒  安全:');
  console.log(`   安全模式: ${config.security.safeMode ? '启用' : '禁用'}`);
  console.log(`   允许危险工具: ${config.security.allowDangerousTools ? '是' : '否'}`);
  console.log(`   最大利用尝试: ${config.security.maxExploitAttempts}`);
  
  console.log('');
}

function showHelp(): void {
  console.log('\n📖  可用命令:\n');
  console.log('🔧  核心功能:');
  console.log('  /status    显示系统状态');
  console.log('  /context   显示当前上下文');
  console.log('  /clear     清除上下文');
  console.log('  /help      显示此帮助');
  console.log('  /exit      退出程序\n');
  
  console.log('🤖  模型管理:');
  console.log('  /models list           列出所有模型提供商');
  console.log('  /models switch <名>    切换到指定提供商\n');
  
  console.log('🔧  工具管理:');
  console.log('  /tools list            列出所有工具');
  console.log('  /tools install <名>    安装指定工具');
  console.log('  /tools install-all     安装所有工具');
  console.log('  /tools check <名>      检查工具状态\n');
  
  console.log('📋  任务管理:');
  console.log('  /todo list     列出所有任务列表');
  console.log('  /todo show     显示当前任务详情');
  console.log('  /execute       执行当前任务列表\n');
  
  console.log('🔍  安全:');
  console.log('  /vulns         显示发现的漏洞');
  console.log('  /config        显示当前配置\n');
  
  console.log('💡  使用提示:');
  console.log('  - 直接输入问题或指令进行对话');
  console.log('  - 系统会自动分析需求并生成任务');
  console.log('  - 使用 /execute 执行生成的任务列表');
  console.log('  - 使用 /vulns 查看发现的漏洞\n');
}

// If no command provided, show help
if (process.argv.length <= 2) {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║          AI Security MCP - 自动化漏洞挖掘系统              ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  console.log('用法: ai-security-mcp [命令]\n');
  console.log('命令:');
  console.log('  interactive, i    启动交互式模式 (推荐)');
  console.log('  scan <目标>       对目标执行安全扫描');
  console.log('  tools             管理安全工具');
  console.log('  --help            显示详细帮助\n');
  console.log('示例:');
  console.log('  ai-security-mcp interactive');
  console.log('  ai-security-mcp scan example.com --type full\n');
}
