import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import WebSocket from 'ws';
import filesRouter from './routes/files';
import aiRouter from './routes/ai';
import templatesRouter from './routes/templates';
import gitRouter from './routes/git';
import memoryRouter from './routes/memory';
import uploadRouter from './routes/upload';
import agentRouter from './routes/agent';
import projectsRouter from './routes/projects';
import npmRouter from './routes/npm';
import { handleTerminalUpgrade } from './routes/terminal';
import { analyzeProject } from './services/projectAnalyzer';
import { getAllowedRoots, isPathSafe } from './utils/pathUtils';
import os from 'os';

const app = express();
const PORT = parseInt(process.env.SERVER_PORT || '3001', 10);

if (!process.env.ALLOWED_ROOT_PATHS && !process.env.ALLOWED_ROOTS) {
  console.warn(`[WARNING] ALLOWED_ROOT_PATHS is not set. Defaulting to home directory: ${os.homedir()}. Set ALLOWED_ROOT_PATHS in .env to restrict file system access.`);
}

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '请求过于频繁，请稍后再试' },
});
app.use('/api/', generalLimiter);

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'AI 请求过于频繁，请稍后再试' },
});
app.use('/api/ai/', aiLimiter);

const agentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Agent 请求过于频繁，请稍后再试' },
});
app.use('/api/agent/', agentLimiter);

app.use(express.json({ limit: '10mb' }));

app.use('/api/files', filesRouter);
app.use('/api/ai', aiRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/git', gitRouter);
app.use('/api/memory', memoryRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/agent', agentRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/npm', npmRouter);

app.post('/api/project/analyze', (req, res) => {
  const { root } = req.body as { root: string };
  if (!root) return res.status(400).json({ error: 'root is required' });
  if (!isPathSafe(root, getAllowedRoots())) {
    return res.status(403).json({ error: 'Access denied: path is outside allowed directories' });
  }
  try {
    const info = analyzeProject(root);
    res.json(info);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const url = request.url || '';
  if (url.startsWith('/ws/terminal')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      handleTerminalUpgrade(wss, ws, request).catch((err) => {
        console.error('[Terminal] Upgrade error:', err);
      });
    });
  } else {
    socket.destroy();
  }
});

server.listen(PORT, () => {
  console.log(`DeepSeek server running on http://localhost:${PORT}`);
});

export default app;
