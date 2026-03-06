import path from 'path';
import os from 'os';

export function getAllowedRoots(): string[] {
  const roots: string[] = [];
  const envRoots = process.env.ALLOWED_ROOT_PATHS || process.env.ALLOWED_ROOTS || '';
  if (envRoots) {
    roots.push(...envRoots.split(',').map(r => r.trim()).filter(Boolean));
  }
  if (roots.length === 0) {
    roots.push(os.homedir());
  }
  return roots;
}

export function isPathSafe(filePath: string, allowedRoots: string[]): boolean {
  const resolved = path.resolve(filePath);
  return allowedRoots.some(root => {
    const resolvedRoot = path.resolve(root);
    return resolved.startsWith(resolvedRoot + path.sep) || resolved === resolvedRoot;
  });
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
