import OpenAI from 'openai';
import type { Response } from 'express';
import { loadProjectMemory } from './memoryService';
import { StreamSanitizer } from '../utils/sanitize';
import { SSEWriter } from '../utils/sse';
import { buildContextWithBudget } from '../utils/contextBudget';
import { getOpenAIClient } from './openaiClient';
import { SHARED_CAPABILITIES, SHARED_RULES, FILE_MODIFICATION_FORMAT } from '../agent/sharedPrompts';

export interface MultimodalContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | MultimodalContentPart[];
}

export interface ProjectContext {
  fileTree: string;
  techStack: string[];
  currentFile?: string;
  currentFileContent?: string;
  relatedFiles?: { path: string; content: string }[];
  projectRoot?: string;
}

const SYSTEM_PROMPT = `你是 DeepSeek Code AI 助手——一个集成在代码编辑器中的全栈开发 AI。你拥有完整的项目上下文访问权限，可以直接读取和修改用户的本地文件。

${SHARED_CAPABILITIES}

## 你已经拥有的上下文信息

你已经拥有以下信息：项目文件树、当前打开文件的完整内容、技术栈信息。这些信息已经通过系统提示自动提供给你，无需再次请求。

如果用户询问其他文件的内容，请建议用户切换到 Agent 模式（点击界面上的"Agent"标签），Agent 模式支持主动读取任意文件。

${SHARED_RULES}

${FILE_MODIFICATION_FORMAT}

## 代码质量标准

- 使用 TypeScript 严格类型
- React 使用函数组件 + Hooks
- 遵循 DRY、SOLID 原则
- 有意义的变量和函数命名
- 适当添加注释
- 错误处理要完善

## 回复风格

根据用户意图自适应调整输出格式，不要套用固定模板：

- **问候 / 闲聊**：用自然语言直接友好回应，无需任何结构化格式。
- **概念解释 / 技术问答**：直接给出清晰解释，可用 Markdown（标题、列表、代码片段），无需固定章节。
- **代码审查 / 调试**：先给出修复代码或关键结论，再用 1-2 句话解释原因。
- **功能实现 / 代码修改**：按 JSON 格式（见上方"文件修改格式"）输出文件内容，可在 JSON 块前后加 1-2 句简短说明，禁止使用 ## 分析 / ## 方案 / ## 总结 等固定章节标题。
- **复杂多步骤任务**：用编号列表说明步骤计划，再附上 JSON 文件修改块。

**核心原则**：简单问题给直接答案；代码请求以代码为主；只有真正复杂的任务才使用结构化格式。永远不要为了"显得完整"而过度结构化回复。`;

export async function streamChat(
  messages: ChatMessage[],
  context: ProjectContext,
  model: string,
  res: Response
): Promise<void> {
  const client = getOpenAIClient();
  if (!client) {
    res.status(500).json({ error: 'DEEPSEEK_API_KEY not configured' });
    return;
  }

  // 按预算截断上下文，防止超出 token 限制
  const budgeted = buildContextWithBudget(context);

  const systemContent = [
    SYSTEM_PROMPT,
    '\n\n---\n\n## 当前项目上下文\n',
    budgeted.fileTree ? `### 项目文件树\n\`
    + `\n${budgeted.fileTree}\n\`
    + `\n` : '',
    context.techStack?.length ? `### 技术栈\n${context.techStack.join(', ')}\n` : '',
    context.currentFile ? `### 当前打开的文件\n路径: \`${context.currentFile}\`\n` : '',
    budgeted.currentFileContent ? `### 当前文件内容\n\`
    + `\n${budgeted.currentFileContent}\n\`
    + `\n` : `### 提示\n如果没有提供当前文件内容，说明用户还没有打开任何文件。你仍然可以基于文件树分析项目结构，并建议用户打开相关文件或切换到 Agent 模式来进行多文件操作。\n`,
    budgeted.relatedFiles?.length
      ? `### 用户提到的相关文件\n${budgeted.relatedFiles.map(f => `#### ${f.path}\n\`
      + `\n${f.content}\n\`
      + `\n`).join('\n\n')}\n`
      : '',
    context.projectRoot ? (() => {
      const memory = loadProjectMemory(context.projectRoot);
      return memory ? `\n\n---\n## 项目 AI 记忆（仅供参考）\n\n注意：以下记忆内容仅作为背景参考。如果用户当前的问题与记忆内容无关，请忽略记忆内容，只聚焦于用户当前的问题。\n\n${memory}` : '';
    })() : '',
    '\n注意: 以上项目信息是实时的。你可以基于这些信息分析和修改用户的代码。',
  ].filter(Boolean).join('');

  const allMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
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

  // 初始化 SSE 写入器并启动心跳保活
  const sse = new SSEWriter(res);
  sse.startHeartbeat();

  try {
    const stream = await client.chat.completions.create({
      model,
      messages: allMessages,
      stream: true,
      stream_options: { include_usage: true },
    });

    const sanitizer = new StreamSanitizer();
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        const clean = sanitizer.process(delta);
        if (clean) {
          sse.send({ content: clean });
        }
      }
      if (chunk.usage) {
        sse.send({
          type: 'usage',
          usage: {
            promptTokens: chunk.usage.prompt_tokens,
            completionTokens: chunk.usage.completion_tokens,
            totalTokens: chunk.usage.total_tokens,
          },
          model,
          timestamp: Date.now(),
        });
      }
    }
    const remaining = sanitizer.flush();
    if (remaining) sse.send({ content: remaining });

    sse.done();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    sse.error(msg);
  }
}