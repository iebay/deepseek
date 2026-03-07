import { useState, useRef, useEffect } from 'react';
import { X, Circle } from 'lucide-react';
import { useAppStore } from '../../store/appStore';

interface ContextMenu {
  x: number;
  y: number;
  path: string;
}

export default function EditorTabs() {
  const { openTabs, activeTabPath, setActiveTab, closeTab, closeOtherTabs, closeAllTabs, reorderTabs, showToast } = useAppStore();
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const dragIndexRef = useRef<number | null>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [contextMenu]);

  function handleContextMenu(e: React.MouseEvent, path: string) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, path });
  }

  function handleDragStart(e: React.DragEvent, index: number) {
    dragIndexRef.current = index;
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function handleDrop(e: React.DragEvent, toIndex: number) {
    e.preventDefault();
    if (dragIndexRef.current === null || dragIndexRef.current === toIndex) return;
    reorderTabs(dragIndexRef.current, toIndex);
    dragIndexRef.current = null;
  }

  if (openTabs.length === 0) {
    return (
      <div className="h-9 bg-[var(--bg-primary)] border-b border-[var(--border-primary)] flex items-center px-4 shrink-0">
        <span className="text-xs text-[var(--text-tertiary)]">没有打开的文件</span>
      </div>
    );
  }

  return (
    <>
      <div className="h-9 bg-[var(--bg-primary)] border-b border-[var(--border-primary)] flex items-center overflow-x-auto shrink-0 scrollbar-thin">
        {openTabs.map((tab, index) => (
          <div
            key={tab.path}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, index)}
            className={`flex items-center gap-1.5 px-3 h-full border-r border-[var(--border-primary)] cursor-pointer text-xs shrink-0 group transition-colors select-none ${
              tab.path === activeTabPath
                ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] border-t-2 border-t-[var(--accent-primary)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
            }`}
            onClick={() => setActiveTab(tab.path)}
            onContextMenu={(e) => handleContextMenu(e, tab.path)}
          >
            {tab.isDirty ? (
              <Circle size={8} className="text-[var(--warning)] shrink-0 fill-[var(--warning)]" />
            ) : (
              <span className="w-2 shrink-0" />
            )}
            <span className="max-w-[120px] truncate" title={tab.path}>{tab.name}</span>
            <button
              className="opacity-0 group-hover:opacity-100 hover:text-[var(--error)] hover:bg-[var(--error)]/10 rounded p-0.5 transition-all -mr-1"
              onClick={e => { e.stopPropagation(); closeTab(tab.path); }}
              title="关闭"
            >
              <X size={11} />
            </button>
          </div>
        ))}
      </div>

      {contextMenu && (
        <div
          ref={menuRef}
          className="fixed z-50 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl shadow-2xl py-1 min-w-[180px] text-sm"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            className="flex items-center gap-2 w-full px-3 py-2 text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors text-left text-xs"
            onClick={() => { closeTab(contextMenu.path); setContextMenu(null); }}
          >
            关闭
          </button>
          <button
            className="flex items-center gap-2 w-full px-3 py-2 text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors text-left text-xs"
            onClick={() => { closeOtherTabs(contextMenu.path); setContextMenu(null); }}
          >
            关闭其他标签页
          </button>
          <button
            className="flex items-center gap-2 w-full px-3 py-2 text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors text-left text-xs"
            onClick={() => { closeAllTabs(); setContextMenu(null); }}
          >
            关闭所有标签页
          </button>
          <div className="h-px bg-[var(--border-primary)] my-1" />
          <button
            className="flex items-center gap-2 w-full px-3 py-2 text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors text-left text-xs"
            onClick={() => {
              navigator.clipboard.writeText(contextMenu.path);
              showToast('路径已复制', 'success');
              setContextMenu(null);
            }}
          >
            复制文件路径
          </button>
        </div>
      )}
    </>
  );
}