import type { GitStatus, GitLog } from '../types';

const BASE = '/api/git';

export interface CommitResult {
  success: boolean;
  commitHash: string;
  message: string;
}

export interface PushResult {
  success: boolean;
  message: string;
}

export interface SimpleResult {
  success: boolean;
  message?: string;
}

export async function fetchGitStatus(root: string): Promise<GitStatus> {
  const res = await fetch(`${BASE}/status?root=${encodeURIComponent(root)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Failed to get git status');
  }
  return res.json();
}

export async function fetchGitLog(root: string, limit = 20): Promise<GitLog> {
  const res = await fetch(`${BASE}/log?root=${encodeURIComponent(root)}&limit=${limit}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Failed to get git log');
  }
  return res.json();
}

export async function commitChanges(
  root: string,
  message: string,
  files?: string[]
): Promise<CommitResult> {
  const res = await fetch(`${BASE}/commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ root, message, files }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Commit failed');
  }
  return res.json();
}

export async function pushChanges(root: string, remote?: string, branch?: string): Promise<PushResult> {
  const res = await fetch(`${BASE}/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ root, remote, branch }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Push failed');
  }
  return res.json();
}

export async function initRepo(root: string): Promise<SimpleResult> {
  const res = await fetch(`${BASE}/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ root }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'git init failed');
  }
  return res.json();
}

export async function setRemote(root: string, url: string): Promise<SimpleResult> {
  const res = await fetch(`${BASE}/remote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ root, url }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Failed to set remote');
  }
  return res.json();
}

export async function configGitToken(token: string): Promise<SimpleResult> {
  const res = await fetch(`${BASE}/config-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Failed to configure token');
  }
  return res.json();
}

export interface BranchInfo {
  name: string;
  isCurrent: boolean;
  lastCommit: string;
  lastCommitMessage: string;
  lastCommitDate: string;
}

export interface BranchesResponse {
  current: string;
  local: BranchInfo[];
  remote: { name: string; lastCommit: string }[];
}

export interface MergeResult {
  success: boolean;
  message: string;
  conflicts?: string[];
}

export async function fetchBranches(root: string): Promise<BranchesResponse> {
  const res = await fetch(`${BASE}/branches?root=${encodeURIComponent(root)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Failed to get branches');
  }
  return res.json();
}

export async function createBranch(
  root: string,
  name: string,
  baseBranch: string,
  checkout = false
): Promise<void> {
  const res = await fetch(`${BASE}/branch/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ root, name, baseBranch, checkout }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Failed to create branch');
  }
}

export async function checkoutBranch(root: string, name: string): Promise<void> {
  const res = await fetch(`${BASE}/branch/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ root, name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Failed to checkout branch');
  }
}

export async function mergeBranch(
  root: string,
  sourceBranch: string,
  targetBranch: string
): Promise<MergeResult> {
  const res = await fetch(`${BASE}/branch/merge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ root, sourceBranch, targetBranch }),
  });
  const data = await res.json().catch(() => ({ success: false, message: res.statusText }));
  if (!res.ok) {
    return { success: false, message: data.error || data.message || 'Merge failed', conflicts: data.conflicts };
  }
  return data;
}

export async function deleteBranch(root: string, name: string, force = false): Promise<void> {
  const res = await fetch(`${BASE}/branch/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ root, name, force }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Failed to delete branch');
  }
}

export async function pullBranch(root: string, remote: string, branch: string): Promise<void> {
  const res = await fetch(`${BASE}/branch/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ root, remote, branch }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Failed to pull branch');
  }
}

export async function pushBranch(
  root: string,
  remote: string,
  branch: string,
  setUpstream = false
): Promise<void> {
  const res = await fetch(`${BASE}/branch/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ root, remote, branch, setUpstream }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Failed to push branch');
  }
}

export interface CloneResult {
  success: boolean;
  path: string;
}

export async function cloneRepo(url: string, targetDir: string): Promise<CloneResult> {
  const res = await fetch(`${BASE}/clone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, targetDir }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Clone failed');
  }
  return res.json();
}
