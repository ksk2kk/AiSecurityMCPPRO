#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const readline = __importStar(require("readline"));
const securityAgent_1 = require("./agents/securityAgent");
const modelManager_1 = require("./models/modelManager");
const toolRegistry_1 = require("./tools/toolRegistry");
const toolExecutor_1 = require("./tools/toolExecutor");
const contextManager_1 = require("./context/contextManager");
const todoManager_1 = require("./todo/todoManager");
const vulnerabilityAnalyzer_1 = require("./vulnerability/vulnerabilityAnalyzer");
const config_1 = require("./config");
const i18n_1 = require("./i18n");
const program = new commander_1.Command();
const i18n = (0, i18n_1.getI18n)();
function t(key) {
    const keys = key.split('.');
    const lang = i18n.getLanguage();
    // Simple translation lookup
    const translations = {
        en: {
            'cli.banner': 'AI Security MCP - Automated Vulnerability Mining System',
            'cli.availableCommands': 'Available Commands:',
            'cli.command.status': '/status   - Show system status',
            'cli.command.context': '/context  - Show context info',
            'cli.command.tools': '/tools    - Manage tools',
            'cli.command.models': '/models   - Manage model providers',
            'cli.command.vulns': '/vulns    - Show vulnerabilities',
            'cli.command.todo': '/todo     - Manage todo list',
            'cli.command.execute': '/execute  - Execute todo list',
            'cli.command.clear': '/clear    - Clear context',
            'cli.command.config': '/config   - Show/modify config',
            'cli.command.help': '/help     - Show help',
            'cli.command.exit': '/exit     - Exit program',
            'cli.initializing': 'Initializing... Please ensure LMStudio or Ollama is running.',
            'cli.noProviders': '⚠️  Warning: No model providers detected.',
            'cli.lmstudioHint': '   Please start LMStudio (http://localhost:1234) or Ollama (http://localhost:11434)',
            'cli.loadModelHint': '   Then load a model in LMStudio.',
            'cli.availableProviders': '✅  Available model providers:',
            'cli.contextStatus': '📊  Context status:',
            'cli.error': '❌  Error:',
            'cli.goodbye': '\n👋  Goodbye!',
            'scan.starting': '🚀  Starting scan on target:',
            'scan.type': '   Scan type:',
            'scan.depth': '   Scan depth:',
            'scan.userMessage': 'Please perform a {type} scan on target {target} with {depth} depth.',
            'scan.preparing': '\n⚙️  Preparing to execute task list...',
            'scan.complete': '\n✅  Task list execution complete!',
            'scan.foundVulns': '\n🔍  Found {count} potential vulnerabilities:',
            'scan.noVulns': '\n✅  No obvious vulnerabilities found.',
            'scan.failed': '\n❌  Task list execution failed.',
            'tools.available': '\n📋  Available tools:',
            'tools.status': '   Status:',
            'tools.version': '   Version:',
            'tools.notFound': '❌  Tool not found:',
            'tools.installing': '📦  Installing tool:',
            'tools.installSuccess': '✅  Tool installed successfully:',
            'tools.installFailed': '❌  Tool installation failed:',
            'tools.installingAll': '📦  Installing all tools...',
            'tools.installResult': '\n\n✅  Installation complete: {installed}/{total} succeeded, {failed} failed',
            'tools.checking': '🔍  Checking tool:',
            'tools.installed': '   Status: ✅ Installed',
            'tools.notInstalled': '   Status: ❌ Not installed',
            'tools.help.title': '\n📋  Tool management commands:',
            'tools.help.list': '  tools --list          List all tools',
            'tools.help.install': '  tools --install <name>  Install specified tool',
            'tools.help.installAll': '  tools --install-all   Install all tools',
            'tools.help.check': '  tools --check <name>  Check if tool is installed',
            'cmd.unknown': '❌  Unknown command:',
            'cmd.helpHint': 'Type /help to see available commands.',
            'user.processing': '\n🤔  Processing...\n',
            'resp.agent': '🤖  Response:',
            'resp.context': 'Context',
            'resp.todo': '📋  Todo List:',
            'resp.progress': '   Progress:',
            'resp.found': '\n🔍  Found {count} vulnerabilities:',
            'resp.needInfo': '\n❓  Need more information:',
            'vuln.critical': '🔴 Critical',
            'vuln.high': '🟠 High',
            'vuln.medium': '🟡 Medium',
            'vuln.low': '🔵 Low',
            'vuln.info': 'ℹ️  Info',
            'vuln.target': '     Target:',
            'vuln.desc': '     Description:',
            'vuln.evidence': '     Evidence:',
            'status.title': '\n📊  System Status:\n',
            'status.providers': '🤖  Model Providers:',
            'status.context': '📝  Context:',
            'status.tools': '🔧  Tools:',
            'status.tools.installed': 'installed',
            'status.todo': '📋  Todo List:',
            'status.todo.none': 'No active tasks',
            'status.vulns': '🔍  Vulnerabilities:',
            'status.vulns.count': 'discoveries',
            'ctx.title': '\n📝  Context Content:\n',
            'ctx.status': 'Status:',
            'ctx.messageCount': 'Message count:',
            'ctx.role.system': 'System',
            'ctx.role.user': 'User',
            'ctx.role.assistant': 'Assistant',
            'ctx.role.tool': 'Tool',
            'ctx.noContent': '(no content)',
            'tools.list.title': '\n📋  Tool List:\n',
            'tools.cmd.help.title': '\n📋  Tool commands:',
            'tools.cmd.list': '  /tools list          List all tools',
            'tools.cmd.install': '  /tools install <name>  Install specified tool',
            'tools.cmd.installAll': '  /tools install-all   Install all tools',
            'tools.cmd.check': '  /tools check <name>  Check tool status',
            'tools.cmd.specifyName': '❌  Please specify the tool name to install.',
            'tools.cmd.usageInstall': 'Usage: /tools install <tool-name>',
            'tools.cmd.installingNow': '📦  Installing',
            'tools.cmd.specifyCheck': '❌  Please specify the tool name to check.',
            'models.list.title': '\n🤖  Model Providers:\n',
            'models.available.title': '\n📦  Available models for current provider:\n',
            'models.cmd.specify': '❌  Please specify the provider name to switch to.',
            'models.cmd.usage': 'Usage: /models switch <provider-name>',
            'models.switched': '✅  Switched to',
            'models.failed': '❌  Could not switch to (unavailable)',
            'models.cmd.help.title': '\n🤖  Model commands:',
            'models.cmd.list': '  /models list           List all providers',
            'models.cmd.switch': '  /models switch <name>  Switch to specified provider',
            'vulns.none': '\n✅  No vulnerabilities found yet.\n',
            'vulns.found': '\n🔍  Found {count} vulnerabilities:\n',
            'todo.none': '\n📋  No todo lists yet.\n',
            'todo.list.title': '\n📋  Todo Lists:\n',
            'todo.tasks': 'Tasks:',
            'todo.tasks.completed': 'completed',
            'todo.noActive': '\n❌  No active todo list.\n',
            'todo.activeTitle': '\n📋  {title}:\n',
            'todo.status.completed': '✅',
            'todo.status.inProgress': '🔄',
            'todo.status.failed': '❌',
            'todo.status.pending': '⏳',
            'todo.priority.high': '🔴',
            'todo.priority.medium': '🟡',
            'todo.priority.low': '🔵',
            'todo.tool': '   Tool:',
            'todo.result': '   Result:',
            'todo.cmd.help.title': '\n📋  Todo list commands:',
            'todo.cmd.list': '  /todo list        List all todo lists',
            'todo.cmd.show': '  /todo show        Show current todo list details',
            'todo.cmd.execute': '  /execute          Execute current todo list',
            'exec.noActive': '\n❌  No active todo list.\n',
            'exec.empty': '\n❌  Todo list is empty.\n',
            'exec.running': '\n⚙️  Executing todo list: {title}\n',
            'exec.complete': '\n✅  Todo list execution complete!',
            'exec.found': '\n🔍  Found {count} vulnerabilities:\n',
            'exec.none': '\n✅  No obvious vulnerabilities found.',
            'exec.failed': '\n❌  Todo list execution failed.',
            'clear.done': '\n🗑️  Context cleared.\n',
            'config.dev': '⚠️  Config modification feature in development.\n',
            'config.title': '\n⚙️  Current Configuration:\n',
            'config.providers': '🤖  Model Providers:',
            'config.active': '   Active:',
            'config.context': '\n📝  Context Window:',
            'config.maxTokens': '   Max tokens:',
            'config.warningThreshold': '   Warning threshold:',
            'config.autoCompression': '   Auto compression:',
            'config.todo': '\n📋  Todo List:',
            'config.autoGenerate': '   Auto generate:',
            'config.maxConcurrent': '   Max concurrent:',
            'config.retry': '   Retry on failure:',
            'config.retry.times': 'times',
            'config.tools': '\n🔧  Tool Chain:',
            'config.autoInstall': '   Auto install:',
            'config.autoUpdate': '   Auto update:',
            'config.logLevel': '   Log level:',
            'config.toolsDir': '   Tools directory:',
            'config.security': '\n🔒  Security:',
            'config.safeMode': '   Safe mode:',
            'config.allowDangerous': '   Allow dangerous tools:',
            'config.maxExploit': '   Max exploit attempts:',
            'config.enabled': 'Enabled',
            'config.disabled': 'Disabled',
            'config.yes': 'Yes',
            'config.no': 'No',
            'help.title': '\n📖  Available Commands:\n',
            'help.core': '🔧  Core Features:',
            'help.core.status': '  /status    Show system status',
            'help.core.context': '  /context   Show current context',
            'help.core.clear': '  /clear     Clear context',
            'help.core.help': '  /help      Show this help',
            'help.core.exit': '  /exit      Exit program\n',
            'help.models': '🤖  Model Management:',
            'help.models.list': '  /models list           List all model providers',
            'help.models.switch': '  /models switch <name>  Switch to specified provider\n',
            'help.tools': '🔧  Tool Management:',
            'help.tools.list': '  /tools list            List all tools',
            'help.tools.install': '  /tools install <name>  Install specified tool',
            'help.tools.installAll': '  /tools install-all     Install all tools',
            'help.tools.check': '  /tools check <name>    Check tool status\n',
            'help.tasks': '📋  Task Management:',
            'help.tasks.list': '  /todo list     List all todo lists',
            'help.tasks.show': '  /todo show     Show current todo details',
            'help.tasks.execute': '  /execute       Execute current todo list\n',
            'help.security': '🔍  Security:',
            'help.security.vulns': '  /vulns         Show discovered vulnerabilities',
            'help.security.config': '  /config        Show current configuration\n',
            'help.tips': '💡  Usage Tips:',
            'help.tips.1': '  - Enter questions or instructions directly to chat',
            'help.tips.2': '  - System will automatically analyze requirements and generate tasks',
            'help.tips.3': '  - Use /execute to execute generated todo list',
            'help.tips.4': '  - Use /vulns to view discovered vulnerabilities\n',
            'welcome.usage': 'Usage: ai-security-mcp [command]\n',
            'welcome.commands': 'Commands:',
            'welcome.cmd.interactive': '  interactive, i    Start interactive mode (recommended)',
            'welcome.cmd.scan': '  scan <target>      Perform security scan on target',
            'welcome.cmd.tools': '  tools             Manage security tools',
            'welcome.cmd.help': '  --help            Show detailed help\n',
            'welcome.examples': 'Examples:',
            'welcome.ex.1': '  ai-security-mcp interactive',
            'welcome.ex.2': '  ai-security-mcp scan example.com --type full\n'
        },
        zh: {
            'cli.banner': 'AI Security MCP - 自动化漏洞挖掘系统',
            'cli.availableCommands': '可用命令:',
            'cli.command.status': '/status  - 显示当前状态',
            'cli.command.context': '/context - 显示上下文信息',
            'cli.command.tools': '/tools   - 管理工具',
            'cli.command.models': '/models  - 管理模型提供商',
            'cli.command.vulns': '/vulns   - 显示发现的漏洞',
            'cli.command.todo': '/todo    - 管理任务列表',
            'cli.command.execute': '/execute - 执行当前任务列表',
            'cli.command.clear': '/clear   - 清除上下文',
            'cli.command.config': '/config  - 显示/修改配置',
            'cli.command.help': '/help    - 显示帮助',
            'cli.command.exit': '/exit    - 退出程序',
            'cli.initializing': '正在初始化... 请确保 LMStudio 或 Ollama 正在运行。',
            'cli.noProviders': '⚠️  警告: 没有检测到可用的模型提供商。',
            'cli.lmstudioHint': '   请启动 LMStudio (http://localhost:1234) 或 Ollama (http://localhost:11434)',
            'cli.loadModelHint': '   然后在 LMStudio 中加载一个模型。',
            'cli.availableProviders': '✅  检测到可用的模型提供商:',
            'cli.contextStatus': '📊  上下文状态:',
            'cli.error': '❌  错误:',
            'cli.goodbye': '\n👋  再见!',
            'scan.starting': '🚀  开始扫描目标:',
            'scan.type': '   扫描类型:',
            'scan.depth': '   扫描深度:',
            'scan.userMessage': '请对目标 {target} 执行 {type} 扫描，扫描深度为 {depth}。',
            'scan.preparing': '\n⚙️  准备执行任务列表...',
            'scan.complete': '\n✅  任务列表执行完成!',
            'scan.foundVulns': '\n🔍  发现 {count} 个潜在漏洞:',
            'scan.noVulns': '\n✅  未发现明显漏洞。',
            'scan.failed': '\n❌  任务列表执行失败。',
            'tools.available': '\n📋  可用工具:\n',
            'tools.status': '   状态:',
            'tools.version': '   版本:',
            'tools.notFound': '❌  未找到工具:',
            'tools.installing': '📦  正在安装工具:',
            'tools.installSuccess': '✅  工具安装成功:',
            'tools.installFailed': '❌  工具安装失败:',
            'tools.installingAll': '📦  正在安装所有工具...',
            'tools.installResult': '\n\n✅  安装完成: {installed}/{total} 成功, {failed} 失败',
            'tools.checking': '🔍  检查工具:',
            'tools.installed': '   状态: ✅ 已安装',
            'tools.notInstalled': '   状态: ❌ 未安装',
            'tools.help.title': '\n📋  工具管理命令:\n',
            'tools.help.list': '  tools --list          列出所有工具',
            'tools.help.install': '  tools --install <name>  安装指定工具',
            'tools.help.installAll': '  tools --install-all   安装所有工具',
            'tools.help.check': '  tools --check <name>  检查工具是否安装',
            'cmd.unknown': '❌  未知命令:',
            'cmd.helpHint': '输入 /help 查看可用命令。',
            'user.processing': '\n🤔  正在处理...\n',
            'resp.agent': '🤖  回复:',
            'resp.context': '上下文',
            'resp.todo': '📋  任务列表:',
            'resp.progress': '   进度:',
            'resp.found': '\n🔍  发现 {count} 个漏洞:',
            'resp.needInfo': '\n❓  需要更多信息:',
            'vuln.critical': '🔴 严重',
            'vuln.high': '🟠 高危',
            'vuln.medium': '🟡 中危',
            'vuln.low': '🔵 低危',
            'vuln.info': 'ℹ️  信息',
            'vuln.target': '     目标:',
            'vuln.desc': '     描述:',
            'vuln.evidence': '     证据:',
            'status.title': '\n📊  系统状态:\n',
            'status.providers': '🤖  模型提供商:',
            'status.context': '📝  上下文:',
            'status.tools': '🔧  工具:',
            'status.tools.installed': '已安装',
            'status.todo': '📋  任务列表:',
            'status.todo.none': '无活动任务',
            'status.vulns': '🔍  漏洞:',
            'status.vulns.count': '个发现',
            'ctx.title': '\n📝  上下文内容:\n',
            'ctx.status': '状态:',
            'ctx.messageCount': '消息数量:',
            'ctx.role.system': '系统',
            'ctx.role.user': '用户',
            'ctx.role.assistant': '助手',
            'ctx.role.tool': '工具',
            'ctx.noContent': '(无内容)',
            'tools.list.title': '\n📋  工具列表:\n',
            'tools.cmd.help.title': '\n📋  工具管理命令:',
            'tools.cmd.list': '  /tools list          列出所有工具',
            'tools.cmd.install': '  /tools install <名>  安装指定工具',
            'tools.cmd.installAll': '  /tools install-all   安装所有工具',
            'tools.cmd.check': '  /tools check <名>    检查工具状态',
            'tools.cmd.specifyName': '❌  请指定要安装的工具名称。',
            'tools.cmd.usageInstall': '用法: /tools install <工具名>',
            'tools.cmd.installingNow': '📦  正在安装',
            'tools.cmd.specifyCheck': '❌  请指定要检查的工具名称。',
            'models.list.title': '\n🤖  模型提供商:\n',
            'models.available.title': '\n📦  当前提供商可用模型:\n',
            'models.cmd.specify': '❌  请指定要切换的提供商名称。',
            'models.cmd.usage': '用法: /models switch <提供商名>',
            'models.switched': '✅  已切换到',
            'models.failed': '❌  无法切换到（不可用）',
            'models.cmd.help.title': '\n🤖  模型管理命令:',
            'models.cmd.list': '  /models list           列出所有提供商',
            'models.cmd.switch': '  /models switch <名>    切换到指定提供商',
            'vulns.none': '\n✅  暂无发现的漏洞。\n',
            'vulns.found': '\n🔍  发现 {count} 个漏洞:\n',
            'todo.none': '\n📋  暂无任务列表。\n',
            'todo.list.title': '\n📋  任务列表:\n',
            'todo.tasks': '任务:',
            'todo.tasks.completed': '已完成',
            'todo.noActive': '\n❌  没有活动的任务列表。\n',
            'todo.activeTitle': '\n📋  {title}:\n',
            'todo.status.completed': '✅',
            'todo.status.inProgress': '🔄',
            'todo.status.failed': '❌',
            'todo.status.pending': '⏳',
            'todo.priority.high': '🔴',
            'todo.priority.medium': '🟡',
            'todo.priority.low': '🔵',
            'todo.tool': '   工具:',
            'todo.result': '   结果:',
            'todo.cmd.help.title': '\n📋  任务列表命令:',
            'todo.cmd.list': '  /todo list        列出所有任务列表',
            'todo.cmd.show': '  /todo show        显示当前任务列表详情',
            'todo.cmd.execute': '  /execute          执行当前任务列表',
            'exec.noActive': '\n❌  没有活动的任务列表。\n',
            'exec.empty': '\n❌  任务列表为空。\n',
            'exec.running': '\n⚙️  正在执行任务列表: {title}\n',
            'exec.complete': '\n✅  任务列表执行完成!',
            'exec.found': '\n🔍  发现 {count} 个漏洞:\n',
            'exec.none': '\n✅  未发现明显漏洞。',
            'exec.failed': '\n❌  任务列表执行失败。',
            'clear.done': '\n🗑️  上下文已清除。\n',
            'config.dev': '⚠️  配置修改功能开发中。\n',
            'config.title': '\n⚙️  当前配置:\n',
            'config.providers': '🤖  模型提供商:',
            'config.active': '   活动:',
            'config.context': '\n📝  上下文窗口:',
            'config.maxTokens': '   最大 tokens:',
            'config.warningThreshold': '   警告阈值:',
            'config.autoCompression': '   自动压缩:',
            'config.todo': '\n📋  任务列表:',
            'config.autoGenerate': '   自动生成:',
            'config.maxConcurrent': '   最大并发:',
            'config.retry': '   失败重试:',
            'config.retry.times': '次',
            'config.tools': '\n🔧  工具链:',
            'config.autoInstall': '   自动安装:',
            'config.autoUpdate': '   自动更新:',
            'config.logLevel': '   日志级别:',
            'config.toolsDir': '   工具目录:',
            'config.security': '\n🔒  安全:',
            'config.safeMode': '   安全模式:',
            'config.allowDangerous': '   允许危险工具:',
            'config.maxExploit': '   最大利用尝试:',
            'config.enabled': '启用',
            'config.disabled': '禁用',
            'config.yes': '是',
            'config.no': '否',
            'help.title': '\n📖  可用命令:\n',
            'help.core': '🔧  核心功能:',
            'help.core.status': '  /status    显示系统状态',
            'help.core.context': '  /context   显示当前上下文',
            'help.core.clear': '  /clear     清除上下文',
            'help.core.help': '  /help      显示此帮助',
            'help.core.exit': '  /exit      退出程序\n',
            'help.models': '🤖  模型管理:',
            'help.models.list': '  /models list           列出所有模型提供商',
            'help.models.switch': '  /models switch <名>    切换到指定提供商\n',
            'help.tools': '🔧  工具管理:',
            'help.tools.list': '  /tools list            列出所有工具',
            'help.tools.install': '  /tools install <名>    安装指定工具',
            'help.tools.installAll': '  /tools install-all     安装所有工具',
            'help.tools.check': '  /tools check <名>      检查工具状态\n',
            'help.tasks': '📋  任务管理:',
            'help.tasks.list': '  /todo list     列出所有任务列表',
            'help.tasks.show': '  /todo show     显示当前任务详情',
            'help.tasks.execute': '  /execute       执行当前任务列表\n',
            'help.security': '🔍  安全:',
            'help.security.vulns': '  /vulns         显示发现的漏洞',
            'help.security.config': '  /config        显示当前配置\n',
            'help.tips': '💡  使用提示:',
            'help.tips.1': '  - 直接输入问题或指令进行对话',
            'help.tips.2': '  - 系统会自动分析需求并生成任务',
            'help.tips.3': '  - 使用 /execute 执行生成的任务列表',
            'help.tips.4': '  - 使用 /vulns 查看发现的漏洞\n',
            'welcome.usage': '用法: ai-security-mcp [命令]\n',
            'welcome.commands': '命令:',
            'welcome.cmd.interactive': '  interactive, i    启动交互式模式 (推荐)',
            'welcome.cmd.scan': '  scan <目标>       对目标执行安全扫描',
            'welcome.cmd.tools': '  tools             管理安全工具',
            'welcome.cmd.help': '  --help            显示详细帮助\n',
            'welcome.examples': '示例:',
            'welcome.ex.1': '  ai-security-mcp interactive',
            'welcome.ex.2': '  ai-security-mcp scan example.com --type full\n'
        }
    };
    const langData = translations[lang] || translations.en;
    return langData[key] || key;
}
function format(str, args) {
    return str.replace(/{(\w+)}/g, (_, key) => String(args[key] ?? key));
}
program
    .name('ai-security-mcp')
    .description(t('cli.banner'))
    .version('1.0.0');
program
    .command('interactive')
    .alias('i')
    .description(i18n.isChinese() ? '启动交互式模式' : 'Start interactive mode')
    .action(async () => {
    const isZh = i18n.isChinese();
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log(`║          ${t('cli.banner').padEnd(52)}║`);
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║  ${t('cli.availableCommands').padEnd(58)}║`);
    console.log(`║    ${t('cli.command.status').padEnd(54)}║`);
    console.log(`║    ${t('cli.command.context').padEnd(54)}║`);
    console.log(`║    ${t('cli.command.tools').padEnd(54)}║`);
    console.log(`║    ${t('cli.command.models').padEnd(54)}║`);
    console.log(`║    ${t('cli.command.vulns').padEnd(54)}║`);
    console.log(`║    ${t('cli.command.todo').padEnd(54)}║`);
    console.log(`║    ${t('cli.command.execute').padEnd(54)}║`);
    console.log(`║    ${t('cli.command.clear').padEnd(54)}║`);
    console.log(`║    ${t('cli.command.config').padEnd(54)}║`);
    console.log(`║    ${t('cli.command.help').padEnd(54)}║`);
    console.log(`║    ${t('cli.command.exit').padEnd(54)}║`);
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    const agent = (0, securityAgent_1.getSecurityAgent)();
    await agent.initialize();
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: 'SecurityMCP> '
    });
    console.log(t('cli.initializing') + '\n');
    const modelManager = (0, modelManager_1.getModelManager)();
    const providers = await modelManager.checkAllProviders();
    const availableProviders = Array.from(providers.entries())
        .filter(([, available]) => available)
        .map(([name]) => name);
    if (availableProviders.length === 0) {
        console.warn(t('cli.noProviders'));
        console.warn(t('cli.lmstudioHint'));
        console.warn(t('cli.loadModelHint') + '\n');
    }
    else {
        console.log(t('cli.availableProviders') + availableProviders.join(', ') + '\n');
    }
    const contextManager = (0, contextManager_1.getContextManager)();
    console.log(t('cli.contextStatus') + contextManager.getStatusDisplay() + '\n');
    rl.prompt();
    rl.on('line', async (line) => {
        const input = line.trim();
        try {
            if (input.startsWith('/')) {
                await handleCommand(input, rl);
            }
            else if (input.length > 0) {
                await handleUserMessage(input, rl);
            }
        }
        catch (error) {
            console.error('\n' + t('cli.error'), error instanceof Error ? error.message : String(error));
        }
        rl.prompt();
    }).on('close', () => {
        console.log(t('cli.goodbye'));
        process.exit(0);
    });
});
program
    .command('scan <target>')
    .description(i18n.isChinese() ? '对目标执行安全扫描' : 'Perform security scan on target')
    .option('-t, --type <type>', i18n.isChinese() ? '扫描类型: recon, vulnerability, full (默认: full)' : 'Scan type: recon, vulnerability, full (default: full)', 'full')
    .option('-d, --depth <depth>', i18n.isChinese() ? '扫描深度: quick, standard, deep (默认: standard)' : 'Scan depth: quick, standard, deep (default: standard)', 'standard')
    .option('-o, --output <file>', i18n.isChinese() ? '输出报告文件' : 'Output report file')
    .action(async (target, options) => {
    const isZh = i18n.isChinese();
    console.log('\n' + t('scan.starting') + ' ' + target);
    console.log(t('scan.type') + ' ' + options.type);
    console.log(t('scan.depth') + ' ' + options.depth + '\n');
    const agent = (0, securityAgent_1.getSecurityAgent)();
    await agent.initialize();
    const userMessage = format(t('scan.userMessage'), {
        target,
        type: options.type,
        depth: options.depth
    });
    const response = await agent.processMessage(userMessage);
    printResponse(response);
    const todoManager = (0, todoManager_1.getTodoManager)();
    const activeTodo = todoManager.getActiveTodoList();
    if (activeTodo && activeTodo.items.length > 0) {
        console.log(t('scan.preparing'));
        const success = await agent.executeActiveTodoList();
        if (success) {
            console.log(t('scan.complete'));
            const vulnerabilities = agent.getVulnerabilities();
            if (vulnerabilities.length > 0) {
                console.log(format(t('scan.foundVulns'), { count: vulnerabilities.length }));
                printVulnerabilities(vulnerabilities);
            }
            else {
                console.log(t('scan.noVulns'));
            }
        }
        else {
            console.log(t('scan.failed'));
        }
    }
});
program
    .command('tools')
    .description(i18n.isChinese() ? '管理安全工具' : 'Manage security tools')
    .option('-l, --list', i18n.isChinese() ? '列出所有工具' : 'List all tools')
    .option('-i, --install <tool>', i18n.isChinese() ? '安装指定工具' : 'Install specified tool')
    .option('-a, --install-all', i18n.isChinese() ? '安装所有工具' : 'Install all tools')
    .option('-c, --check <tool>', i18n.isChinese() ? '检查工具是否安装' : 'Check if tool is installed')
    .action(async (options) => {
    const toolRegistry = (0, toolRegistry_1.getToolRegistry)();
    const toolExecutor = (0, toolExecutor_1.getToolExecutor)();
    const isZh = i18n.isChinese();
    if (options.list) {
        const tools = toolRegistry.getAllTools();
        console.log(t('tools.available'));
        tools.forEach((tool, i) => {
            const statusIcon = tool.installed ? '✅' : '❌';
            console.log(`${i + 1}. ${statusIcon} ${tool.name} (${tool.category})`);
            console.log(`   ${isZh ? '描述' : 'Description'}: ${tool.description}`);
            console.log(`   ${t('tools.version')} ${tool.version}`);
            console.log(`   ${t('tools.status')} ${tool.installed ? t('tools.installed') : t('tools.notInstalled')}\n`);
        });
    }
    else if (options.install) {
        const tool = toolRegistry.getTool(options.install);
        if (!tool) {
            console.error(t('tools.notFound') + ' ' + options.install);
            return;
        }
        console.log(t('tools.installing') + ' ' + tool.name + '...\n');
        const success = await toolExecutor.installTool(tool, (progress) => {
            const progressBar = progress.progress
                ? `[${'='.repeat(Math.floor(progress.progress / 10))}${' '.repeat(10 - Math.floor(progress.progress / 10))}]`
                : '';
            process.stdout.write(`\r   ${progress.phase}: ${progress.message} ${progressBar}`);
        });
        console.log('\n');
        console.log(success ? t('tools.installSuccess') + ' ' + tool.name : t('tools.installFailed') + ' ' + tool.name);
    }
    else if (options.installAll) {
        console.log(t('tools.installingAll') + '\n');
        const result = await toolExecutor.installAllTools((progress, index, total) => {
            process.stdout.write(`\r   [${index + 1}/${total}] ${progress.toolName}: ${progress.phase}`);
        });
        console.log(format(t('tools.installResult'), {
            installed: result.installed,
            total: result.total,
            failed: result.failed
        }));
    }
    else if (options.check) {
        const tool = toolRegistry.getTool(options.check);
        if (!tool) {
            console.error(t('tools.notFound') + ' ' + options.check);
            return;
        }
        console.log(t('tools.checking') + ' ' + tool.name + '...');
        const result = await toolExecutor.checkToolInstalled(tool);
        console.log(result.installed ? t('tools.installed') : t('tools.notInstalled'));
        if (result.version) {
            console.log(t('tools.version') + ' ' + result.version);
        }
        if (result.installed) {
            toolRegistry.updateToolStatus(tool.name, true, result.version);
        }
    }
    else {
        console.log(t('tools.help.title'));
        console.log(t('tools.help.list'));
        console.log(t('tools.help.install'));
        console.log(t('tools.help.installAll'));
        console.log(t('tools.help.check') + '\n');
    }
});
program.parse(process.argv);
async function handleCommand(input, rl) {
    const parts = input.split(' ');
    const command = parts[0]?.toLowerCase();
    const isZh = i18n.isChinese();
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
            console.log(t('cli.goodbye'));
            process.exit(0);
            break;
        default:
            console.log(t('cmd.unknown') + ' ' + command);
            console.log(t('cmd.helpHint'));
    }
}
async function handleUserMessage(input, rl) {
    const agent = (0, securityAgent_1.getSecurityAgent)();
    console.log(t('user.processing'));
    const response = await agent.processMessage(input);
    printResponse(response);
}
function printResponse(response) {
    console.log(t('resp.agent'));
    console.log(response.content);
    console.log('');
    const pct = Math.round(response.contextInfo.usagePercentage * 100);
    const status = pct >= 95 ? '🔴' : pct >= 80 ? '🟡' : '🟢';
    console.log(`${status}  ${t('resp.context')}: ${response.contextInfo.currentTokens}/${response.contextInfo.maxTokens} tokens (${pct}%)`);
    if (response.todoList) {
        console.log(t('resp.todo') + ' ' + response.todoList.title);
        console.log(t('resp.progress') + ' ' + response.todoList.progress.completed + '/' + response.todoList.progress.total + ' (' + response.todoList.progress.percentage + '%)');
    }
    if (response.vulnerabilities && response.vulnerabilities.length > 0) {
        console.log(format(t('resp.found'), { count: response.vulnerabilities.length }));
        printVulnerabilities(response.vulnerabilities);
    }
    if (response.clarifications && response.clarifications.length > 0) {
        console.log(t('resp.needInfo'));
        response.clarifications.forEach((c, i) => {
            console.log(`${i + 1}. ${c.question}`);
            if (c.options && c.options.length > 0) {
                console.log(`   ${i18n.isChinese() ? '选项' : 'Options'}: ${c.options.join(', ')}`);
            }
        });
    }
    console.log('');
}
function printVulnerabilities(vulnerabilities) {
    const bySeverity = {};
    for (const vuln of vulnerabilities) {
        if (!bySeverity[vuln.severity]) {
            bySeverity[vuln.severity] = [];
        }
        bySeverity[vuln.severity].push(vuln);
    }
    const severityOrder = ['critical', 'high', 'medium', 'low', 'info'];
    const severityLabels = {
        critical: t('vuln.critical'),
        high: t('vuln.high'),
        medium: t('vuln.medium'),
        low: t('vuln.low'),
        info: t('vuln.info')
    };
    for (const severity of severityOrder) {
        const vulns = bySeverity[severity];
        if (!vulns || vulns.length === 0)
            continue;
        console.log(`\n${severityLabels[severity]} (${vulns.length}):`);
        vulns.forEach((vuln, i) => {
            console.log(`  ${i + 1}. ${vuln.name}`);
            console.log(t('vuln.target') + ' ' + vuln.affectedTarget);
            console.log(t('vuln.desc') + ' ' + vuln.description.substring(0, 100) + '...');
            if (vuln.proofOfConcept) {
                console.log(t('vuln.evidence') + ' ' + vuln.proofOfConcept.substring(0, 80) + '...');
            }
        });
    }
}
async function showStatus() {
    const modelManager = (0, modelManager_1.getModelManager)();
    const contextManager = (0, contextManager_1.getContextManager)();
    const toolRegistry = (0, toolRegistry_1.getToolRegistry)();
    const todoManager = (0, todoManager_1.getTodoManager)();
    const vulnerabilityAnalyzer = (0, vulnerabilityAnalyzer_1.getVulnerabilityAnalyzer)();
    const isZh = i18n.isChinese();
    console.log(t('status.title'));
    const providers = await modelManager.checkAllProviders();
    const activeProvider = modelManager.getActiveProviderName();
    console.log(t('status.providers'));
    for (const [name, available] of providers.entries()) {
        const isActive = name === activeProvider;
        const icon = available ? '✅' : '❌';
        const activeMarker = isActive ? (isZh ? ' [当前]' : ' [Current]') : '';
        console.log(`   ${icon} ${name}${activeMarker}`);
    }
    console.log(`\n${t('status.context')} ${contextManager.getStatusDisplay()}`);
    const tools = toolRegistry.getAllTools();
    const installed = tools.filter(t => t.installed).length;
    console.log(`${t('status.tools')} ${installed}/${tools.length} ${t('status.tools.installed')}`);
    const activeTodo = todoManager.getActiveTodoList();
    if (activeTodo) {
        const progress = todoManager.getProgress(activeTodo.id);
        console.log(`${t('status.todo')} ${activeTodo.title} (${progress.percentage}%)`);
    }
    else {
        console.log(`${t('status.todo')} ${t('status.todo.none')}`);
    }
    const vulns = vulnerabilityAnalyzer.getAllVulnerabilities();
    console.log(`${t('status.vulns')} ${vulns.length} ${t('status.vulns.count')}`);
    console.log('');
}
function showContext() {
    const contextManager = (0, contextManager_1.getContextManager)();
    const messages = contextManager.getMessages();
    const isZh = i18n.isChinese();
    console.log(t('ctx.title'));
    console.log(t('ctx.status') + ' ' + contextManager.getStatusDisplay() + '\n');
    console.log(t('ctx.messageCount') + ' ' + messages.length + '\n');
    messages.forEach((msg, i) => {
        const roleLabel = msg.role === 'system' ? t('ctx.role.system') :
            msg.role === 'user' ? t('ctx.role.user') :
                msg.role === 'assistant' ? t('ctx.role.assistant') : t('ctx.role.tool');
        const preview = msg.content?.substring(0, 100) || t('ctx.noContent');
        const truncated = msg.content && msg.content.length > 100 ? '...' : '';
        console.log(`[${i + 1}] ${roleLabel}: ${preview}${truncated}`);
    });
    console.log('');
}
async function handleToolsCommand(args) {
    const toolRegistry = (0, toolRegistry_1.getToolRegistry)();
    const toolExecutor = (0, toolExecutor_1.getToolExecutor)();
    const isZh = i18n.isChinese();
    const subCommand = args[0]?.toLowerCase();
    switch (subCommand) {
        case 'list':
        case 'ls':
            const tools = toolRegistry.getAllTools();
            console.log(t('tools.list.title'));
            tools.forEach((tool, i) => {
                const status = tool.installed ? '✅' : '❌';
                console.log(`${i + 1}. ${status} ${tool.name} (${tool.category}) - ${tool.description}`);
            });
            console.log('');
            break;
        case 'install':
        case 'i':
            if (args.length < 2) {
                console.log(t('tools.cmd.specifyName'));
                console.log(t('tools.cmd.usageInstall'));
                return;
            }
            const toolName = args[1];
            const tool = toolRegistry.getTool(toolName);
            if (!tool) {
                console.log(t('tools.notFound') + ' ' + toolName);
                return;
            }
            console.log(t('tools.cmd.installingNow') + ' ' + tool.name + '...');
            const success = await toolExecutor.installTool(tool, (progress) => {
                process.stdout.write(`\r   ${progress.phase}: ${progress.message}`);
            });
            console.log('');
            console.log(success ? t('tools.installSuccess') + ' ' + tool.name : t('tools.installFailed') + ' ' + tool.name);
            break;
        case 'install-all':
            console.log(t('tools.installingAll') + '\n');
            const result = await toolExecutor.installAllTools((progress, index, total) => {
                process.stdout.write(`\r   [${index + 1}/${total}] ${progress.toolName}: ${progress.phase}`);
            });
            console.log(format(t('tools.installResult'), {
                installed: result.installed,
                total: result.total,
                failed: result.failed
            }));
            break;
        case 'check':
            if (args.length < 2) {
                console.log(t('tools.cmd.specifyCheck'));
                return;
            }
            const checkName = args[1];
            const checkTool = toolRegistry.getTool(checkName);
            if (!checkTool) {
                console.log(t('tools.notFound') + ' ' + checkName);
                return;
            }
            console.log(t('tools.checking') + ' ' + checkTool.name + '...');
            const checkResult = await toolExecutor.checkToolInstalled(checkTool);
            console.log(checkResult.installed ? t('tools.installed') : t('tools.notInstalled'));
            if (checkResult.version) {
                console.log(t('tools.version') + ' ' + checkResult.version);
            }
            break;
        default:
            console.log(t('tools.cmd.help.title'));
            console.log(t('tools.cmd.list'));
            console.log(t('tools.cmd.install'));
            console.log(t('tools.cmd.installAll'));
            console.log(t('tools.cmd.check') + '\n');
    }
}
async function handleModelsCommand(args) {
    const modelManager = (0, modelManager_1.getModelManager)();
    const isZh = i18n.isChinese();
    const subCommand = args[0]?.toLowerCase();
    switch (subCommand) {
        case 'list':
        case 'ls':
            const providers = await modelManager.checkAllProviders();
            const active = modelManager.getActiveProviderName();
            console.log(t('models.list.title'));
            for (const [name, available] of providers.entries()) {
                const isActive = name === active;
                const statusIcon = available ? '✅' : '❌';
                const activeMarker = isActive ? (isZh ? ' [当前]' : ' [Current]') : '';
                console.log(`   ${statusIcon} ${name}${activeMarker}`);
            }
            try {
                const models = await modelManager.getAvailableModels();
                if (models.length > 0) {
                    console.log(t('models.available.title'));
                    models.forEach(m => console.log(`   - ${m.id}`));
                }
            }
            catch {
                // Ignore
            }
            console.log('');
            break;
        case 'switch':
        case 'use':
            if (args.length < 2) {
                console.log(t('models.cmd.specify'));
                console.log(t('models.cmd.usage'));
                return;
            }
            const providerName = args[1];
            const switched = await modelManager.switchProvider(providerName);
            if (switched) {
                console.log(t('models.switched') + ' ' + providerName);
            }
            else {
                console.log(t('models.failed') + ' ' + providerName);
            }
            break;
        default:
            console.log(t('models.cmd.help.title'));
            console.log(t('models.cmd.list'));
            console.log(t('models.cmd.switch') + '\n');
    }
}
function showVulnerabilities() {
    const vulnerabilityAnalyzer = (0, vulnerabilityAnalyzer_1.getVulnerabilityAnalyzer)();
    const vulns = vulnerabilityAnalyzer.getAllVulnerabilities();
    if (vulns.length === 0) {
        console.log(t('vulns.none'));
        return;
    }
    console.log(format(t('vulns.found'), { count: vulns.length }));
    printVulnerabilities(vulns);
    console.log('');
}
function handleTodoCommand(args) {
    const todoManager = (0, todoManager_1.getTodoManager)();
    const isZh = i18n.isChinese();
    const subCommand = args[0]?.toLowerCase();
    switch (subCommand) {
        case 'list':
        case 'ls':
            const lists = todoManager.getAllTodoLists();
            const active = todoManager.getActiveTodoList();
            if (lists.length === 0) {
                console.log(t('todo.none'));
                return;
            }
            console.log(t('todo.list.title'));
            lists.forEach((list, i) => {
                const isActive = active?.id === list.id;
                const progress = todoManager.getProgress(list.id);
                console.log(`${i + 1}. ${isActive ? '▶️ ' : ''}${list.title} (${progress.percentage}%)`);
                console.log(`   ${list.description.substring(0, 80)}${list.description.length > 80 ? '...' : ''}`);
                console.log(`   ${t('todo.tasks')} ${progress.completed}/${progress.total} ${t('todo.tasks.completed')}\n`);
            });
            break;
        case 'show':
            const activeList = todoManager.getActiveTodoList();
            if (!activeList) {
                console.log(t('todo.noActive'));
                return;
            }
            console.log(format(t('todo.activeTitle'), { title: activeList.title }) + '\n');
            activeList.items.forEach((item, i) => {
                const statusIcon = item.status === 'completed' ? t('todo.status.completed') :
                    item.status === 'in_progress' ? t('todo.status.inProgress') :
                        item.status === 'failed' ? t('todo.status.failed') : t('todo.status.pending');
                const priorityIcon = item.priority === 'high' ? t('todo.priority.high') :
                    item.priority === 'medium' ? t('todo.priority.medium') : t('todo.priority.low');
                console.log(`${i + 1}. ${statusIcon} ${priorityIcon} ${item.content}`);
                if (item.tool) {
                    console.log(t('todo.tool') + ' ' + item.tool);
                }
                if (item.result) {
                    console.log(t('todo.result') + ' ' + item.result.substring(0, 100) + '...');
                }
                console.log('');
            });
            break;
        default:
            console.log(t('todo.cmd.help.title'));
            console.log(t('todo.cmd.list'));
            console.log(t('todo.cmd.show'));
            console.log(t('todo.cmd.execute') + '\n');
    }
}
async function executeTodoList() {
    const todoManager = (0, todoManager_1.getTodoManager)();
    const agent = (0, securityAgent_1.getSecurityAgent)();
    const activeTodo = todoManager.getActiveTodoList();
    if (!activeTodo) {
        console.log(t('exec.noActive'));
        return;
    }
    if (activeTodo.items.length === 0) {
        console.log(t('exec.empty'));
        return;
    }
    console.log(format(t('exec.running'), { title: activeTodo.title }) + '\n');
    const success = await agent.executeActiveTodoList();
    if (success) {
        console.log(t('exec.complete'));
        const vulns = agent.getVulnerabilities();
        if (vulns.length > 0) {
            console.log(format(t('exec.found'), { count: vulns.length }));
            printVulnerabilities(vulns);
        }
        else {
            console.log(t('exec.none'));
        }
    }
    else {
        console.log(t('exec.failed'));
    }
    console.log('');
}
function clearContext() {
    const agent = (0, securityAgent_1.getSecurityAgent)();
    agent.clearContext();
    console.log(t('clear.done'));
}
function handleConfigCommand(args) {
    const config = (0, config_1.getConfig)();
    const subCommand = args[0]?.toLowerCase();
    const isZh = i18n.isChinese();
    if (subCommand === 'set') {
        console.log(t('config.dev'));
        return;
    }
    console.log(t('config.title'));
    console.log(t('config.providers'));
    console.log(t('config.active') + ' ' + config.activeProvider);
    config.modelProviders.forEach(p => {
        console.log(`   - ${p.name} (${p.type}): ${p.baseUrl}`);
    });
    console.log(t('config.context'));
    console.log(t('config.maxTokens') + ' ' + config.contextWindow.maxTokens);
    console.log(t('config.warningThreshold') + ' ' + Math.round(config.contextWindow.warningThreshold * 100) + '%');
    console.log(t('config.autoCompression') + ' ' + (config.contextWindow.autoCompression ? t('config.enabled') : t('config.disabled')));
    console.log(t('config.todo'));
    console.log(t('config.autoGenerate') + ' ' + (config.todoList.autoGenerate ? t('config.enabled') : t('config.disabled')));
    console.log(t('config.maxConcurrent') + ' ' + config.todoList.maxConcurrentTasks);
    console.log(t('config.retry') + ' ' + (config.todoList.retryOnFailure ? t('config.enabled') + ` (${t('config.retry.times')}: ${config.todoList.maxRetries})` : t('config.disabled')));
    console.log(t('config.tools'));
    console.log(t('config.autoInstall') + ' ' + (config.toolChain.autoInstall ? t('config.enabled') : t('config.disabled')));
    console.log(t('config.autoUpdate') + ' ' + (config.toolChain.autoUpdate ? t('config.enabled') : t('config.disabled')));
    console.log(t('config.logLevel') + ' ' + config.toolChain.logLevel);
    console.log(t('config.toolsDir') + ' ' + config.toolChain.toolsDirectory);
    console.log(t('config.security'));
    console.log(t('config.safeMode') + ' ' + (config.security.safeMode ? t('config.enabled') : t('config.disabled')));
    console.log(t('config.allowDangerous') + ' ' + (config.security.allowDangerousTools ? t('config.yes') : t('config.no')));
    console.log(t('config.maxExploit') + ' ' + config.security.maxExploitAttempts);
    console.log('');
}
function showHelp() {
    console.log(t('help.title'));
    console.log(t('help.core'));
    console.log(t('help.core.status'));
    console.log(t('help.core.context'));
    console.log(t('help.core.clear'));
    console.log(t('help.core.help'));
    console.log(t('help.core.exit'));
    console.log(t('help.models'));
    console.log(t('help.models.list'));
    console.log(t('help.models.switch'));
    console.log(t('help.tools'));
    console.log(t('help.tools.list'));
    console.log(t('help.tools.install'));
    console.log(t('help.tools.installAll'));
    console.log(t('help.tools.check'));
    console.log(t('help.tasks'));
    console.log(t('help.tasks.list'));
    console.log(t('help.tasks.show'));
    console.log(t('help.tasks.execute'));
    console.log(t('help.security'));
    console.log(t('help.security.vulns'));
    console.log(t('help.security.config'));
    console.log(t('help.tips'));
    console.log(t('help.tips.1'));
    console.log(t('help.tips.2'));
    console.log(t('help.tips.3'));
    console.log(t('help.tips.4'));
}
if (process.argv.length <= 2) {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log(`║          ${t('cli.banner').padEnd(52)}║`);
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    console.log(t('welcome.usage'));
    console.log(t('welcome.commands'));
    console.log(t('welcome.cmd.interactive'));
    console.log(t('welcome.cmd.scan'));
    console.log(t('welcome.cmd.tools'));
    console.log(t('welcome.cmd.help'));
    console.log(t('welcome.examples'));
    console.log(t('welcome.ex.1'));
    console.log(t('welcome.ex.2'));
}
//# sourceMappingURL=index.js.map