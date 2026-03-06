import OpenAI from 'openai';
import type { Response } from 'express';
import { loadProjectMemory } from './memoryService';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | Array<{
    type: 'text' | 'image_url';
    text?: string;
    image_url?: { url: string };
  }>;
}

export interface ProjectContext {
  fileTree: string;
  techStack: string[];
  currentFile?: string;
  currentFileContent?: string;
  relatedFiles?: { path: string; content: string }[];
  projectRoot?: string;
}

const SYSTEM_PROMPT = `你是一个专业的全栈开发工程师 AI 助手，精通所有主流编程语言和框架。

## 你的核心能力
1. **代码生成**：根据用户的自然语言描述生成完整、可运行的代码
2. **代码分析**：分析现有代码，找出 bug、性能问题和改进建议
3. **图片识别**：理解用户上传的设计图、截图、错误截图，并据此编写代码或提供帮助
4. **项目架构**：根据需求设计合理的项目结构和技术方案

## 交互规则
- 用户可能不会编程，请用简单易懂的语言解释
- 主动提供完整的解决方案，而不是片段
- 如果需要修改文件，必须使用下面的 JSON 格式输出完整文件内容
- 在解释中使用中文
- 如果用户上传了设计图，仔细分析图片中的 UI 元素、颜色、布局，然后生成对应的代码

## 文件修改格式
当需要创建或修改文件时，在你的回复中包含以下 JSON 代码块：

\`\`\`json
{
  "files": [
    {
      "path": "相对路径",
      "content": "完整文件内容（不要省略任何部分）"
    }
  ],
  "explanation": "修改说明（用简单的语言解释你做了什么）"
}
\`\`\`

## 重要提醒
- 永远输出**完整的文件内容**，不要用 "..." 或 "// 其余代码保持不变" 来省略
- 如果修改涉及多个文件，全部包含在 files 数组中
- 如果用户的需求不明确，主动询问细节
- 如果不需要修改文件，直接用中文回答即可
- 代码要有适当的注释，帮助用户理解`;

export async function streamChat(
  messages: ChatMessage[],
  context: ProjectContext,
  model: string,
  res: Response
): Promise<void> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'DEEPSEEK_API_KEY not configured' });
    return;
  }

  const client = new OpenAI({
    apiKey,
    baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
  });

  const systemContent = [
    SYSTEM_PROMPT,
    '\n\n---\n\n## 当前项目上下文\n',
    context.fileTree ? `### 项目文件树\n\`\`\`\n${context.fileTree}\n\`\`\`\n` : '',
    context.techStack?.length ? `### 技术栈\n${context.techStack.join(', ')}\n` : '',
    context.currentFile ? `### 当前打开的文件\n路径: \`${context.currentFile}\`\n` : '',
    context.currentFileContent ? `### 当前文件内容\n\`\`\`\n${context.currentFileContent}\n\`\`\`\n` : '',
    context.relatedFiles?.length
      ? `### 用户提到的相关文件\n${context.relatedFiles.map(f => `#### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``).join('\n\n')}\n`
      : '',
    context.projectRoot ? (() => {
      const memory = loadProjectMemory(context.projectRoot);
      return memory ? `\n\n---\n## 项目 AI 记忆（必须遵守）\n\n${memory}` : '';
    })() : '',
    '\n注意: 以上项目信息是实时的。你可以基于这些信息分析和修改用户的代码。',
  ].filter(Boolean).join('');

  const allMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemContent },
    ...messages.map(m => ({
      role: m.role,
      content: m.content,
    } as OpenAI.Chat.ChatCompletionMessageParam)),
  ];

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  try {
    const stream = await client.chat.completions.create({
      model,
      messages: allMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
    res.end();
  }
}
