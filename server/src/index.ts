import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import filesRouter from './routes/files';
import aiRouter from './routes/ai';
import templatesRouter from './routes/templates';
import gitRouter from './routes/git';
import memoryRouter from './routes/memory';
import uploadRouter from './routes/upload';
import { analyzeProject } from './services/projectAnalyzer';

const app = express();
const PORT = parseInt(process.env.SERVER_PORT || '3001', 10);

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api/files', filesRouter);
app.use('/api/ai', aiRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/git', gitRouter);
app.use('/api/memory', memoryRouter);
app.use('/api/upload', uploadRouter);

app.post('/api/project/analyze', (req, res) => {
  const { root } = req.body as { root: string };
  if (!root) return res.status(400).json({ error: 'root is required' });
  try {
    const info = analyzeProject(root);
    res.json(info);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

app.listen(PORT, () => {
  console.log(`DeepSeek server running on http://localhost:${PORT}`);
});

export default app;
