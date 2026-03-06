import { Router, Request, Response } from 'express';
import { getFileTree, readFile, writeFile, backupFile, restoreBackup } from '../services/fileService';
import path from 'path';
import fs from 'fs';
import mime from 'mime-types';
import { isPathSafe, getAllowedRoots } from '../utils/pathUtils';

const router = Router();

router.get('/tree', (req: Request, res: Response) => {
  const root = req.query.root as string;
  if (!root) return res.status(400).json({ error: 'root query param required' });
  const allowedRoots = getAllowedRoots();
  if (!isPathSafe(root, allowedRoots)) {
    return res.status(403).json({ error: 'Access denied: path is outside allowed directories' });
  }
  try {
    const tree = getFileTree(root);
    res.json(tree);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

router.get('/content', (req: Request, res: Response) => {
  const filePath = req.query.path as string;
  if (!filePath) return res.status(400).json({ error: 'path query param required' });
  try {
    const content = readFile(filePath);
    res.json({ content });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

router.post('/write', (req: Request, res: Response) => {
  const { path: filePath, content } = req.body as { path: string; content: string };
  if (!filePath || content === undefined) return res.status(400).json({ error: 'path and content required' });
  try {
    writeFile(filePath, content);
    res.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

router.post('/batch-write', (req: Request, res: Response) => {
  const { files, projectRoot } = req.body as { files: { path: string; content: string }[]; projectRoot: string };
  if (!files || !Array.isArray(files)) return res.status(400).json({ error: 'files array required' });
  try {
    const results: { path: string; backupPath: string }[] = [];
    for (const f of files) {
      const absPath = path.isAbsolute(f.path) ? f.path : path.join(projectRoot, f.path);
      const backupPath = backupFile(absPath);
      writeFile(absPath, f.content);
      results.push({ path: absPath, backupPath });
    }
    res.json({ success: true, results });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

router.post('/restore', (req: Request, res: Response) => {
  const { backupPath, originalPath } = req.body as { backupPath: string; originalPath: string };
  if (!backupPath || !originalPath) return res.status(400).json({ error: 'backupPath and originalPath required' });
  try {
    restoreBackup(backupPath, originalPath);
    res.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

router.get('/raw', (req: Request, res: Response) => {
  const filePath = req.query.path as string;
  if (!filePath) return res.status(400).json({ error: 'path query param required' });
  const allowedRoots = getAllowedRoots();
  if (!isPathSafe(filePath, allowedRoots)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  const resolved = path.resolve(filePath);
  try {
    const stat = fs.statSync(resolved);
    if (!stat.isFile()) return res.status(400).json({ error: 'Not a file' });
    const mimeType = mime.lookup(resolved) || 'application/octet-stream';
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Cache-Control', 'no-store');
    const stream = fs.createReadStream(resolved);
    stream.pipe(res);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

export default router;