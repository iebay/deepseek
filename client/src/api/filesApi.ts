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
  return data.content as string;
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

export const writeFileContent = saveFile;

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
