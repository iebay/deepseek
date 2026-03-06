import fs from 'fs';
import path from 'path';
import { shouldIgnoreDir, shouldIgnoreFile, isAllowedFileExtension } from '../utils/ignorePatterns';
import { isPathSafe, getAllowedRoots, isFileSizeOk } from '../utils/pathUtils';

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  extension?: string;
}

export function getFileTree(rootPath: string): FileNode {
  const allowedRoots = getAllowedRoots();
  if (!isPathSafe(rootPath, allowedRoots)) {
    throw new Error('Access denied: path is outside allowed directories');
  }
  const stats = fs.statSync(rootPath);
  const name = path.basename(rootPath);

  if (stats.isDirectory()) {
    let children: FileNode[] = [];
    try {
      const entries = fs.readdirSync(rootPath);
      children = entries
        .filter(entry => {
          const entryPath = path.join(rootPath, entry);
          try {
            const entryStat = fs.statSync(entryPath);
            if (entryStat.isDirectory()) return !shouldIgnoreDir(entry);
            return !shouldIgnoreFile(entry);
          } catch {
            // File deleted or permission denied between readdirSync and statSync; skip this entry
            return false;
          }
        })
        .map(entry => getFileTree(path.join(rootPath, entry)))
        .sort((a, b) => {
          if (a.type === 'directory' && b.type === 'file') return -1;
          if (a.type === 'file' && b.type === 'directory') return 1;
          return a.name.localeCompare(b.name);
        });
    } catch {
      // Permission error, skip
    }
    return { name, path: rootPath, type: 'directory', children };
  } else {
    const ext = path.extname(name);
    return { name, path: rootPath, type: 'file', extension: ext };
  }
}

export function readFile(filePath: string): string {
  const allowedRoots = getAllowedRoots();
  if (!isPathSafe(filePath, allowedRoots)) {
    throw new Error('Access denied: path is outside allowed directories');
  }

  const stats = fs.statSync(filePath);
  if (!isFileSizeOk(stats.size)) {
    throw new Error(`File too large (max 2MB): ${stats.size} bytes`);
  }

  if (!isAllowedFileExtension(path.basename(filePath))) {
    throw new Error('File type not allowed');
  }

  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Writes content to a file, enforcing path safety and extension allowlist checks
 * (consistent with readFile). This intentionally restricts writes to known safe
 * file types. If AI needs to create a file with a new extension, add it to
 * ALLOWED_EXTENSIONS in ignorePatterns.ts.
 */
export function writeFile(filePath: string, content: string): void {
  const allowedRoots = getAllowedRoots();
  if (!isPathSafe(filePath, allowedRoots)) {
    throw new Error('Access denied: path is outside allowed directories');
  }
  if (!isAllowedFileExtension(path.basename(filePath))) {
    throw new Error(`File type not allowed: ${path.extname(filePath) || '(no extension)'}`);
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
}

export function backupFile(filePath: string): string {
  const allowedRoots = getAllowedRoots();
  if (!isPathSafe(filePath, allowedRoots)) {
    throw new Error('Access denied: path is outside allowed directories');
  }
  const backupPath = filePath + '.bak.' + Date.now();
  if (fs.existsSync(filePath)) {
    fs.copyFileSync(filePath, backupPath);
  }
  return backupPath;
}

export function restoreBackup(backupPath: string, originalPath: string): void {
  const allowedRoots = getAllowedRoots();
  if (!isPathSafe(backupPath, allowedRoots)) {
    throw new Error('Access denied: backupPath is outside allowed directories');
  }
  if (!isPathSafe(originalPath, allowedRoots)) {
    throw new Error('Access denied: originalPath is outside allowed directories');
  }
  fs.copyFileSync(backupPath, originalPath);
}

export { getFileTree as buildFileTree };