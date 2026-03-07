import { useRef, useEffect } from 'react';
import { Clock, Plus, X } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import type { ChatSession } from '../../store/appStore';

function formatSessionTime(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 7) return `${days} 天前`;
  return new Date(ts).toLocaleDateString(navigator.language, { month: 'short', day: 'numeric' });
}

interface ChatHistoryProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChatHistory({ isOpen, onClose }: ChatHistoryProps) {
  const {
    chatSessions,
    activeChatSessionId,
    createChatSession,
    switchChatSession,
    deleteChatSession,
  } = useAppStore();

  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sortedSessions = [...chatSessions].sort((a, b) => b.updatedAt - a.updatedAt);

  function handleNewSession() {
    createChatSession();
    onClose();
  }

  function handleSwitch(session: ChatSession) {
    if (session.id !== activeChatSessionId) {
      switchChatSession(session.id);
    }
    onClose();
  }

  function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    deleteChatSession(id);
  }

  return (
    <div
      ref={panelRef}
      className="absolute top-full left-0 right-0 z-20 mt-0 bg-[var(--bg-secondary)] border border-[var(--border-primary)] border-t-0 shadow-xl max-h-72 overflow-y-auto"
    >
      {/* New session button */}
      <button
        onClick={handleNewSession}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--accent-primary)] hover:bg-[var(--bg-hover)] transition-colors border-b border-[var(--border-primary)]"
      >
        <Plus size={12} />
        新建对话
      </button>

      {/* Session list */}
      {sortedSessions.length === 0 ? (
        <div className="px-3 py-4 text-xs text-[var(--text-tertiary)] text-center">暂无对话记录</div>
      ) : (
        sortedSessions.map(session => {
          const isActive = session.id === activeChatSessionId;
          return (
            <div
              key={session.id}
              onClick={() => handleSwitch(session)}
              className={`group flex items-start justify-between px-3 py-2 cursor-pointer hover:bg-[var(--bg-hover)] transition-colors ${
                isActive ? 'bg-[#388bfd]/10 border-l-2 border-[#388bfd]' : 'border-l-2 border-transparent'
              }`}
            >
              <div className="flex-1 min-w-0 pr-2">
                <div className="text-xs text-[var(--text-primary)] truncate">{session.title}</div>
                <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
                  {formatSessionTime(session.updatedAt)} · {session.messages.length} 条消息
                </div>
              </div>
              <button
                onClick={(e) => handleDelete(e, session.id)}
                className="shrink-0 p-0.5 rounded text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 hover:text-[var(--error)] hover:bg-[var(--error)]/10 transition-all mt-0.5"
                title="删除此对话"
              >
                <X size={12} />
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}

export function ChatHistoryButton({ onClick, isOpen }: { onClick: () => void; isOpen: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`p-1.5 rounded-lg transition-colors ${
        isOpen
          ? 'text-[var(--accent-primary)] bg-[#388bfd]/10'
          : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
      }`}
      title="对话历史"
    >
      <Clock size={14} />
    </button>
  );
}
