import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';

const router = Router();

const STATS_FILE = path.join(os.homedir(), '.deepseek-token-stats.json');
const MAX_RECORD_DAYS = 90;

interface TokenRecord {
  id: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  timestamp: number;
  date: string;
}

interface StatsFile {
  records: TokenRecord[];
  totalTokens: number;
  totalCost: number;
}

// DeepSeek pricing in $/token (configurable via .env)
const PRICING: Record<string, { input: number; output: number }> = {
  'deepseek-chat': {
    input: parseFloat(process.env.DEEPSEEK_CHAT_INPUT_PRICE || '0.000001'),
    output: parseFloat(process.env.DEEPSEEK_CHAT_OUTPUT_PRICE || '0.000002'),
  },
  'deepseek-reasoner': {
    input: parseFloat(process.env.DEEPSEEK_REASONER_INPUT_PRICE || '0.000004'),
    output: parseFloat(process.env.DEEPSEEK_REASONER_OUTPUT_PRICE || '0.000016'),
  },
  'deepseek-coder': {
    input: parseFloat(process.env.DEEPSEEK_CHAT_INPUT_PRICE || '0.000001'),
    output: parseFloat(process.env.DEEPSEEK_CHAT_OUTPUT_PRICE || '0.000002'),
  },
};

function calculateCost(model: string, promptTokens: number, completionTokens: number): number {
  const price = PRICING[model] ?? PRICING['deepseek-chat'];
  return promptTokens * price.input + completionTokens * price.output;
}

function generateId(): string {
  return crypto.randomUUID();
}

function loadStats(): StatsFile {
  try {
    if (!fs.existsSync(STATS_FILE)) {
      return { records: [], totalTokens: 0, totalCost: 0 };
    }
    const raw = fs.readFileSync(STATS_FILE, 'utf-8');
    return JSON.parse(raw) as StatsFile;
  } catch {
    return { records: [], totalTokens: 0, totalCost: 0 };
  }
}

function saveStats(data: StatsFile): void {
  // Prune records older than MAX_RECORD_DAYS
  const cutoff = Date.now() - MAX_RECORD_DAYS * 24 * 60 * 60 * 1000;
  data.records = data.records.filter(r => r.timestamp >= cutoff);
  // Recalculate totals after pruning
  data.totalTokens = data.records.reduce((s, r) => s + r.totalTokens, 0);
  data.totalCost = data.records.reduce((s, r) => s + r.cost, 0);
  fs.writeFileSync(STATS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function getDateString(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function filterByPeriod(records: TokenRecord[], period: string): TokenRecord[] {
  const now = Date.now();
  const today = getDateString(now);
  switch (period) {
    case 'today':
      return records.filter(r => getDateString(r.timestamp) === today);
    case 'week': {
      const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
      return records.filter(r => r.timestamp >= weekAgo);
    }
    case 'month': {
      const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
      return records.filter(r => r.timestamp >= monthAgo);
    }
    default:
      return records;
  }
}

// POST /api/stats/token-usage
router.post('/token-usage', (req: Request, res: Response) => {
  const { model, promptTokens, completionTokens, totalTokens } = req.body as {
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };

  if (!model || typeof promptTokens !== 'number' || typeof completionTokens !== 'number' || typeof totalTokens !== 'number'
    || isNaN(promptTokens) || isNaN(completionTokens) || isNaN(totalTokens)
    || promptTokens < 0 || completionTokens < 0 || totalTokens < 0) {
    return res.status(400).json({ error: 'model, promptTokens, completionTokens, totalTokens are required and must be non-negative numbers' });
  }

  const cost = calculateCost(model, promptTokens, completionTokens);
  const timestamp = Date.now();
  const record: TokenRecord = {
    id: generateId(),
    model,
    promptTokens,
    completionTokens,
    totalTokens,
    cost,
    timestamp,
    date: getDateString(timestamp),
  };

  const stats = loadStats();
  stats.records.push(record);
  stats.totalTokens += totalTokens;
  stats.totalCost += cost;
  saveStats(stats);

  res.json({ success: true, record });
});

// GET /api/stats/token-usage?period=today|week|month|all
router.get('/token-usage', (req: Request, res: Response) => {
  const period = (req.query.period as string) || 'all';
  const stats = loadStats();
  const filtered = filterByPeriod(stats.records, period);

  // Summary
  const summary = {
    totalTokens: filtered.reduce((s, r) => s + r.totalTokens, 0),
    totalPromptTokens: filtered.reduce((s, r) => s + r.promptTokens, 0),
    totalCompletionTokens: filtered.reduce((s, r) => s + r.completionTokens, 0),
    totalCost: filtered.reduce((s, r) => s + r.cost, 0),
    requestCount: filtered.length,
  };

  // By model
  const byModel: Record<string, { tokens: number; cost: number; count: number }> = {};
  for (const r of filtered) {
    if (!byModel[r.model]) byModel[r.model] = { tokens: 0, cost: 0, count: 0 };
    byModel[r.model].tokens += r.totalTokens;
    byModel[r.model].cost += r.cost;
    byModel[r.model].count += 1;
  }

  // Daily usage
  const dailyMap: Record<string, { tokens: number; cost: number; count: number }> = {};
  for (const r of filtered) {
    if (!dailyMap[r.date]) dailyMap[r.date] = { tokens: 0, cost: 0, count: 0 };
    dailyMap[r.date].tokens += r.totalTokens;
    dailyMap[r.date].cost += r.cost;
    dailyMap[r.date].count += 1;
  }
  const dailyUsage = Object.entries(dailyMap)
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30);

  // Recent records (last 10)
  const recentRecords = [...filtered]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 10)
    .map(({ id, model, totalTokens, cost, timestamp }) => ({ id, model, totalTokens, cost, timestamp }));

  res.json({ summary, byModel, dailyUsage, recentRecords });
});

export default router;
