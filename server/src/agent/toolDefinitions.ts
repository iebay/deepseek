import type OpenAI from 'openai';

/** Scopes that a tool can be available in. */
export type ToolScope = 'agent' | 'smart-chat';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  /** Which service scopes include this tool. */
  scope: ToolScope[];
}

/**
 * ALL_TOOLS is the single source of truth for every tool definition.
 *
 * To add a tool:
 *  1. Add it here with the appropriate scope(s).
 *  2. Add the execution logic in toolRunner.ts switch/case.
 */
export const ALL_TOOLS: ToolDefinition[] = [
  {
    name: 'read_file',
    description: '读取项目中指定文件的内容。用于分析代码、理解上下文。',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件的相对或绝对路径' },
      },
      required: ['path'],
    },
    scope: ['agent', 'smart-chat'],
  },
  {
    name: 'write_file',
    description: '创建或修改项目中的文件。写入完整的文件内容（不是 diff）。',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件路径（相对于项目根目录）' },
        content: { type: 'string', description: '完整的文件内容' },
      },
      required: ['path', 'content'],
    },
    scope: ['agent', 'smart-chat'],
  },
  {
    name: 'search_code',
    description: '在项目中搜索包含指定文本或正则的代码行',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: '搜索文本或正则表达式' },
        path: { type: 'string', description: '限定搜索的目录或文件，默认项目根目录' },
        is_regex: { type: 'boolean', description: '是否为正则表达式' },
      },
      required: ['pattern'],
    },
    scope: ['agent', 'smart-chat'],
  },
  {
    name: 'list_directory',
    description: '列出指定目录下的文件和子目录',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '目录路径' },
        recursive: { type: 'boolean', description: '是否递归列出，默认 false' },
        max_depth: { type: 'number', description: '递归深度限制，默认 3' },
      },
      required: ['path'],
    },
    scope: ['agent', 'smart-chat'],
  },
  {
    name: 'run_command',
    description: '在项目根目录执行 shell 命令。仅限安全命令如 npm/tsc/eslint/prettier。',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: '要执行的命令' },
        cwd: { type: 'string', description: '工作目录，默认项目根' },
      },
      required: ['command'],
    },
    scope: ['agent'],
  },
  {
    name: 'git_status',
    description: '获取当前 git 状态（分支、变更文件列表）',
    parameters: {
      type: 'object',
      properties: {},
    },
    scope: ['agent', 'smart-chat'],
  },
  {
    name: 'git_log',
    description: '获取 git 提交历史。可以查看整个项目或指定文件的提交记录。',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '可选，限定到某个文件的历史' },
        limit: { type: 'number', description: '返回的提交数量，默认 10' },
        since: { type: 'string', description: '可选，起始日期，如 "2024-01-01" 或 "1 week ago"' },
      },
    },
    scope: ['agent'],
  },
  {
    name: 'git_diff',
    description: '查看两个 commit 之间的代码差异，或查看未提交的改动。',
    parameters: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'commit SHA 或引用（如 HEAD~3），默认 HEAD~1' },
        to: { type: 'string', description: 'commit SHA 或引用，默认 HEAD' },
        path: { type: 'string', description: '可选，限定到某个文件' },
      },
    },
    scope: ['agent'],
  },
  {
    name: 'git_blame',
    description: '查看文件每一行的最后修改者和修改时间。用于追溯代码变更。',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件路径' },
        start_line: { type: 'number', description: '可选，起始行号' },
        end_line: { type: 'number', description: '可选，结束行号' },
      },
      required: ['path'],
    },
    scope: ['agent'],
  },
  {
    name: 'git_commit',
    description: '将所有变更暂存（git add -A）并提交到本地仓库。',
    parameters: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'commit 消息' },
      },
      required: ['message'],
    },
    scope: ['agent'],
  },
  {
    name: 'git_push',
    description: '将本地提交推送到远程仓库。',
    parameters: {
      type: 'object',
      properties: {
        remote: { type: 'string', description: '可选，远程名称，默认 origin' },
        branch: { type: 'string', description: '可选，分支名称，默认为当前分支' },
      },
    },
    scope: ['agent'],
  },
  {
    name: 'git_pull',
    description: '从远程仓库拉取最新变更。',
    parameters: {
      type: 'object',
      properties: {
        remote: { type: 'string', description: '可选，远程名称，默认 origin' },
        branch: { type: 'string', description: '可选，分支名称' },
      },
    },
    scope: ['agent'],
  },
  {
    name: 'git_clone',
    description: '克隆远程仓库到本地目录。目标目录必须在允许的工作区范围内。',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: '仓库 URL（https:// 或 git@）' },
        directory: { type: 'string', description: '可选，克隆到的本地目录路径' },
      },
      required: ['url'],
    },
    scope: ['agent'],
  },
  {
    name: 'semantic_search',
    description:
      '按语义/意图搜索代码。当你不知道确切的函数名或变量名时，可以用自然语言描述你要找的功能。例如："处理用户登录认证的逻辑"、"数据库连接配置"',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '自然语言描述你要查找的代码功能' },
        file_extensions: {
          type: 'array',
          items: { type: 'string' },
          description: '可选，限定搜索的文件类型，如 [".ts", ".tsx"]',
        },
        max_results: { type: 'number', description: '返回结果数量，默认 5' },
      },
      required: ['query'],
    },
    scope: ['agent'],
  },
  {
    name: 'find_references',
    description:
      '搜索指定符号（函数名、类名、组件名、变量名）在项目中的所有引用位置。包括 import 语句和实际调用。',
    parameters: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: '要查找的符号名' },
        type: {
          type: 'string',
          enum: ['function', 'class', 'component', 'variable', 'any'],
          description: '符号类型，默认 any（搜索所有类型）',
        },
      },
      required: ['symbol'],
    },
    scope: ['agent'],
  },
  {
    name: 'web_search',
    description:
      '搜索网络获取最新的技术文档、API 参考、npm 包信息、错误解决方案等。当你不确定某个库的用法或遇到不熟悉的错误时使用。',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词' },
        max_results: { type: 'number', description: '返回结果数量，默认 5' },
      },
      required: ['query'],
    },
    scope: ['agent'],
  },
  {
    name: 'task_complete',
    description: '标记任务完成，输出最终总结',
    parameters: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: '任务完成总结' },
        files_modified: {
          type: 'array',
          items: { type: 'string' },
          description: '修改过的文件列表',
        },
      },
      required: ['summary'],
    },
    scope: ['agent'],
  },
  // ── GitHub API remote tools ──────────────────────────────────────────────
  {
    name: 'github_read_file',
    description: '从远程 GitHub 仓库读取文件内容（无需克隆）。',
    parameters: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: '仓库所有者（用户名或组织名）' },
        repo: { type: 'string', description: '仓库名称' },
        path: { type: 'string', description: '文件路径' },
        ref: { type: 'string', description: '可选，分支名、标签或 commit SHA，默认为默认分支' },
      },
      required: ['owner', 'repo', 'path'],
    },
    scope: ['agent', 'smart-chat'],
  },
  {
    name: 'github_write_file',
    description: '在远程 GitHub 仓库创建或更新文件（生成一个 commit）。更新已有文件时需提供 sha。',
    parameters: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: '仓库所有者' },
        repo: { type: 'string', description: '仓库名称' },
        path: { type: 'string', description: '文件路径' },
        content: { type: 'string', description: '文件的完整文本内容' },
        message: { type: 'string', description: 'commit 消息' },
        branch: { type: 'string', description: '可选，目标分支，默认为默认分支' },
        sha: { type: 'string', description: '可选，更新已有文件时需要提供该文件当前的 SHA' },
      },
      required: ['owner', 'repo', 'path', 'content', 'message'],
    },
    scope: ['agent', 'smart-chat'],
  },
  {
    name: 'github_list_repo',
    description: '列出远程 GitHub 仓库中某目录下的文件和子目录。',
    parameters: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: '仓库所有者' },
        repo: { type: 'string', description: '仓库名称' },
        path: { type: 'string', description: '可选，目录路径，默认为根目录' },
        ref: { type: 'string', description: '可选，分支名、标签或 commit SHA' },
      },
      required: ['owner', 'repo'],
    },
    scope: ['agent', 'smart-chat'],
  },
  {
    name: 'github_create_branch',
    description: '在远程 GitHub 仓库创建新分支。',
    parameters: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: '仓库所有者' },
        repo: { type: 'string', description: '仓库名称' },
        branch_name: { type: 'string', description: '新分支名称' },
        from_branch: { type: 'string', description: '可选，基于哪个分支创建，默认为 main 或 master' },
      },
      required: ['owner', 'repo', 'branch_name'],
    },
    scope: ['agent', 'smart-chat'],
  },
  {
    name: 'github_create_pr',
    description: '在远程 GitHub 仓库创建 Pull Request。',
    parameters: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: '仓库所有者' },
        repo: { type: 'string', description: '仓库名称' },
        title: { type: 'string', description: 'PR 标题' },
        body: { type: 'string', description: '可选，PR 描述内容' },
        head: { type: 'string', description: '源分支（包含变更的分支）' },
        base: { type: 'string', description: '可选，目标分支，默认为 main' },
      },
      required: ['owner', 'repo', 'title', 'head'],
    },
    scope: ['agent', 'smart-chat'],
  },
];

/**
 * Returns tools formatted for the OpenAI API, filtered to the given scope.
 */
export function getToolsForScope(scope: ToolScope): OpenAI.Chat.ChatCompletionTool[] {
  return ALL_TOOLS.filter(t => t.scope.includes(scope)).map(t => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}
