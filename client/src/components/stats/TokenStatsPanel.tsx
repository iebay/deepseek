import { useState, useEffect, useCallback } from 'react';
import { X, BarChart3, TrendingUp, Cpu, Clock } from 'lucide-react';
import { fetchTokenStats, type TokenStats, type DailyUsage, type RecentRecord } from '../../api/statsApi';
import { formatCost, formatTokens } from '../../utils/formatStats';

type Period = 'today' | 'week' | 'month' | 'all';

const MIN_BAR_HEIGHT_PCT = 2;

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  return `${days}天前`;
}

function formatDate(dateStr: string): string {
  const parts = dateStr.split('-');
  return `${parts[1]}/${parts[2]}`;
}

interface BarChartProps {
  data: DailyUsage[];
}

function BarChart({ data }: BarChartProps) {
  if (data.length === 0) return <p className="text-xs text-[#8b949e] text-center py-4">暂无数据</p>;

  // Show up to 14 days, most recent first → reverse to show oldest→newest left to right
  const display = [...data].reverse().slice(-14);
  const maxTokens = Math.max(...display.map(d => d.tokens), 1);

  return (
    <div className="flex items-end gap-1 h-20 mt-2">
      {display.map((d) => {
        const heightPct = Math.max((d.tokens / maxTokens) * 100, MIN_BAR_HEIGHT_PCT);
        return (
          <div key={d.date} className="flex flex-col items-center gap-0.5 flex-1 min-w-0 group relative">
            <div
              className="w-full bg-[#388bfd]/60 hover:bg-[#388bfd] rounded-sm transition-colors cursor-default"
              style={{ height: `${heightPct}%` }}
              title={`${formatDate(d.date)}: ${formatTokens(d.tokens)} tokens`}
            />
            <span className="text-[8px] text-[#8b949e] truncate w-full text-center leading-tight">
              {formatDate(d.date)}
            </span>
            {/* Tooltip */}
            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-[#161b22] border border-[#30363d] rounded px-1.5 py-0.5 text-[9px] text-[#e6edf3] whitespace-nowrap hidden group-hover:block z-10 pointer-events-none">
              {formatTokens(d.tokens)} · {formatCost(d.cost)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface TokenStatsPanelProps {
  onClose: () => void;
}

export default function TokenStatsPanel({ onClose }: TokenStatsPanelProps) {
  const [period, setPeriod] = useState<Period>('week');
  const [stats, setStats] = useState<TokenStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTokenStats(period);
      setStats(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const PERIOD_LABELS: { value: Period; label: string }[] = [
    { value: 'today', label: '今天' },
    { value: 'week', label: '本周' },
    { value: 'month', label: '本月' },
    { value: 'all', label: '全部' },
  ];

  const modelEntries = stats ? Object.entries(stats.byModel) : [];
  const totalTokensForBar = modelEntries.reduce((s, [, v]) => s + v.tokens, 0) || 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#30363d] sticky top-0 bg-[#161b22] z-10">
          <div className="flex items-center gap-2">
            <BarChart3 size={16} className="text-[#388bfd]" />
            <span className="text-sm font-semibold text-[#e6edf3]">Token 使用统计</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[#6e7681] hover:text-[#e6edf3] hover:bg-[#21262d] transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Period filter */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-[#30363d]">
          {PERIOD_LABELS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setPeriod(value)}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                period === value
                  ? 'bg-[#388bfd]/20 text-[#388bfd] font-medium'
                  : 'text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d]'
              }`}
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => void loadStats()}
            className="ml-auto text-[10px] text-[#6e7681] hover:text-[#8b949e] transition-colors"
            disabled={loading}
          >
            {loading ? '加载中...' : '刷新'}
          </button>
        </div>

        {error && (
          <div className="mx-4 mt-3 px-3 py-2 bg-[#f85149]/10 border border-[#f85149]/20 rounded text-xs text-[#f85149]">
            {error}
          </div>
        )}

        {stats && (
          <div className="p-4 space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-[#21262d] rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-[#e6edf3]">
                  {formatTokens(stats.summary.totalTokens)}
                </div>
                <div className="text-[10px] text-[#8b949e] mt-0.5">总 Token</div>
              </div>
              <div className="bg-[#21262d] rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-[#3fb950]">
                  {formatCost(stats.summary.totalCost)}
                </div>
                <div className="text-[10px] text-[#8b949e] mt-0.5">总费用</div>
              </div>
              <div className="bg-[#21262d] rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-[#e6edf3]">
                  {stats.summary.requestCount}
                </div>
                <div className="text-[10px] text-[#8b949e] mt-0.5">请求次数</div>
              </div>
            </div>

            {/* Token breakdown */}
            {stats.summary.totalTokens > 0 && (
              <div className="bg-[#21262d] rounded-lg p-3 text-xs text-[#8b949e] flex items-center justify-between">
                <span>输入 <span className="text-[#e6edf3]">{formatTokens(stats.summary.totalPromptTokens)}</span></span>
                <span className="text-[#30363d]">·</span>
                <span>输出 <span className="text-[#e6edf3]">{formatTokens(stats.summary.totalCompletionTokens)}</span></span>
              </div>
            )}

            {/* Model distribution */}
            {modelEntries.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Cpu size={12} className="text-[#8b949e]" />
                  <span className="text-xs font-medium text-[#8b949e]">按模型分布</span>
                </div>
                <div className="space-y-2">
                  {modelEntries.map(([model, usage]) => {
                    const pct = Math.round((usage.tokens / totalTokensForBar) * 100);
                    return (
                      <div key={model} className="bg-[#21262d] rounded-lg p-2.5">
                        <div className="flex items-center justify-between mb-1.5 text-xs">
                          <span className="text-[#e6edf3] font-medium truncate mr-2">{model}</span>
                          <span className="text-[#8b949e] shrink-0">
                            {formatTokens(usage.tokens)} · {formatCost(usage.cost)} · {usage.count}次
                          </span>
                        </div>
                        <div className="h-1.5 bg-[#30363d] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#388bfd] rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="text-right text-[10px] text-[#6e7681] mt-0.5">{pct}%</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Daily trend */}
            {stats.dailyUsage.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp size={12} className="text-[#8b949e]" />
                  <span className="text-xs font-medium text-[#8b949e]">每日趋势</span>
                </div>
                <div className="bg-[#21262d] rounded-lg p-3">
                  <BarChart data={stats.dailyUsage} />
                </div>
              </div>
            )}

            {/* Recent records */}
            {stats.recentRecords.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Clock size={12} className="text-[#8b949e]" />
                  <span className="text-xs font-medium text-[#8b949e]">最近请求</span>
                </div>
                <div className="space-y-1">
                  {stats.recentRecords.map((record: RecentRecord) => (
                    <div
                      key={record.id}
                      className="flex items-center justify-between bg-[#21262d] rounded-lg px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="text-xs text-[#e6edf3] truncate">{record.model}</div>
                        <div className="text-[10px] text-[#6e7681]">{formatRelativeTime(record.timestamp)}</div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <div className="text-xs text-[#8b949e]">{formatTokens(record.totalTokens)} tokens</div>
                        <div className="text-[10px] text-[#3fb950]">{formatCost(record.cost)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {stats.summary.requestCount === 0 && !loading && (
              <div className="text-center py-8 text-[#8b949e] text-sm">
                <BarChart3 size={32} className="mx-auto mb-2 opacity-30" />
                <p>暂无统计数据</p>
                <p className="text-xs mt-1">开始对话后会自动记录 Token 使用量</p>
              </div>
            )}
          </div>
        )}

        {loading && !stats && (
          <div className="py-12 text-center text-[#8b949e] text-sm">加载中...</div>
        )}
      </div>
    </div>
  );
}
