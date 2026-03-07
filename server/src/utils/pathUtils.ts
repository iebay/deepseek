import path from 'path';
import os from 'os';
import type { Response } from 'express';
import { isAllowedFileExtension } from './ignorePatterns';

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
  return isAllowedFileExtension(path.basename(filePath));
}

export function isFileSizeOk(sizeInBytes: number, maxMB = 2): boolean {
  return sizeInBytes <= maxMB * 1024 * 1024;
}
