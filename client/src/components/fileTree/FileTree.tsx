import { useState } from 'react';
import { ChevronRight, ChevronDown, FileCode, Folder, FolderOpen } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { fetchFileContent } from '../../api/filesApi';
import type { FileNode } from '../../types';

const EXT_COLORS: Record<string, string> = {
  '.tsx': '#61dafb', '.ts': '#3178c6', '.jsx': '#61dafb', '.js': '#f7df1e',
  '.css': '#1572b6', '.scss': '#cf649a', '.html': '#e34f26', '.json': '#cbcb41',
  '.md': '#ffffff', '.py': '#3572a5', '.go': '#00add8', '.rs': '#dea584',
};

function FileTreeNode({ node, depth }: { node: FileNode; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const { openTab, setActiveTab } = useAppStore();

  async function handleFileClick() {
    try {
      const content = await fetchFileContent(node.path);
      openTab({ path: node.path, name: node.name, content, isDirty: false });
      setActiveTab(node.path);
    } catch (e) { console.error('Failed to read file', e); }
  }

  if (node.type === 'directory') {
    return (
      <div>
        <button
          className="flex items-center gap-1 w-full text-left px-2 py-0.5 hover:bg-[#21262d] rounded text-sm text-[#e6edf3] transition-colors"
          style={{ paddingLeft: `${8 + depth * 12}px` }}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronDown size={14} className="shrink-0 text-[#8b949e]" /> : <ChevronRight size={14} className="shrink-0 text-[#8b949e]" />}
          {expanded ? <FolderOpen size={14} className="shrink-0 text-[#d29922]" /> : <Folder size={14} className="shrink-0 text-[#d29922]" />}
          <span className="truncate">{node.name}</span>
        </button>
        {expanded && node.children?.map(child => (
          <FileTreeNode key={child.path} node={child} depth={depth + 1} />
        ))}
      </div>
    );
  }

  const color = EXT_COLORS[node.extension || ''] || '#8b949e';
  return (
    <button
      className="flex items-center gap-1 w-full text-left px-2 py-0.5 hover:bg-[#21262d] rounded text-sm text-[#8b949e] hover:text-[#e6edf3] transition-colors"
      style={{ paddingLeft: `${8 + depth * 12}px` }}
      onClick={handleFileClick}
    >
      <FileCode size={14} className="shrink-0" style={{ color }} />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

export default function FileTree() {
  const { fileTree, currentProject } = useAppStore();
  if (!fileTree) return <div className="p-4 text-xs text-[#6e7681]">未打开项目</div>;
  return (
    <div className="h-full overflow-y-auto py-2">
      <div className="px-3 py-1 text-xs text-[#6e7681] font-medium uppercase tracking-wider mb-1">
        {currentProject?.name || 'Explorer'}
      </div>
      {fileTree.children?.map(node => <FileTreeNode key={node.path} node={node} depth={0} />)}
    </div>
  );
}