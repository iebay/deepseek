import { Router, Request, Response } from 'express';
import { getFileTree, readFile, writeFile, backupFile, restoreBackup } from '../services/fileService';
import path from 'path';
import fs from 'fs';
import mime from 'mime-types';
import { isPathSafe, getAllowedRoots } from '../utils/pathUtils';
import { shouldIgnoreDir, shouldIgnoreFile, isAllowedFileExtension } from '../utils/ignorePatterns';

const MAX_SEARCH_MATCHES = 500;
const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024; // 1 MB

interface SearchMatch {
  line: number;
  column: number;
  text: string;
  matchStart: number;
  matchEnd: number;
}

interface SearchResultFile {
  filePath: string;
  relativePath: string;
  matches: SearchMatch[];
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function globPatternToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '\x00') // temporary placeholder for **
    .replace(/\*/g, '[^/\\\\]*')
    .replace(/\x00/g, '.*')
    .replace(/\?/g, '[^/\\\\]');
  return new RegExp('^' + escaped + '$', 'i');
}

function matchesGlobPatterns(relPath: string, patterns: string[]): boolean {
  if (patterns.length === 0) return false;
  const filename = path.basename(relPath);
  const normalised = relPath.replace(/\\/g, '/');
  return patterns.some(p => {
    const re = globPatternToRegex(p.trim());
    return re.test(normalised) || re.test(filename);
  });
}

function searchInDirectory(
  root: string,
  query: string,
  options: {
    caseSensitive?: boolean;
    useRegex?: boolean;
    includePatterns: string[];
    excludePatterns: string[];
  }
): { results: SearchResultFile[]; totalMatches: number; filesSearched: number } {
  const results: SearchResultFile[] = [];
  let totalMatches = 0;
  let filesSearched = 0;

  const flags = options.caseSensitive ? 'g' : 'gi';
  let searchRegex: RegExp;
  if (options.useRegex) {
    searchRegex = new RegExp(query, flags);
  } else {
    searchRegex = new RegExp(escapeRegExp(query), flags);
  }

  function walk(dir: string): void {
    if (totalMatches >= MAX_SEARCH_MATCHES) return;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (totalMatches >= MAX_SEARCH_MATCHES) return;

      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(root, fullPath).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        if (shouldIgnoreDir(entry.name)) continue;
        if (options.excludePatterns.length > 0 && matchesGlobPatterns(relPath, options.excludePatterns)) continue;
        walk(fullPath);
      } else if (entry.isFile()) {
        if (shouldIgnoreFile(entry.name)) continue;
        if (!isAllowedFileExtension(entry.name)) continue;
        if (options.excludePatterns.length > 0 && matchesGlobPatterns(relPath, options.excludePatterns)) continue;
        if (options.includePatterns.length > 0 && !matchesGlobPatterns(relPath, options.includePatterns)) continue;

        let stat: fs.Stats;
        try {
          stat = fs.statSync(fullPath);
        } catch {
          continue;
        }
        if (stat.size > MAX_FILE_SIZE_BYTES) continue;

        let content: string;
        try {
          content = fs.readFileSync(fullPath, 'utf8');
        } catch {
          continue;
        }

        filesSearched++;
        const lines = content.split('\n');
        const fileMatches: SearchMatch[] = [];

        for (let i = 0; i < lines.length && totalMatches < MAX_SEARCH_MATCHES; i++) {
          const lineText = lines[i];
          searchRegex.lastIndex = 0;
          let match: RegExpExecArray | null;
          while ((match = searchRegex.exec(lineText)) !== null && totalMatches < MAX_SEARCH_MATCHES) {
            fileMatches.push({
              line: i + 1,
              column: match.index,
              text: lineText,
              matchStart: match.index,
              matchEnd: match.index + match[0].length,
            });
            totalMatches++;
            if (!searchRegex.global) break;
          }
        }

        if (fileMatches.length > 0) {
          results.push({ filePath: fullPath, relativePath: relPath, matches: fileMatches });
        }
      }
    }
  }

  walk(path.resolve(root));
  return { results, totalMatches, filesSearched };
}

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

router.post('/search', (req: Request, res: Response) => {
  const { root, query, caseSensitive, useRegex, includePattern, excludePattern } = req.body as {
    root: string;
    query: string;
    caseSensitive?: boolean;
    useRegex?: boolean;
    includePattern?: string;
    excludePattern?: string;
  };

  if (!root) return res.status(400).json({ error: 'root required' });
  if (!query || query.trim() === '') return res.status(400).json({ error: 'query required' });

  const allowedRoots = getAllowedRoots();
  if (!isPathSafe(root, allowedRoots)) {
    return res.status(403).json({ error: 'Access denied: path is outside allowed directories' });
  }

  const includePatterns = includePattern
    ? includePattern.split(',').map(p => p.trim()).filter(Boolean)
    : [];
  const excludePatterns = excludePattern
    ? excludePattern.split(',').map(p => p.trim()).filter(Boolean)
    : [];

  try {
    if (useRegex) {
      new RegExp(query); // validate regex before starting search
    }
    const searchResult = searchInDirectory(root, query, {
      caseSensitive: !!caseSensitive,
      useRegex: !!useRegex,
      includePatterns,
      excludePatterns,
    });
    res.json(searchResult);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(400).json({ error: msg });
  }
});

router.post('/replace', (req: Request, res: Response) => {
  const { replacements } = req.body as {
    replacements: { filePath: string; searchText: string; replaceWith: string; useRegex?: boolean; caseSensitive?: boolean }[];
  };

  if (!replacements || !Array.isArray(replacements)) {
    return res.status(400).json({ error: 'replacements array required' });
  }

  const allowedRoots = getAllowedRoots();
  let replacedCount = 0;
  let filesModified = 0;

  try {
    for (const { filePath, searchText, replaceWith, useRegex, caseSensitive } of replacements) {
      if (!filePath || !searchText) continue;
      if (!isPathSafe(filePath, allowedRoots)) {
        return res.status(403).json({ error: `Access denied: ${filePath} is outside allowed directories` });
      }

      let content: string;
      try {
        content = fs.readFileSync(filePath, 'utf8');
      } catch {
        continue;
      }

      const flags = caseSensitive ? 'g' : 'gi';
      let searchRegex: RegExp;
      try {
        searchRegex = useRegex
          ? new RegExp(searchText, flags)
          : new RegExp(escapeRegExp(searchText), flags);
      } catch {
        continue;
      }

      const matchCount = (content.match(searchRegex) || []).length;
      if (matchCount > 0) {
        const newContent = content.replace(searchRegex, replaceWith);
        try {
          fs.writeFileSync(filePath, newContent, 'utf8');
          replacedCount += matchCount;
          filesModified++;
        } catch {
          continue;
        }
      }
    }
    res.json({ success: true, replacedCount, filesModified });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

export default router;