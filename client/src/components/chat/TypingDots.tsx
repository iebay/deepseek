export default function TypingDots() {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <div className="typing-skeleton h-2.5 w-20 rounded-full" />
      <div className="typing-cursor h-3.5 w-px rounded-full bg-[var(--accent-primary)]" />
    </div>
  );
}

