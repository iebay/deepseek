import { Cpu, Home, Eye, PanelLeft, PanelRight, Github, Maximize2, Minimize2, GitBranch, TerminalSquare, CommandIcon, Bot, Search, Undo2, Redo2, Package, BarChart3, Sun, Moon } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/appStore';
import { MODELS } from '../../constants/models';
import CommandPalette from '../ui/CommandPalette';
import TokenStatsPanel from '../stats/TokenStatsPanel';

export default function TopBar() {
  const navigate = useNavigate();
  const {
    currentProject, selectedModel, setSelectedModel,
    togglePreview, showPreview,
    toggleSidebar, showSidebar,
    toggleAIPanel, showAIPanel,
    toggleGitPanel, showGitPanel,
    toggleTerminal, showTerminal,
    toggleSearchPanel, showSearchPanel,
    toggleNpmPanel, showNpmPanel,
    toggleStatsPanel, showStatsPanel,
    aiMode, activateAgentMode,
    currentBranch,
    canUndo, canRedo, undo, redo,
    theme, toggleTheme,
  } = useAppStore();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        setShowCommandPalette(v => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Undo/Redo keyboard shortcuts (only when Monaco editor is not focused)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.closest('.monaco-editor')) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) void undo();
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        ((e.shiftKey && e.key === 'Z') || e.key.toLowerCase() === 'y')
      ) {
        e.preventDefault();
        if (canRedo) void redo();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, canRedo, undo, redo]);

  function handleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }

  const handleActivateAgent = useCallback(() => {
    activateAgentMode();
  }, [activateAgentMode]);

  return (
    <>
      <header className="h-12 bg-[var(--bg-secondary)] border-b border-[var(--border-primary)] flex items-center px-3 gap-2 shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center justify-center w-7 h-7 bg-[var(--accent-bg)] rounded-lg">
            <Cpu size={15} className="text-[var(--accent-primary)]" />
          </div>
          <span className="text-sm font-bold text-[var(--text-primary)] tracking-tight">DeepSeek</span>
          <span className="text-xs text-[var(--accent-primary)] font-medium px-1.5 py-0.5 bg-[var(--accent-bg)] rounded-md">Code</span>
        </div>

        {currentProject && (
          <>
            <div className="h-4 w-px bg-[var(--bg-hover)] mx-1" />
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1.5 min-w-0 hover:bg-[var(--bg-tertiary)] px-2 py-1 rounded-lg transition-colors"
              title="返回项目列表"
            >
              <span className="text-xs text-[var(--text-secondary)] truncate max-w-[180px]" title={currentProject.path}>
                {currentProject.name}
              </span>
              {currentProject.techStack?.length > 0 && (
                <span className="text-[10px] text-[var(--accent-primary)] bg-[var(--accent-bg)] px-1.5 rounded shrink-0">
                  {currentProject.techStack[0]}
                </span>
              )}
            </button>
            {currentBranch && (
              <button
                onClick={toggleGitPanel}
                className="flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] px-1.5 py-1 rounded-lg transition-colors shrink-0"
                title="切换分支"
              >
                <GitBranch size={12} />
                <span className="max-w-[100px] truncate">{currentBranch}</span>
              </button>
            )}
          </>
        )}

        <div className="flex-1" />

        {/* Model selector */}
        <div className="flex items-center gap-1.5">
          <Cpu size={13} className="text-[var(--text-secondary)]" />
          <select
            value={selectedModel}
            onChange={e => setSelectedModel(e.target.value)}
            className="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-[var(--accent-primary)] transition-colors cursor-pointer"
          >
            {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>

        <div className="h-4 w-px bg-[var(--bg-hover)] mx-1" />

        {/* Undo/Redo */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => void undo()}
            disabled={!canUndo}
            className={`p-1.5 rounded-lg transition-colors ${canUndo ? 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]' : 'text-[var(--border-primary)] cursor-not-allowed'}`}
            title="撤销 (Ctrl+Z)"
          >
            <Undo2 size={15} />
          </button>
          <button
            onClick={() => void redo()}
            disabled={!canRedo}
            className={`p-1.5 rounded-lg transition-colors ${canRedo ? 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]' : 'text-[var(--border-primary)] cursor-not-allowed'}`}
            title="重做 (Ctrl+Shift+Z)"
          >
            <Redo2 size={15} />
          </button>
        </div>

        <div className="h-4 w-px bg-[var(--bg-hover)] mx-1" />

        {/* Panel toggles */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={toggleSidebar}
            className={`p-1.5 rounded-lg transition-colors text-xs ${showSidebar && !showSearchPanel ? 'text-[var(--accent-primary)] bg-[var(--accent-bg)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'}`}
            title={`${showSidebar ? '隐藏' : '显示'}文件树 (Ctrl+B)`}
          >
            <PanelLeft size={15} />
          </button>
          <button
            onClick={toggleSearchPanel}
            className={`p-1.5 rounded-lg transition-colors ${showSearchPanel ? 'text-[var(--accent-primary)] bg-[var(--accent-bg)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'}`}
            title="全局搜索 (Ctrl+Shift+F)"
          >
            <Search size={15} />
          </button>
          <button
            onClick={togglePreview}
            className={`p-1.5 rounded-lg transition-colors ${showPreview ? 'text-[var(--accent-primary)] bg-[var(--accent-bg)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'}`}
            title={`${showPreview ? '隐藏' : '显示'}预览`}
          >
            <Eye size={15} />
          </button>
          <button
            onClick={toggleAIPanel}
            className={`p-1.5 rounded-lg transition-colors ${showAIPanel ? 'text-[var(--accent-primary)] bg-[var(--accent-bg)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'}`}
            title={`${showAIPanel ? '隐藏' : '显示'} AI 面板`}
          >
            <PanelRight size={15} />
          </button>
          <button
            onClick={handleActivateAgent}
            className={`p-1.5 rounded-lg transition-colors ${showAIPanel && aiMode === 'agent' ? 'text-[var(--purple)] bg-[var(--purple-bg)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'}`}
            title="Agent 模式"
          >
            <Bot size={15} />
          </button>
          <button
            onClick={toggleGitPanel}
            className={`p-1.5 rounded-lg transition-colors ${showGitPanel ? 'text-[var(--accent-primary)] bg-[var(--accent-bg)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'}`}
            title={`${showGitPanel ? '隐藏' : '显示'} Git 面板`}
          >
            <GitBranch size={15} />
          </button>
          <button
            onClick={toggleTerminal}
            className={`p-1.5 rounded-lg transition-colors ${showTerminal ? 'text-[var(--accent-primary)] bg-[var(--accent-bg)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'}`}
            title={`${showTerminal ? '隐藏' : '显示'}终端`}
          >
            <TerminalSquare size={15} />
          </button>
          <button
            onClick={toggleNpmPanel}
            className={`p-1.5 rounded-lg transition-colors ${showNpmPanel ? 'text-[var(--accent-primary)] bg-[var(--accent-bg)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'}`}
            title={`${showNpmPanel ? '隐藏' : '显示'} npm 依赖管理`}
          >
            <Package size={15} />
          </button>
          <button
            onClick={toggleStatsPanel}
            className={`p-1.5 rounded-lg transition-colors ${showStatsPanel ? 'text-[var(--accent-primary)] bg-[var(--accent-bg)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'}`}
            title="Token 使用统计"
          >
            <BarChart3 size={15} />
          </button>
        </div>

        <div className="h-4 w-px bg-[var(--bg-hover)] mx-1" />

        {/* Actions */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
            title={theme === 'dark' ? '切换到亮色主题' : '切换到暗色主题'}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button
            onClick={() => setShowCommandPalette(true)}
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
            title="命令面板 (Ctrl+Shift+P)"
          >
            <CommandIcon size={15} />
          </button>
          <a
            href="https://github.com/iebay/deepseek"
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
            title="GitHub 仓库"
          >
            <Github size={15} />
          </a>
          <button
            onClick={handleFullscreen}
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
            title={isFullscreen ? '退出全屏' : '全屏'}
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <Home size={14} /> 首页
          </button>
        </div>
      </header>
      {showCommandPalette && (
        <CommandPalette onClose={() => setShowCommandPalette(false)} />
      )}
      {showStatsPanel && (
        <TokenStatsPanel onClose={toggleStatsPanel} />
      )}
    </>
  );
}
