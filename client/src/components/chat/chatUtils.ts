import type { ChatMessage } from '../../types';

export function formatTime(ts?: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

export function exportChatAsMarkdown(messages: ChatMessage[], projectName: string): void {
  const dateTime = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const header = `# ${projectName || 'DeepSeek'} 对话记录\n\n> 导出时间：${dateTime}\n\n---\n\n`;
  const body = messages
    .filter(m => m.role !== 'system')
    .map(m => {
      const role = m.role === 'user' ? '**用户**' : '**AI 助手**';
      const time = m.timestamp ? ` *(${formatTime(m.timestamp)})*` : '';
      const content = typeof m.content === 'string'
        ? m.content
        : m.content.map(p => p.type === 'text' ? (p.text ?? '') : '[图片]').join('\n');
      return `### ${role}${time}\n\n${content}`;
    })
    .join('\n\n---\n\n');
  const fullContent = header + body;
  const blob = new Blob([fullContent], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chat-${Date.now()}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
