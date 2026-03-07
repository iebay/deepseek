import { useState, useCallback, useEffect, useRef } from 'react';
import { ChevronRight, ChevronDown, FileCode, FileImage, FileArchive, FileJson, FileText, Folder, FolderOpen, Search, ChevronsUpDown, ChevronsDownUp, X, Upload, FilePlus, FolderPlus, Pencil, Trash2, Copy } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { fetchFileContent, uploadZip, uploadFiles, fetchFileTree, createFileOrDir, renameFile, deleteFile } from '../../api/filesApi';
import type { FileNode } from '../../types';
import { FileTreeSkeleton } from '../ui/Skeleton';
import ContextMenu, { type ContextMenuItem } from '../ui/ContextMenu';

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

function InlineInput({
  defaultValue,
  depth,
  icon,
  onCommit,
  onCancel,
}: {
  defaultValue: string;
  depth: number;
  icon: React.ReactNode;
  onCommit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (value.trim()) onCommit(value.trim());
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  }

  return (
    <div
      className="flex items-center gap-1.5 rounded-md bg-[var(--bg-tertiary)]"
      style={{ paddingLeft: `${8 + depth * 14}px`, paddingRight: '8px', paddingTop: '2px', paddingBottom: '2px' }}
    >
      <span className="shrink-0">{icon}</span>
      <input
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => onCancel()}
        className="flex-1 bg-[var(--bg-primary)] border border-[#388bfd] rounded px-1 py-0.5 text-xs text-[var(--text-primary)] focus:outline-none min-w-0"
      />
    </div>
  );
}

function FileTreeNode({
  node, depth, expandedPaths, onToggle, searchQuery, onContextMenu,
  renamingPath, onRenameCommit, onRenameCancel,
  inlineCreate, onInlineCreateCommit, onInlineCreateCancel,
}: {
  node: FileNode;
  depth: number;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
  searchQuery: string;
  onContextMenu: (node: FileNode, e: React.MouseEvent) => void;
  renamingPath: string | null;
  onRenameCommit: (node: FileNode, newName: string) => void;
  onRenameCancel: () => void;
  inlineCreate: { parentPath: string; type: 'file' | 'directory' } | null;
  onInlineCreateCommit: (name: string) => void;
  onInlineCreateCancel: () => void;
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
    const isRenaming = renamingPath === node.path;
    const showCreate = inlineCreate && inlineCreate.parentPath === node.path;

    return (
      <div>
        {isRenaming ? (
          <InlineInput
            defaultValue={node.name}
            depth={depth}
            icon={<Folder size={14} className="text-[var(--warning)]" />}
            onCommit={(name) => onRenameCommit(node, name)}
            onCancel={onRenameCancel}
          />
        ) : (
          <button
            className="flex items-center gap-1 w-full text-left hover:bg-[var(--bg-hover)] rounded-md text-sm text-[var(--text-primary)] transition-colors group"
            style={{ paddingLeft: `${8 + depth * 14}px`, paddingRight: '8px', paddingTop: '3px', paddingBottom: '3px' }}
            onClick={() => onToggle(node.path)}
            onContextMenu={e => onContextMenu(node, e)}
            title={node.path}
          >
            <span className="shrink-0 text-[var(--text-secondary)]">
              {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </span>
            <span className="shrink-0 text-[var(--warning)]">
              {isExpanded ? <FolderOpen size={14} /> : <Folder size={14} />}
            </span>
            <span className="truncate flex-1 ml-0.5">{node.name}</span>
          </button>
        )}
        {isExpanded && (
          <>
            {showCreate && (
              <InlineInput
                defaultValue=""
                depth={depth + 1}
                icon={
                  inlineCreate?.type === 'directory'
                    ? <Folder size={14} className="text-[var(--warning)]" />
                    : <FileCode size={14} className="text-[var(--text-secondary)]" />
                }
                onCommit={onInlineCreateCommit}
                onCancel={onInlineCreateCancel}
              />
            )}
            {node.children?.map(child => (
              <FileTreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                expandedPaths={expandedPaths}
                onToggle={onToggle}
                searchQuery={searchQuery}
                onContextMenu={onContextMenu}
                renamingPath={renamingPath}
                onRenameCommit={onRenameCommit}
                onRenameCancel={onRenameCancel}
                inlineCreate={inlineCreate}
                onInlineCreateCommit={onInlineCreateCommit}
                onInlineCreateCancel={onInlineCreateCancel}
              />
            ))}
          </>
        )}
      </div>
    );
  }

  const color = EXT_COLORS[node.extension || ''] || '#8b949e';
  const isActive = node.path === activeTabPath;
  const isRenaming = renamingPath === node.path;

  if (isRenaming) {
    return (
      <InlineInput
        defaultValue={node.name}
        depth={depth}
        icon={getFileIcon(node.extension || '', color)}
        onCommit={(name) => onRenameCommit(node, name)}
        onCancel={onRenameCancel}
      />
    );
  }

  return (
    <button
      className={`flex items-center gap-1.5 w-full text-left hover:bg-[var(--bg-hover)] rounded-md text-sm transition-colors ${isActive ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
      style={{ paddingLeft: `${8 + depth * 14}px`, paddingRight: '8px', paddingTop: '3px', paddingBottom: '3px' }}
      onClick={handleFileClick}
      onContextMenu={e => onContextMenu(node, e)}
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

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);
  // Rename state
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  // Inline create state
  const [inlineCreate, setInlineCreate] = useState<{ parentPath: string; type: 'file' | 'directory' } | null>(null);
  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{ path: string; name: string } | null>(null);
  // Drag-over state for file drop
  const [isDragOver, setIsDragOver] = useState(false);

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

  async function refreshTree() {
    if (!currentProject) return;
    const tree = await fetchFileTree(currentProject.path);
    setFileTree(tree);
  }

  function getDirPath(nodePath: string, nodeType: 'file' | 'directory'): string {
    if (nodeType === 'directory') return nodePath;
    const parts = nodePath.split('/');
    parts.pop();
    return parts.join('/');
  }

  function handleNodeContextMenu(node: FileNode, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const items: ContextMenuItem[] = [];
    if (node.type === 'directory') {
      items.push(
        { label: '新建文件', icon: <FilePlus size={13} />, onClick: () => startCreate(node.path, 'file') },
        { label: '新建文件夹', icon: <FolderPlus size={13} />, onClick: () => startCreate(node.path, 'directory') },
      );
    }
    items.push(
      { label: '重命名', icon: <Pencil size={13} />, onClick: () => setRenamingPath(node.path) },
      { label: '删除', icon: <Trash2 size={13} />, onClick: () => setDeleteConfirm({ path: node.path, name: node.name }), danger: true },
      { label: '复制路径', icon: <Copy size={13} />, onClick: () => { navigator.clipboard.writeText(node.path).then(() => showToast('路径已复制', 'success')).catch(() => showToast('复制失败', 'error')); } },
    );
    setContextMenu({ x: e.clientX, y: e.clientY, items });
  }

  function handleTreeAreaContextMenu(e: React.MouseEvent) {
    // Only fire on the tree area itself, not on nodes
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    if (!currentProject) return;
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { label: '新建文件', icon: <FilePlus size={13} />, onClick: () => startCreate(currentProject.path, 'file') },
        { label: '新建文件夹', icon: <FolderPlus size={13} />, onClick: () => startCreate(currentProject.path, 'directory') },
      ],
    });
  }

  function startCreate(parentPath: string, type: 'file' | 'directory') {
    // Expand the parent if it's in the tree
    setExpandedPaths(prev => new Set([...prev, parentPath]));
    setInlineCreate({ parentPath, type });
  }

  async function handleInlineCreateCommit(name: string) {
    if (!inlineCreate) return;
    const newPath = `${inlineCreate.parentPath}/${name}`;
    try {
      await createFileOrDir(newPath, inlineCreate.type);
      showToast(`已创建 ${name}`, 'success');
      await refreshTree();
    } catch (err) {
      showToast(`创建失败: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setInlineCreate(null);
    }
  }

  async function handleRenameCommit(node: FileNode, newName: string) {
    const dirPath = getDirPath(node.path, node.type);
    const newPath = `${dirPath}/${newName}`;
    if (newPath === node.path) { setRenamingPath(null); return; }
    try {
      await renameFile(node.path, newPath);
      showToast(`已重命名为 ${newName}`, 'success');
      await refreshTree();
    } catch (err) {
      showToast(`重命名失败: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setRenamingPath(null);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteConfirm) return;
    try {
      await deleteFile(deleteConfirm.path);
      showToast(`已删除 ${deleteConfirm.name}`, 'success');
      await refreshTree();
    } catch (err) {
      showToast(`删除失败: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setDeleteConfirm(null);
    }
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

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (!currentProject) {
      showToast('请先打开一个项目', 'error');
      return;
    }

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    setLoading(true);
    try {
      await uploadFiles(files, currentProject.path);
      const tree = await fetchFileTree(currentProject.path);
      setFileTree(tree);
      showToast(`成功上传 ${files.length} 个文件`, 'success');
    } catch (err) {
      showToast(`上传失败: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <FileTreeSkeleton />;
  }

  if (!fileTree) {
    return (
      <div className="p-4 text-xs text-[var(--text-tertiary)] flex flex-col items-center gap-2 mt-8">
        <Folder size={32} className="text-[var(--text-muted)]" />
        <p>未打开项目</p>
      </div>
    );
  }

  return (
    <div
      className="h-full flex flex-col overflow-hidden relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[var(--bg-primary)]/80 border-2 border-dashed border-[#388bfd] rounded-lg pointer-events-none">
          <div className="text-center">
            <Upload size={32} className="text-[var(--accent-primary)] mx-auto mb-2" />
            <p className="text-sm text-[var(--accent-primary)]">拖拽文件到此处上传</p>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="px-3 py-2 border-b border-[var(--border-primary)] shrink-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-[var(--text-tertiary)] font-semibold uppercase tracking-widest">
            {currentProject?.name || '资源管理器'}
          </span>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={`p-1 rounded transition-colors ${showSearch ? 'text-[var(--accent-primary)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}
              title="搜索文件 (Ctrl+P)"
            >
              <Search size={12} />
            </button>
            {currentProject && (
              <>
                <button
                  onClick={() => startCreate(currentProject.path, 'file')}
                  className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                  title="新建文件"
                >
                  <FilePlus size={12} />
                </button>
                <button
                  onClick={() => startCreate(currentProject.path, 'directory')}
                  className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                  title="新建文件夹"
                >
                  <FolderPlus size={12} />
                </button>
                <button
                  onClick={() => zipInputRef.current?.click()}
                  className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
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
              className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
              title="展开全部"
            >
              <ChevronsUpDown size={12} />
            </button>
            <button
              onClick={collapseAll}
              className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
              title="折叠全部"
            >
              <ChevronsDownUp size={12} />
            </button>
          </div>
        </div>
        {showSearch && (
          <div className="relative">
            <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <input
              autoFocus
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜索文件..."
              className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-md pl-6 pr-6 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              >
                <X size={11} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tree */}
      <div
        className="flex-1 overflow-y-auto py-1"
        onContextMenu={handleTreeAreaContextMenu}
      >
        {inlineCreate && inlineCreate.parentPath === currentProject?.path && (
          <InlineInput
            defaultValue=""
            depth={0}
            icon={
              inlineCreate.type === 'directory'
                ? <Folder size={14} className="text-[var(--warning)]" />
                : <FileCode size={14} className="text-[var(--text-secondary)]" />
            }
            onCommit={handleInlineCreateCommit}
            onCancel={() => setInlineCreate(null)}
          />
        )}
        {fileTree.children?.map(node => (
          <FileTreeNode
            key={node.path}
            node={node}
            depth={0}
            expandedPaths={expandedPaths}
            onToggle={handleToggle}
            searchQuery={searchQuery}
            onContextMenu={handleNodeContextMenu}
            renamingPath={renamingPath}
            onRenameCommit={handleRenameCommit}
            onRenameCancel={() => setRenamingPath(null)}
            inlineCreate={inlineCreate}
            onInlineCreateCommit={handleInlineCreateCommit}
            onInlineCreateCancel={() => setInlineCreate(null)}
          />
        ))}
      </div>

      {/* Footer */}
      {currentProject && (
        <div className="px-3 py-1.5 border-t border-[var(--border-primary)] shrink-0">
          <span className="text-[10px] text-[var(--text-tertiary)]">
            {currentProject.fileCount} 个文件
          </span>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-[#1c2128] border border-[var(--border-primary)] rounded-lg shadow-xl p-5 max-w-sm w-full mx-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">确认删除</h3>
            <p className="text-xs text-[var(--text-secondary)] mb-4">
              确定要删除 <span className="text-[var(--text-primary)] font-medium">{deleteConfirm.name}</span> 吗？此操作不可撤销。
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-3 py-1.5 text-xs rounded-md border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-3 py-1.5 text-xs rounded-md bg-[#da3633] hover:bg-[#b62324] text-white transition-colors"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}