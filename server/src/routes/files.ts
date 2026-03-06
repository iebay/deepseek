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
  const allowedRoots = getAllowedRoots();
  if (!isPathSafe(filePath, allowedRoots)) {
    return res.status(403).json({ error: 'Access denied: path is outside allowed directories' });
  }
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
  const allowedRoots = getAllowedRoots();
  if (!isPathSafe(filePath, allowedRoots)) {
    return res.status(403).json({ error: 'Access denied: path is outside allowed directories' });
  }
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
  if (!projectRoot) return res.status(400).json({ error: 'projectRoot required' });
  const allowedRoots = getAllowedRoots();
  if (!isPathSafe(projectRoot, allowedRoots)) {
    return res.status(403).json({ error: 'Access denied: projectRoot is outside allowed directories' });
  }
  try {
    const results: { path: string; backupPath: string }[] = [];
    for (const f of files) {
      const absPath = path.isAbsolute(f.path) ? f.path : path.join(projectRoot, f.path);
      if (!isPathSafe(absPath, allowedRoots)) {
        return res.status(403).json({ error: `Access denied: ${f.path} is outside allowed directories` });
      }
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
  const allowedRoots = getAllowedRoots();
  if (!isPathSafe(backupPath, allowedRoots)) {
    return res.status(403).json({ error: 'Access denied: backupPath is outside allowed directories' });
  }
  if (!isPathSafe(originalPath, allowedRoots)) {
    return res.status(403).json({ error: 'Access denied: originalPath is outside allowed directories' });
  }
  try {
    restoreBackup(backupPath, originalPath);
    res.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

router.post('/create', (req: Request, res: Response) => {
  const { path: filePath, type, content } = req.body as { path: string; type: 'file' | 'directory'; content?: string };
  if (!filePath) return res.status(400).json({ error: 'path required' });
  if (type !== 'file' && type !== 'directory') return res.status(400).json({ error: 'type must be "file" or "directory"' });
  const allowedRoots = getAllowedRoots();
  if (!isPathSafe(filePath, allowedRoots)) {
    return res.status(403).json({ error: 'Access denied: path is outside allowed directories' });
  }
  const resolved = path.resolve(filePath);
  try {
    if (type === 'directory') {
      fs.mkdirSync(resolved, { recursive: true });
    } else {
      fs.mkdirSync(path.dirname(resolved), { recursive: true });
      fs.writeFileSync(resolved, content ?? '', 'utf8');
    }
    res.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

router.post('/rename', (req: Request, res: Response) => {
  const { oldPath, newPath } = req.body as { oldPath: string; newPath: string };
  if (!oldPath || !newPath) return res.status(400).json({ error: 'oldPath and newPath required' });
  const allowedRoots = getAllowedRoots();
  if (!isPathSafe(oldPath, allowedRoots)) {
    return res.status(403).json({ error: 'Access denied: oldPath is outside allowed directories' });
  }
  if (!isPathSafe(newPath, allowedRoots)) {
    return res.status(403).json({ error: 'Access denied: newPath is outside allowed directories' });
  }
  try {
    fs.renameSync(path.resolve(oldPath), path.resolve(newPath));
    res.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

router.post('/delete', (req: Request, res: Response) => {
  const { path: filePath } = req.body as { path: string };
  if (!filePath) return res.status(400).json({ error: 'path required' });
  const allowedRoots = getAllowedRoots();
  if (!isPathSafe(filePath, allowedRoots)) {
    return res.status(403).json({ error: 'Access denied: path is outside allowed directories' });
  }
  const resolved = path.resolve(filePath);
  try {
    fs.rmSync(resolved, { recursive: true, force: true });
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