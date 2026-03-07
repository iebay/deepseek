export default function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      <span className="w-1.5 h-1.5 bg-[var(--accent-primary)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-1.5 h-1.5 bg-[var(--accent-primary)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-1.5 h-1.5 bg-[var(--accent-primary)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  );
}
