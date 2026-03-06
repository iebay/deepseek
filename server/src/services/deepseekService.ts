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
  relatedFiles?: { path: string; content: string }[];
}

const SYSTEM_PROMPT = `你是 DeepSeek Code AI 助手——一个集成在代码编辑器中的全栈开发 AI。你拥有完整的项目上下文访问权限，可以直接读取和修改用户的本地文件。

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
\`\`\`

## 代码质量标准

- 使用 TypeScript 严格类型
- React 使用函数组件 + Hooks
- 遵循 DRY、SOLID 原则
- 有意义的变量和函数命名
- 适当添加注释
- 错误处理要完善

## 回复格式

1. **分析问题** — 先说明你理解了什么
2. **解决方案** — 解释你的修改思路
3. **代码修改** — 输出 JSON 格式的文件修改
4. **总结** — 说明修改后的效果和需要注意的事项`;

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
    '\n注意: 以上项目信息是实时的。你可以基于这些信息分析和修改用户的代码。',
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
