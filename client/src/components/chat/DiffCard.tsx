import { useState } from 'react';
import { ChevronDown, ChevronRight, Check, FileCode, Download } from 'lucide-react';

interface FileChange {
  path: string;
  content: string;
}

function downloadFile(file: FileChange) {
  const fileName = file.path.replace(/\\/g, '/').split('/').pop() || 'file.txt';
  const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

interface DiffCardProps {
  files: FileChange[];
  appliedFiles: Set<string>;
  onApplyFile: (file: FileChange) => Promise<void>;
  onApplyAll: () => Promise<void>;
  allApplied: boolean;
}

function FileCard({
  file,
  applied,
  onApply,
}: {
  file: FileChange;
  applied: boolean;
  onApply: () => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [applying, setApplying] = useState(false);
  const fileName = file.path.split('/').pop() || file.path;

  async function handleApply() {
    setApplying(true);
    try {
      await onApply();
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="border border-[var(--border-primary)] rounded-xl overflow-hidden mb-2">
      {/* File header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-secondary)]">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
        >
          {expanded ? <ChevronDown size={13} className="text-[var(--text-secondary)] shrink-0" /> : <ChevronRight size={13} className="text-[var(--text-secondary)] shrink-0" />}
          <FileCode size={13} className="text-[var(--accent-primary)] shrink-0" />
          <span className="text-xs text-[var(--text-primary)] font-mono truncate">{fileName}</span>
          <span className="text-[10px] text-[var(--text-tertiary)] truncate ml-1 hidden sm:inline">{file.path}</span>
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] px-1.5 py-0.5 bg-[var(--accent-bg)] text-[var(--accent-hover)] rounded border border-[var(--accent-border)]">修改</span>
          <button
            onClick={() => downloadFile(file)}
            className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded transition-colors"
            title="下载文件"
          >
            <Download size={12} />
          </button>
          {applied ? (
            <span className="flex items-center gap-1 text-[10px] text-[var(--success)]">
              <Check size={11} />已应用
            </span>
          ) : (
            <button
              onClick={handleApply}
              disabled={applying}
              className="text-[10px] px-2 py-1 bg-[var(--success-solid)] hover:bg-[var(--success-solid-hover)] disabled:opacity-50 text-white rounded transition-colors"
            >
              {applying ? '应用中...' : '应用'}
            </button>
          )}
        </div>
      </div>

      {/* Code preview */}
      {expanded && (
        <div className="border-t border-[var(--border-primary)]">
          <pre className="px-3 py-2.5 text-xs text-[var(--text-primary)] overflow-x-auto bg-[var(--bg-primary)] font-mono leading-relaxed max-h-48">
            <code>{file.content}</code>
          </pre>
        </div>
      )}
    </div>
  );
}

export default function DiffCard({ files, appliedFiles, onApplyFile, onApplyAll, allApplied }: DiffCardProps) {
  const [applyingAll, setApplyingAll] = useState(false);

  async function handleApplyAll() {
    setApplyingAll(true);
    try {
      await onApplyAll();
    } finally {
      setApplyingAll(false);
    }
  }

  return (
    <div className="border border-[var(--border-primary)] rounded-xl overflow-hidden bg-[var(--bg-secondary)] my-2">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-primary)] bg-[var(--bg-tertiary)]">
        <span className="text-xs font-semibold text-[var(--text-secondary)]">
          代码修改 · {files.length} 个文件
        </span>
        {allApplied ? (
          <span className="flex items-center gap-1 text-xs text-[var(--success)]">
            <Check size={13} />全部已应用
          </span>
        ) : (
          <button
            onClick={handleApplyAll}
            disabled={applyingAll}
            className="text-xs px-2.5 py-1 bg-[var(--success-solid)] hover:bg-[var(--success-solid-hover)] disabled:opacity-50 text-white rounded-lg transition-colors font-medium"
          >
            {applyingAll ? '应用中...' : '全部应用'}
          </button>
        )}
      </div>

      {/* File list */}
      <div className="p-2">
        {files.map((file) => (
          <FileCard
            key={file.path}
            file={file}
            applied={appliedFiles.has(file.path)}
            onApply={() => onApplyFile(file)}
          />
        ))}
      </div>
    </div>
  );
}
