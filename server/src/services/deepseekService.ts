import OpenAI from 'openai';
import type { Response } from 'express';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ProjectContext {
  fileTree: string;
  techStack: string[];
  currentFile?: string;
  currentFileContent?: string;
}

const SYSTEM_PROMPT = `你是一个专业的全栈开发工程师，精通 TypeScript、React、Node.js 及现代 Web 开发技术栈。
你的任务是帮助用户分析和修改代码项目。
当你需要修改文件时，请使用以下 JSON 格式输出（以 \`\`\`json 开头）：
\`\`\`json
{
  "files": [
    {
      "path": "相对路径或绝对路径",
      "content": "完整文件内容"
    }
  ],
  "explanation": "修改说明"
}
\`\`\`
如果不需要修改文件，直接用中文回答问题即可。`;

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
    context.fileTree ? `\n当前项目文件树:\n${context.fileTree}` : '',
    context.techStack?.length ? `\n技术栈: ${context.techStack.join(', ')}` : '',
    context.currentFile ? `\n当前打开文件: ${context.currentFile}` : '',
    context.currentFileContent ? `\n当前文件内容:\n\`\`\`\n${context.currentFileContent}\n\`\`\`` : '',
  ].filter(Boolean).join('');

  const allMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemContent },
    ...messages.map(m => ({ role: m.role, content: m.content } as OpenAI.Chat.ChatCompletionMessageParam)),
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
