import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export default function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="my-2 rounded-lg overflow-hidden border border-[var(--border-primary)] max-w-full">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--bg-tertiary)] border-b border-[var(--border-primary)]">
        <span className="text-[10px] text-[var(--text-secondary)] font-mono">{language || '代码'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          {copied ? <Check size={11} className="text-[var(--success)]" /> : <Copy size={11} />}
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <pre className="px-3 py-2.5 text-xs text-[var(--text-primary)] overflow-x-auto bg-[var(--bg-primary)] font-mono leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}
