import { Check, ChevronDown, ChevronRight, Files } from 'lucide-react';
import { useState } from 'react';

interface FileEntry {
  path: string;
  content: string;
}

interface ConfirmCardProps {
  files: FileEntry[];
  appliedFiles: Set<string>;
  onApplyFile: (f: FileEntry) => Promise<void>;
  onApplyAll: () => Promise<void>;
  allApplied: boolean;
  explanation?: string;
}

export default function ConfirmCard({
  files,
  appliedFiles,
  onApplyFile,
  onApplyAll,
  allApplied,
  explanation,
}: ConfirmCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [applying, setApplying] = useState(false);

  async function handleApplyAll() {
    setApplying(true);
    try {
      await onApplyAll();
    } finally {
      setApplying(false);
    }
  }

  function getFileSize(content: string): string {
    const lines = content.split('\n').length;
    return `${lines} 行`;
  }

  return (
    <div className="my-2 rounded-xl border-l-4 border-[var(--accent-primary)] border border-[var(--border-primary)] bg-[var(--bg-secondary)] overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-[var(--bg-hover)] transition-colors text-left"
      >
        <Files size={14} className="text-[var(--accent-primary)] shrink-0" />
        <span className="flex-1 text-xs font-semibold text-[var(--text-primary)]">
          AI 建议修改以下 {files.length} 个文件
        </span>
        {allApplied && (
          <span className="text-[10px] text-[var(--success)] bg-[var(--success)]/10 px-1.5 py-0.5 rounded-full">已全部应用</span>
        )}
        {expanded ? (
          <ChevronDown size={12} className="text-[var(--text-tertiary)] shrink-0" />
        ) : (
          <ChevronRight size={12} className="text-[var(--text-tertiary)] shrink-0" />
        )}
      </button>

      {expanded && (
        <>
          {/* File list */}
          <div className="border-t border-[var(--border-primary)] divide-y divide-[var(--border-primary)]/50">
            {files.map((file, i) => {
              const isApplied = appliedFiles.has(file.path);
              const fileName = file.path.split('/').pop() ?? file.path;
              return (
                <div key={i} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                  <span className="font-mono text-[var(--text-secondary)] truncate flex-1" title={file.path}>
                    {fileName}
                    <span className="ml-1.5 text-[var(--text-tertiary)] font-sans">{getFileSize(file.content)}</span>
                  </span>
                  <span className="text-[10px] text-[var(--text-tertiary)] truncate hidden sm:block max-w-[120px]">
                    {file.path}
                  </span>
                  {isApplied ? (
                    <span className="shrink-0 flex items-center gap-0.5 text-[var(--success)] text-[10px]">
                      <Check size={11} /> 已应用
                    </span>
                  ) : (
                    <button
                      onClick={() => onApplyFile(file)}
                      className="shrink-0 text-[10px] text-[var(--accent-primary)] hover:underline"
                    >
                      应用
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Explanation */}
          {explanation && (
            <div className="px-3 py-2 text-[11px] text-[var(--text-secondary)] border-t border-[var(--border-primary)]/50">
              {explanation}
            </div>
          )}

          {/* Footer actions */}
          {!allApplied && (
            <div className="flex gap-2 px-3 py-2 border-t border-[var(--border-primary)]">
              <button
                onClick={handleApplyAll}
                disabled={applying}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white text-xs font-medium transition-colors"
              >
                <Check size={12} />
                {applying ? '应用中...' : '✓ 全部应用'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
