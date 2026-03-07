export interface TokenUsageData {
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface TokenStatsSummary {
  totalTokens: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalCost: number;
  requestCount: number;
}

export interface ModelDistributionItem {
  model: string;
  tokens: number;
  requests: number;
  cost: number;
  percentage: number;
}

export interface DailyStatItem {
  date: string;
  tokens: number;
  requests: number;
  cost: number;
}

export interface RecentRecord {
  timestamp: number;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
}

export interface TokenStatsResponse {
  period: string;
  summary: TokenStatsSummary;
  modelDistribution: ModelDistributionItem[];
  dailyStats: DailyStatItem[];
  recentRecords: RecentRecord[];
}

export type StatsPeriod = 'today' | 'week' | 'month' | 'all';

export async function fetchTokenStats(period: StatsPeriod): Promise<TokenStatsResponse> {
  const res = await fetch(`/api/stats/token-usage?period=${period}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || '获取统计数据失败');
  }
  return res.json();
}

export async function recordTokenUsage(data: TokenUsageData): Promise<void> {
  const res = await fetch('/api/stats/token-usage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || '记录Token使用失败');
  }
}
