import { Cpu, Home, Eye, PanelLeft, PanelRight, Github, Maximize2, Minimize2, GitBranch, Terminal, Command } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/appStore';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { MODELS } from '../../constants/models';

interface TopBarProps {
  onOpenCommandPalette?: () => void;
}

export default function TopBar({ onOpenCommandPalette }: TopBarProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const {
    currentProject, selectedModel, setSelectedModel,
    togglePreview, showPreview,
    toggleSidebar, showSidebar,
    toggleAIPanel, showAIPanel,
    toggleGitPanel, showGitPanel,
    toggleTerminal, showTerminal,
  } = useAppStore();
  const [isFullscreen, setIsFullscreen] = useState(false);

  function handleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }

  return (
    <header className="h-12 bg-[#161b22] border-b border-[#30363d] flex items-center px-3 gap-2 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex items-center justify-center w-7 h-7 bg-[#388bfd]/15 rounded-lg">
          <Cpu size={15} className="text-[#388bfd]" />
        </div>
        <span className="text-sm font-bold text-[#e6edf3] tracking-tight">DeepSeek</span>
        <span className="text-xs text-[#388bfd] font-medium px-1.5 py-0.5 bg-[#388bfd]/10 rounded-md">Code</span>
      </div>

      {currentProject && !isMobile && (
        <>
          <div className="h-4 w-px bg-[#30363d] mx-1" />
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs text-[#8b949e] truncate max-w-[180px]" title={currentProject.path}>
              {currentProject.name}
            </span>
            {currentProject.techStack?.length > 0 && (
              <span className="text-[10px] text-[#388bfd] bg-[#388bfd]/10 px-1.5 rounded shrink-0">
                {currentProject.techStack[0]}
              </span>
            )}
          </div>
        </>
      )}

      <div className="flex-1" />

      {/* Model selector */}
      {!isMobile && (
        <div className="flex items-center gap-1.5">
          <Cpu size={13} className="text-[#8b949e]" />
          <select
            value={selectedModel}
            onChange={e => setSelectedModel(e.target.value)}
            className="bg-[#21262d] border border-[#30363d] text-[#e6edf3] text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#388bfd] transition-colors cursor-pointer"
          >
            {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
      )}

      <div className="h-4 w-px bg-[#30363d] mx-1" />

      {/* Panel toggles */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={toggleSidebar}
          className={`p-1.5 rounded-lg transition-colors text-xs ${showSidebar ? 'text-[#388bfd] bg-[#388bfd]/10' : 'text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d]'}`}
          title={`${showSidebar ? '隐藏' : '显示'}文件树 (Ctrl+B)`}
        >
          <PanelLeft size={15} />
        </button>
        {!isMobile && (
          <button
            onClick={togglePreview}
            className={`p-1.5 rounded-lg transition-colors ${showPreview ? 'text-[#388bfd] bg-[#388bfd]/10' : 'text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d]'}`}
            title={`${showPreview ? '隐藏' : '显示'}预览`}
          >
            <Eye size={15} />
          </button>
        )}
        <button
          onClick={toggleAIPanel}
          className={`p-1.5 rounded-lg transition-colors ${showAIPanel ? 'text-[#388bfd] bg-[#388bfd]/10' : 'text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d]'}`}
          title={`${showAIPanel ? '隐藏' : '显示'} AI 面板`}
        >
          <PanelRight size={15} />
        </button>
        {!isMobile && (
          <>
            <button
              onClick={toggleGitPanel}
              className={`p-1.5 rounded-lg transition-colors ${showGitPanel ? 'text-[#388bfd] bg-[#388bfd]/10' : 'text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d]'}`}
              title={`${showGitPanel ? '隐藏' : '显示'} Git 面板`}
            >
              <GitBranch size={15} />
            </button>
            <button
              onClick={toggleTerminal}
              className={`p-1.5 rounded-lg transition-colors ${showTerminal ? 'text-[#388bfd] bg-[#388bfd]/10' : 'text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d]'}`}
              title={`${showTerminal ? '隐藏' : '显示'}终端`}
            >
              <Terminal size={15} />
            </button>
          </>
        )}
      </div>

      <div className="h-4 w-px bg-[#30363d] mx-1" />

      {/* Actions */}
      <div className="flex items-center gap-0.5">
        {onOpenCommandPalette && (
          <button
            onClick={onOpenCommandPalette}
            className="p-1.5 rounded-lg text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d] transition-colors"
            title="命令面板 (Ctrl+Shift+P)"
          >
            <Command size={15} />
          </button>
        )}
        {!isMobile && (
          <a
            href="https://github.com/iebay/deepseek"
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d] transition-colors"
            title="GitHub 仓库"
          >
            <Github size={15} />
          </a>
        )}
        <button
          onClick={handleFullscreen}
          className="p-1.5 rounded-lg text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d] transition-colors"
          title={isFullscreen ? '退出全屏' : '全屏'}
        >
          {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-xs text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d] px-2.5 py-1.5 rounded-lg transition-colors"
        >
          <Home size={14} /> {!isMobile && '首页'}
        </button>
      </div>
    </header>
  );
}
