import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';

const router = Router();
const STATS_FILE = path.join(os.homedir(), '.deepseek-token-stats.json');
const RETENTION_DAYS = 90;

interface TokenUsageRecord {
  timestamp: number;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
}

interface StatsFile {
  records: TokenUsageRecord[];
}

function readStats(): StatsFile {
  try {
    if (!fs.existsSync(STATS_FILE)) return { records: [] };
    const raw = fs.readFileSync(STATS_FILE, 'utf-8');
    return JSON.parse(raw) as StatsFile;
  } catch {
    return { records: [] };
  }
}

function writeStats(data: StatsFile): void {
  const tmpFile = STATS_FILE + '.tmp';
  fs.writeFileSync(tmpFile, JSON.stringify(data), 'utf-8');
  fs.renameSync(tmpFile, STATS_FILE);
}

function pruneOldRecords(records: TokenUsageRecord[]): TokenUsageRecord[] {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return records.filter(r => r.timestamp >= cutoff);
}

function getPrices(): { inputPrice: number; outputPrice: number } {
  const inputPrice = parseFloat(process.env.DEEPSEEK_CHAT_INPUT_PRICE || '0.00014');
  const outputPrice = parseFloat(process.env.DEEPSEEK_CHAT_OUTPUT_PRICE || '0.00028');
  return { inputPrice, outputPrice };
}

function filterByPeriod(records: TokenUsageRecord[], period: string): TokenUsageRecord[] {
  const now = Date.now();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  if (period === 'today') {
    return records.filter(r => r.timestamp >= startOfDay.getTime());
  }
  if (period === 'week') {
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    return records.filter(r => r.timestamp >= weekAgo);
  }
  if (period === 'month') {
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
    return records.filter(r => r.timestamp >= monthAgo);
  }
  return records;
}

// POST /api/stats/token-usage — record token usage
router.post('/token-usage', (req, res) => {
  const { model, promptTokens, completionTokens, totalTokens } = req.body as {
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };

  if (!model || promptTokens == null || completionTokens == null || totalTokens == null) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (promptTokens < 0 || completionTokens < 0 || totalTokens < 0) {
    return res.status(400).json({ error: 'Token counts must be non-negative' });
  }

  const { inputPrice, outputPrice } = getPrices();
  const cost = (promptTokens / 1000) * inputPrice + (completionTokens / 1000) * outputPrice;

  const record: TokenUsageRecord = {
    timestamp: Date.now(),
    model,
    promptTokens,
    completionTokens,
    totalTokens,
    cost,
  };

  try {
    const data = readStats();
    data.records = pruneOldRecords([...data.records, record]);
    writeStats(data);
    res.json({ ok: true, record });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// GET /api/stats/token-usage?period=today|week|month|all
router.get('/token-usage', (req, res) => {
  const period = (req.query.period as string) || 'all';

  try {
    const data = readStats();
    const filtered = filterByPeriod(data.records, period);

    const totalTokens = filtered.reduce((s, r) => s + r.totalTokens, 0);
    const totalPromptTokens = filtered.reduce((s, r) => s + r.promptTokens, 0);
    const totalCompletionTokens = filtered.reduce((s, r) => s + r.completionTokens, 0);
    const totalCost = filtered.reduce((s, r) => s + r.cost, 0);
    const requestCount = filtered.length;

    // Model distribution
    const modelMap: Record<string, { tokens: number; requests: number; cost: number }> = {};
    for (const r of filtered) {
      if (!modelMap[r.model]) modelMap[r.model] = { tokens: 0, requests: 0, cost: 0 };
      modelMap[r.model].tokens += r.totalTokens;
      modelMap[r.model].requests += 1;
      modelMap[r.model].cost += r.cost;
    }
    const modelDistribution = Object.entries(modelMap).map(([model, stats]) => ({
      model,
      tokens: stats.tokens,
      requests: stats.requests,
      cost: stats.cost,
      percentage: totalTokens > 0 ? Math.round((stats.tokens / totalTokens) * 100) : 0,
    }));

    // Daily breakdown (last 30 days)
    const dailyMap: Record<string, { tokens: number; requests: number; cost: number }> = {};
    for (const r of filtered) {
      const d = new Date(r.timestamp);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!dailyMap[key]) dailyMap[key] = { tokens: 0, requests: 0, cost: 0 };
      dailyMap[key].tokens += r.totalTokens;
      dailyMap[key].requests += 1;
      dailyMap[key].cost += r.cost;
    }
    const dailyStats = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, stats]) => ({ date, ...stats }));

    // Recent records (last 20)
    const recentRecords = [...filtered]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 20);

    res.json({
      period,
      summary: {
        totalTokens,
        totalPromptTokens,
        totalCompletionTokens,
        totalCost,
        requestCount,
      },
      modelDistribution,
      dailyStats,
      recentRecords,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

export default router;
