import { Routes, Route, Navigate } from 'react-router-dom';
import ProjectSelector from './components/home/ProjectSelector';
import TopBar from './components/layout/TopBar';
import FileTree from './components/fileTree/FileTree';
import CodeEditor from './components/editor/CodeEditor';
import ChatPanel from './components/chat/ChatPanel';
import LivePreview from './components/preview/LivePreview';
import { useAppStore } from './store/appStore';

function EditorLayout() {
  const { showPreview } = useAppStore();

  return (
    <div className="flex flex-col h-screen bg-[#0d1117] text-[#e6edf3]">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        {/* Left: File Tree */}
        <aside className="w-56 shrink-0 border-r border-[#30363d] bg-[#0d1117] overflow-hidden">
          <FileTree />
        </aside>

        {/* Center: Code Editor */}
        <main className={`flex-1 overflow-hidden ${showPreview ? 'border-r border-[#30363d]' : ''}`}>
          <CodeEditor />
        </main>

        {/* Center-right: Preview (optional) */}
        {showPreview && (
          <div className="w-[40%] shrink-0 border-r border-[#30363d] overflow-hidden">
            <LivePreview />
          </div>
        )}

        {/* Right: Chat Panel */}
        <aside className="w-80 shrink-0 border-l border-[#30363d] overflow-hidden">
          <ChatPanel />
        </aside>
      </div>
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
