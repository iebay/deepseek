import OpenAI from 'openai';
import type { Response } from 'express';
import { runTool } from '../agent/toolRunner';
import { loadProjectMemory } from './memoryService';
import type { ChatMessage, ProjectContext } from './deepseekService';

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
];

const SMART_CHAT_TOOL_PROMPT = `
## 智能排查能力

你现在可以通过工具调用主动探索项目代码：
- **read_file(path)** — 读取任意文件内容，深入理解代码
- **search_code(pattern)** — 搜索代码定位问题
- **list_directory(path)** — 浏览目录结构
- **git_status()** — 查看当前 git 状态

当用户的问题需要更多上下文时，主动使用这些工具去查看相关代码，而不是猜测或要求用户提供。`;

const SMART_CHAT_BASE_PROMPT = `你是 DeepSeek Code AI 助手——一个集成在代码编辑器中的全栈开发 AI。你拥有完整的项目上下文访问权限，可以直接读取用户的本地文件。

## 你的能力

1. **文件读取**: 用户的项目文件树和当前打开文件的内容已经自动提供给你。你可以看到项目结构和文件内容。
2. **文件修改**: 当你需要创建或修改文件时，使用下方的 JSON 格式输出，系统会自动将修改应用到用户的本地文件系统。
3. **多文件操作**: 你可以在一次回复中修改多个文件。
4. **项目分析**: 你可以分析项目的技术栈、架构、依赖关系和代码质量。

## 重要规则

- **你可以访问用户的项目文件。** 不要说"我无法访问本地文件系统"。项目文件树和文件内容已经通过上下文提供给你了。
- **当用户要求修改代码时，必须输出完整的文件内容**，不要输出片段或 diff。
- **始终在修改前解释你要做什么**，修改后说明做了什么改动。
- **主动发现问题**: 如果你发现代码中有 bug、安全隐患或性能问题，主动指出。
- **遵循项目现有的代码风格和规范**。
- **使用中文回答**。

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
\`\`\``;

const MAX_TOOL_ITERATIONS = 5;
const MAX_RESULT_LENGTH = 3000;

function truncateResult(str: string): string {
  if (str.length <= MAX_RESULT_LENGTH) return str;
  return str.slice(0, MAX_RESULT_LENGTH) + `\n...[已截断]`;
}

function sseEvent(res: Response, data: Record<string, unknown>): void {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
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
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'DEEPSEEK_API_KEY not configured' });
    return;
  }

  const projectRoot = context.projectRoot || '';

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const client = new OpenAI({
    apiKey,
    baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    timeout: 60_000,
    maxRetries: 2,
  });

  const memory = projectRoot ? loadProjectMemory(projectRoot) : null;

  const systemContent = [
    SMART_CHAT_BASE_PROMPT,
    SMART_CHAT_TOOL_PROMPT,
    '\n\n---\n\n## 当前项目上下文\n',
    context.fileTree ? `### 项目文件树\n\`\`\`\n${context.fileTree}\n\`\`\`\n` : '',
    context.techStack?.length ? `### 技术栈\n${context.techStack.join(', ')}\n` : '',
    context.currentFile ? `### 当前打开的文件\n路径: \`${context.currentFile}\`\n` : '',
    context.currentFileContent ? `### 当前文件内容\n\`\`\`\n${context.currentFileContent}\n\`\`\`\n` : '',
    context.relatedFiles?.length
      ? `### 用户提到的相关文件\n${context.relatedFiles.map(f => `#### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``).join('\n\n')}\n`
      : '',
    memory ? `\n\n---\n## 项目 AI 记忆（必须遵守）\n\n${memory}` : '',
    '\n注意: 以上项目信息是实时的。你可以通过工具调用主动读取更多文件来深入排查问题。',
  ].filter(Boolean).join('');

  const loopMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemContent },
    ...messages.map(m => {
      if (m.role === 'user' && Array.isArray(m.content)) {
        return { role: 'user', content: m.content } as OpenAI.Chat.ChatCompletionMessageParam;
      }
      return { role: m.role, content: m.content as string } as OpenAI.Chat.ChatCompletionMessageParam;
    }),
  ];

  sseEvent(res, { type: 'thinking', message: '正在分析...' });

  try {
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

        for await (const chunk of finalStream) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            sseEvent(res, { type: 'content', content: delta });
          }
          if (chunk.usage) {
            sseEvent(res, { type: 'usage', usage: chunk.usage, model });
          }
        }

        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }

      // AI requested tool calls — execute them and append results
      loopMessages.push({
        role: 'assistant',
        content: message.content ?? null,
        tool_calls: message.tool_calls,
      });

      for (const toolCall of message.tool_calls) {
        const toolName = toolCall.function.name;
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
        } catch {
          args = {};
        }

        sseEvent(res, { type: 'tool_call', tool: toolName, args });

        const result = await runTool(toolName, args, projectRoot);
        const truncated = truncateResult(result);
        const summary = buildToolSummary(toolName, args, result);

        sseEvent(res, { type: 'tool_result', tool: toolName, summary });

        loopMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: truncated,
        });
      }
    }

    // Max iterations reached — do a final streaming call without tools
    sseEvent(res, { type: 'thinking', message: '正在整理结果...' });

    const finalStream = await client.chat.completions.create({
      model,
      messages: loopMessages,
      stream: true,
      stream_options: { include_usage: true },
    });

    for await (const chunk of finalStream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        sseEvent(res, { type: 'content', content: delta });
      }
      if (chunk.usage) {
        sseEvent(res, { type: 'usage', usage: chunk.usage, model });
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    sseEvent(res, { error: msg });
    res.end();
  }
}
