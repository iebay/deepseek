import { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';

export interface ToolAction {
  toolCallId: string;
  tool: string;
  args: Record<string, unknown>;
  summary: string;
}

interface ToolTraceProps {
  actions: ToolAction[];
  isLoading?: boolean;
}

function toolIcon(tool: string): string {
  switch (tool) {
    case 'read_file': return '📖';
    case 'search_code': return '🔍';
    case 'list_directory': return '📂';
    case 'git_status': return '🌿';
    default: return '🔧';
  }
}

export default function ToolTrace({ actions, isLoading }: ToolTraceProps) {
  const [expanded, setExpanded] = useState(false);

  if (actions.length === 0 && !isLoading) return null;

  const label = isLoading && actions.length === 0
    ? '正在分析...'
    : `AI 排查了 ${actions.length} 个步骤`;

  return (
    <div className="mb-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] text-xs overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-[var(--bg-hover)] transition-colors text-left"
      >
        <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
          <span className="text-[11px]">🧠</span>
          <span>{label}</span>
          {isLoading && actions.length > 0 && (
            <span className="flex gap-0.5 ml-1">
              <span className="w-1 h-1 bg-[var(--accent-primary)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1 h-1 bg-[var(--accent-primary)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1 h-1 bg-[var(--accent-primary)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
          )}
        </div>
        {actions.length > 0 && (
          expanded
            ? <ChevronDown size={12} className="text-[var(--text-tertiary)] shrink-0" />
            : <ChevronRight size={12} className="text-[var(--text-tertiary)] shrink-0" />
        )}
      </button>

      {expanded && actions.length > 0 && (
        <div className="border-t border-[var(--border-primary)] px-2.5 py-1.5 space-y-1">
          {actions.map((action, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[var(--text-secondary)]">
              <span className="shrink-0 mt-0.5">{toolIcon(action.tool)}</span>
              <span className="break-all">{action.summary}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
