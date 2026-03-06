import { useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import EditorTabs from './EditorTabs';
import { useAppStore } from '../../store/appStore';
import { saveFile } from '../../api/filesApi';
import { FileCode, ChevronRight, Keyboard, Sparkles, FolderOpen, Search } from 'lucide-react';

function getLanguage(filename: string): string {
  const ext = filename.split('.').pop() || '';
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    css: 'css', scss: 'scss', html: 'html', json: 'json', md: 'markdown',
    py: 'python', go: 'go', rs: 'rust', yaml: 'yaml', yml: 'yaml',
    sh: 'shell', bash: 'shell', prisma: 'prisma', graphql: 'graphql',
  };
  return map[ext] || 'plaintext';
}

function getLanguageLabel(filename: string): string {
  const ext = filename.split('.').pop() || '';
  const map: Record<string, string> = {
    ts: 'TypeScript', tsx: 'TypeScript JSX', js: 'JavaScript', jsx: 'JavaScript JSX',
    css: 'CSS', scss: 'SCSS', html: 'HTML', json: 'JSON', md: 'Markdown',
    py: 'Python', go: 'Go', rs: 'Rust', yaml: 'YAML', yml: 'YAML',
    sh: 'Shell', bash: 'Bash', txt: 'Plain Text',
  };
  return map[ext] || ext.toUpperCase() || 'Plain Text';
}

function Breadcrumb({ path }: { path: string }) {
  const parts = path.split('/').filter(Boolean);
  return (
    <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-[#30363d] bg-[#161b22] text-xs text-[#8b949e] overflow-x-auto whitespace-nowrap shrink-0">
      {parts.map((part, i) => (
        <span key={i} className="flex items-center gap-0.5">
          {i > 0 && <ChevronRight size={11} className="text-[#6e7681]" />}
          <span className={i === parts.length - 1 ? 'text-[#e6edf3]' : ''}>{part}</span>
        </span>
      ))}
    </div>
  );
}

function StatusBar({ filename, line, column }: { filename: string; line: number; column: number }) {
  return (
    <div className="h-6 bg-[#161b22] border-t border-[#30363d] flex items-center px-3 gap-4 shrink-0">
      <div className="flex items-center gap-1.5 text-[10px] text-[#8b949e]">
        <FileCode size={10} />
        <span>{getLanguageLabel(filename)}</span>
      </div>
      <div className="flex items-center gap-0.5 text-[10px] text-[#8b949e]">
        <span>行 {line}</span>
        <span className="text-[#6e7681]">,</span>
        <span>列 {column}</span>
      </div>
      <div className="flex-1" />
      <span className="text-[10px] text-[#6e7681]">UTF-8</span>
    </div>
  );
}

function EmptyState() {
  const shortcuts = [
    { keys: 'Ctrl+S', desc: '保存文件' },
    { keys: 'Ctrl+P', desc: '搜索文件' },
    { keys: 'Ctrl+B', desc: '切换侧栏' },
    { keys: 'Shift+Enter', desc: 'AI 多行输入' },
  ];
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center max-w-sm px-6">
        <div className="w-16 h-16 bg-[#388bfd]/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <FileCode size={28} className="text-[#388bfd]" />
        </div>
        <h3 className="text-[#e6edf3] font-semibold mb-1.5">选择文件开始编辑</h3>
        <p className="text-[#8b949e] text-sm mb-6 leading-relaxed">
          从左侧文件树选择文件，或使用 AI 助手生成代码
        </p>
        <div className="grid grid-cols-2 gap-2 mb-5">
          {shortcuts.map(({ keys, desc }) => (
            <div key={keys} className="flex items-center gap-2 bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2 text-left">
              <Keyboard size={12} className="text-[#388bfd] shrink-0" />
              <div>
                <div className="text-[10px] font-mono text-[#e6edf3]">{keys}</div>
                <div className="text-[10px] text-[#6e7681]">{desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-4 text-xs text-[#6e7681]">
          <div className="flex items-center gap-1.5">
            <FolderOpen size={12} className="text-[#d29922]" />
            <span>浏览项目文件</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Sparkles size={12} className="text-[#388bfd]" />
            <span>AI 智能生成</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Search size={12} className="text-[#8b949e]" />
            <span>快速搜索</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CodeEditor() {
  const { openTabs, activeTabPath, updateTabContent, showToast } = useAppStore();
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });

  const activeTab = openTabs.find(t => t.path === activeTabPath);

  async function handleSave(path: string, content: string) {
    try {
      await saveFile(path, content);
      updateTabContent(path, content, false);
      showToast('文件已保存', 'success');
    } catch (e) {
      showToast(`保存失败: ${e instanceof Error ? e.message : String(e)}`, 'error');
    }
  }

  function handleChange(value: string | undefined) {
    if (!activeTabPath || value === undefined) return;
    updateTabContent(activeTabPath, value, true);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      handleSave(activeTabPath, value);
    }, 2000);
  }

  function handleEditorMount(editorInstance: editor.IStandaloneCodeEditor) {
    editorRef.current = editorInstance;
    editorInstance.onDidChangeCursorPosition((e) => {
      setCursor({ line: e.position.lineNumber, column: e.position.column });
    });
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (activeTab) handleSave(activeTab.path, activeTab.content);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeTab]);

  return (
    <div className="flex flex-col h-full">
      <EditorTabs />
      {activeTab ? (
        <>
          <Breadcrumb path={activeTab.path} />
          <div className="flex-1 min-h-0">
            <Editor
              key={activeTab.path}
              height="100%"
              language={getLanguage(activeTab.name)}
              value={activeTab.content}
              onChange={handleChange}
              onMount={handleEditorMount}
              theme="vs-dark"
              options={{
                fontSize: 14,
                fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace',
                fontLigatures: true,
                minimap: { enabled: true },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                wordWrap: 'on',
                lineNumbers: 'on',
                renderLineHighlight: 'line',
                smoothScrolling: true,
                cursorBlinking: 'smooth',
                padding: { top: 8 },
              }}
            />
          </div>
          <StatusBar filename={activeTab.name} line={cursor.line} column={cursor.column} />
        </>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}