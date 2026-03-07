import React from 'react';
import CodeBlock from './CodeBlock';
import ConfirmCard from './ConfirmCard';

interface ParsedAIResponse {
  files?: { path: string; content: string }[];
  explanation?: string;
}

// Defense-in-depth: strip any XML/DSML tool-call tags that may have slipped through from the backend.
// These are module-level constants so they are not recreated on every render call.
const DSML_TAG_RE = /< *\|? *DSML *\|? *[^>]*>[\s\S]*?< *\/ *\|? *DSML *\|? *[^>]*>/g;
const TOOL_CALL_TAG_RE = /<\s*(?:function_calls|invoke(?:\s[^>]*)?)>[\s\S]*?<\/\s*(?:function_calls|invoke)\s*>/g;
const PARAMETER_TAG_RE = /<\s*parameter(?:\s[^>]*)?>[\s\S]*?<\/\s*parameter\s*>/g;

export function renderInline(
  text: string,
  knownPaths?: Set<string>,
  onOpenFile?: (path: string) => void,
): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-[var(--text-primary)]">{part.slice(2, -2)}</strong>;
    }
    const codeParts = part.split(/(`[^`]+`)/g);
    return codeParts.map((cp, j) => {
      if (cp.startsWith('`') && cp.endsWith('`')) {
        const inner = cp.slice(1, -1);
        if (knownPaths && onOpenFile && knownPaths.has(inner)) {
          return (
            <button
              key={j}
              onClick={() => onOpenFile(inner)}
              className="px-1 py-0.5 bg-[var(--bg-tertiary)] rounded text-[var(--accent-primary)] text-[11px] font-mono hover:underline cursor-pointer"
              title={`在编辑器中打开 ${inner}`}
            >
              {inner}
            </button>
          );
        }
        return <code key={j} className="px-1 py-0.5 bg-[var(--bg-tertiary)] rounded text-[var(--text-primary)] text-[11px] font-mono">{inner}</code>;
      }
      return cp;
    });
  });
}

export function renderContent(
  content: string,
  onApplyFile?: (f: { path: string; content: string }) => Promise<void>,
  onApplyAll?: () => Promise<void>,
  appliedFiles?: Set<string>,
  knownPaths?: Set<string>,
  onOpenFile?: (path: string) => void,
): React.ReactNode[] {
  const sanitized = content
    .replace(DSML_TAG_RE, '')
    .replace(TOOL_CALL_TAG_RE, '')
    .replace(PARAMETER_TAG_RE, '')
    .trimEnd();

  const parts: React.ReactNode[] = [];
  const codeRegex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;
  let partIndex = 0;

  while ((match = codeRegex.exec(sanitized)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <span key={`text-${partIndex++}`} className="whitespace-pre-wrap">
          {renderInline(sanitized.slice(lastIndex, match.index), knownPaths, onOpenFile)}
        </span>
      );
    }

    const lang = match[1];
    const code = match[2].trim();

    if (lang === 'json' && onApplyFile && onApplyAll && appliedFiles) {
      try {
        const parsed = JSON.parse(code) as ParsedAIResponse;
        if (parsed.files && Array.isArray(parsed.files) && parsed.files.length > 0) {
          const allApplied = parsed.files.every(f => appliedFiles.has(f.path));
          parts.push(
            <ConfirmCard
              key={`confirm-${partIndex++}`}
              files={parsed.files}
              appliedFiles={appliedFiles}
              onApplyFile={onApplyFile}
              onApplyAll={onApplyAll}
              allApplied={allApplied}
              explanation={parsed.explanation}
            />
          );
          lastIndex = match.index + match[0].length;
          continue;
        }
      } catch {
        // not a valid file changes JSON, render as code block
        console.debug('JSON code block is not a file changes response');
      }
    }

    parts.push(
      <CodeBlock key={`code-${partIndex++}`} language={lang} code={code} />
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < sanitized.length) {
    parts.push(
      <span key={`text-${partIndex++}`} className="whitespace-pre-wrap">
        {renderInline(sanitized.slice(lastIndex), knownPaths, onOpenFile)}
      </span>
    );
  }

  return parts;
}
