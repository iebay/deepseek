import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Trash2, Copy, Check, Sparkles } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { streamAIChat } from '../../api/aiApi';
import { batchWriteFiles } from '../../api/filesApi';
import type { ChatMessage } from '../../types';

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

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="my-2 rounded-lg overflow-hidden border border-[#30363d]">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#21262d] border-b border-[#30363d]">
        <span className="text-[10px] text-[#8b949e] font-mono">{language || '代码'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[10px] text-[#8b949e] hover:text-[#e6edf3] transition-colors"
        >
          {copied ? <Check size={11} className="text-[#3fb950]" /> : <Copy size={11} />}
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <pre className="px-3 py-2.5 text-xs text-[#e6edf3] overflow-x-auto bg-[#0d1117] font-mono leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function renderContent(content: string) {
  const parts: React.ReactNode[] = [];
  const codeRegex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <span key={lastIndex} className="whitespace-pre-wrap">
          {renderInline(content.slice(lastIndex, match.index))}
        </span>
      );
    }
    parts.push(
      <CodeBlock key={match.index} language={match[1]} code={match[2].trim()} />
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push(
      <span key={lastIndex} className="whitespace-pre-wrap">
        {renderInline(content.slice(lastIndex))}
      </span>
    );
  }

  return parts;
}

function renderInline(text: string): React.ReactNode {
  // Bold: **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-[#e6edf3]">{part.slice(2, -2)}</strong>;
    }
    // Inline code: `text`
    const codeParts = part.split(/(`[^`]+`)/g);
    return codeParts.map((cp, j) => {
      if (cp.startsWith('`') && cp.endsWith('`')) {
        return <code key={j} className="px-1 py-0.5 bg-[#21262d] rounded text-[#e6edf3] text-[11px] font-mono">{cp.slice(1, -1)}</code>;
      }
      return cp;
    });
  });
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      <span className="w-1.5 h-1.5 bg-[#388bfd] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-1.5 h-1.5 bg-[#388bfd] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-1.5 h-1.5 bg-[#388bfd] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-2.5 mb-4 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${isUser ? 'bg-[#388bfd]' : 'bg-gradient-to-br from-[#238636] to-[#2ea043]'}`}>
        {isUser ? <User size={13} /> : <Bot size={13} />}
      </div>
      <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm break-words ${isUser ? 'bg-[#388bfd]/20 text-[#e6edf3] rounded-tr-sm' : 'bg-[#161b22] text-[#e6edf3] border border-[#30363d] rounded-tl-sm'}`}>
        {isUser ? (
          <span className="whitespace-pre-wrap">{msg.content}</span>
        ) : (
          <div className="leading-relaxed">{renderContent(msg.content)}</div>
        )}
      </div>
    </div>
  );
}

export default function ChatPanel() {
  const {
    chatMessages, addChatMessage, updateLastAssistantMessage,
    clearChat, isAiLoading, setAiLoading, selectedModel,
    currentProject, fileTree, activeTabPath, openTabs,
    showToast,
  } = useAppStore();

  const [input, setInput] = useState('');
  const [applyStatus, setApplyStatus] = useState<string>('');
  const [elapsed, setElapsed] = useState<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Auto-resize textarea
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

  function buildFileTreeText(): string {
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
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || isAiLoading) return;
    setInput('');

    const userMsg: ChatMessage = { role: 'user', content: text };
    addChatMessage(userMsg);

    const assistantMsg: ChatMessage = { role: 'assistant', content: '' };
    addChatMessage(assistantMsg);
    setAiLoading(true);
    setElapsed(0);

    const activeTab = openTabs.find(t => t.path === activeTabPath);

    const context = {
      fileTree: buildFileTreeText(),
      techStack: currentProject?.techStack ?? [],
      currentFile: activeTab?.path,
      currentFileContent: activeTab?.content,
    };

    let fullContent = '';

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
    });
  }

  async function handleApplyChanges(content: string) {
    if (!currentProject) {
      showToast('请先打开一个项目', 'error');
      return;
    }
    const parsed = tryParseFileChanges(content);
    if (!parsed?.files?.length) {
      showToast('未找到可应用的文件修改', 'error');
      return;
    }
    try {
      setApplyStatus('正在应用修改...');
      await batchWriteFiles(parsed.files, currentProject.path);
      showToast(`✓ 已应用 ${parsed.files.length} 个文件修改`, 'success');
      setApplyStatus('');
    } catch (e) {
      const msg = `应用失败: ${e instanceof Error ? e.message : String(e)}`;
      showToast(msg, 'error');
      setApplyStatus('');
    }
  }

  const lastMsg = chatMessages[chatMessages.length - 1];
  const canApply = lastMsg?.role === 'assistant' && tryParseFileChanges(lastMsg.content) !== null;
  const isTyping = isAiLoading && chatMessages[chatMessages.length - 1]?.content === '';

  return (
    <div className="flex flex-col h-full bg-[#0d1117]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#30363d] shrink-0 bg-[#161b22]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-gradient-to-br from-[#388bfd] to-[#58a6ff] rounded-lg flex items-center justify-center">
            <Sparkles size={13} className="text-white" />
          </div>
          <span className="text-sm font-semibold text-[#e6edf3]">AI 助手</span>
          {isAiLoading && (
            <span className="text-[10px] text-[#388bfd] animate-pulse">
              {elapsed > 0 ? `${elapsed}s` : '思考中...'}
            </span>
          )}
        </div>
        <button
          onClick={() => { clearChat(); showToast('对话已清空', 'info'); }}
          className="p-1.5 rounded-lg text-[#6e7681] hover:text-[#f85149] hover:bg-[#f85149]/10 transition-colors"
          title="清空对话"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3">
        {chatMessages.length === 0 ? (
          <div className="text-center text-[#6e7681] text-sm mt-10 px-4">
            <div className="w-14 h-14 bg-gradient-to-br from-[#388bfd]/20 to-[#238636]/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Sparkles size={24} className="text-[#388bfd]" />
            </div>
            <p className="font-medium text-[#8b949e] mb-2">向 DeepSeek AI 描述需求</p>
            <p className="text-xs text-[#6e7681] leading-relaxed">AI 会分析项目结构并生成代码修改方案</p>
            <div className="mt-5 space-y-2 text-left">
              {['添加登录表单验证', '优化列表渲染性能', '添加 TypeScript 类型定义'].map(hint => (
                <button
                  key={hint}
                  onClick={() => setInput(hint)}
                  className="w-full text-left px-3 py-2 bg-[#161b22] border border-[#30363d] rounded-lg text-xs text-[#8b949e] hover:text-[#e6edf3] hover:border-[#388bfd]/40 transition-colors"
                >
                  {hint}
                </button>
              ))}
            </div>
          </div>
        ) : (
          chatMessages.map((msg, i) => <MessageBubble key={i} msg={msg} />)
        )}
        {isTyping && (
          <div className="flex gap-2.5 mb-4">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#238636] to-[#2ea043] flex items-center justify-center shrink-0">
              <Bot size={13} />
            </div>
            <div className="bg-[#161b22] border border-[#30363d] rounded-xl rounded-tl-sm px-3 py-2">
              <TypingDots />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Apply button */}
      {canApply && (
        <div className="px-3 py-2 border-t border-[#30363d] shrink-0">
          <button
            onClick={() => handleApplyChanges(lastMsg.content)}
            className="w-full py-2 bg-[#238636] hover:bg-[#2ea043] text-white text-sm rounded-lg transition-colors font-medium"
          >
            应用 AI 修改到项目
          </button>
          {applyStatus && <p className="text-xs text-[#8b949e] mt-1 text-center">{applyStatus}</p>}
        </div>
      )}

      {/* Input */}
      <div className="px-3 py-2.5 border-t border-[#30363d] shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            className="flex-1 bg-[#161b22] border border-[#30363d] rounded-xl text-sm text-[#e6edf3] placeholder-[#6e7681] px-3 py-2.5 resize-none focus:outline-none focus:border-[#388bfd] transition-colors min-h-[40px] max-h-[120px]"
            style={{ height: '40px' }}
            placeholder="描述你的需求..."
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
          <button
            onClick={handleSend}
            disabled={!input.trim() || isAiLoading}
            className="shrink-0 w-9 h-9 flex items-center justify-center bg-[#388bfd] hover:bg-[#58a6ff] disabled:bg-[#21262d] disabled:text-[#6e7681] text-white rounded-xl transition-colors"
          >
            <Send size={15} />
          </button>
        </div>
        <p className="text-[10px] text-[#6e7681] mt-1.5">Enter 发送 · Shift+Enter 换行</p>
      </div>
    </div>
  );
}
