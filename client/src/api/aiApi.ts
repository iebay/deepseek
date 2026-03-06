import type { ChatMessage, ProjectInfo } from '../types';

interface StreamAIChatOptions {
  messages: ChatMessage[];
  context: {
    fileTree?: string;
    techStack?: string[];
    currentFile?: string;
    currentFileContent?: string;
    relatedFiles?: { path: string; content: string }[];
  };
  model: string;
  onChunk: (text: string) => void;
  onDone: () => void;
  onError: (err: string) => void;
}

export function streamAIChat(options: StreamAIChatOptions): () => void {
  const { messages, context, model, onChunk, onDone, onError } = options;
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
