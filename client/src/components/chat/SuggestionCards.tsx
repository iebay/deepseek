interface Suggestion {
  icon: string;
  title: string;
  description: string;
  prompt: string;
}

const suggestions: Suggestion[] = [
  {
    icon: '🗂️',
    title: '分析项目结构',
    description: '分析架构并优化代码组织',
    prompt: '帮我分析项目结构并优化代码组织',
  },
  {
    icon: '🐛',
    title: '检查 Bug 和安全问题',
    description: '发现潜在的 bug 和安全隐患',
    prompt: '检查当前文件的潜在 bug 和安全问题',
  },
  {
    icon: '🔷',
    title: '添加 TypeScript 类型',
    description: '为当前文件补充严格类型',
    prompt: '为当前打开的文件添加 TypeScript 类型',
  },
  {
    icon: '⚡',
    title: '优化性能和可读性',
    description: '改善组件性能与代码质量',
    prompt: '优化当前组件的性能和可读性',
  },
  {
    icon: '🧪',
    title: '生成单元测试',
    description: '为当前文件生成测试用例',
    prompt: '为当前文件生成单元测试',
  },
  {
    icon: '♻️',
    title: '重构代码',
    description: '遵循 SOLID 原则重构代码',
    prompt: '帮我重构这段代码，遵循 SOLID 原则',
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
