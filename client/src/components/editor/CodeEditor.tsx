import { useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import EditorTabs from './EditorTabs';
import { useAppStore } from '../../store/appStore';
import { saveFile } from '../../api/filesApi';

export default function CodeEditor() {
  const { openTabs, activeTabPath, updateTabContent } = useAppStore();
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeTab = openTabs.find(t => t.path === activeTabPath);

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

  async function handleSave(path: string, content: string) {
    try {
      await saveFile(path, content);
      updateTabContent(path, content, false);
    } catch (e) { console.error('Save failed', e); }
  }

  function handleChange(value: string | undefined) {
    if (!activeTabPath || value === undefined) return;
    updateTabContent(activeTabPath, value, true);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      handleSave(activeTabPath, value);
    }, 2000);
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
        <div className="flex-1">
          <Editor
            key={activeTab.path}
            height="100%"
            language={getLanguage(activeTab.name)}
            value={activeTab.content}
            onChange={handleChange}
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
            }}
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-[#6e7681] text-sm">
          <div className="text-center">
            <p className="mb-2">从左侧文件树选择文件打开</p>
            <p className="text-xs">或在右侧 AI 面板输入需求，让 DeepSeek 帮你修改代码</p>
          </div>
        </div>
      )}
    </div>
  );
}