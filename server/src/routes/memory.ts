import { Router, Request, Response } from 'express';
import {
  loadProjectMemory, appendDecision,
  saveContextSummary, initPersonality,
  readPersonality, writePersonality,
  readContext, writeContext,
} from '../services/memoryService';
import { validateRootParam } from '../utils/pathUtils';

const router = Router();

// GET /api/memory?root=xxx — 读取全部记忆
router.get('/', (req: Request, res: Response) => {
  const root = validateRootParam(req.query.root as string, res);
  if (!root) return;
  try {
    res.json({ memory: loadProjectMemory(root) });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// GET /api/memory/personality?root=xxx
router.get('/personality', (req: Request, res: Response) => {
  const root = validateRootParam(req.query.root as string, res);
  if (!root) return;
  try {
    res.json({ content: readPersonality(root) });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// POST /api/memory/personality { root, content }
router.post('/personality', (req: Request, res: Response) => {
  const { root, content } = req.body as { root: string; content: string };
  const validRoot = validateRootParam(root, res);
  if (!validRoot) return;
  if (content === undefined) {
    res.status(400).json({ error: 'content required' });
    return;
  }
  try {
    writePersonality(validRoot, content);
    res.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// POST /api/memory/decision { root, decision }
router.post('/decision', (req: Request, res: Response) => {
  const { root, decision } = req.body as { root: string; decision: string };
  const validRoot = validateRootParam(root, res);
  if (!validRoot) return;
  if (!decision) {
    res.status(400).json({ error: 'decision required' });
    return;
  }
  try {
    appendDecision(validRoot, decision);
    res.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// POST /api/memory/summary { root, summary }
router.post('/summary', (req: Request, res: Response) => {
  const { root, summary } = req.body as { root: string; summary: string };
  const validRoot = validateRootParam(root, res);
  if (!validRoot) return;
  if (!summary) {
    res.status(400).json({ error: 'summary required' });
    return;
  }
  try {
    saveContextSummary(validRoot, summary);
    res.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// POST /api/memory/init { root } — 初始化 .deepseek 文件夹
router.post('/init', (req: Request, res: Response) => {
  const { root } = req.body as { root: string };
  const validRoot = validateRootParam(root, res);
  if (!validRoot) return;
  try {
    initPersonality(validRoot);
    res.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// GET /api/memory/context?root=xxx
router.get('/context', (req: Request, res: Response) => {
  const root = validateRootParam(req.query.root as string, res);
  if (!root) return;
  try {
    res.json({ content: readContext(root) });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// POST /api/memory/context { root, content }
router.post('/context', (req: Request, res: Response) => {
  const { root, content } = req.body as { root: string; content: string };
  const validRoot = validateRootParam(root, res);
  if (!validRoot) return;
  if (content === undefined) {
    res.status(400).json({ error: 'content required' });
    return;
  }
  try {
    writeContext(validRoot, content);
    res.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

export default router;
