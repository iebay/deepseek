import OpenAI from 'openai';
import type { Response } from 'express';
import { AGENT_TOOLS } from './tools';
import { AGENT_SYSTEM_PROMPT } from './prompts';
import { runTool } from './toolRunner';
import type { ChatMessage, ProjectContext } from '../services/deepseekService';
import { supportsToolCalling } from '../constants/models';
import { sanitizeContent, StreamSanitizer } from '../utils/sanitize';
import { SSEWriter } from '../utils/sse';
import { buildContextWithBudget, truncateResult } from '../utils/contextBudget';
import { getOpenAIClient } from '../services/openaiClient';

const MAX_ITERATIONS = 15;

function sseWrite(sse: SSEWriter, event: string, data: Record<string, unknown>): void {
  sse.send({ event, ...data });
}

export async function runAgent(
  userMessages: ChatMessage[],
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

  const systemContent = [
    AGENT_SYSTEM_PROMPT,
    '\n\n---\n\n## 当前项目上下文\n',
    budgeted.fileTree ? `### 项目文件树\n\`\`\`\n${budgeted.fileTree}\n\`\`\`\n` : '',
    context.techStack?.length ? `### 技术栈\n${context.techStack.join(', ')}\n` : '',
    context.currentFile ? `### 当前打开的文件\n路径: \`${context.currentFile}\`\n` : '',
    budgeted.currentFileContent ? `### 当前文件内容\n\`\`\`\n${budgeted.currentFileContent}\n\`\`\`\n` : '',
    projectRoot ? `### 项目根目录\n${projectRoot}\n` : '',
  ].filter(Boolean).join('');

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemContent },
    ...userMessages.map(m => {
      if (m.role === 'user' && Array.isArray(m.content)) {
        const textOnly = (m.content as Array<{ type: string; text?: string }>)
          .filter(part => part.type === 'text')
          .map(part => ({ type: 'text' as const, text: part.text ?? '' }));
        return { role: 'user', content: textOnly } as OpenAI.Chat.ChatCompletionMessageParam;
      }
      return { role: m.role, content: m.content as string } as OpenAI.Chat.ChatCompletionMessageParam;
    }),
  ];

  let iterations = 0;
  let taskComplete = false;

  try {
    // deepseek-reasoner (R1) does not support function calling — stream directly
    if (!supportsToolCalling(model)) {
      const directStream = await client.chat.completions.create({
        model,
        messages,
        stream: true,
        stream_options: { include_usage: true },
      });

      const sanitizer = new StreamSanitizer();
      for await (const chunk of directStream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          const clean = sanitizer.process(delta);
          if (clean) sseWrite(sse, 'content', { content: clean });
        }
        if (chunk.usage) {
          sseWrite(sse, 'usage', { usage: chunk.usage, model });
        }
      }
      const remaining = sanitizer.flush();
      if (remaining) sseWrite(sse, 'content', { content: remaining });

      sseWrite(sse, 'done', { iterations: 0 });
      sse.done();
      return;
    }

    while (iterations < MAX_ITERATIONS && !taskComplete) {
      iterations++;

      sseWrite(sse, 'thinking', { iteration: iterations, message: `第 ${iterations} 步：思考中...` });

      const response = await client.chat.completions.create({
        model,
        messages,
        tools: AGENT_TOOLS,
        tool_choice: 'auto',
        stream: false,
      });

      const choice = response.choices[0];
      if (!choice) {
        sseWrite(sse, 'error', { message: 'AI 未返回任何响应' });
        break;
      }

      const assistantMessage = choice.message;

      if (assistantMessage.content) {
        const clean = sanitizeContent(assistantMessage.content);
        if (clean) sseWrite(sse, 'content', { content: clean });
      }

      if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
        break;
      }

      messages.push({
        role: 'assistant',
        content: assistantMessage.content,
        reasoning_content: (assistantMessage as any).reasoning_content ?? undefined,
        tool_calls: assistantMessage.tool_calls,
      } as OpenAI.Chat.ChatCompletionMessageParam);

      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        let toolArgs: Record<string, unknown> = {};
        try {
          toolArgs = JSON.parse(toolCall.function.arguments || '{}');
        } catch {
          toolArgs = {};
        }

        sseWrite(sse, 'tool_call', { tool: toolName, args: toolArgs });

        const result = await runTool(toolName, toolArgs, projectRoot);
        const truncated = truncateResult(result);

        sseWrite(sse, 'tool_result', { tool: toolName, result: truncated });

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: truncated,
        });

        if (toolName === 'task_complete') {
          taskComplete = true;
        }
      }

      if (taskComplete) break;

      if (choice.finish_reason === 'stop') break;
    }

    sseWrite(sse, 'done', { iterations });
    sse.done();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    sseWrite(sse, 'error', { message: msg });
    sse.done();
  }
}
