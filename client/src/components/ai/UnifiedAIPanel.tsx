import { MessageSquare, Bot } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import ChatPanel from '../chat/ChatPanel';
import AgentPanel from '../agent/AgentPanel';

export default function UnifiedAIPanel() {
  const { aiMode, setAiMode } = useAppStore();

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      {/* Mode tabs */}
      <div className="flex shrink-0 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]">
        <button
          onClick={() => setAiMode('chat')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
            aiMode === 'chat'
              ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
              : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <MessageSquare size={13} />
          💬 Chat
        </button>
        <button
          onClick={() => setAiMode('agent')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
            aiMode === 'agent'
              ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
              : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Bot size={13} />
          🤖 Agent
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden min-h-0">
        {aiMode === 'chat' ? <ChatPanel /> : <AgentPanel />}
      </div>
    </div>
  );
}
