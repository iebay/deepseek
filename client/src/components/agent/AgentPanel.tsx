import { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, Send, Square, ChevronDown, ChevronRight, CheckCircle2, XCircle, Wrench, Brain, FileText } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { streamAgentRun, type AgentEvent } from '../../api/agentApi';

interface EventEntry {
  id: number;
  type: AgentEvent['event'];
  iteration?: number;
  message?: string;
  tool?: string;
  args?: Record<string, unknown>;
  result?: string;
  content?: string;
  iterations?: number;
  collapsed?: boolean;
}

function EventCard({ entry, onToggle }: { entry: EventEntry; onToggle: () => void }) {
  const bgMap: Record<string, string> = {
    thinking: 'bg-[#1c2a3f] border-[#2d4263]',
    tool_call: 'bg-[#1e1333] border-[#3d2070]',
    tool_result: 'bg-[var(--bg-secondary)] border-[var(--border-primary)]',
    content: 'bg-[var(--bg-primary)] border-[var(--border-primary)]',
    done: 'bg-[#0d2616] border-[#1a5c2e]',
    error: 'bg-[#2d0d0d] border-[#6e1212]',
  };
  const iconMap: Record<string, JSX.Element> = {
    thinking: <Brain size={13} className="text-[var(--accent-hover)] shrink-0" />,
    tool_call: <Wrench size={13} className="text-[var(--purple)] shrink-0" />,
    tool_result: <FileText size={13} className="text-[var(--text-secondary)] shrink-0" />,
    content: <Bot size={13} className="text-[var(--accent-primary)] shrink-0" />,
    done: <CheckCircle2 size={13} className="text-[var(--success)] shrink-0" />,
    error: <XCircle size={13} className="text-[var(--error)] shrink-0" />,
  };

  const bg = bgMap[entry.type] || 'bg-[var(--bg-secondary)] border-[var(--border-primary)]';
  const icon = iconMap[entry.type];
  const isCollapsible = entry.type === 'tool_result' && entry.result;

  function renderContent() {
    switch (entry.type) {
      case 'thinking':
        return <span className="text-[var(--text-secondary)]">{entry.message}</span>;
      case 'tool_call':
        return (
          <div>
            <span className="text-[var(--purple)] font-mono text-xs">{entry.tool}</span>
            {entry.args && Object.keys(entry.args).length > 0 && (
              <pre className="mt-1 text-[10px] text-[var(--text-secondary)] overflow-auto max-h-20 whitespace-pre-wrap break-all">
                {JSON.stringify(entry.args, null, 2)}
              </pre>
            )}
          </div>
        );
      case 'tool_result':
        if (entry.collapsed) {
          return <span className="text-[var(--text-secondary)] text-xs italic">（点击展开结果）</span>;
        }
        return (
          <pre className="text-[10px] text-[#c9d1d9] overflow-auto max-h-48 whitespace-pre-wrap break-all">
            {entry.result}
          </pre>
        );
      case 'content':
        return <p className="text-[var(--text-primary)] whitespace-pre-wrap break-words text-xs">{entry.content}</p>;
      case 'done':
        return <span className="text-[var(--success)]">任务完成（共 {entry.iterations} 步）</span>;
      case 'error':
        return <span className="text-[var(--error)]">{entry.message}</span>;
      default:
        return null;
    }
  }

  return (
    <div className={`rounded-lg border p-2.5 text-xs ${bg} ${isCollapsible ? 'cursor-pointer' : ''}`}
      onClick={isCollapsible ? onToggle : undefined}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[var(--text-secondary)] font-medium">
          {entry.type === 'thinking' && `步骤 ${entry.iteration}`}
          {entry.type === 'tool_call' && '调用工具'}
          {entry.type === 'tool_result' && '工具结果'}
          {entry.type === 'content' && 'AI 回复'}
          {entry.type === 'done' && '完成'}
          {entry.type === 'error' && '错误'}
        </span>
        {isCollapsible && (
          <span className="ml-auto text-[var(--text-secondary)]">
            {entry.collapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
          </span>
        )}
      </div>
      {renderContent()}
    </div>
  );
}

export default function AgentPanel() {
  const { currentProject, selectedModel } = useAppStore();
  const [input, setInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [events, setEvents] = useState<EventEntry[]>([]);
  const abortRef = useRef<(() => void) | null>(null);
  const eventIdRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [events, scrollToBottom]);

  function addEvent(partial: Omit<EventEntry, 'id'>) {
    setEvents(prev => [...prev, { id: eventIdRef.current++, ...partial }]);
  }

  function toggleCollapse(id: number) {
    setEvents(prev =>
      prev.map(e => e.id === id ? { ...e, collapsed: !e.collapsed } : e)
    );
  }

  function handleStop() {
    if (abortRef.current) {
      abortRef.current();
      abortRef.current = null;
    }
    setIsRunning(false);
  }

  function handleSubmit() {
    const trimmed = input.trim();
    if (!trimmed || isRunning) return;
    if (!currentProject) {
      addEvent({ type: 'error', message: '请先打开一个项目' });
      return;
    }

    setEvents([]);
    setInput('');
    setIsRunning(true);

    const abort = streamAgentRun({
      messages: [{ role: 'user', content: trimmed }],
      context: {
        projectRoot: currentProject.path,
        techStack: currentProject.techStack,
      },
      model: selectedModel,
      onEvent: (event) => {
        if (event.event === 'thinking') {
          addEvent({ type: 'thinking', iteration: event.iteration, message: event.message });
        } else if (event.event === 'tool_call') {
          addEvent({ type: 'tool_call', tool: event.tool, args: event.args });
        } else if (event.event === 'tool_result') {
          addEvent({ type: 'tool_result', tool: event.tool, result: event.result, collapsed: true });
        } else if (event.event === 'content') {
          addEvent({ type: 'content', content: event.content });
        } else if (event.event === 'done') {
          addEvent({ type: 'done', iterations: event.iterations });
          setIsRunning(false);
          abortRef.current = null;
        } else if (event.event === 'error') {
          addEvent({ type: 'error', message: event.message });
          setIsRunning(false);
          abortRef.current = null;
        }
      },
      onContent: () => {},
      onDone: () => {
        setIsRunning(false);
        abortRef.current = null;
      },
      onError: (err) => {
        addEvent({ type: 'error', message: err });
        setIsRunning(false);
        abortRef.current = null;
      },
    });

    abortRef.current = abort;
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--border-primary)] shrink-0">
        <Bot size={15} className="text-[var(--accent-primary)]" />
        <span className="text-sm font-semibold text-[var(--text-primary)]">Agent 模式</span>
        <span className="ml-auto text-[10px] text-[var(--text-secondary)] bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded-full">
          {selectedModel}
        </span>
      </div>

      {/* Event stream */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
        {events.length === 0 && !isRunning && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 text-[var(--text-secondary)]">
            <Bot size={32} className="text-[var(--accent-primary)]/40" />
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]/70">AI 代码代理</p>
              <p className="text-xs mt-1">描述你的任务，Agent 将自主探索代码并执行修改</p>
            </div>
          </div>
        )}
        {events.map(entry => (
          <EventCard key={entry.id} entry={entry} onToggle={() => toggleCollapse(entry.id)} />
        ))}
        {isRunning && (
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] px-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#388bfd] animate-pulse" />
            Agent 正在执行...
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-[var(--border-primary)] p-2 shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={currentProject ? '描述任务，Agent 将自动执行...' : '请先打开项目'}
            disabled={isRunning || !currentProject}
            rows={2}
            className="flex-1 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-primary)] resize-none disabled:opacity-50 transition-colors"
          />
          {isRunning ? (
            <button
              onClick={handleStop}
              className="p-2 rounded-lg bg-[var(--error-bg)] hover:bg-[#f85149]/20 text-[var(--error)] transition-colors shrink-0"
              title="停止"
            >
              <Square size={15} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || !currentProject}
              className="p-2 rounded-lg bg-[var(--accent-bg)] hover:bg-[var(--accent-bg-medium)] text-[var(--accent-primary)] disabled:opacity-50 transition-colors shrink-0"
              title="发送 (Enter)"
            >
              <Send size={15} />
            </button>
          )}
        </div>
        <p className="text-[10px] text-[var(--text-muted)] mt-1 px-1">Enter 发送 · Shift+Enter 换行</p>
      </div>
    </div>
  );
}
