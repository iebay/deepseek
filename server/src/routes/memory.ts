import { Router, Request, Response } from 'express';
import {
  loadProjectMemory, appendDecision,
  saveContextSummary, initPersonality,
  readPersonality, writePersonality,
} from '../services/memoryService';
import { getAllowedRoots, isPathSafe } from '../utils/pathUtils';

const router = Router();

function validateRoot(root: string, res: Response): boolean {
  if (!root) {
    res.status(400).json({ error: 'root required' });
    return false;
  }
  if (!isPathSafe(root, getAllowedRoots())) {
    res.status(403).json({ error: 'Access denied: path is outside allowed roots' });
    return false;
  }
  return true;
}

// GET /api/memory?root=xxx — 读取全部记忆
router.get('/', (req: Request, res: Response) => {
  const root = req.query.root as string;
  if (!validateRoot(root, res)) return;
  try {
    res.json({ memory: loadProjectMemory(root) });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// GET /api/memory/personality?root=xxx
router.get('/personality', (req: Request, res: Response) => {
  const root = req.query.root as string;
  if (!validateRoot(root, res)) return;
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
  if (!validateRoot(root, res)) return;
  if (content === undefined) {
    res.status(400).json({ error: 'content required' });
    return;
  }
  try {
    writePersonality(root, content);
    res.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// POST /api/memory/decision { root, decision }
router.post('/decision', (req: Request, res: Response) => {
  const { root, decision } = req.body as { root: string; decision: string };
  if (!validateRoot(root, res)) return;
  if (!decision) {
    res.status(400).json({ error: 'decision required' });
    return;
  }
  try {
    appendDecision(root, decision);
    res.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// POST /api/memory/summary { root, summary }
router.post('/summary', (req: Request, res: Response) => {
  const { root, summary } = req.body as { root: string; summary: string };
  if (!validateRoot(root, res)) return;
  if (!summary) {
    res.status(400).json({ error: 'summary required' });
    return;
  }
  try {
    saveContextSummary(root, summary);
    res.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// POST /api/memory/init { root } — 初始化 .deepseek 文件夹
router.post('/init', (req: Request, res: Response) => {
  const { root } = req.body as { root: string };
  if (!validateRoot(root, res)) return;
  try {
    initPersonality(root);
    res.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

export default router;
