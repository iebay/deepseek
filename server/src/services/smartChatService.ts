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
import { getToolsForScope } from '../agent/toolDefinitions';
import { SHARED_CAPABILITIES, SHARED_RULES, FILE_MODIFICATION_FORMAT } from '../agent/sharedPrompts';

const SMART_CHAT_TOOLS = getToolsForScope('smart-chat');

const SMART_CHAT_BASE_PROMPT = `你是 DeepSeek Code AI 助手——一个集成在代码编辑器中的全栈开发 AI。你拥有完整的项目上下文访问权限，可以直接读取用户的本地文件。

${SHARED_CAPABILITIES}

${SHARED_RULES}

${FILE_MODIFICATION_FORMAT}

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
