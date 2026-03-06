import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { buildFileTree, readFile, writeFile } from '../services/fileService';
import { isPathSafe, getAllowedRoots, isTextFile, isFileSizeOk } from '../utils/pathUtils';

const router = Router();

// GET /api/files/tree?root=C:\xxx\project
router.get('/tree', (req: Request, res: Response) => {
  const root = req.query.root as string;
  if (!root) return res.status(400).json({ error: '缺少 root 参数' });

  const normalized = path.normalize(root);
  if (!fs.existsSync(normalized)) {
    return res.status(404).json({ error: `路径不存在：${normalized}` });
  }
  if (!fs.statSync(normalized).isDirectory()) {
    return res.status(400).json({ error: '路径必须是一个目录' });
  }

  const allowedRoots = getAllowedRoots();
  if (!isPathSafe(normalized, allowedRoots)) {
    return res.status(403).json({ error: '路径不在允许的范围内' });
  }

  try {
    const tree = buildFileTree(normalized, normalized);
    return res.json({ tree, root: normalized });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '未知错误';
    return res.status(500).json({ error: message });
  }
});

// GET /api/files/content?path=C:\xxx\file.ts
router.get('/content', (req: Request, res: Response) => {
  const filePath = req.query.path as string;
  if (!filePath) return res.status(400).json({ error: '缺少 path 参数' });

  const normalized = path.normalize(filePath);
  const allowedRoots = getAllowedRoots();
  if (!isPathSafe(normalized, allowedRoots)) {
    return res.status(403).json({ error: '路径不在允许的范围内' });
  }
  if (!fs.existsSync(normalized)) {
    return res.status(404).json({ error: `文件不存在：${normalized}` });
  }
  if (!isTextFile(normalized)) {
    return res.status(400).json({ error: '不支持读取二进制文件' });
  }
  if (!isFileSizeOk(normalized)) {
    return res.status(400).json({ error: '文件过大（超过 2MB），无法读取' });
  }

  try {
    const content = readFile(normalized);
    const ext = path.extname(normalized).toLowerCase().slice(1);
    return res.json({ content, path: normalized, extension: ext });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '未知错误';
    return res.status(500).json({ error: message });
  }
});

// POST /api/files/write  { path, content }
router.post('/write', (req: Request, res: Response) => {
  const { path: filePath, content } = req.body;
  if (!filePath || content === undefined) {
    return res.status(400).json({ error: '缺少 path 或 content 参数' });
  }

  const normalized = path.normalize(filePath);
  const allowedRoots = getAllowedRoots();
  if (!isPathSafe(normalized, allowedRoots)) {
    return res.status(403).json({ error: '路径不在允许的范围内' });
  }

  try {
    writeFile(normalized, content);
    return res.json({ success: true, path: normalized });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '未知错误';
    return res.status(500).json({ error: message });
  }
});

// POST /api/files/batch-write  { files: [{path, content}] }
router.post('/batch-write', (req: Request, res: Response) => {
  const { files } = req.body as { files: { path: string; content: string }[] };
  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: '缺少 files 数组' });
  }

  const allowedRoots = getAllowedRoots();
  const results: { path: string; success: boolean; error?: string }[] = [];

  for (const file of files) {
    const normalized = path.normalize(file.path);
    if (!isPathSafe(normalized, allowedRoots)) {
      results.push({ path: normalized, success: false, error: '路径不在允许的范围内' });
      continue;
    }
    try {
      writeFile(normalized, file.content);
      results.push({ path: normalized, success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '未知错误';
      results.push({ path: normalized, success: false, error: message });
    }
  }

  return res.json({ results });
});

export default router;