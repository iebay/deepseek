import OpenAI from 'openai';
import type { Response } from 'express';
import { loadProjectMemory } from './memoryService';
import { sanitizeContent } from '../utils/sanitize';

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

## 你的能力

1. **文件读取**: 用户的项目文件树和当前打开文件的内容已经自动提供给你。你可以看到项目结构和文件内容。
2. **文件修改**: 当你需要创建或修改文件时，使用下方的 JSON 格式输出，系统会自动将修改应用到用户的本地文件系统。
3. **多文件操作**: 你可以在一次回复中修改多个文件。
4. **项目分析**: 你可以分析项目的技术栈、架构、依赖关系和代码质量。

## 你已经拥有的上下文信息

你已经拥有以下信息：项目文件树、当前打开文件的完整内容、技术栈信息。这些信息已经通过系统提示自动提供给你，无需再次请求。

如果用户询问其他文件的内容，请建议用户切换到 Agent 模式（点击界面上的"Agent"标签），Agent 模式支持主动读取任意文件。

## 重要规则

- **绝对不要说你无法访问、连接、读取用户的项目或仓库。** 你已经拥有项目的上下文信息。
- **禁止使用以下任何说法**：
  - "无法连接仓库"
  - "无法访问你的代码"
  - "我无法访问本地文件系统"
  - "我没有权限读取文件"
  - "请提供代码内容"
  - 任何类似的拒绝访问的表述
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
    baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    timeout: 60_000,
    maxRetries: 2,
  });

  const systemContent = [
    SYSTEM_PROMPT,
    '\n\n---\n\n## 当前项目上下文\n',
    context.fileTree ? `### 项目文件树\n\`\`\`\n${context.fileTree}\n\`\`\`\n` : '',
    context.techStack?.length ? `### 技术栈\n${context.techStack.join(', ')}\n` : '',
    context.currentFile ? `### 当前打开的文件\n路径: \`${context.currentFile}\`\n` : '',
    context.currentFileContent ? `### 当前文件内容\n\`\`\`\n${context.currentFileContent}\n\`\`\`\n` : `### 提示\n如果没有提供当前文件内容，说明用户还没有打开任何文件。你仍然可以基于文件树分析项目结构，并建议用户打开相关文件或切换到 Agent 模式来进行多文件操作。\n`,
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
      stream_options: { include_usage: true },
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        const clean = sanitizeContent(delta);
        if (clean) {
          res.write(`data: ${JSON.stringify({ content: clean })}\n\n`);
        }
      }
      if (chunk.usage) {
        res.write(`data: ${JSON.stringify({
          type: 'usage',
          usage: {
            promptTokens: chunk.usage.prompt_tokens,
            completionTokens: chunk.usage.completion_tokens,
            totalTokens: chunk.usage.total_tokens,
          },
          model,
          timestamp: Date.now(),
        })}\n\n`);
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
