import { FileText } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { fetchFileContent } from '../../api/filesApi';

interface FileEntry {
  path: string;
  content: string;
}

interface SummaryTableProps {
  files: FileEntry[];
  appliedFiles: Set<string>;
}

export default function SummaryTable({ files, appliedFiles }: SummaryTableProps) {
  const { openTabs, openTab, setActiveTab } = useAppStore();

  if (files.length === 0) return null;

  async function handleOpenFile(filePath: string) {
    try {
      const existing = openTabs.find(t => t.path === filePath);
      if (existing) {
        setActiveTab(existing.path);
        return;
      }
      const content = await fetchFileContent(filePath);
      const name = filePath.split('/').pop() ?? filePath;
      openTab({ path: filePath, name, content, isDirty: false });
      setActiveTab(filePath);
    } catch {
      // ignore errors for unresolvable paths
    }
  }

  return (
    <div className="mt-2 rounded-lg border border-[var(--border-primary)] overflow-hidden text-[11px]">
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--bg-tertiary)] border-b border-[var(--border-primary)]">
        <FileText size={11} className="text-[var(--text-secondary)]" />
        <span className="text-[var(--text-secondary)] font-medium">文件修改摘要</span>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]">
            <th className="text-left px-2.5 py-1 text-[var(--text-secondary)] font-medium">文件路径</th>
            <th className="text-left px-2.5 py-1 text-[var(--text-secondary)] font-medium w-16">操作</th>
            <th className="text-left px-2.5 py-1 text-[var(--text-secondary)] font-medium w-16">状态</th>
          </tr>
        </thead>
        <tbody>
          {files.map((file, i) => {
            const isApplied = appliedFiles.has(file.path);
            const fileName = file.path.split('/').pop() ?? file.path;
            return (
              <tr
                key={i}
                className="border-b border-[var(--border-primary)]/50 last:border-0 hover:bg-[var(--bg-hover)] transition-colors"
              >
                <td className="px-2.5 py-1">
                  <button
                    onClick={() => handleOpenFile(file.path)}
                    className="font-mono text-[var(--accent-primary)] hover:underline truncate max-w-[180px] block"
                    title={file.path}
                  >
                    {fileName}
                  </button>
                </td>
                <td className="px-2.5 py-1 text-[var(--text-secondary)]">修改</td>
                <td className="px-2.5 py-1">
                  {isApplied ? (
                    <span className="text-[var(--success)]">已应用</span>
                  ) : (
                    <span className="text-[var(--text-tertiary)]">待应用</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
