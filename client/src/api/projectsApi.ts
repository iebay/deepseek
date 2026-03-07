export interface ProjectInfo {
  name: string;
  path: string;
  techStack: string[];
  lastOpened: number | null;
  isFavorite: boolean;
}

const BASE = '/api/projects';

export async function fetchProjects(): Promise<ProjectInfo[]> {
  const res = await fetch(`${BASE}/list`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || '获取项目列表失败');
  }
  const data = await res.json();
  return data.projects as ProjectInfo[];
}

export async function toggleFavorite(path: string, favorite: boolean): Promise<void> {
  const res = await fetch(`${BASE}/favorite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, favorite }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || '操作失败');
  }
}

export async function recordRecentProject(path: string): Promise<void> {
  const res = await fetch(`${BASE}/recent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || '操作失败');
  }
}

export async function openProjectByPath(path: string): Promise<ProjectInfo> {
  const res = await fetch(`${BASE}/open`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || '打开项目失败');
  }
  return res.json();
}

export async function removeProject(path: string): Promise<void> {
  const res = await fetch(`${BASE}/remove`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || '操作失败');
  }
}
