import { Router, Request, Response } from 'express';
import { streamChat, ProjectContext, ChatMessage } from '../services/deepseekService';
import { streamSmartChat } from '../services/smartChatService';
import { ALLOWED_MODELS, DEFAULT_MODEL } from '../constants/models';
import { isPathSafe, getAllowedRoots } from '../utils/pathUtils';

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

// POST /api/ai/smart-chat  (SSE streaming with read-only tool calling)
router.post('/smart-chat', async (req: Request, res: Response) => {
  const { messages, context, model } = req.body as {
    messages: ChatMessage[];
    context: ProjectContext;
    model: string;
  };

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const projectRoot = context?.projectRoot;
  if (!projectRoot) {
    return res.status(400).json({ error: 'context.projectRoot is required for smart-chat' });
  }

  if (!isPathSafe(projectRoot, getAllowedRoots())) {
    return res.status(403).json({ error: 'Access denied: projectRoot is outside allowed roots' });
  }

  const resolvedModel = model && (ALLOWED_MODELS as readonly string[]).includes(model)
    ? model
    : DEFAULT_MODEL;

  await streamSmartChat(messages, context, resolvedModel, res);
});

export default router;