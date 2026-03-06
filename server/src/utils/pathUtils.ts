import path from 'path';
import os from 'os';
import type { Response } from 'express';

export function getAllowedRoots(): string[] {
  const envRoots = process.env.ALLOWED_ROOT_PATHS || process.env.ALLOWED_ROOTS || '';
  if (!envRoots) {
    return [os.homedir()];
  }
  return envRoots.split(',').map(r => r.trim()).filter(Boolean);
}

export function isPathSafe(filePath: string, allowedRoots: string[]): boolean {
  if (allowedRoots.length === 0) return false;
  const resolved = path.resolve(filePath);
  return allowedRoots.some(root => {
    const resolvedRoot = path.resolve(root);
    return resolved.startsWith(resolvedRoot + path.sep) || resolved === resolvedRoot;
  });
}

/**
 * Validates the `root` path parameter in route handlers.
 * Returns the validated root string on success, or sends a 400/403 response
 * and returns null when the path is missing or outside allowed roots.
 * Used across route files to centralize path validation logic.
 */
export function validateRootParam(root: string | undefined, res: Response): string | null {
  if (!root) {
    res.status(400).json({ error: 'root is required' });
    return null;
  }
  if (!isPathSafe(root, getAllowedRoots())) {
    res.status(403).json({ error: 'Access denied: path is outside allowed roots' });
    return null;
  }
  return root;
}

export function isTextFile(filePath: string): boolean {
  const textExtensions = new Set([
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
    '.css', '.scss', '.sass', '.less',
    '.html', '.htm', '.xml', '.svg',
    '.json', '.jsonc', '.yaml', '.yml', '.toml', '.ini', '.env',
    '.md', '.mdx', '.txt', '.rst',
    '.py', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.hpp',
    '.sh', '.bash', '.zsh', '.fish',
    '.prisma', '.graphql', '.gql',
    '.vue', '.svelte',
    '.lock', '.gitignore', '.gitattributes', '.editorconfig',
  ]);
  const ext = path.extname(filePath).toLowerCase();
  return textExtensions.has(ext) || ext === '';
}

export function isFileSizeOk(sizeInBytes: number, maxMB = 2): boolean {
  return sizeInBytes <= maxMB * 1024 * 1024;
}
