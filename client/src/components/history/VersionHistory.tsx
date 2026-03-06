import { useState } from 'react';
import { History, RotateCcw, ChevronDown, ChevronRight } from 'lucide-react';
import { restoreFile } from '../../api/filesApi';
import { useAppStore } from '../../store/appStore';
import { fetchFileContent } from '../../api/filesApi';

interface BackupEntry {
  backupPath: string;
  originalPath: string;
  timestamp: number;
}

interface VersionHistoryProps {
  backups?: BackupEntry[];
  onRestored?: () => void;
}

export default function VersionHistory({ backups = [], onRestored }: VersionHistoryProps) {
  const [expanded, setExpanded] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const { updateTabContent, openTabs } = useAppStore();

  async function handleRestore(entry: BackupEntry) {
    if (!confirm(`确定要恢复到 ${new Date(entry.timestamp).toLocaleString()} 的版本吗？`)) return;
    setRestoring(entry.backupPath);
    setStatus('');
    try {
      await restoreFile(entry.backupPath, entry.originalPath);
      // refresh open tab if it matches
      const tab = openTabs.find(t => t.path === entry.originalPath);
      if (tab) {
        const fresh = await fetchFileContent(entry.originalPath);
        updateTabContent(entry.originalPath, fresh, false);
      }
      setStatus('✓ 恢复成功');
      onRestored?.();
      setTimeout(() => setStatus(''), 2000);
    } catch (e) {
      setStatus(`恢复失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRestoring(null);
    }
  }

  return (
    <div className="bg-[#0d1117] border border-[#30363d] rounded-lg overflow-hidden">
      <button
        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[#e6edf3] hover:bg-[#161b22] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <History size={14} className="text-[#388bfd]" />
        <span className="font-medium flex-1 text-left">版本历史</span>
        <span className="text-xs text-[#6e7681]">{backups.length}</span>
        {expanded ? <ChevronDown size={14} className="text-[#6e7681]" /> : <ChevronRight size={14} className="text-[#6e7681]" />}
      </button>

      {expanded && (
        <div className="border-t border-[#30363d]">
          {backups.length === 0 ? (
            <div className="px-3 py-4 text-xs text-[#6e7681] text-center">暂无备份记录</div>
          ) : (
            backups.map((entry) => (
              <div key={entry.backupPath} className="flex items-center gap-2 px-3 py-2 border-b border-[#21262d] last:border-0 hover:bg-[#161b22] transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-[#e6edf3] truncate">{entry.originalPath.split('/').pop()}</div>
                  <div className="text-xs text-[#6e7681]">{new Date(entry.timestamp).toLocaleString()}</div>
                </div>
                <button
                  onClick={() => handleRestore(entry)}
                  disabled={restoring === entry.backupPath}
                  className="flex items-center gap-1 text-xs text-[#8b949e] hover:text-[#e6edf3] disabled:opacity-50 transition-colors"
                  title="恢复此版本"
                >
                  <RotateCcw size={12} />
                  回滚
                </button>
              </div>
            ))
          )}
          {status && <div className="px-3 py-2 text-xs text-[#3fb950]">{status}</div>}
        </div>
      )}
    </div>
  );
}
