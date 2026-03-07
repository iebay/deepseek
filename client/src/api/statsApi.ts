export interface TokenUsageSummary {
  totalTokens: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalCost: number;
  requestCount: number;
}

export interface ModelUsage {
  tokens: number;
  cost: number;
  count: number;
}

export interface DailyUsage {
  date: string;
  tokens: number;
  cost: number;
  count: number;
}

export interface RecentRecord {
  id: string;
  model: string;
  totalTokens: number;
  cost: number;
  timestamp: number;
}

export interface TokenStats {
  summary: TokenUsageSummary;
  byModel: Record<string, ModelUsage>;
  dailyUsage: DailyUsage[];
  recentRecords: RecentRecord[];
}

export async function fetchTokenStats(period: 'today' | 'week' | 'month' | 'all' = 'all'): Promise<TokenStats> {
  const res = await fetch(`/api/stats/token-usage?period=${period}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || '获取统计数据失败');
  }
  return res.json() as Promise<TokenStats>;
}

export async function recordTokenUsage(data: {
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}): Promise<{ cost: number } | null> {
  try {
    const res = await fetch('/api/stats/token-usage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) return null;
    const json = await res.json() as { success: boolean; record: { cost: number } };
    return json.record ?? null;
  } catch {
    return null;
  }
}
