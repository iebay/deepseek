import type { Template } from '../../types';

interface TemplateGridProps {
  templates: Template[];
  loading: boolean;
  onSelect: (template: Template) => void;
}

export default function TemplateGrid({ templates, loading, onSelect }: TemplateGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-32 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {templates.map((tpl) => (
        <button
          key={tpl.id}
          onClick={() => onSelect(tpl)}
          className="group relative text-left p-4 rounded-xl border border-[var(--border-primary)] hover:border-[var(--accent-primary)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] transition-all duration-200 overflow-hidden"
        >
          {/* Gradient background */}
          <div className={`absolute inset-0 bg-gradient-to-br ${tpl.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-200`} />

          <div className="relative">
            <div className="text-2xl mb-2">{tpl.icon}</div>
            <div className="text-sm font-semibold text-[var(--text-primary)] mb-1 leading-tight">{tpl.name}</div>
            <div className="text-xs text-[var(--text-secondary)] leading-relaxed mb-2 line-clamp-2">{tpl.description}</div>
            <div className="flex flex-wrap gap-1">
              {tpl.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] px-1.5 py-0.5 bg-[var(--accent-bg)] text-[#58a6ff] rounded-md border border-[var(--accent-bg)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Hover overlay */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-[var(--bg-primary)]/60 backdrop-blur-[1px]">
            <span className="text-xs font-semibold text-white bg-[var(--accent-primary)] px-3 py-1.5 rounded-lg shadow-lg">
              使用此模板
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
