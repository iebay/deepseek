import { X } from 'lucide-react';
import { useAppStore } from '../../store/appStore';

export default function EditorTabs() {
  const { openTabs, activeTabPath, setActiveTab, closeTab } = useAppStore();

  if (openTabs.length === 0) {
    return (
      <div className="h-9 bg-[#0d1117] border-b border-[#30363d] flex items-center px-4">
        <span className="text-xs text-[#6e7681]">没有打开的文件</span>
      </div>
    );
  }

  return (
    <div className="h-9 bg-[#0d1117] border-b border-[#30363d] flex items-center overflow-x-auto shrink-0">
      {openTabs.map(tab => (
        <div
          key={tab.path}
          className={`flex items-center gap-2 px-3 h-full border-r border-[#30363d] cursor-pointer text-xs shrink-0 group transition-colors ${
            tab.path === activeTabPath
              ? 'bg-[#1e1e1e] text-[#e6edf3] border-t-2 border-t-[#388bfd]'
              : 'text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#161b22]'
          }`}
          onClick={() => setActiveTab(tab.path)}
        >
          <span className="max-w-[120px] truncate">{tab.name}</span>
          {tab.isDirty && <span className="text-[#d29922] text-[10px]">●</span>}
          <button
            className="opacity-0 group-hover:opacity-100 hover:text-[#f85149] transition-all"
            onClick={e => { e.stopPropagation(); closeTab(tab.path); }}
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}