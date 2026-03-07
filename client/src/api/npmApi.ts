const BASE = '/api/npm';

export interface DependencyInfo {
  name: string;
  version: string;
  type: 'production' | 'development';
}

export interface OutdatedInfo {
  name: string;
  current: string;
  wanted: string;
  latest: string;
}

export interface DependenciesResponse {
  dependencies: DependencyInfo[];
  devDependencies: DependencyInfo[];
  packageManager: string;
  hasLockFile: boolean;
}

export async function fetchDependencies(root: string): Promise<DependenciesResponse> {
  const res = await fetch(`${BASE}/dependencies?root=${encodeURIComponent(root)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Failed to fetch dependencies');
  }
  return res.json();
}

export async function installPackages(
  root: string,
  packages: string[],
  isDev = false
): Promise<{ output: string }> {
  const res = await fetch(`${BASE}/install`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ root, packages, isDev }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Install failed');
  }
  return res.json();
}

export async function uninstallPackages(
  root: string,
  packages: string[]
): Promise<{ output: string }> {
  const res = await fetch(`${BASE}/uninstall`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ root, packages }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Uninstall failed');
  }
  return res.json();
}

export async function updatePackages(
  root: string,
  packages: string[]
): Promise<{ output: string }> {
  const res = await fetch(`${BASE}/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ root, packages }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Update failed');
  }
  return res.json();
}

export async function checkOutdated(root: string): Promise<OutdatedInfo[]> {
  const res = await fetch(`${BASE}/outdated?root=${encodeURIComponent(root)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Failed to check outdated');
  }
  const data = await res.json();
  return data.outdated as OutdatedInfo[];
}
