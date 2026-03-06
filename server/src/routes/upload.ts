import { Router, Request, Response } from 'express';
import multer from 'multer';
import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { getAllowedRoots, isPathSafe } from '../utils/pathUtils';

const router = Router();

const upload = multer({
  dest: path.join(os.tmpdir(), 'deepseek-uploads'),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'application/zip',
      'application/x-zip-compressed',
      'application/x-zip',
    ];
    const isAllowed = allowedMimes.includes(file.mimetype) || file.originalname.endsWith('.zip');
    cb(null, isAllowed);
  },
});

// POST /api/upload/zip — extract a ZIP archive into a target directory
router.post('/zip', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    const targetDir = req.body.targetDir as string;

    if (!file) {
      return res.status(400).json({ error: '请上传 ZIP 文件' });
    }
    if (!targetDir) {
      fs.unlinkSync(file.path);
      return res.status(400).json({ error: '请指定目标目录' });
    }

    // Path safety check for target directory
    const resolvedTarget = path.resolve(targetDir);
    const allowedRoots = getAllowedRoots();
    if (!isPathSafe(resolvedTarget, allowedRoots)) {
      fs.unlinkSync(file.path);
      return res.status(403).json({ error: '目标目录访问被拒绝' });
    }

    const zip = new AdmZip(file.path);

    // Validate each ZIP entry to prevent zip slip attacks
    const entries = zip.getEntries();
    for (const entry of entries) {
      const entryPath = path.resolve(resolvedTarget, entry.entryName);
      if (!entryPath.startsWith(resolvedTarget + path.sep) && entryPath !== resolvedTarget) {
        fs.unlinkSync(file.path);
        return res.status(400).json({ error: `ZIP 包含非法路径: ${entry.entryName}` });
      }
    }

    zip.extractAllTo(resolvedTarget, true);

    // Clean up temporary upload file
    fs.unlinkSync(file.path);

    const extractedEntries = entries.map(e => ({
      name: e.entryName,
      isDirectory: e.isDirectory,
      size: e.header.size,
    }));

    res.json({
      success: true,
      message: `成功解压 ${extractedEntries.length} 个文件`,
      files: extractedEntries,
    });
  } catch (err) {
    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
    }
    res.status(500).json({
      error: `解压失败: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
});

export default router;
