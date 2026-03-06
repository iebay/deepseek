import fs from 'fs';
import path from 'path';
import { shouldIgnoreDir, shouldIgnoreFile, isAllowedFileExtension } from '../utils/ignorePatterns';
import { isPathSafe, getAllowedRoots } from '../utils/pathUtils';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  extension?: string;
}

export function getFileTree(rootPath: string): FileNode {
  const stats = fs.statSync(rootPath);
  const name = path.basename(rootPath);

  if (stats.isDirectory()) {
    let children: FileNode[] = [];
    try {
      const entries = fs.readdirSync(rootPath);
      children = entries
        .filter(entry => {
          const entryPath = path.join(rootPath, entry);
          const entryStat = fs.statSync(entryPath);
          if (entryStat.isDirectory()) return !shouldIgnoreDir(entry);
          return !shouldIgnoreFile(entry);
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
  if (stats.size > MAX_FILE_SIZE) {
    throw new Error(`File too large (max 2MB): ${stats.size} bytes`);
  }

  if (!isAllowedFileExtension(path.basename(filePath))) {
    throw new Error('File type not allowed');
  }

  return fs.readFileSync(filePath, 'utf-8');
}

export function writeFile(filePath: string, content: string): void {
  const allowedRoots = getAllowedRoots();
  if (!isPathSafe(filePath, allowedRoots)) {
    throw new Error('Access denied: path is outside allowed directories');
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
}

export function backupFile(filePath: string): string {
  const backupPath = filePath + '.bak.' + Date.now();
  if (fs.existsSync(filePath)) {
    fs.copyFileSync(filePath, backupPath);
  }
  return backupPath;
}

export function restoreBackup(backupPath: string, originalPath: string): void {
  fs.copyFileSync(backupPath, originalPath);
}