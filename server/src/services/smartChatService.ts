import OpenAI from 'openai';
import type { Response } from 'express';
import { runTool } from '../agent/toolRunner';
import { loadProjectMemory } from './memoryService';
import type { ChatMessage, ProjectContext } from './deepseekService';
import { supportsToolCalling } from '../constants/models';
import { StreamSanitizer } from '../utils/sanitize';
import { SSEWriter } from '../utils/sse';
import { buildContextWithBudget, truncateResult } from '../utils/contextBudget';
import { getOpenAIClient } from './openaiClient';

const SMART_CHAT_TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
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
    type: 'function',
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
    type: 'function',
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
    type: 'function',
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
    type: 'function',
    function: {
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
    },
  },
  {
    type: 'function',
    function: {
      name: 'github_read_file',
      description: '从 GitHub 远程仓库读取文件内容（需要配置 GITHUB_TOKEN 环境变量）',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'GitHub 仓库所有者' },
          repo: { type: 'string', description: 'GitHub 仓库名称' },
          path: { type: 'string', description: '文件路径' },
          ref: { type: 'string', description: '分支名或 commit SHA，默认为默认分支' },
        },
        required: ['owner', 'repo', 'path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'github_write_file',
      description: '在 GitHub 远程仓库创建或更新文件（需要配置 GITHUB_TOKEN 环境变量）',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'GitHub 仓库所有者' },
          repo: { type: 'string', description: 'GitHub 仓库名称' },
          path: { type: 'string', description: '文件路径' },
          content: { type: 'string', description: '完整的文件内容' },
          message: { type: 'string', description: 'commit 消息' },
          branch: { type: 'string', description: '目标分支名' },
          sha: { type: 'string', description: '被更新文件当前的 blob sha（更新已有文件时必须提供）' },
        },
        required: ['owner', 'repo', 'path', 'content', 'message'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'github_list_repo',
      description: '列出 GitHub 远程仓库的目录内容（需要配置 GITHUB_TOKEN 环境变量）',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'GitHub 仓库所有者' },
          repo: { type: 'string', description: 'GitHub 仓库名称' },
          path: { type: 'string', description: '目录路径，默认仓库根目录' },
          ref: { type: 'string', description: '分支名或 commit SHA' },
        },
        required: ['owner', 'repo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'github_create_branch',
      description: '在 GitHub 远程仓库创建新分支（需要配置 GITHUB_TOKEN 环境变量）',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'GitHub 仓库所有者' },
          repo: { type: 'string', description: 'GitHub 仓库名称' },
          branch_name: { type: 'string', description: '新分支名称' },
          from_branch: { type: 'string', description: '源分支，默认 main' },
        },
        required: ['owner', 'repo', 'branch_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'github_create_pr',
      description: '在 GitHub 远程仓库创建 Pull Request（需要配置 GITHUB_TOKEN 环境变量）',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'GitHub 仓库所有者' },
          repo: { type: 'string', description: 'GitHub 仓库名称' },
          title: { type: 'string', description: 'PR 标题' },
          body: { type: 'string', description: 'PR 描述' },
          head: { type: 'string', description: '源分支' },
          base: { type: 'string', description: '目标分支，默认 main' },
        },
        required: ['owner', 'repo', 'title', 'head'],
      },
    },
  },
];

const SMART_CHAT_BASE_PROMPT = `你是 DeepSeek Code AI 助手——一个集成在代码编辑器中的全栈开发 AI。你拥有完整的项目上下文访问权限，可以直接读取用户的本地文件。

## 你的能力

1. **文件读取**: 用户的项目文件树和当前打开文件的内容已经自动提供给你。你可以看到项目结构和文件内容。
2. **文件修改**: 当你需要创建或修改文件时，使用下方的 JSON 格式输出，系统会自动将修改应用到用户的本地文件系统。
3. **多文件操作**: 你可以在一次回复中修改多个文件。
4. **项目分析**: 你可以分析项目的技术栈、架构、依赖关系和代码质量。

## 重要规则

- **意图识别**: 对于简单的问候、寒暄或闲聊（如"你好"、"hello"、"谢谢"等），直接友好回应，不要调用任何工具，也不要过度分析项目。只有当用户明确提出与代码、文件、项目相关的需求时，才启动工具调用和代码分析流程。
- **你可以访问用户的项目文件。** 不要说"我无法访问本地文件系统"。项目文件树和文件内容已经通过上下文提供给你了。
- **当用户要求修改代码时，必须输出完整的文件内容**，不要输出片段或 diff。
- **始终在修改前解释你要做什么**，修改后说明做了什么改动。
- **主动发现问题**: 如果你发现代码中有 bug、安全隐患或性能问题，主动指出。
- **遵循项目现有的代码风格和规范**。
- **使用中文回答**。
- **绝对不要在回复中输出 XML 标签**。禁止输出 \`<function_calls>\`、\`<invoke>\`、\`<parameter>\`、\`<DSML>\` 等任何 XML/HTML 标签。如果你需要调用工具，请使用 API 提供的 tool_call 机制，不要在文本中模拟。

## 文件修改格式

当需要创建或修改文件时，在你的回复中包含以下 JSON 代码块：

\`\`\`json
{
  "files": [
    {
      "path": "src/components/Example.tsx",
      "content": "完整的文件内容（不是 diff，是完整内容）"
    }
  ],
  "explanation": "简要说明做了什么修改"
}
\`\`\`

## 执行计划模式

当用户的需求涉及多个文件或复杂的重构时，请先输出一份简洁的执行计划（Markdown 格式），然后再执行具体操作。

执行计划格式：
### 📋 执行计划

1. **修改 \`src/xxx.tsx\`** — 添加 XXX 功能
2. **新建 \`src/yyy.ts\`** — 创建 YYY 工具函数
3. **更新 \`package.json\`** — 添加依赖

### 影响范围
- 需要修改 N 个文件
- 不影响现有 API

---

然后紧接着执行具体的文件读取/修改操作。

## GitHub 远程仓库操作

当用户需要直接操作 GitHub 远程仓库时（无需克隆到本地），使用 \`github_*\` 系列工具：

1. **探索远程仓库** — 用 \`github_list_repo\` 浏览目录，用 \`github_read_file\` 读取文件内容
2. **创建工作分支** — 用 \`github_create_branch\` 从 main/master 创建新分支
3. **编辑文件** — 先用 \`github_read_file\` 读取文件（获取 sha），再用 \`github_write_file\` 更新（更新已有文件时必须传 sha）
4. **提交 PR** — 用 \`github_create_pr\` 创建 Pull Request

> **注意**: 使用 GitHub API 工具需要在环境变量中配置 GITHUB_TOKEN 或 GITHUB_PAT。`;

const MAX_TOOL_ITERATIONS = 8;

function sseEvent(sse: SSEWriter, data: Record<string, unknown>): void {
  sse.send(data);
}

function buildToolSummary(toolName: string, args: Record<string, unknown>, result: string): string {
  switch (toolName) {
    case 'read_file': {
      const filePath = args.path as string;
      const lineCount = result.split('\n').length;
      return `读取了 ${filePath}，共 ${lineCount} 行`;
    }
    case 'search_code': {
      const pattern = args.pattern as string;
      const matchCount = result === '未找到匹配结果' ? 0 : result.split('\n').filter(Boolean).length;
      return `搜索 "${pattern}"，找到 ${matchCount} 处匹配`;
    }
    case 'list_directory': {
      const dirPath = args.path as string;
      return `列出了目录 ${dirPath}`;
    }
    case 'git_status':
      return '获取了 git 状态';
    case 'write_file':
      return `已写入文件: ${args.path}`;
    case 'github_read_file':
      return `读取 GitHub 文件: ${args.owner}/${args.repo}/${args.path}`;
    case 'github_write_file':
      return `写入 GitHub 文件: ${args.owner}/${args.repo}/${args.path}`;
    case 'github_list_repo':
      return `浏览 GitHub 仓库: ${args.owner}/${args.repo}/${args.path || ''}`;
    case 'github_create_branch':
      return `创建 GitHub 分支: ${args.branch_name}`;
    case 'github_create_pr':
      return `创建 Pull Request: ${args.title}`;
    default:
      return `执行了工具 ${toolName}`;
  }
}

export async function streamSmartChat(
  messages: ChatMessage[],
  context: ProjectContext,
  model: string,
  res: Response,
): Promise<void> {
  const client = getOpenAIClient();
  if (!client) {
    res.status(500).json({ error: 'DEEPSEEK_API_KEY not configured' });
    return;
  }

  const projectRoot = context.projectRoot || '';

  // 初始化 SSE 写入器并启动心跳保活
  const sse = new SSEWriter(res);
  sse.startHeartbeat();

  // 按预算截断上下文，防止超出 token 限制
  const budgeted = buildContextWithBudget(context);

  const memory = projectRoot ? loadProjectMemory(projectRoot) : null;

  const systemContent = [
    SMART_CHAT_BASE_PROMPT,
    '\n\n---\n\n## 当前项目上下文\n',
    budgeted.fileTree ? `### 项目文件树\n\`\`\`\n${budgeted.fileTree}\n\`\`\`\n` : '',
    context.techStack?.length ? `### 技术栈\n${context.techStack.join(', ')}\n` : '',
    context.currentFile ? `### 当前打开的文件\n路径: \`${context.currentFile}\`\n` : '',
    budgeted.currentFileContent ? `### 当前文件内容\n\`\`\`\n${budgeted.currentFileContent}\n\`\`\`\n` : '',
    budgeted.relatedFiles?.length
      ? `### 用户提到的相关文件\n${budgeted.relatedFiles.map(f => `#### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``).join('\n\n')}\n`
      : '',
    memory ? `\n\n---\n## 项目 AI 记忆（必须遵守）\n\n${memory}` : '',
    '\n注意: 以上项目信息是实时的。你可以通过工具调用主动读取更多文件来深入排查问题。',
  ].filter(Boolean).join('');

  const loopMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemContent },
    ...messages.map(m => {
      if (m.role === 'user' && Array.isArray(m.content)) {
        const textOnly = (m.content as Array<{ type: string; text?: string }>)
          .filter(part => part.type === 'text')
          .map(part => ({ type: 'text' as const, text: part.text ?? '' }));
        return { role: 'user', content: textOnly } as OpenAI.Chat.ChatCompletionMessageParam;
      }
      return { role: m.role, content: m.content as string } as OpenAI.Chat.ChatCompletionMessageParam;
    }),
  ];

  sseEvent(sse, { type: 'thinking', message: '正在分析...' });

  try {
    // deepseek-reasoner (R1) does not support function calling — stream directly
    if (!supportsToolCalling(model)) {
      const directStream = await client.chat.completions.create({
        model,
        messages: loopMessages,
        stream: true,
        stream_options: { include_usage: true },
      });

      const sanitizer = new StreamSanitizer();
      for await (const chunk of directStream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          const clean = sanitizer.process(delta);
          if (clean) sseEvent(sse, { type: 'content', content: clean });
        }
        if (chunk.usage) {
          sseEvent(sse, { type: 'usage', usage: chunk.usage, model });
        }
      }
      const remaining = sanitizer.flush();
      if (remaining) sseEvent(sse, { type: 'content', content: remaining });

      sse.done();
      return;
    }

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      // Non-streaming call to detect tool calls
      const response = await client.chat.completions.create({
        model,
        messages: loopMessages,
        tools: SMART_CHAT_TOOLS,
        tool_choice: 'auto',
        stream: false,
      });

      const choice = response.choices[0];
      if (!choice) break;

      const { message, finish_reason } = choice;

      // No tool calls — switch to a streaming call for the final reply
      if (!message.tool_calls || message.tool_calls.length === 0 || finish_reason === 'stop') {
        const finalStream = await client.chat.completions.create({
          model,
          messages: loopMessages,
          tools: SMART_CHAT_TOOLS,
          tool_choice: 'none',
          stream: true,
          stream_options: { include_usage: true },
        });

        const sanitizer = new StreamSanitizer();
        for await (const chunk of finalStream) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            const clean = sanitizer.process(delta);
            if (clean) sseEvent(sse, { type: 'content', content: clean });
          }
          if (chunk.usage) {
            sseEvent(sse, { type: 'usage', usage: chunk.usage, model });
          }
        }
        const remaining = sanitizer.flush();
        if (remaining) sseEvent(sse, { type: 'content', content: remaining });

        sse.done();
        return;
      }

      // AI requested tool calls — execute them and append results
      loopMessages.push({
        role: 'assistant',
        content: message.content ?? null,
        reasoning_content: (message as any).reasoning_content ?? undefined,
        tool_calls: message.tool_calls,
      } as OpenAI.Chat.ChatCompletionMessageParam);

      for (const toolCall of message.tool_calls) {
        const toolName = toolCall.function.name;
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
        } catch {
          // Malformed JSON from the model; proceed with empty args rather than failing
          args = {};
        }

        sseEvent(sse, { type: 'tool_call', tool: toolName, toolCallId: toolCall.id, args });

        const result = await runTool(toolName, args, projectRoot);
        const truncated = truncateResult(result);
        const summary = buildToolSummary(toolName, args, result);

        sseEvent(sse, { type: 'tool_result', tool: toolName, toolCallId: toolCall.id, summary });

        loopMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: truncated,
        });
      }
    }

    // Max iterations reached — do a final streaming call without tools
    sseEvent(sse, { type: 'thinking', message: '正在整理结果...' });

    const finalStream = await client.chat.completions.create({
      model,
      messages: loopMessages,
      tool_choice: 'none',
      stream: true,
      stream_options: { include_usage: true },
    });

    const sanitizer = new StreamSanitizer();
    for await (const chunk of finalStream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        const clean = sanitizer.process(delta);
        if (clean) sseEvent(sse, { type: 'content', content: clean });
      }
      if (chunk.usage) {
        sseEvent(sse, { type: 'usage', usage: chunk.usage, model });
      }
    }
    const remaining = sanitizer.flush();
    if (remaining) sseEvent(sse, { type: 'content', content: remaining });

    sse.done();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    sse.error(msg);
  }
}
