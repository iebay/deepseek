import { useCallback, useEffect, useRef } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProjectSelector from './components/home/ProjectSelector';
import TopBar from './components/layout/TopBar';
import FileTree from './components/fileTree/FileTree';
import CodeEditor from './components/editor/CodeEditor';
import ChatPanel from './components/chat/ChatPanel';
import LivePreview from './components/preview/LivePreview';
import Toast from './components/ui/Toast';
import { useAppStore } from './store/appStore';

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
    showPreview, showSidebar, showAIPanel,
    sidebarWidth, aiPanelWidth,
    setSidebarWidth, setAIPanelWidth,
    toggleSidebar, toggleAIPanel,
    openTabs, activeTabPath,
  } = useAppStore();

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        toggleSidebar();
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
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        {/* Left: File Tree */}
        {showSidebar && (
          <>
            <aside
              className="shrink-0 border-r border-[#30363d] bg-[#0d1117] overflow-hidden transition-all duration-200"
              style={{ width: sidebarWidth }}
            >
              <FileTree />
            </aside>
            <ResizeDivider onResize={handleSidebarResize} />
          </>
        )}

        {/* Center: Code Editor */}
        <main className="flex-1 overflow-hidden min-w-0">
          <CodeEditor />
        </main>

        {/* Center-right: Preview (optional) */}
        {showPreview && (
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
            <ResizeDivider onResize={handleAIPanelResize} />
            <aside
              className="shrink-0 border-l border-[#30363d] overflow-hidden transition-all duration-200"
              style={{ width: aiPanelWidth }}
            >
              <ChatPanel />
            </aside>
          </>
        )}

        {/* Collapsed panel toggles */}
        {!showAIPanel && (
          <button
            onClick={toggleAIPanel}
            className="w-6 shrink-0 border-l border-[#30363d] bg-[#161b22] hover:bg-[#21262d] flex items-center justify-center text-[#8b949e] hover:text-[#e6edf3] transition-colors"
            title="展开 AI 面板"
          >
            <span className="text-[10px] rotate-90 whitespace-nowrap">AI</span>
          </button>
        )}
      </div>
      <Toast />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ProjectSelector />} />
      <Route path="/editor" element={<EditorLayout />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
