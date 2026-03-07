import { useState, useEffect, useRef } from 'react';
import { Command, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/appStore';
import { MODELS } from '../../constants/models';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  action: () => void;
}

interface CommandPaletteProps {
  onClose: () => void;
}

export default function CommandPalette({ onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const {
    toggleSidebar, togglePreview, toggleAIPanel, toggleTerminal,
    clearChat, setSelectedModel,
    openTabs, activeTabPath,
    showToast,
  } = useAppStore();

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeTab = openTabs.find(t => t.path === activeTabPath);

  const commands: CommandItem[] = [
    { id: 'toggle-sidebar', label: '切换文件树', description: 'Ctrl+B', action: () => { toggleSidebar(); onClose(); } },
    { id: 'toggle-preview', label: '切换预览面板', action: () => { togglePreview(); onClose(); } },
    { id: 'toggle-ai', label: '切换 AI 面板', action: () => { toggleAIPanel(); onClose(); } },
    { id: 'toggle-terminal', label: '切换终端', action: () => { toggleTerminal(); onClose(); } },
    { id: 'toggle-fullscreen', label: '切换全屏', action: () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
      onClose();
    }},
    { id: 'clear-chat', label: '清空对话', action: () => { clearChat(); showToast('对话已清空', 'info'); onClose(); } },
    { id: 'save-file', label: '保存当前文件', description: activeTab?.name, action: () => {
      // Trigger save via keyboard event
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true }));
      onClose();
    }},
    { id: 'go-home', label: '回到首页', action: () => { navigate('/'); onClose(); } },
    ...MODELS.map(m => ({
      id: `model-${m.value}`,
      label: `切换模型: ${m.label}`,
      description: m.value,
      action: () => { setSelectedModel(m.value); showToast(`已切换到 ${m.label}`, 'success'); onClose(); },
    })),
  ];

  const filtered = query.trim()
    ? commands.filter(c =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.description?.toLowerCase().includes(query.toLowerCase())
      )
    : commands;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected(s => Math.min(s + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected(s => Math.max(s - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      filtered[selected]?.action();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-primary)]">
          <Search size={15} className="text-[var(--text-secondary)] shrink-0" />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-[var(--text-primary)] text-sm placeholder-[var(--text-tertiary)] outline-none"
            placeholder="搜索命令..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)] border border-[var(--border-primary)] rounded px-1.5 py-0.5">
            <Command size={10} />
            <span>Esc</span>
          </div>
        </div>

        {/* Command list */}
        <div className="max-h-80 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-[var(--text-tertiary)]">未找到命令</div>
          ) : (
            filtered.map((cmd, i) => (
              <button
                key={cmd.id}
                className={`flex items-center justify-between w-full px-4 py-2.5 text-sm text-left transition-colors ${
                  i === selected ? 'bg-[var(--accent-bg)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
                }`}
                onClick={cmd.action}
                onMouseEnter={() => setSelected(i)}
              >
                <span>{cmd.label}</span>
                {cmd.description && (
                  <span className="text-[10px] text-[var(--text-tertiary)] ml-2 shrink-0">{cmd.description}</span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
