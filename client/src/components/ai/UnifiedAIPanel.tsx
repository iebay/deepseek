import { MessageSquare, Bot } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import ChatPanel from '../chat/ChatPanel';
import AgentPanel from '../agent/AgentPanel';

export default function UnifiedAIPanel() {
  const { aiMode, setAiMode } = useAppStore();

  return (
    <div className="flex flex-col h-full bg-[#0d1117]">
      {/* Mode tabs */}
      <div className="flex shrink-0 border-b border-[#30363d] bg-[#161b22]">
        <button
          onClick={() => setAiMode('chat')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
            aiMode === 'chat'
              ? 'border-[#388bfd] text-[#388bfd]'
              : 'border-transparent text-[#8b949e] hover:text-[#e6edf3]'
          }`}
        >
          <MessageSquare size={13} />
          💬 Chat
        </button>
        <button
          onClick={() => setAiMode('agent')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
            aiMode === 'agent'
              ? 'border-[#388bfd] text-[#388bfd]'
              : 'border-transparent text-[#8b949e] hover:text-[#e6edf3]'
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
