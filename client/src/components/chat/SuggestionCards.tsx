interface Suggestion {
  icon: string;
  title: string;
  description: string;
  prompt: string;
}

const suggestions: Suggestion[] = [
  {
    icon: '🔍',
    title: '读取并修改文件',
    description: '告诉我文件名，我帮你修改代码',
    prompt: '请读取 src/App.tsx 并帮我优化代码结构',
  },
  {
    icon: '🐛',
    title: '修复 Bug',
    description: '描述问题，AI 直接定位并修复',
    prompt: '帮我检查当前文件的 bug 并修复',
  },
  {
    icon: '✨',
    title: '新增功能',
    description: '描述需求，AI 生成完整代码',
    prompt: '给当前页面新增一个黑暗模式切换按钮',
  },
  {
    icon: '🔷',
    title: '完善 TypeScript 类型',
    description: '添加严格类型，消除 any',
    prompt: '为当前文件补充完整的 TypeScript 类型定义',
  },
  {
    icon: '🧪',
    title: '生成测试代码',
    description: '自动生成单元测试和集成测试',
    prompt: '为当前文件生成完整的单元测试',
  },
  {
    icon: '♻️',
    title: '重构代码',
    description: '拆分组件，提取复用逻辑',
    prompt: '按照 SOLID 原则重构当前文件，拆分过大的组件',
  },
];

interface SuggestionCardsProps {
  onSelect: (prompt: string) => void;
}

export default function SuggestionCards({ onSelect }: SuggestionCardsProps) {
  return (
    <div className="px-3 py-4">
      <div className="w-12 h-12 bg-gradient-to-br from-[var(--accent-bg-heavy)] to-[#238636]/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
        <span className="text-xl">✨</span>
      </div>
      <p className="text-center font-medium text-[var(--text-secondary)] mb-1 text-sm">向 DeepSeek AI 描述需求</p>
      <p className="text-center text-xs text-[var(--text-tertiary)] leading-relaxed mb-4">
        AI 会分析项目结构并生成代码修改方案
      </p>

      <div className="grid grid-cols-2 gap-2">
        {suggestions.map((s) => (
          <button
            key={s.prompt}
            onClick={() => onSelect(s.prompt)}
            className="group text-left p-2.5 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl hover:border-[var(--accent-border)] hover:bg-[var(--bg-tertiary)] transition-all duration-150"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-base">{s.icon}</span>
              <span className="text-xs font-semibold text-[var(--text-primary)] leading-tight">{s.title}</span>
            </div>
            <p className="text-[11px] text-[var(--text-tertiary)] leading-tight">{s.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
