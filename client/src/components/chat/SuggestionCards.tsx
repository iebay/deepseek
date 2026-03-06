interface Suggestion {
  icon: string;
  title: string;
  description: string;
  prompt: string;
}

const suggestions: Suggestion[] = [
  {
    icon: '💡',
    title: '分析项目架构',
    description: '分析技术栈和代码结构',
    prompt: '分析这个项目的技术栈和架构',
  },
  {
    icon: '🐛',
    title: '检查潜在 Bug',
    description: '发现当前文件的问题',
    prompt: '检查当前文件的潜在 Bug',
  },
  {
    icon: '🎨',
    title: '优化 UI 样式',
    description: '改善组件的视觉效果',
    prompt: '优化这个组件的 UI 样式',
  },
  {
    icon: '⚡',
    title: '提升代码性能',
    description: '优化代码的运行效率',
    prompt: '提升这段代码的性能',
  },
  {
    icon: '📝',
    title: '添加 JSDoc 注释',
    description: '为函数生成文档注释',
    prompt: '给这个函数添加 JSDoc 注释',
  },
  {
    icon: '🧪',
    title: '生成单元测试',
    description: '为当前文件写测试用例',
    prompt: '为当前文件生成单元测试',
  },
];

interface SuggestionCardsProps {
  onSelect: (prompt: string) => void;
}

export default function SuggestionCards({ onSelect }: SuggestionCardsProps) {
  return (
    <div className="px-3 py-4">
      <div className="w-12 h-12 bg-gradient-to-br from-[#388bfd]/20 to-[#238636]/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
        <span className="text-xl">✨</span>
      </div>
      <p className="text-center font-medium text-[#8b949e] mb-1 text-sm">向 DeepSeek AI 描述需求</p>
      <p className="text-center text-xs text-[#6e7681] leading-relaxed mb-4">
        AI 会分析项目结构并生成代码修改方案
      </p>

      <div className="grid grid-cols-2 gap-2">
        {suggestions.map((s) => (
          <button
            key={s.prompt}
            onClick={() => onSelect(s.prompt)}
            className="group text-left p-2.5 bg-[#161b22] border border-[#30363d] rounded-xl hover:border-[#388bfd]/40 hover:bg-[#1c2128] transition-all duration-150"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-base">{s.icon}</span>
              <span className="text-xs font-semibold text-[#e6edf3] leading-tight">{s.title}</span>
            </div>
            <p className="text-[11px] text-[#6e7681] leading-tight">{s.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
