import ChatPanel from '../chat/ChatPanel';

export default function UnifiedAIPanel() {
  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      <ChatPanel />
    </div>
  );
}
