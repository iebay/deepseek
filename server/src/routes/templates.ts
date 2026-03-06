import { Router, Request, Response } from 'express';
import { getTemplates, createProjectFromTemplate } from '../services/templateService';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  try {
    const templates = getTemplates();
    res.json({ templates });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

router.post('/create', (req: Request, res: Response) => {
  const { templateId, projectName, targetPath } = req.body as {
    templateId: string;
    projectName: string;
    targetPath: string;
  };

  if (!templateId || !projectName || !targetPath) {
    return res.status(400).json({ error: 'templateId, projectName, targetPath 均为必填项' });
  }

  try {
    const result = createProjectFromTemplate(templateId, projectName, targetPath);
    res.json({ success: true, ...result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

export default router;
