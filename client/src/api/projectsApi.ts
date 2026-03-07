export interface ProjectInfo {
  name: string;
  path: string;
  techStack: string[];
  lastOpened: number | null;
  isFavorite: boolean;
}

const API_BASE = import.meta.env.VITE_API_URL || '';
const BASE = `${API_BASE}/api/projects`;

async function parseErrorResponse(res: Response): Promise<string> {
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      const err = await res.json();
      if (err.error) return err.error;
    } catch {
      // ignore parse failure
    }
  }
  if (res.status === 404) {
    return 'API 路由未找到，请确认后端已启动并在端口 3001 运行';
  }
  return `服务器错误 (${res.status}): ${res.statusText}`;
}

export async function fetchProjects(): Promise<ProjectInfo[]> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/list`);
  } catch (err) {
    console.error('[projectsApi] fetchProjects network error:', err);
    throw new Error('无法连接到服务器，请确认后端已启动 (npm run server)');
  }
  if (!res.ok) {
    throw new Error(await parseErrorResponse(res));
  }
  const data = await res.json();
  return data.projects as ProjectInfo[];
}

export async function toggleFavorite(path: string, favorite: boolean): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/favorite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, favorite }),
    });
  } catch {
    throw new Error('无法连接到服务器，请确认后端已启动 (npm run server)');
  }
  if (!res.ok) {
    throw new Error(await parseErrorResponse(res));
  }
}

export async function recordRecentProject(path: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/recent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
  } catch {
    throw new Error('无法连接到服务器，请确认后端已启动 (npm run server)');
  }
  if (!res.ok) {
    throw new Error(await parseErrorResponse(res));
  }
}

export async function openProjectByPath(path: string): Promise<ProjectInfo> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
  } catch {
    throw new Error('无法连接到服务器，请确认后端已启动 (npm run server)');
  }
  if (!res.ok) {
    throw new Error(await parseErrorResponse(res));
  }
  return res.json();
}

export async function removeProject(path: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/remove`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
  } catch {
    throw new Error('无法连接到服务器，请确认后端已启动 (npm run server)');
  }
  if (!res.ok) {
    throw new Error(await parseErrorResponse(res));
  }
}
