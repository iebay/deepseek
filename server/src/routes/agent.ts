import { Router, Request, Response } from 'express';
import { runAgent } from '../agent/executor';
import type { ChatMessage, ProjectContext } from '../services/deepseekService';
import { isPathSafe, getAllowedRoots } from '../utils/pathUtils';

const router = Router();

// POST /api/agent/run — 启动 Agent 任务 (SSE)
router.post('/run', async (req: Request, res: Response) => {
  const { messages, context, model } = req.body as {
    messages: ChatMessage[];
    context: ProjectContext & { projectRoot: string };
    model?: string;
  };

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  if (!context?.projectRoot) {
    return res.status(400).json({ error: 'context.projectRoot is required' });
  }

  const allowedRoots = getAllowedRoots();
  if (!isPathSafe(context.projectRoot, allowedRoots)) {
    return res.status(403).json({ error: 'Access denied: projectRoot is outside allowed directories' });
  }

  await runAgent(messages, context, model || 'deepseek-chat', res);
});

export default router;
