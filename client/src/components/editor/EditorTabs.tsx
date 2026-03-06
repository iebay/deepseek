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
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

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

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }

  function handleDrop(e: React.DragEvent, toIndex: number) {
    e.preventDefault();
    const fromIndex = dragIndexRef.current;
    if (fromIndex !== null && fromIndex !== toIndex) {
      reorderTabs(fromIndex, toIndex);
    }
    dragIndexRef.current = null;
    setDragOverIndex(null);
  }

  function handleDragEnd() {
    dragIndexRef.current = null;
    setDragOverIndex(null);
  }

  if (openTabs.length === 0) {
    return (
      <div className="h-9 bg-[#0d1117] border-b border-[#30363d] flex items-center px-4 shrink-0">
        <span className="text-xs text-[#6e7681]">没有打开的文件</span>
      </div>
    );
  }

  return (
    <>
      <div className="h-9 bg-[#0d1117] border-b border-[#30363d] flex items-center overflow-x-auto shrink-0 scrollbar-thin">
        {openTabs.map((tab, index) => (
          <div
            key={tab.path}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            className={`flex items-center gap-1.5 px-3 h-full border-r border-[#30363d] cursor-pointer text-xs shrink-0 group transition-colors select-none ${
              tab.path === activeTabPath
                ? 'bg-[#1e1e1e] text-[#e6edf3] border-t-2 border-t-[#388bfd]'
                : 'text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#161b22]'
            } ${dragOverIndex === index && dragIndexRef.current !== index ? 'border-l-2 border-l-[#388bfd]' : ''}`}
            onClick={() => setActiveTab(tab.path)}
            onContextMenu={(e) => handleContextMenu(e, tab.path)}
          >
            {tab.isDirty ? (
              <Circle size={8} className="text-[#d29922] shrink-0 fill-[#d29922]" />
            ) : (
              <span className="w-2 shrink-0" />
            )}
            <span className="max-w-[120px] truncate" title={tab.path}>{tab.name}</span>
            <button
              className="opacity-0 group-hover:opacity-100 hover:text-[#f85149] hover:bg-[#f85149]/10 rounded p-0.5 transition-all -mr-1"
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
          className="fixed z-50 bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl py-1 min-w-[180px] text-sm"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            className="flex items-center gap-2 w-full px-3 py-2 text-[#e6edf3] hover:bg-[#21262d] transition-colors text-left text-xs"
            onClick={() => { closeTab(contextMenu.path); setContextMenu(null); }}
          >
            关闭
          </button>
          <button
            className="flex items-center gap-2 w-full px-3 py-2 text-[#e6edf3] hover:bg-[#21262d] transition-colors text-left text-xs"
            onClick={() => { closeOtherTabs(contextMenu.path); setContextMenu(null); }}
          >
            关闭其他标签页
          </button>
          <button
            className="flex items-center gap-2 w-full px-3 py-2 text-[#e6edf3] hover:bg-[#21262d] transition-colors text-left text-xs"
            onClick={() => { closeAllTabs(); setContextMenu(null); }}
          >
            关闭所有标签页
          </button>
          <div className="h-px bg-[#30363d] my-1" />
          <button
            className="flex items-center gap-2 w-full px-3 py-2 text-[#e6edf3] hover:bg-[#21262d] transition-colors text-left text-xs"
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