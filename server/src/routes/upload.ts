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

export default router;
