import { Router, Request, Response } from 'express';
import multer from 'multer';
import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs';
import { isPathSafe, getAllowedRoots } from '../utils/pathUtils';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

router.post('/zip', upload.single('file'), (req: Request, res: Response) => {
  const targetDir = req.body.targetDir as string;
  const file = (req as Request & { file?: Express.Multer.File }).file;
  if (!file) return res.status(400).json({ error: 'No file uploaded' });
  if (!targetDir) return res.status(400).json({ error: 'targetDir required' });

  const allowedRoots = getAllowedRoots();
  if (!isPathSafe(targetDir, allowedRoots)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const resolvedTarget = path.resolve(targetDir);

  try {
    const zip = new AdmZip(file.buffer);
    const entries = zip.getEntries();

    // Zip slip protection: verify all entries are within resolvedTarget
    for (const entry of entries) {
      const entryPath = path.resolve(resolvedTarget, entry.entryName);
      if (!entryPath.startsWith(resolvedTarget + path.sep) && entryPath !== resolvedTarget) {
        return res.status(400).json({ error: `Unsafe zip entry: ${entry.entryName}` });
      }
    }

    // Ensure target directory exists
    fs.mkdirSync(resolvedTarget, { recursive: true });

    // Extract
    zip.extractAllTo(resolvedTarget, true);

    res.json({ success: true, extractedTo: resolvedTarget, fileCount: entries.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

router.post('/files', upload.array('files', 50), (req: Request, res: Response) => {
  const targetDir = req.body.targetDir as string;
  if (!targetDir) return res.status(400).json({ error: 'targetDir required' });

  const files = (req as Request & { files?: Express.Multer.File[] }).files;
  if (!files || files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

  const allowedRoots = getAllowedRoots();
  if (!isPathSafe(targetDir, allowedRoots)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  let relativePaths: string[] = [];
  try {
    relativePaths = JSON.parse(req.body.relativePaths || '[]');
  } catch {
    return res.status(400).json({ error: 'Invalid relativePaths JSON' });
  }

  const resolvedTarget = path.resolve(targetDir);

  try {
    for (let i = 0; i < files.length; i++) {
      const relPath = relativePaths[i] || files[i].originalname;
      const fullPath = path.resolve(resolvedTarget, relPath);

      // Path traversal protection: ensure fullPath is within resolvedTarget
      const rel = path.relative(resolvedTarget, fullPath);
      if (rel.startsWith('..') || path.isAbsolute(rel)) {
        return res.status(400).json({ error: `Unsafe path: ${relPath}` });
      }

      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, files[i].buffer);
    }

    res.json({ success: true, fileCount: files.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

export default router;
