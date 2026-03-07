import { useCallback, useEffect, useRef } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProjectSelector from './components/home/ProjectSelector';
import ProjectList from './components/home/ProjectList';
import TopBar from './components/layout/TopBar';
import FileTree from './components/fileTree/FileTree';
import SearchPanel from './components/search/SearchPanel';
import CodeEditor from './components/editor/CodeEditor';
import UnifiedAIPanel from './components/ai/UnifiedAIPanel';
import GitPanel from './components/git/GitPanel';
import LivePreview from './components/preview/LivePreview';
import Toast from './components/ui/Toast';
import ErrorBoundary from './components/ui/ErrorBoundary';
import OfflineIndicator from './components/ui/OfflineIndicator';
import Terminal from './components/terminal/Terminal';
import NpmPanel from './components/npm/NpmPanel';
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
      className={`w-1 shrink-0 cursor-col-resize hover:bg-[var(--accent-primary)]/50 active:bg-[var(--accent-primary)] transition-colors ${className}`}
      onMouseDown={onMouseDown}
    />
  );
}

function EditorLayout() {
  const {
    showPreview, showSidebar, showAIPanel, showGitPanel, showTerminal,
    showSearchPanel, toggleSearchPanel,
    showNpmPanel,
    sidebarWidth, aiPanelWidth,
    setSidebarWidth, setAIPanelWidth,
    toggleSidebar, toggleAIPanel,
    openTabs, activeTabPath,
  } = useAppStore();

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
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        toggleSearchPanel();
      }
      if (e.key === 'Escape' && showSearchPanel) {
        toggleSearchPanel();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleSidebar, toggleSearchPanel, showSearchPanel]);

  const handleSidebarResize = useCallback((delta: number) => {
    setSidebarWidth(Math.max(160, Math.min(480, sidebarWidth + delta)));
  }, [sidebarWidth, setSidebarWidth]);

  const handleAIPanelResize = useCallback((delta: number) => {
    setAIPanelWidth(Math.max(240, Math.min(600, aiPanelWidth - delta)));
  }, [aiPanelWidth, setAIPanelWidth]);

  return (
    <div className="flex flex-col h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <OfflineIndicator />
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        {/* Left: File Tree / Search Panel */}
        {showSidebar && (
          <>
            <aside
              className="shrink-0 border-r border-[var(--border-primary)] bg-[var(--bg-primary)] overflow-hidden transition-all duration-200"
              style={{ width: sidebarWidth }}
            >
              <ErrorBoundary>
                {showSearchPanel ? <SearchPanel /> : <FileTree />}
              </ErrorBoundary>
            </aside>
            <ResizeDivider onResize={handleSidebarResize} />
          </>
        )}
        {/* Search panel when sidebar is hidden */}
        {!showSidebar && showSearchPanel && (
          <>
            <aside
              className="shrink-0 border-r border-[var(--border-primary)] bg-[var(--bg-primary)] overflow-hidden transition-all duration-200"
              style={{ width: sidebarWidth }}
            >
              <ErrorBoundary>
                <SearchPanel />
              </ErrorBoundary>
            </aside>
            <ResizeDivider onResize={handleSidebarResize} />
          </>
        )}

        {/* Center: Code Editor */}
        <main className="flex-1 overflow-hidden min-w-0">
          <ErrorBoundary>
            <CodeEditor />
          </ErrorBoundary>
        </main>

        {/* Center-right: Preview (optional) */}
        {showPreview && (
          <>
            <ResizeDivider onResize={(d) => setSidebarWidth(Math.max(160, sidebarWidth + d))} />
            <div className="w-[38%] shrink-0 border-l border-[var(--border-primary)] overflow-hidden">
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

        {/* Right: AI Panel (Chat + Agent unified) */}
        {showAIPanel && (
          <>
            <ResizeDivider onResize={handleAIPanelResize} />
            <aside
              className="shrink-0 border-l border-[var(--border-primary)] overflow-hidden transition-all duration-200"
              style={{ width: aiPanelWidth }}
            >
              <ErrorBoundary>
                <UnifiedAIPanel />
              </ErrorBoundary>
            </aside>
          </>
        )}
        {/* Right: Git Panel */}
        {showGitPanel && (
          <>
            <ResizeDivider onResize={handleAIPanelResize} />
            <aside
              className="shrink-0 border-l border-[var(--border-primary)] overflow-hidden relative transition-all duration-200"
              style={{ width: aiPanelWidth }}
            >
              <ErrorBoundary>
                <GitPanel />
              </ErrorBoundary>
            </aside>
          </>
        )}

        {/* Right: npm Panel */}
        {showNpmPanel && (
          <>
            <ResizeDivider onResize={handleAIPanelResize} />
            <aside
              className="shrink-0 border-l border-[var(--border-primary)] overflow-hidden relative transition-all duration-200"
              style={{ width: aiPanelWidth }}
            >
              <ErrorBoundary>
                <NpmPanel />
              </ErrorBoundary>
            </aside>
          </>
        )}

        {/* Collapsed panel toggles */}
        {!showAIPanel && (
          <button
            onClick={toggleAIPanel}
            className="w-6 shrink-0 border-l border-[var(--border-primary)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            title="展开 AI 面板"
          >
            <span className="text-[10px] rotate-90 whitespace-nowrap">AI</span>
          </button>
        )}
      </div>

      {/* Bottom: Terminal */}
      {showTerminal && (
        <div className="h-52 shrink-0 border-t border-[var(--border-primary)] overflow-hidden">
          <ErrorBoundary>
            <Terminal />
          </ErrorBoundary>
        </div>
      )}

      <Toast />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<ProjectList />} />
        <Route path="/classic" element={<ProjectSelector />} />
        <Route path="/editor" element={<EditorLayout />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
