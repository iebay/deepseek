import type { ChatMessage } from '../types';

export interface AgentEvent {
  event: 'thinking' | 'tool_call' | 'tool_result' | 'content' | 'done' | 'error';
  iteration?: number;
  message?: string;
  tool?: string;
  args?: Record<string, unknown>;
  result?: string;
  content?: string;
  iterations?: number;
}

export interface StreamAgentRunOptions {
  messages: ChatMessage[];
  context: {
    fileTree?: string;
    techStack?: string[];
    currentFile?: string;
    currentFileContent?: string;
    projectRoot: string;
  };
  model: string;
  onEvent: (event: AgentEvent) => void;
  onContent: (text: string) => void;
  onDone: () => void;
  onError: (err: string) => void;
}

export function streamAgentRun(options: StreamAgentRunOptions): () => void {
  const { messages, context, model, onEvent, onContent, onDone, onError } = options;
  const controller = new AbortController();

  fetch('/api/agent/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, context, model }),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        onError(err.error || 'Agent 请求失败');
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
              const parsed = JSON.parse(data) as AgentEvent;
              if (parsed.event === 'content' && parsed.content) {
                onContent(parsed.content);
              }
              onEvent(parsed);
            } catch {
              if (import.meta.env.DEV) {
                console.warn('[agentApi] Malformed SSE line:', data);
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
