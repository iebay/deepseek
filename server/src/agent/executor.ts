import OpenAI from 'openai';
import type { Response } from 'express';
import { AGENT_TOOLS } from './tools';
import { AGENT_SYSTEM_PROMPT } from './prompts';
import { runTool } from './toolRunner';
import type { ChatMessage, ProjectContext } from '../services/deepseekService';
import { supportsToolCalling } from '../constants/models';
import { sanitizeContent } from '../utils/sanitize';

const MAX_ITERATIONS = 15;
const MAX_RESULT_LENGTH = 3000;

function truncateResult(str: string): string {
  if (str.length <= MAX_RESULT_LENGTH) return str;
  return str.slice(0, MAX_RESULT_LENGTH) + `\n...[已截断]`;
}

function sseWrite(res: Response, event: string, data: Record<string, unknown>): void {
  res.write(`data: ${JSON.stringify({ event, ...data })}\n\n`);
}

export async function runAgent(
  userMessages: ChatMessage[],
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

  const systemContent = [
    AGENT_SYSTEM_PROMPT,
    '\n\n---\n\n## 当前项目上下文\n',
    context.fileTree ? `### 项目文件树\n\`\`\`\n${context.fileTree}\n\`\`\`\n` : '',
    context.techStack?.length ? `### 技术栈\n${context.techStack.join(', ')}\n` : '',
    context.currentFile ? `### 当前打开的文件\n路径: \`${context.currentFile}\`\n` : '',
    context.currentFileContent ? `### 当前文件内容\n\`\`\`\n${context.currentFileContent}\n\`\`\`\n` : '',
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

      for await (const chunk of directStream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          const clean = sanitizeContent(delta);
          if (clean) sseWrite(res, 'content', { content: clean });
        }
        if (chunk.usage) {
          sseWrite(res, 'usage', { usage: chunk.usage, model });
        }
      }

      sseWrite(res, 'done', { iterations: 0 });
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    while (iterations < MAX_ITERATIONS && !taskComplete) {
      iterations++;

      sseWrite(res, 'thinking', { iteration: iterations, message: `第 ${iterations} 步：思考中...` });

      const response = await client.chat.completions.create({
        model,
        messages,
        tools: AGENT_TOOLS,
        tool_choice: 'auto',
        stream: false,
      });

      const choice = response.choices[0];
      if (!choice) {
        sseWrite(res, 'error', { message: 'AI 未返回任何响应' });
        break;
      }

      const assistantMessage = choice.message;

      if (assistantMessage.content) {
        const clean = sanitizeContent(assistantMessage.content);
        if (clean) sseWrite(res, 'content', { content: clean });
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

        sseWrite(res, 'tool_call', { tool: toolName, args: toolArgs });

        const result = await runTool(toolName, toolArgs, projectRoot);
        const truncated = truncateResult(result);

        sseWrite(res, 'tool_result', { tool: toolName, result: truncated });

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

    sseWrite(res, 'done', { iterations });
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    sseWrite(res, 'error', { message: msg });
    res.write('data: [DONE]\n\n');
    res.end();
  }
}
