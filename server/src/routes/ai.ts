import { Router, Request, Response } from 'express';
import { streamChat, ProjectContext, ChatMessage } from '../services/deepseekService';
import { ALLOWED_MODELS, DEFAULT_MODEL } from '../constants/models';

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

  const resolvedModel = model && (ALLOWED_MODELS as readonly string[]).includes(model)
    ? model
    : DEFAULT_MODEL;

  await streamChat(messages, context || { fileTree: '', techStack: [] }, resolvedModel, res);
});

export default router;