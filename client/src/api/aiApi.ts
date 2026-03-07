import type { ChatMessage, ProjectInfo } from '../types';

export interface UsageInfo {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface StreamAIChatOptions {
  messages: ChatMessage[];
  context: {
    fileTree?: string;
    techStack?: string[];
    currentFile?: string;
    currentFileContent?: string;
    relatedFiles?: { path: string; content: string }[];
    projectRoot?: string;
  };
  model: string;
  onChunk: (text: string) => void;
  onDone: () => void;
  onError: (err: string) => void;
  onUsage?: (usage: UsageInfo, model: string) => void;
}

export interface ToolCallEvent {
  tool: string;
  args: Record<string, unknown>;
}

export interface SmartChatCallbacks extends StreamAIChatOptions {
  onToolCall?: (event: ToolCallEvent) => void;
  onToolResult?: (tool: string, summary: string) => void;
  onThinking?: (message: string) => void;
}

export function streamAIChat(options: StreamAIChatOptions): () => void {
  const { messages, context, model, onChunk, onDone, onError, onUsage } = options;
  const controller = new AbortController();

  fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, context, model }),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        onError(err.error || 'AI 请求失败');
        return;
      }
      const reader = res.body?.getReader();
      if (!reader) {
        onError('无法读取响应流');
        return;
      }
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              onDone();
              return;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.error) {
                onError(parsed.error);
                return;
              }
              if (parsed.type === 'usage' && parsed.usage && onUsage) {
                onUsage(parsed.usage as UsageInfo, parsed.model as string);
              }
              if (parsed.content) {
                onChunk(parsed.content);
              }
            } catch {
              if (import.meta.env.DEV) {
                console.warn('[aiApi] Malformed SSE line:', data);
              }
            }
          }
        }
      }
      onDone();
    })
    .catch((err: Error) => {
      if (err.name !== 'AbortError') {
        onError(err.message || 'Network error');
      } else {
        onDone();
      }
    });

  return () => controller.abort();
}

export function streamSmartChat(options: SmartChatCallbacks): () => void {
  const { messages, context, model, onChunk, onDone, onError, onUsage, onToolCall, onToolResult, onThinking } = options;
  const controller = new AbortController();

  fetch('/api/ai/smart-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, context, model }),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        onError(err.error || 'AI 请求失败');
        return;
      }
      const reader = res.body?.getReader();
      if (!reader) {
        onError('无法读取响应流');
        return;
      }
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              onDone();
              return;
            }
            try {
              const parsed = JSON.parse(data) as Record<string, unknown>;
              if (parsed.error) {
                onError(parsed.error as string);
                return;
              }
              if (parsed.type === 'usage' && parsed.usage && onUsage) {
                onUsage(parsed.usage as UsageInfo, parsed.model as string);
              }
              if (parsed.type === 'content' && parsed.content) {
                onChunk(parsed.content as string);
              }
              if (parsed.type === 'tool_call' && onToolCall) {
                onToolCall({ tool: parsed.tool as string, args: parsed.args as Record<string, unknown> });
              }
              if (parsed.type === 'tool_result' && onToolResult) {
                onToolResult(parsed.tool as string, parsed.summary as string);
              }
              if (parsed.type === 'thinking' && onThinking) {
                onThinking(parsed.message as string);
              }
            } catch {
              if (import.meta.env.DEV) {
                console.warn('[aiApi] Malformed SSE line:', data);
              }
            }
          }
        }
      }
      onDone();
    })
    .catch((err: Error) => {
      if (err.name !== 'AbortError') {
        onError(err.message || 'Network error');
      } else {
        onDone();
      }
    });

  return () => controller.abort();
}

export async function analyzeProject(root: string): Promise<ProjectInfo> {
  const res = await fetch('/api/project/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ root }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || '分析项目失败');
  }
  return res.json();
}
