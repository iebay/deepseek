import { useCallback, useEffect, useRef, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProjectSelector from './components/home/ProjectSelector';
import TopBar from './components/layout/TopBar';
import FileTree from './components/fileTree/FileTree';
import CodeEditor from './components/editor/CodeEditor';
import ChatPanel from './components/chat/ChatPanel';
import GitPanel from './components/git/GitPanel';
import LivePreview from './components/preview/LivePreview';
import Toast from './components/ui/Toast';
import OfflineIndicator from './components/ui/OfflineIndicator';
import CommandPalette from './components/ui/CommandPalette';
import Terminal from './components/terminal/Terminal';
import ErrorBoundary from './components/ui/ErrorBoundary';
import { useAppStore } from './store/appStore';
import { useIsMobile } from './hooks/useMediaQuery';

function ResizeDivider({ onResize, className = '' }: { onResize: (delta: number) => void; className?: string }) {
  const dragging = useRef(false);
  const startX = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startX.current = e.clientX;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = e.clientX - startX.current;
      startX.current = e.clientX;
      onResize(delta);
    };
    const onMouseUp = () => {
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [onResize]);

  return (
    <div
      className={`w-1 shrink-0 cursor-col-resize hover:bg-[#388bfd]/50 active:bg-[#388bfd] transition-colors ${className}`}
      onMouseDown={onMouseDown}
    />
  );
}

function EditorLayout() {
  const {
    showPreview, showSidebar, showAIPanel, showGitPanel, showTerminal,
    sidebarWidth, aiPanelWidth,
    setSidebarWidth, setAIPanelWidth,
    toggleSidebar, toggleAIPanel,
    openTabs, activeTabPath,
  } = useAppStore();

  const isMobile = useIsMobile();
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      const hasDirtyTabs = openTabs.some(t => t.isDirty);
      if (hasDirtyTabs) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [openTabs]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        setCmdPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleSidebar]);

  const handleSidebarResize = useCallback((delta: number) => {
    setSidebarWidth(Math.max(160, Math.min(480, sidebarWidth + delta)));
  }, [sidebarWidth, setSidebarWidth]);

  const handleAIPanelResize = useCallback((delta: number) => {
    setAIPanelWidth(Math.max(240, Math.min(600, aiPanelWidth - delta)));
  }, [aiPanelWidth, setAIPanelWidth]);

  return (
    <div className="flex flex-col h-screen bg-[#0d1117] text-[#e6edf3]">
      <OfflineIndicator />
      <TopBar onOpenCommandPalette={() => setCmdPaletteOpen(true)} />
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left: File Tree */}
        {showSidebar && (
          <>
            <aside
              className={`border-r border-[#30363d] bg-[#0d1117] overflow-hidden transition-all duration-200 ${
                isMobile ? 'absolute inset-y-0 left-0 z-40' : 'shrink-0'
              }`}
              style={{ width: isMobile ? Math.min(sidebarWidth, window.innerWidth * 0.8) : sidebarWidth }}
            >
              <ErrorBoundary>
                <FileTree />
              </ErrorBoundary>
            </aside>
            {isMobile && (
              <div
                className="absolute inset-0 z-30 bg-black/50"
                onClick={toggleSidebar}
              />
            )}
            {!isMobile && <ResizeDivider onResize={handleSidebarResize} />}
          </>
        )}

        {/* Center + right panels */}
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          <div className="flex flex-1 overflow-hidden">
            {/* Center: Code Editor */}
            <main className="flex-1 overflow-hidden min-w-0">
              <ErrorBoundary>
                <CodeEditor />
              </ErrorBoundary>
            </main>

            {/* Center-right: Preview (optional, hidden on mobile) */}
            {showPreview && !isMobile && (
              <>
                <ResizeDivider onResize={(d) => setSidebarWidth(Math.max(160, sidebarWidth + d))} />
                <div className="w-[38%] shrink-0 border-l border-[#30363d] overflow-hidden">
                  {(() => {
                    const activeTab = openTabs.find((t) => t.path === activeTabPath);
                    const isHtml = activeTab?.path?.match(/\.html?$/i);
                    return (
                      <LivePreview
                        srcDoc={isHtml ? activeTab?.content : undefined}
                      />
                    );
                  })()}
                </div>
              </>
            )}

            {/* Right: Chat Panel */}
            {showAIPanel && (
              <>
                {!isMobile && <ResizeDivider onResize={handleAIPanelResize} />}
                <aside
                  className={`border-l border-[#30363d] overflow-hidden transition-all duration-200 ${
                    isMobile ? 'absolute inset-0 z-40 w-full' : 'shrink-0'
                  }`}
                  style={isMobile ? undefined : { width: aiPanelWidth }}
                >
                  <ErrorBoundary>
                    <ChatPanel />
                  </ErrorBoundary>
                </aside>
                {isMobile && (
                  <div
                    className="absolute inset-0 z-30 bg-black/50"
                    onClick={toggleAIPanel}
                  />
                )}
              </>
            )}

            {/* Right: Git Panel */}
            {showGitPanel && !isMobile && (
              <>
                <ResizeDivider onResize={handleAIPanelResize} />
                <aside
                  className="shrink-0 border-l border-[#30363d] overflow-hidden relative transition-all duration-200"
                  style={{ width: aiPanelWidth }}
                >
                  <ErrorBoundary>
                    <GitPanel />
                  </ErrorBoundary>
                </aside>
              </>
            )}

            {/* Collapsed panel toggles */}
            {!showAIPanel && !isMobile && (
              <button
                onClick={toggleAIPanel}
                className="w-6 shrink-0 border-l border-[#30363d] bg-[#161b22] hover:bg-[#21262d] flex items-center justify-center text-[#8b949e] hover:text-[#e6edf3] transition-colors"
                title="展开 AI 面板"
              >
                <span className="text-[10px] rotate-90 whitespace-nowrap">AI</span>
              </button>
            )}
          </div>

          {/* Bottom: Terminal */}
          {showTerminal && (
            <div className="h-48 shrink-0 border-t border-[#30363d] overflow-hidden">
              <Terminal />
            </div>
          )}
        </div>
      </div>
      <Toast />
      <CommandPalette open={cmdPaletteOpen} onClose={() => setCmdPaletteOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<ProjectSelector />} />
        <Route path="/editor" element={<EditorLayout />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
