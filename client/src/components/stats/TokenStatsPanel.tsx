import { useState, useEffect } from 'react';
import { X, BarChart3, Loader2, TrendingUp, Hash, DollarSign } from 'lucide-react';
import { fetchTokenStats, type TokenStatsResponse, type StatsPeriod } from '../../api/statsApi';
import { formatCost, formatTokens } from '../../utils/formatStats';

interface Props {
  onClose: () => void;
}

const PERIODS: { value: StatsPeriod; label: string }[] = [
  { value: 'today', label: '今天' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
  { value: 'all', label: '全部' },
];

const MAX_DAILY_BARS = 14;

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TokenStatsPanel({ onClose }: Props) {
  const [period, setPeriod] = useState<StatsPeriod>('week');
  const [stats, setStats] = useState<TokenStatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchTokenStats(period)
      .then(setStats)
      .catch(e => setError(e instanceof Error ? e.message : '加载失败'))
      .finally(() => setLoading(false));
  }, [period]);

  const maxDailyTokens = stats
    ? Math.max(...stats.dailyStats.map(d => d.tokens), 1)
    : 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border-primary)] shrink-0">
          <div className="flex items-center gap-2">
            <BarChart3 size={16} className="text-[var(--accent-primary)]" />
            <span className="text-sm font-semibold text-[var(--text-primary)]">Token 使用统计</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Period selector */}
        <div className="flex gap-1.5 px-5 pt-3.5 shrink-0">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                period === p.value
                  ? 'bg-[#388bfd] text-white'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-[var(--accent-primary)]" />
            </div>
          )}
          {error && (
            <div className="text-xs text-[var(--error)] bg-[var(--error-bg)] border border-[var(--error-border)] rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          {stats && !loading && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-3 py-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Hash size={12} className="text-[var(--accent-primary)]" />
                    <span className="text-[10px] text-[var(--text-secondary)]">总 Token</span>
                  </div>
                  <div className="text-lg font-bold text-[var(--text-primary)]">
                    {formatTokens(stats.summary.totalTokens)}
                  </div>
                  <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
                    输入 {formatTokens(stats.summary.totalPromptTokens)} · 输出 {formatTokens(stats.summary.totalCompletionTokens)}
                  </div>
                </div>
                <div className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-3 py-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <DollarSign size={12} className="text-[var(--success)]" />
                    <span className="text-[10px] text-[var(--text-secondary)]">总费用</span>
                  </div>
                  <div className="text-lg font-bold text-[var(--success)]">
                    {formatCost(stats.summary.totalCost)}
                  </div>
                  <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">USD</div>
                </div>
                <div className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-3 py-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <TrendingUp size={12} className="text-[var(--purple)]" />
                    <span className="text-[10px] text-[var(--text-secondary)]">请求次数</span>
                  </div>
                  <div className="text-lg font-bold text-[var(--text-primary)]">
                    {stats.summary.requestCount}
                  </div>
                  <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">次对话</div>
                </div>
              </div>

              {/* Model distribution */}
              {stats.modelDistribution.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-[var(--text-secondary)] mb-2">模型分布</h3>
                  <div className="space-y-2">
                    {stats.modelDistribution.map(m => (
                      <div key={m.model}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[11px] text-[var(--text-primary)]">{m.model}</span>
                          <span className="text-[10px] text-[var(--text-secondary)]">
                            {formatTokens(m.tokens)} · {m.percentage}%
                          </span>
                        </div>
                        <div className="h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#388bfd] rounded-full transition-all"
                            style={{ width: `${m.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Daily bar chart */}
              {stats.dailyStats.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-[var(--text-secondary)] mb-2">每日用量</h3>
                  <div className="flex items-end gap-1 h-20">
                    {stats.dailyStats.slice(-MAX_DAILY_BARS).map(d => {
                      const heightPct = Math.max((d.tokens / maxDailyTokens) * 100, 2);
                      return (
                        <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5 group relative" title={`${d.date}: ${formatTokens(d.tokens)} tokens`}>
                          <div
                            className="w-full bg-[var(--accent-primary)]/60 group-hover:bg-[var(--accent-primary)] rounded-sm transition-colors"
                            style={{ height: `${heightPct}%` }}
                          />
                          <span className="text-[8px] text-[var(--text-tertiary)] truncate max-w-full">
                            {d.date.slice(5)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Recent records */}
              {stats.recentRecords.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-[var(--text-secondary)] mb-2">最近请求</h3>
                  <div className="space-y-1.5">
                    {stats.recentRecords.map((r, i) => (
                      <div key={i} className="flex items-center justify-between bg-[var(--bg-primary)] border border-[var(--border-secondary)] rounded-lg px-3 py-2">
                        <div>
                          <span className="text-[11px] text-[var(--text-primary)]">{r.model}</span>
                          <span className="text-[10px] text-[var(--text-tertiary)] ml-2">{formatDate(r.timestamp)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[11px] text-[var(--text-secondary)]">{formatTokens(r.totalTokens)} tokens</span>
                          <span className="text-[10px] text-[var(--success)] ml-2">{formatCost(r.cost)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {stats.summary.requestCount === 0 && (
                <div className="text-center py-8 text-[var(--text-tertiary)] text-sm">
                  暂无数据，开始对话后即可查看统计
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
