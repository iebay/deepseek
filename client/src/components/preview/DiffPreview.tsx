import { DiffEditor } from '@monaco-editor/react';

interface DiffPreviewProps {
  original: string;
  modified: string;
  language?: string;
  filename?: string;
}

export default function DiffPreview({ original, modified, language = 'typescript', filename }: DiffPreviewProps) {
  return (
    <div className="flex flex-col h-full bg-[#0d1117]">
      {filename && (
        <div className="px-3 py-2 border-b border-[#30363d] text-xs text-[#8b949e] shrink-0">
          差异对比: <span className="text-[#e6edf3]">{filename}</span>
        </div>
      )}
      <div className="flex-1">
        <DiffEditor
          original={original}
          modified={modified}
          language={language}
          theme="vs-dark"
          options={{
            readOnly: true,
            fontSize: 13,
            fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            wordWrap: 'on',
            renderSideBySide: true,
          }}
        />
      </div>
    </div>
  );
}
