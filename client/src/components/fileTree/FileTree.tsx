import { useState, useCallback, useEffect, useRef } from 'react';
import { ChevronRight, ChevronDown, FileCode, FileImage, FileArchive, FileJson, FileText, Folder, FolderOpen, Search, ChevronsUpDown, ChevronsDownUp, X, Upload } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { fetchFileContent, uploadZip } from '../../api/filesApi';
import { fetchFileTree } from '../../api/filesApi';
import type { FileNode } from '../../types';
import { FileTreeSkeleton } from '../ui/Skeleton';

const EXT_COLORS: Record<string, string> = {
  '.tsx': '#61dafb', '.ts': '#3178c6', '.jsx': '#61dafb', '.js': '#f7df1e',
  '.css': '#1572b6', '.scss': '#cf649a', '.html': '#e34f26', '.json': '#cbcb41',
  '.md': '#8b949e', '.py': '#3572a5', '.go': '#00add8', '.rs': '#dea584',
  '.svg': '#ffb13b', '.png': '#a8c7fa', '.jpg': '#a8c7fa', '.gif': '#a8c7fa',
  '.sh': '#89e051', '.env': '#8b949e', '.yaml': '#cc3e44', '.yml': '#cc3e44',
};

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.bmp']);
const ARCHIVE_EXTS = new Set(['.zip', '.tar', '.gz', '.rar', '.7z']);
const JSON_EXTS = new Set(['.json', '.jsonc']);
const TEXT_EXTS = new Set(['.md', '.txt', '.rst', '.env', '.gitignore', '.editorconfig']);

function getFileIcon(ext: string, color: string) {
  if (IMAGE_EXTS.has(ext)) return <FileImage size={14} className="shrink-0" style={{ color }} />;
  if (ARCHIVE_EXTS.has(ext)) return <FileArchive size={14} className="shrink-0" style={{ color }} />;
  if (JSON_EXTS.has(ext)) return <FileJson size={14} className="shrink-0" style={{ color }} />;
  if (TEXT_EXTS.has(ext)) return <FileText size={14} className="shrink-0" style={{ color }} />;
  return <FileCode size={14} className="shrink-0" style={{ color }} />;
}

function getAllPaths(node: FileNode): string[] {
  if (node.type === 'file') return [];
  const paths: string[] = [node.path];
  for (const child of node.children ?? []) {
    paths.push(...getAllPaths(child));
  }
  return paths;
}

function matchesSearch(node: FileNode, query: string): boolean {
  if (!query) return true;
  if (node.name.toLowerCase().includes(query.toLowerCase())) return true;
  if (node.type === 'directory') {
    return node.children?.some(c => matchesSearch(c, query)) ?? false;
  }
  return false;
}

function FileTreeNode({
  node, depth, expandedPaths, onToggle, searchQuery,
}: {
  node: FileNode;
  depth: number;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
  searchQuery: string;
}) {
  const { openTab, setActiveTab, activeTabPath } = useAppStore();

  if (!matchesSearch(node, searchQuery)) return null;

  async function handleFileClick() {
    try {
      const content = await fetchFileContent(node.path);
      openTab({ path: node.path, name: node.name, content, isDirty: false });
      setActiveTab(node.path);
    } catch (e) { console.error('Failed to read file', e); }
  }

  if (node.type === 'directory') {
    const isExpanded = expandedPaths.has(node.path);
    return (
      <div>
        <button
          className="flex items-center gap-1 w-full text-left hover:bg-[#21262d] rounded-md text-sm text-[#e6edf3] transition-colors group"
          style={{ paddingLeft: `${8 + depth * 14}px`, paddingRight: '8px', paddingTop: '3px', paddingBottom: '3px' }}
          onClick={() => onToggle(node.path)}
          title={node.path}
        >
          <span className="shrink-0 text-[#8b949e]">
            {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </span>
          <span className="shrink-0 text-[#d29922]">
            {isExpanded ? <FolderOpen size={14} /> : <Folder size={14} />}
          </span>
          <span className="truncate flex-1 ml-0.5">{node.name}</span>
        </button>
        {isExpanded && node.children?.map(child => (
          <FileTreeNode
            key={child.path}
            node={child}
            depth={depth + 1}
            expandedPaths={expandedPaths}
            onToggle={onToggle}
            searchQuery={searchQuery}
          />
        ))}
      </div>
    );
  }

  const color = EXT_COLORS[node.extension || ''] || '#8b949e';
  const isActive = node.path === activeTabPath;
  return (
    <button
      className={`flex items-center gap-1.5 w-full text-left hover:bg-[#21262d] rounded-md text-sm transition-colors ${isActive ? 'bg-[#21262d] text-[#e6edf3]' : 'text-[#8b949e] hover:text-[#e6edf3]'}`}
      style={{ paddingLeft: `${8 + depth * 14}px`, paddingRight: '8px', paddingTop: '3px', paddingBottom: '3px' }}
      onClick={handleFileClick}
      title={node.path}
    >
      {getFileIcon(node.extension || '', color)}
      <span className="truncate flex-1">{node.name}</span>
    </button>
  );
}

export default function FileTree() {
  const { fileTree, currentProject, setFileTree, showToast } = useAppStore();
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [loading, setLoading] = useState(false);
  const zipInputRef = useRef<HTMLInputElement>(null);

  // Initialize with first 2 levels expanded
  useEffect(() => {
    if (!fileTree) return;
    const initial = new Set<string>();
    function init(node: FileNode, depth: number) {
      if (node.type === 'directory' && depth < 2) {
        initial.add(node.path);
        node.children?.forEach(c => init(c, depth + 1));
      }
    }
    init(fileTree, 0);
    setExpandedPaths(initial);
  }, [fileTree]);

  // Expand all when searching
  useEffect(() => {
    if (searchQuery && fileTree) {
      setExpandedPaths(new Set(getAllPaths(fileTree)));
    }
  }, [searchQuery, fileTree]);

  // Ctrl+P shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        setShowSearch(true);
      }
      if (e.key === 'Escape') {
        setShowSearch(false);
        setSearchQuery('');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleToggle = useCallback((path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  function expandAll() {
    if (fileTree) setExpandedPaths(new Set(getAllPaths(fileTree)));
  }

  function collapseAll() {
    setExpandedPaths(new Set());
  }

  async function handleZipUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !currentProject) return;
    setLoading(true);
    try {
      await uploadZip(file, currentProject.path);
      // Refresh file tree
      const tree = await fetchFileTree(currentProject.path);
      setFileTree(tree);
      showToast('ZIP 解压成功', 'success');
    } catch (err) {
      showToast(`ZIP 解压失败: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setLoading(false);
      if (zipInputRef.current) zipInputRef.current.value = '';
    }
  }

  if (loading) {
    return <FileTreeSkeleton />;
  }

  if (!fileTree) {
    return (
      <div className="p-4 text-xs text-[#6e7681] flex flex-col items-center gap-2 mt-8">
        <Folder size={32} className="text-[#30363d]" />
        <p>未打开项目</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[#30363d] shrink-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-[#6e7681] font-semibold uppercase tracking-widest">
            {currentProject?.name || '资源管理器'}
          </span>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={`p-1 rounded transition-colors ${showSearch ? 'text-[#388bfd]' : 'text-[#6e7681] hover:text-[#e6edf3]'}`}
              title="搜索文件 (Ctrl+P)"
            >
              <Search size={12} />
            </button>
            {currentProject && (
              <>
                <button
                  onClick={() => zipInputRef.current?.click()}
                  className="p-1 rounded text-[#6e7681] hover:text-[#e6edf3] transition-colors"
                  title="上传 ZIP 并解压"
                >
                  <Upload size={12} />
                </button>
                <input
                  ref={zipInputRef}
                  type="file"
                  accept=".zip"
                  className="hidden"
                  onChange={handleZipUpload}
                />
              </>
            )}
            <button
              onClick={expandAll}
              className="p-1 rounded text-[#6e7681] hover:text-[#e6edf3] transition-colors"
              title="展开全部"
            >
              <ChevronsUpDown size={12} />
            </button>
            <button
              onClick={collapseAll}
              className="p-1 rounded text-[#6e7681] hover:text-[#e6edf3] transition-colors"
              title="折叠全部"
            >
              <ChevronsDownUp size={12} />
            </button>
          </div>
        </div>
        {showSearch && (
          <div className="relative">
            <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#6e7681]" />
            <input
              autoFocus
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜索文件..."
              className="w-full bg-[#21262d] border border-[#30363d] rounded-md pl-6 pr-6 py-1.5 text-xs text-[#e6edf3] placeholder-[#6e7681] focus:outline-none focus:border-[#388bfd] transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6e7681] hover:text-[#e6edf3]"
              >
                <X size={11} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {fileTree.children?.map(node => (
          <FileTreeNode
            key={node.path}
            node={node}
            depth={0}
            expandedPaths={expandedPaths}
            onToggle={handleToggle}
            searchQuery={searchQuery}
          />
        ))}
      </div>

      {/* Footer */}
      {currentProject && (
        <div className="px-3 py-1.5 border-t border-[#30363d] shrink-0">
          <span className="text-[10px] text-[#6e7681]">
            {currentProject.fileCount} 个文件
          </span>
        </div>
      )}
    </div>
  );
}