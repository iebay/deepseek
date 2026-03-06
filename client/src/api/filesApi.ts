import type { FileNode } from '../types';

const BASE = '/api/files';

export async function fetchFileTree(root: string): Promise<FileNode> {
  const res = await fetch(`${BASE}/tree?root=${encodeURIComponent(root)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || '获取文件树失败');
  }
  return res.json();
}

export async function fetchFileContent(filePath: string): Promise<string> {
  const res = await fetch(`${BASE}/content?path=${encodeURIComponent(filePath)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || '读取文件失败');
  }
  const data = await res.json();
  if (typeof data.content !== 'string') throw new Error('Invalid response: content is not a string');
  return data.content;
}

export function getRawFileUrl(filePath: string): string {
  return `${BASE}/raw?path=${encodeURIComponent(filePath)}`;
}

export async function saveFile(filePath: string, content: string): Promise<void> {
  const res = await fetch(`${BASE}/write`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: filePath, content }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || '保存文件失败');
  }
}

export async function batchWriteFiles(
  files: { path: string; content: string }[],
  projectRoot: string
): Promise<{ path: string; backupPath: string }[]> {
  const res = await fetch(`${BASE}/batch-write`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files, projectRoot }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || '批量写入失败');
  }
  const data = await res.json();
  if (!Array.isArray(data.results)) throw new Error('Invalid response: results is not an array');
  return data.results;
}

export async function restoreFile(backupPath: string, originalPath: string): Promise<void> {
  const res = await fetch(`${BASE}/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ backupPath, originalPath }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || '恢复备份失败');
  }
}

export async function uploadZip(file: File, targetDir: string): Promise<void> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('targetDir', targetDir);
  const res = await fetch('/api/upload/zip', {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'ZIP 上传失败');
  }
}

export async function uploadFiles(files: File[], targetDir: string, relativePaths?: string[]): Promise<void> {
  const formData = new FormData();
  files.forEach(f => formData.append('files', f));
  formData.append('targetDir', targetDir);
  if (relativePaths) {
    formData.append('relativePaths', JSON.stringify(relativePaths));
  }
  const res = await fetch('/api/upload/files', {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || '文件上传失败');
  }
}

export async function createFileOrDir(filePath: string, type: 'file' | 'directory', content?: string): Promise<void> {
  const res = await fetch(`${BASE}/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: filePath, type, content: content ?? '' }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || '创建失败');
  }
}

export async function renameFile(oldPath: string, newPath: string): Promise<void> {
  const res = await fetch(`${BASE}/rename`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ oldPath, newPath }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || '重命名失败');
  }
}

export async function deleteFile(filePath: string): Promise<void> {
  const res = await fetch(`${BASE}/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: filePath }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || '删除失败');
  }
}
