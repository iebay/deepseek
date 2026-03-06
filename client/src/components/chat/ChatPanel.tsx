import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Trash2, Loader2 } from 'lucide-react';
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

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-2 mb-4 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs ${isUser ? 'bg-[#388bfd]' : 'bg-[#238636]'}`}>
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>
      <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words ${isUser ? 'bg-[#388bfd]/20 text-[#e6edf3]' : 'bg-[#161b22] text-[#e6edf3] border border-[#30363d]'}`}>
        {msg.content}
      </div>
    </div>
  );
}

export default function ChatPanel() {
  const {
    chatMessages, addChatMessage, updateLastAssistantMessage,
    clearChat, isAiLoading, setAiLoading, selectedModel,
    currentProject, fileTree, activeTabPath, openTabs,
  } = useAppStore();

  const [input, setInput] = useState('');
  const [applyStatus, setApplyStatus] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

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
      setApplyStatus('请先打开一个项目');
      return;
    }
    const parsed = tryParseFileChanges(content);
    if (!parsed?.files?.length) {
      setApplyStatus('未找到可应用的文件修改');
      return;
    }
    try {
      setApplyStatus('正在应用修改...');
      await batchWriteFiles(parsed.files, currentProject.path);
      setApplyStatus(`✓ 已应用 ${parsed.files.length} 个文件修改`);
      setTimeout(() => setApplyStatus(''), 3000);
    } catch (e) {
      setApplyStatus(`应用失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const lastMsg = chatMessages[chatMessages.length - 1];
  const canApply = lastMsg?.role === 'assistant' && tryParseFileChanges(lastMsg.content) !== null;

  return (
    <div className="flex flex-col h-full bg-[#0d1117]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#30363d] shrink-0">
        <div className="flex items-center gap-2">
          <Bot size={16} className="text-[#388bfd]" />
          <span className="text-sm font-medium text-[#e6edf3]">AI 助手</span>
        </div>
        <button
          onClick={clearChat}
          className="text-[#6e7681] hover:text-[#e6edf3] transition-colors"
          title="清空对话"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3">
        {chatMessages.length === 0 ? (
          <div className="text-center text-[#6e7681] text-sm mt-8">
            <Bot size={32} className="mx-auto mb-3 text-[#30363d]" />
            <p>向 DeepSeek AI 描述你想要的功能</p>
            <p className="text-xs mt-1">AI 会分析项目并生成代码修改</p>
          </div>
        ) : (
          chatMessages.map((msg, i) => <MessageBubble key={i} msg={msg} />)
        )}
        {isAiLoading && chatMessages[chatMessages.length - 1]?.content === '' && (
          <div className="flex gap-2 mb-4">
            <div className="w-7 h-7 rounded-full bg-[#238636] flex items-center justify-center">
              <Bot size={14} />
            </div>
            <div className="bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2">
              <Loader2 size={14} className="animate-spin text-[#388bfd]" />
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
            className="w-full py-1.5 bg-[#238636] hover:bg-[#2ea043] text-white text-sm rounded transition-colors"
          >
            应用 AI 修改到项目
          </button>
          {applyStatus && <p className="text-xs text-[#8b949e] mt-1 text-center">{applyStatus}</p>}
        </div>
      )}

      {/* Input */}
      <div className="px-3 py-2 border-t border-[#30363d] shrink-0">
        <div className="flex gap-2">
          <textarea
            className="flex-1 bg-[#161b22] border border-[#30363d] rounded text-sm text-[#e6edf3] placeholder-[#6e7681] px-3 py-2 resize-none focus:outline-none focus:border-[#388bfd] transition-colors"
            rows={3}
            placeholder="描述你的需求，例如：给登录页面添加表单验证..."
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
            className="px-3 py-2 bg-[#388bfd] hover:bg-[#58a6ff] disabled:bg-[#21262d] disabled:text-[#6e7681] text-white rounded transition-colors self-end"
          >
            {isAiLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
        <p className="text-xs text-[#6e7681] mt-1">Enter 发送，Shift+Enter 换行</p>
      </div>
    </div>
  );
}
