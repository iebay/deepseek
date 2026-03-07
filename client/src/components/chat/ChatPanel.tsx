import { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Bot, User, Trash2, Sparkles, AlertCircle, Download, StopCircle, Brain, MessageSquare, Cpu } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { streamAIChat, streamSmartChat } from '../../api/aiApi';
import { batchWriteFiles, fetchFileContent } from '../../api/filesApi';
import type { ChatMessage, MultimodalContentPart, FileNode } from '../../types';
import SuggestionCards from './SuggestionCards';
import ImageUpload, { type UploadedImage } from './ImageUpload';
import ChatHistory, { ChatHistoryButton } from './ChatHistory';
import ToolTrace, { type ToolAction } from './ToolTrace';
import { recordTokenUsage } from '../../api/statsApi';
import { formatCost, formatTokens } from '../../utils/formatStats';
import { MODELS } from '../../constants/models';
import TypingDots from './TypingDots';
import { renderContent } from './renderContent';
import { formatTime, exportChatAsMarkdown } from './chatUtils';

interface ParsedAIResponse {
  files?: { path: string; content: string }[];
  explanation?: string;
}

function tryParseFileChanges(text: string): ParsedAIResponse | null {
  const match = text.match(/```json\s*([\s\S]*?)```/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as ParsedAIResponse;
  } catch {
    return null;
  }
}

function MessageBubble({
  msg,
  onApplyFile,
  onApplyAll,
  appliedFiles,
  toolActions,
  isToolLoading,
}: {
  msg: ChatMessage;
  onApplyFile?: (f: { path: string; content: string }) => Promise<void>;
  onApplyAll?: () => Promise<void>;
  appliedFiles?: Set<string>;
  toolActions?: ToolAction[];
  isToolLoading?: boolean;
}) {
  const isUser = msg.role === 'user';

  function renderUserContent() {
    if (typeof msg.content === 'string') {
      return <span className="whitespace-pre-wrap">{msg.content}</span>;
    }
    // Multimodal content
    return (
      <div className="space-y-2">
        {msg.content.map((part, i) => {
          if (part.type === 'text') {
            return <span key={i} className="whitespace-pre-wrap">{part.text}</span>;
          }
          if (part.type === 'image_url' && part.image_url) {
            return (
              <img key={i} src={part.image_url.url} alt="attached" className="max-w-full rounded-lg border border-[var(--border-primary)]" style={{ maxHeight: 200 }} />
            );
          }
          return null;
        })}
      </div>
    );
  }

  const textContent = typeof msg.content === 'string' ? msg.content : (msg.content.find(p => p.type === 'text')?.text ?? '');

  return (
    <div className={`flex gap-2.5 mb-4 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${isUser ? 'bg-[var(--accent-primary)]' : 'bg-gradient-to-br from-[#238636] to-[#2ea043]'}`}>
        {isUser ? <User size={13} /> : <Bot size={13} />}
      </div>
      <div className={`max-w-[85%] min-w-0 ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        {!isUser && (toolActions || isToolLoading) && (
          <ToolTrace actions={toolActions ?? []} isLoading={isToolLoading} />
        )}
        <div className={`rounded-xl px-3 py-2 text-sm break-words overflow-hidden w-full ${isUser ? 'bg-[var(--accent-bg)] text-[var(--text-primary)] rounded-tr-sm' : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-primary)] rounded-tl-sm'}`}>
          {isUser ? (
            renderUserContent()
          ) : (
            <div className="leading-relaxed">
              {renderContent(textContent, onApplyFile, onApplyAll, appliedFiles)}
            </div>
          )}
        </div>
        {msg.timestamp && (
          <span className="text-[10px] text-[var(--text-tertiary)] px-1">{formatTime(msg.timestamp)}</span>
        )}
      </div>
    </div>
  );
}

function extractFilePaths(text: string, tree: FileNode | null): string[] {
  if (!tree) return [];

  // File extensions recognized for context extraction
  const FILE_EXT_PATTERN = 'tsx?|jsx?|css|html|json|md|py|go|rs';

  const paths: string[] = [];
  const pathRegex = new RegExp(
    `(?:^|\\s|\`)((?:\\./|src/|server/|client/)?[\\w\\-\\.\\/]+\\.(?:${FILE_EXT_PATTERN}))`,
    'gi'
  );
  let match;
  while ((match = pathRegex.exec(text)) !== null) {
    paths.push(match[1]);
  }

  // Also match bare file names (e.g. "App.tsx") and look them up in the file tree
  const fileNameRegex = new RegExp(`\\b([\\w\\-]+\\.(?:${FILE_EXT_PATTERN}))\\b`, 'gi');
  while ((match = fileNameRegex.exec(text)) !== null) {
    const fileName = match[1];
    const fullPath = findFileInTree(tree, fileName);
    if (fullPath && !paths.includes(fullPath)) {
      paths.push(fullPath);
    }
  }

  return [...new Set(paths)];
}

function findFileInTree(node: FileNode | null, fileName: string): string | null {
  if (!node) return null;
  if (node.type === 'file' && node.name === fileName) return node.path;
  if (node.children) {
    for (const child of node.children) {
      const found = findFileInTree(child, fileName);
      if (found) return found;
    }
  }
  return null;
}

// Client-side price estimates for immediate UI display only.
// The server does the authoritative cost calculation when recording usage.
function getModelPrices(model: string): { inputPrice: number; outputPrice: number } {
  // Default prices per 1K tokens (USD) — must match DEEPSEEK_CHAT_INPUT/OUTPUT_PRICE defaults
  if (model === 'deepseek-reasoner') return { inputPrice: 0.00055, outputPrice: 0.00219 };
  return { inputPrice: 0.00014, outputPrice: 0.00028 };
}

export default function ChatPanel() {
  const {
    chatMessages, addChatMessage, updateLastAssistantMessage,
    clearChat, isAiLoading, setAiLoading, selectedModel,
    currentProject, fileTree, activeTabPath, openTabs,
    showToast, pushOperation, smartMode, toggleSmartMode,
    aiMode, setAiMode,
  } = useAppStore();

  const [input, setInput] = useState('');
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [elapsed, setElapsed] = useState<number>(0);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [appliedFiles, setAppliedFiles] = useState<Set<string>>(new Set());
  const [lastUsage, setLastUsage] = useState<{ tokens: number; cost: number } | null>(null);
  // Map from message index → tool actions for that assistant message
  // TODO: Consider useReducer for messageToolActions to avoid frequent Map copies on each tool call
  const [messageToolActions, setMessageToolActions] = useState<Map<number, ToolAction[]>>(new Map());
  // Index of the currently-loading assistant message (for live tool trace)
  const [loadingMsgIndex, setLoadingMsgIndex] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Auto-resize textarea (up to 5 lines)
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  // Timer for response time
  useEffect(() => {
    if (isAiLoading) {
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 100) / 10);
      }, 100);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isAiLoading]);

  const fileTreeText = useMemo(() => {
    if (!fileTree) return '';
    function walk(n: typeof fileTree, depth: number): string {
      if (!n) return '';
      const indent = '  '.repeat(depth);
      if (n.type === 'directory') {
        return [
          `${indent}${n.name}/`,
          ...(n.children?.map(c => walk(c, depth + 1)) ?? []),
        ].join('\n');
      }
      return `${indent}${n.name}`;
    }
    return walk(fileTree, 0);
  }, [fileTree]);

  async function handleSend(text?: string) {
    const msgText = (text ?? input).trim();
    if ((!msgText && images.length === 0) || isAiLoading) return;
    setInput('');
    const pendingImages = [...images];
    setImages([]);

    // Build user message content (multimodal if images present)
    let userContent: string | MultimodalContentPart[];
    if (pendingImages.length > 0) {
      const parts: MultimodalContentPart[] = [];
      if (msgText) parts.push({ type: 'text', text: msgText });
      for (const img of pendingImages) {
        parts.push({ type: 'image_url', image_url: { url: img.url } });
      }
      userContent = parts;
    } else {
      userContent = msgText;
    }

    const userMsg: ChatMessage = { role: 'user', content: userContent, timestamp: Date.now() };
    addChatMessage(userMsg);

    const assistantMsg: ChatMessage = { role: 'assistant', content: '', timestamp: Date.now() };
    addChatMessage(assistantMsg);
    setAiLoading(true);
    setElapsed(0);

    // The assistant message will be at index = chatMessages.length + 1 (user + assistant added above)
    const assistantMsgIndex = chatMessages.length + 1;

    const activeTab = openTabs.find(t => t.path === activeTabPath);

    // Extract mentioned file paths from the user message and read their content.
    // Limit to MAX_RELATED_FILES to avoid bloating the AI context window.
    const MAX_RELATED_FILES = 3;
    const relatedFiles: { path: string; content: string }[] = [];
    if (currentProject) {
      const mentionedPaths = extractFilePaths(msgText, fileTree);
      for (const filePath of mentionedPaths.slice(0, MAX_RELATED_FILES)) {
        // Skip if already loaded as the active tab
        if (filePath === activeTab?.path) continue;
        try {
          const content = await fetchFileContent(filePath);
          if (content) {
            relatedFiles.push({ path: filePath, content });
          }
        } catch {
          // ignore unresolvable paths
        }
      }
    }

    const context = {
      fileTree: fileTreeText,
      techStack: currentProject?.techStack ?? [],
      currentFile: activeTab?.path,
      currentFileContent: activeTab?.content,
      relatedFiles,
      projectRoot: currentProject?.path,
    };

    let fullContent = '';

    // Use smart mode when enabled and projectRoot is available
    const useSmartMode = smartMode && !!currentProject?.path;

    if (useSmartMode) {
      // Initialize live tool actions tracking for this assistant message
      setLoadingMsgIndex(assistantMsgIndex);
      setMessageToolActions(prev => {
        const next = new Map(prev);
        next.set(assistantMsgIndex, []);
        return next;
      });

      abortRef.current = streamSmartChat({
        messages: [...chatMessages, userMsg],
        context,
        model: selectedModel,
        onChunk: (chunk) => {
          fullContent += chunk;
          updateLastAssistantMessage(fullContent);
        },
        onDone: () => {
          setAiLoading(false);
          setLoadingMsgIndex(null);
          abortRef.current = null;
        },
        onError: (err) => {
          updateLastAssistantMessage(`错误: ${err}`);
          setAiLoading(false);
          setLoadingMsgIndex(null);
          abortRef.current = null;
        },
        onUsage: (usage, model) => {
          const { inputPrice, outputPrice } = getModelPrices(model);
          const cost = (usage.promptTokens / 1000) * inputPrice + (usage.completionTokens / 1000) * outputPrice;
          setLastUsage({ tokens: usage.totalTokens, cost });
          recordTokenUsage({
            model,
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            totalTokens: usage.totalTokens,
          }).catch(() => { /* ignore */ });
        },
        onToolCall: (event) => {
          setMessageToolActions(prev => {
            const next = new Map(prev);
            const existing = next.get(assistantMsgIndex) ?? [];
            // Add placeholder with pending summary; updated when tool_result arrives
            next.set(assistantMsgIndex, [...existing, { toolCallId: event.toolCallId, tool: event.tool, args: event.args, summary: '...' }]);
            return next;
          });
        },
        onToolResult: (toolCallId, _tool, summary) => {
          setMessageToolActions(prev => {
            const next = new Map(prev);
            const existing = [...(next.get(assistantMsgIndex) ?? [])];
            // Match by toolCallId for reliable identification even with duplicate tool types
            const idx = existing.findIndex(a => a.toolCallId === toolCallId);
            if (idx >= 0) {
              existing[idx] = { ...existing[idx], summary };
            }
            next.set(assistantMsgIndex, existing);
            return next;
          });
        },
      });
    } else {
      abortRef.current = streamAIChat({
        messages: [...chatMessages, userMsg],
        context,
        model: selectedModel,
        onChunk: (chunk) => {
          fullContent += chunk;
          updateLastAssistantMessage(fullContent);
        },
        onDone: () => {
          setAiLoading(false);
          abortRef.current = null;
        },
        onError: (err) => {
          updateLastAssistantMessage(`错误: ${err}`);
          setAiLoading(false);
          abortRef.current = null;
        },
        onUsage: (usage, model) => {
          const { inputPrice, outputPrice } = getModelPrices(model);
          const cost = (usage.promptTokens / 1000) * inputPrice + (usage.completionTokens / 1000) * outputPrice;
          setLastUsage({ tokens: usage.totalTokens, cost });
          recordTokenUsage({
            model,
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            totalTokens: usage.totalTokens,
          }).catch(() => { /* ignore */ });
        },
      });
    }
  }

  async function handleApplyFile(file: { path: string; content: string }) {
    if (!currentProject) {
      showToast('请先打开一个项目', 'error');
      return;
    }
    try {
      // Read current content for undo support
      let oldContent: string | null = null;
      try {
        oldContent = await fetchFileContent(file.path);
      } catch {
        oldContent = null; // File doesn't exist yet (new file)
      }

      await batchWriteFiles([file], currentProject.path);

      // Record in history
      pushOperation({
        type: 'apply',
        description: `应用 AI 修改: ${file.path.split('/').pop()}`,
        changes: [{
          filePath: file.path,
          oldContent,
          newContent: file.content,
        }],
      });

      setAppliedFiles(prev => new Set([...prev, file.path]));
      showToast(`✓ 已应用 ${file.path.split('/').pop()}`, 'success');
    } catch (e) {
      showToast(`应用失败: ${e instanceof Error ? e.message : String(e)}`, 'error');
    }
  }

  async function handleApplyAll() {
    if (!currentProject) {
      showToast('请先打开一个项目', 'error');
      return;
    }
    const lastMsg = chatMessages[chatMessages.length - 1];
    const lastContent = typeof lastMsg?.content === 'string' ? lastMsg.content : '';
    const parsed = lastContent ? tryParseFileChanges(lastContent) : null;
    if (!parsed?.files?.length) {
      showToast('未找到可应用的文件修改', 'error');
      return;
    }
    try {
      // Read current content for all files before applying (for undo support)
      const changes = await Promise.all(parsed.files.map(async (file) => {
        let oldContent: string | null = null;
        try {
          oldContent = await fetchFileContent(file.path);
        } catch {
          oldContent = null;
        }
        return { filePath: file.path, oldContent, newContent: file.content };
      }));

      await batchWriteFiles(parsed.files, currentProject.path);

      // Record all file changes as a single operation
      pushOperation({
        type: 'apply',
        description: `应用 AI 修改: ${parsed.files.length} 个文件`,
        changes,
      });

      setAppliedFiles(new Set(parsed.files.map(f => f.path)));
      showToast(`✓ 已应用 ${parsed.files.length} 个文件修改`, 'success');
    } catch (e) {
      showToast(`应用失败: ${e instanceof Error ? e.message : String(e)}`, 'error');
    }
  }

  const activeTab = openTabs.find(t => t.path === activeTabPath);
  const isTyping = isAiLoading && chatMessages[chatMessages.length - 1]?.content === '';
  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)] relative">
      {/* Header */}
      <div className="relative">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--border-primary)] shrink-0 bg-[var(--bg-secondary)]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-[#388bfd] to-[var(--accent-hover)] rounded-lg flex items-center justify-center">
              <Sparkles size={13} className="text-white" />
            </div>
            <span className="text-sm font-semibold text-[var(--text-primary)]">AI 助手</span>
            {isAiLoading && (
              <span className="text-[10px] text-[var(--accent-primary)] animate-pulse">
                {elapsed > 0 ? `${elapsed}s` : '思考中...'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {/* Smart mode toggle */}
            <button
              onClick={toggleSmartMode}
              className={`p-1.5 rounded-lg transition-colors ${
                smartMode
                  ? 'text-[var(--accent-primary)] bg-[var(--accent-bg)]'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
              }`}
              title={smartMode ? '智能模式已开启（点击关闭）' : '开启智能模式'}
            >
              <Brain size={14} />
            </button>
            <ChatHistoryButton
              onClick={() => setShowHistoryPanel(v => !v)}
              isOpen={showHistoryPanel}
            />
            {isAiLoading && (
              <button
                onClick={() => abortRef.current?.()}
                className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--error)] hover:bg-[var(--error-bg)] transition-colors"
                title="停止生成"
              >
                <StopCircle size={14} />
              </button>
            )}
            {chatMessages.length > 0 && (
              <button
                onClick={() => exportChatAsMarkdown(chatMessages, currentProject?.name ?? '')}
                className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                title="导出对话"
              >
                <Download size={14} />
              </button>
            )}
            <button
              onClick={() => setShowClearConfirm(true)}
              className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--error)] hover:bg-[var(--error-bg)] transition-colors"
              title="清空对话"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        <ChatHistory
          isOpen={showHistoryPanel}
          onClose={() => setShowHistoryPanel(false)}
        />
      </div>

      {/* Context info bar */}
      {(activeTab || currentProject) && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]/50 shrink-0 overflow-x-auto">
          {activeTab && (
            <span className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)] whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)]" />
              {activeTab.path.split('/').pop()}
            </span>
          )}
          {currentProject?.techStack && currentProject.techStack.length > 0 && (
            <>
              <span className="text-[var(--border-primary)]">·</span>
              <span className="text-[10px] text-[var(--text-secondary)] whitespace-nowrap">
                {currentProject.techStack.slice(0, 3).join(' · ')}
              </span>
            </>
          )}
          <span className="text-[var(--border-primary)]">·</span>
          <span className="text-[10px] text-[var(--text-tertiary)] whitespace-nowrap">{selectedModel}</span>
          {smartMode && (
            <>
              <span className="text-[var(--border-primary)]">·</span>
              <span className="text-[10px] text-[var(--accent-primary)] whitespace-nowrap">🧠 智能模式</span>
            </>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {chatMessages.length === 0 ? (
          <SuggestionCards onSelect={(prompt) => handleSend(prompt)} />
        ) : (
          <div className="p-3 overflow-hidden">
            {chatMessages.map((msg, i) => (
              <MessageBubble
                key={i}
                msg={msg}
                onApplyFile={handleApplyFile}
                onApplyAll={handleApplyAll}
                appliedFiles={appliedFiles}
                toolActions={messageToolActions.get(i)}
                isToolLoading={loadingMsgIndex === i && isAiLoading}
              />
            ))}
            {isTyping && (
              <div className="flex gap-2.5 mb-4">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#238636] to-[#2ea043] flex items-center justify-center shrink-0">
                  <Bot size={13} />
                </div>
                <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl rounded-tl-sm px-3 py-2">
                  <TypingDots />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-3 py-2 shrink-0">
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-2xl focus-within:border-[var(--accent-primary)] transition-colors">
          {images.length > 0 && (
            <div className="px-3 pt-2">
              <ImageUpload images={images} onChange={setImages} />
            </div>
          )}
          <textarea
            ref={textareaRef}
            className="w-full bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] px-3 py-2.5 resize-none focus:outline-none min-h-[40px] max-h-[120px]"
            style={{ height: '40px' }}
            placeholder="描述你的需求..."
            title="Enter 发送 · Shift+Enter 换行"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={isAiLoading}
          />
          <div className="flex items-center justify-between px-2 pb-2">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setAiMode('chat')}
                title="Chat 模式"
                className={`p-1.5 rounded-lg transition-colors ${aiMode === 'chat' ? 'text-[var(--accent-primary)] bg-[var(--accent-primary)]/10' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'}`}
              >
                <MessageSquare size={14} />
              </button>
              <button
                onClick={() => setAiMode('agent')}
                title="Agent 模式"
                className={`p-1.5 rounded-lg transition-colors ${aiMode === 'agent' ? 'text-[var(--accent-primary)] bg-[var(--accent-primary)]/10' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'}`}
              >
                <Cpu size={14} />
              </button>
              <button
                onClick={toggleSmartMode}
                title="智能模式"
                className={`p-1.5 rounded-lg transition-colors ${smartMode ? 'text-[var(--accent-primary)] bg-[var(--accent-primary)]/10' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'}`}
              >
                <Brain size={14} />
              </button>
              <ImageUpload images={[]} onChange={(imgs) => setImages(prev => [...prev, ...imgs])} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-tertiary)]">
                {MODELS.find(m => m.value === selectedModel)?.label}
              </span>
              <button
                onClick={() => handleSend()}
                disabled={(!input.trim() && images.length === 0) || isAiLoading}
                className="shrink-0 w-7 h-7 flex items-center justify-center bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:bg-[var(--bg-tertiary)] disabled:text-[var(--text-tertiary)] text-white rounded-lg transition-colors"
              >
                <Send size={13} />
              </button>
            </div>
          </div>
        </div>
        {lastUsage && (
          <p className="text-[10px] text-[var(--text-tertiary)] mt-1 px-1">
            上次: {formatTokens(lastUsage.tokens)} tokens · {formatCost(lastUsage.cost)}
          </p>
        )}
      </div>

      {/* Clear confirm dialog */}
      {showClearConfirm && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl p-4 shadow-xl mx-4 max-w-xs w-full">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={16} className="text-[var(--warning)]" />
              <span className="text-sm font-semibold text-[var(--text-primary)]">清空对话</span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mb-4">确定要清空所有对话记录吗？此操作不可撤销。</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] text-xs rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => {
                  clearChat();
                  setAppliedFiles(new Set());
                  setShowClearConfirm(false);
                  showToast('对话已清空', 'info');
                }}
                className="flex-1 py-2 bg-[var(--error)] hover:bg-[var(--error)]/80 text-white text-xs rounded-lg transition-colors"
              >
                确认清空
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
