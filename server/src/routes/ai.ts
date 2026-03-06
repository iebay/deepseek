import { Router, Request, Response } from 'express';
import { streamChat, ProjectContext, ChatMessage } from '../services/deepseekService';

const router = Router();

// POST /api/ai/chat  (SSE streaming)
router.post('/chat', async (req: Request, res: Response) => {
  const { messages, context, model } = req.body as {
    messages: ChatMessage[];
    context: ProjectContext;
    model: string;
  };

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  await streamChat(messages, context || { fileTree: '', techStack: [] }, model || 'deepseek-chat', res);
});

export default router;