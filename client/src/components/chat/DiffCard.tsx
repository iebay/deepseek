import { useState } from 'react';
import { ChevronDown, ChevronRight, Check, FileCode } from 'lucide-react';

interface FileChange {
  path: string;
  content: string;
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
    <div className="border border-[#30363d] rounded-xl overflow-hidden mb-2">
      {/* File header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#161b22]">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
        >
          {expanded ? <ChevronDown size={13} className="text-[#8b949e] shrink-0" /> : <ChevronRight size={13} className="text-[#8b949e] shrink-0" />}
          <FileCode size={13} className="text-[#388bfd] shrink-0" />
          <span className="text-xs text-[#e6edf3] font-mono truncate">{fileName}</span>
          <span className="text-[10px] text-[#6e7681] truncate ml-1 hidden sm:inline">{file.path}</span>
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] px-1.5 py-0.5 bg-[#388bfd]/10 text-[#58a6ff] rounded border border-[#388bfd]/20">修改</span>
          {applied ? (
            <span className="flex items-center gap-1 text-[10px] text-[#3fb950]">
              <Check size={11} />已应用
            </span>
          ) : (
            <button
              onClick={handleApply}
              disabled={applying}
              className="text-[10px] px-2 py-1 bg-[#238636] hover:bg-[#2ea043] disabled:opacity-50 text-white rounded transition-colors"
            >
              {applying ? '应用中...' : '应用'}
            </button>
          )}
        </div>
      </div>

      {/* Code preview */}
      {expanded && (
        <div className="border-t border-[#30363d]">
          <pre className="px-3 py-2.5 text-xs text-[#e6edf3] overflow-x-auto bg-[#0d1117] font-mono leading-relaxed max-h-48">
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
    <div className="border border-[#30363d] rounded-xl overflow-hidden bg-[#161b22] my-2">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#30363d] bg-[#21262d]">
        <span className="text-xs font-semibold text-[#8b949e]">
          代码修改 · {files.length} 个文件
        </span>
        {allApplied ? (
          <span className="flex items-center gap-1 text-xs text-[#3fb950]">
            <Check size={13} />全部已应用
          </span>
        ) : (
          <button
            onClick={handleApplyAll}
            disabled={applyingAll}
            className="text-xs px-2.5 py-1 bg-[#238636] hover:bg-[#2ea043] disabled:opacity-50 text-white rounded-lg transition-colors font-medium"
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
