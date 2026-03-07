import React from 'react';
import { marked } from 'marked';
import DOMPurify, { type Config as DOMPurifyConfig } from 'dompurify';
import ConfirmCard from './ConfirmCard';

interface ParsedAIResponse {
  files?: { path: string; content: string }[];
  explanation?: string;
}

// Defense-in-depth: strip any XML/DSML tool-call tags that may have slipped through from the backend.
// These are module-level constants so they are not recreated on every render call.
const DSML_TAG_RE = /< *[|\uFF5C]? *DSML *[|\uFF5C]? *[^>]*>[\s\S]*?< *\/ *[|\uFF5C]? *DSML *[|\uFF5C]? *[^>]*>/g;
const TOOL_CALL_TAG_RE = /<\s*(?:function_calls|invoke(?:\s[^>]*)?)>[\s\S]*?<\/\s*(?:function_calls|invoke)\s*>/g;
const PARAMETER_TAG_RE = /<\s*parameter(?:\s[^>]*)?>[\s\S]*?<\/\s*parameter\s*>/g;

// Matches fenced ```json ... ``` code blocks
const JSON_FENCE_RE = /```json\n?([\s\S]*?)```/g;

// Explicit DOMPurify allowlist — defense-in-depth for AI-generated markdown HTML
const DOMPURIFY_CONFIG: DOMPurifyConfig = {
  ALLOWED_TAGS: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'hr', 'div', 'span', 'blockquote',
    'ul', 'ol', 'li',
    'strong', 'em', 'del', 'code', 'pre', 'kbd', 'sup', 'sub',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'a',
  ],
  ALLOWED_ATTR: ['class', 'href', 'target', 'rel', 'id'],
  ALLOWED_URI_REGEXP: /^(?:https?|mailto):/i,
  FORCE_BODY: true,
};

// Placeholder prefix used to splice ConfirmCards into the markdown stream
const PLACEHOLDER_PREFIX = 'CONFIRM_CARD_PLACEHOLDER_';

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
  // knownPaths and onOpenFile are kept for API compatibility with existing callers.
  // With marked rendering, clickable file-path links are no longer injected inline.
  void knownPaths;
  void onOpenFile;

  // Step 1: sanitize DSML/tool-call tags
  const sanitized = content
    .replace(DSML_TAG_RE, '')
    .replace(TOOL_CALL_TAG_RE, '')
    .replace(PARAMETER_TAG_RE, '')
    .trimEnd();

  // Step 2: extract ```json blocks that contain a "files" array and replace them with
  // unique text placeholders so that marked does not try to render them as markdown.
  const confirmCards = new Map<string, React.ReactElement>();
  let cardIndex = 0;

  const processed = (onApplyFile && onApplyAll && appliedFiles)
    ? sanitized.replace(JSON_FENCE_RE, (fullMatch, jsonContent: string) => {
        try {
          const parsed = JSON.parse(jsonContent.trim()) as ParsedAIResponse;
          if (parsed.files && Array.isArray(parsed.files) && parsed.files.length > 0) {
            const key = `${PLACEHOLDER_PREFIX}${cardIndex}`;
            const allApplied = parsed.files.every(f => appliedFiles.has(f.path));
            confirmCards.set(key, (
              <ConfirmCard
                files={parsed.files}
                appliedFiles={appliedFiles}
                onApplyFile={onApplyFile}
                onApplyAll={onApplyAll}
                allApplied={allApplied}
                explanation={parsed.explanation}
              />
            ));
            cardIndex++;
            // Wrap in blank lines so marked treats the placeholder as its own paragraph
            return `\n\n${key}\n\n`;
          }
        } catch {
          // Not a valid file-changes JSON block — leave it unchanged for marked to render
        }
        return fullMatch;
      })
    : sanitized;

  // Step 3: if there are no ConfirmCards just render the whole thing as markdown
  if (confirmCards.size === 0) {
    return [renderMarkdown(processed, 0)];
  }

   // Step 4: split on placeholders, render markdown segments and inject ConfirmCards
  const parts: React.ReactNode[] = [];
  // The split regex captures the numeric suffix so odd-indexed elements are the card numbers
  const segments = processed.split(new RegExp(`${PLACEHOLDER_PREFIX}(\\d+)`)); // 只保留一个 segments 声明，并删除多余或未定义的代码行

  for (let i = 0; i < segments.length; i++) {
    if (i % 2 === 0) {
      // Markdown text segment
      const text = segments[i];
      if (text.trim()) {
        parts.push(renderMarkdown(text, parts.length));
      }
    } else {
      // ConfirmCard
      const cardKey = `${PLACEHOLDER_PREFIX}${segments[i]}`;
      const card = confirmCards.get(cardKey);
      if (card) {
        parts.push(React.cloneElement(card, { key: `confirm-${parts.length}` }));
      }
    }
  }

  return parts.length > 0 ? parts : [renderMarkdown(processed, 0)];
}

function renderMarkdown(text: string, index: number): React.ReactNode {
  const html = DOMPurify.sanitize(marked.parse(text) as string, DOMPURIFY_CONFIG);
  return (
    <div
      key={`md-${index}`}
      className="markdown-content"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
