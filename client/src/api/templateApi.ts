import type { Template } from '../types';

const BASE = '/api/templates';

export async function fetchTemplates(): Promise<Template[]> {
  const res = await fetch(BASE);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || '获取模板列表失败');
  }
  const data = await res.json();
  return data.templates as Template[];
}

export async function createProjectFromTemplate(
  templateId: string,
  projectName: string,
  targetPath: string
): Promise<{ projectPath: string; filesCreated: number }> {
  const res = await fetch(`${BASE}/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ templateId, projectName, targetPath }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || '创建项目失败');
  }
  return res.json();
}
