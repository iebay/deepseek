import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, PanelLeft, PanelRight, Eye, Terminal, GitBranch, Trash2, Home, Save, Cpu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/appStore';

interface Command {
  id: string;
  label: string;
  shortcut?: string;
  icon: React.ReactNode;
  action: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const {
    toggleSidebar,
    togglePreview,
    toggleAIPanel,
    toggleGitPanel,
    toggleTerminal,
    clearChat,
    selectedModel,
    setSelectedModel,
  } = useAppStore();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSave = useCallback(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true }));
  }, []);

  const handleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  const MODELS = [
    { value: 'deepseek-chat', label: 'DeepSeek V3.2 (通用)' },
    { value: 'deepseek-reasoner', label: 'DeepSeek R2 (推理)' },
    { value: 'deepseek-coder', label: 'DeepSeek Coder V3 (编程)' },
  ];

  const nextModel = MODELS[(MODELS.findIndex(m => m.value === selectedModel) + 1) % MODELS.length];

  const commands: Command[] = [
    {
      id: 'toggle-sidebar',
      label: '切换文件树',
      shortcut: 'Ctrl+B',
      icon: <PanelLeft size={15} />,
      action: toggleSidebar,
    },
    {
      id: 'toggle-preview',
      label: '切换预览',
      icon: <Eye size={15} />,
      action: togglePreview,
    },
    {
      id: 'toggle-ai',
      label: '切换 AI 面板',
      icon: <PanelRight size={15} />,
      action: toggleAIPanel,
    },
    {
      id: 'toggle-terminal',
      label: '切换终端',
      icon: <Terminal size={15} />,
      action: toggleTerminal,
    },
    {
      id: 'toggle-git',
      label: '切换 Git 面板',
      icon: <GitBranch size={15} />,
      action: toggleGitPanel,
    },
    {
      id: 'clear-chat',
      label: '清空 AI 对话',
      icon: <Trash2 size={15} />,
      action: clearChat,
    },
    {
      id: 'fullscreen',
      label: '切换全屏',
      icon: <Eye size={15} />,
      action: handleFullscreen,
    },
    {
      id: 'home',
      label: '回到首页',
      icon: <Home size={15} />,
      action: () => navigate('/'),
    },
    {
      id: 'save',
      label: '保存当前文件',
      shortcut: 'Ctrl+S',
      icon: <Save size={15} />,
      action: handleSave,
    },
    {
      id: 'switch-model',
      label: `切换模型 → ${nextModel.label}`,
      icon: <Cpu size={15} />,
      action: () => setSelectedModel(nextModel.value),
    },
  ];

  const filtered = commands.filter(cmd =>
    !query || cmd.label.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action();
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [filtered, selectedIndex, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      <div
        className="bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#30363d]">
          <Search size={16} className="text-[#8b949e] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="搜索命令..."
            className="flex-1 bg-transparent text-[#e6edf3] text-sm placeholder-[#6e7681] outline-none"
          />
          <span className="text-[10px] text-[#6e7681] bg-[#21262d] px-1.5 py-0.5 rounded border border-[#30363d]">ESC</span>
        </div>

        {/* Command list */}
        <div className="py-1 max-h-80 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-[#6e7681]">无匹配命令</div>
          ) : (
            filtered.map((cmd, i) => (
              <button
                key={cmd.id}
                className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm text-left transition-colors ${
                  i === selectedIndex
                    ? 'bg-[#388bfd]/15 text-[#e6edf3]'
                    : 'text-[#8b949e] hover:bg-[#21262d] hover:text-[#e6edf3]'
                }`}
                onClick={() => { cmd.action(); onClose(); }}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <span className="text-[#8b949e] shrink-0">{cmd.icon}</span>
                <span className="flex-1">{cmd.label}</span>
                {cmd.shortcut && (
                  <span className="text-[10px] text-[#6e7681] bg-[#21262d] px-1.5 py-0.5 rounded border border-[#30363d] shrink-0">
                    {cmd.shortcut}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
