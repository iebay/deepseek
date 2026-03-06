export const AGENT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'read_file',
      description: '读取项目中指定文件的内容。用于分析代码、理解上下文。',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '文件的相对或绝对路径' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'write_file',
      description: '创建或覆盖文件内容。必须输出完整文件内容，不是 diff。',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '文件路径' },
          content: { type: 'string', description: '完整的文件内容' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
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
    },
  },
  {
    type: 'function' as const,
    function: {
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
    },
  },
  {
    type: 'function' as const,
    function: {
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
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'git_status',
      description: '获取当前 git 状态（分支、变更文件列表）',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function' as const,
    function: {
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
    },
  },
];
