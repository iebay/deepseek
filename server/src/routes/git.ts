import { Router, Request, Response } from 'express';
import { spawnSync } from 'child_process';
import { getAllowedRoots, isPathSafe, validateRootParam } from '../utils/pathUtils';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

const router = Router();

// In-memory token storage (never written to disk)
let githubToken: string | null = null;

interface SpawnResult {
  stdout: string;
  stderr: string;
  status: number | null;
}

function runGit(args: string[], cwd: string, timeout = 15000, env?: NodeJS.ProcessEnv): SpawnResult {
  const result = spawnSync('git', args, {
    cwd,
    timeout,
    encoding: 'utf8',
    env: env ?? { ...process.env },
  });
  return {
    stdout: (result.stdout ?? '').toString().trim(),
    stderr: (result.stderr ?? '').toString().trim(),
    status: result.status,
  };
}

function gitOk(args: string[], cwd: string, timeout = 15000, env?: NodeJS.ProcessEnv): string {
  const r = runGit(args, cwd, timeout, env);
  if (r.status !== 0) {
    throw new Error(r.stderr || r.stdout || `git ${args[0]} failed`);
  }
  return r.stdout;
}

function isInsideRepo(cwd: string): boolean {
  const r = runGit(['rev-parse', '--is-inside-work-tree'], cwd);
  return r.status === 0;
}

// GET /api/git/status?root=<projectPath>
router.get('/status', (req: Request, res: Response) => {
  const root = validateRootParam(req.query.root as string, res);
  if (!root) return;

  try {
    if (!isInsideRepo(root)) {
      return res.json({ branch: '', changes: [], isRepo: false, hasRemote: false });
    }

    const branch = gitOk(['branch', '--show-current'], root);

    const statusOutput = gitOk(['status', '--porcelain'], root);
    const changes = statusOutput
      ? statusOutput.split('\n').filter(Boolean).map((line) => {
          const code = line.substring(0, 2).trim();
          const file = line.substring(3).trim();
          let status: 'modified' | 'added' | 'deleted' | 'untracked' | 'renamed' = 'modified';
          if (code === '?' || code === '??') status = 'untracked';
          else if (code === 'A') status = 'added';
          else if (code === 'D') status = 'deleted';
          else if (code === 'R') status = 'renamed';
          else status = 'modified';
          return { file, status };
        })
      : [];

    let hasRemote = false;
    let remoteUrl: string | undefined;
    try {
      const remoteOutput = gitOk(['remote', '-v'], root);
      hasRemote = remoteOutput.length > 0;
      const match = remoteOutput.match(/origin\s+(\S+)\s+\(fetch\)/);
      if (match) remoteUrl = match[1];
    } catch {
      hasRemote = false;
    }

    res.json({ branch, changes, isRepo: true, hasRemote, remoteUrl });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// GET /api/git/log?root=<projectPath>&limit=20
router.get('/log', (req: Request, res: Response) => {
  const root = validateRootParam(req.query.root as string, res);
  if (!root) return;

  const limit = Math.min(Math.max(1, parseInt((req.query.limit as string) || '20', 10)), 100);

  try {
    if (!isInsideRepo(root)) {
      return res.json({ commits: [] });
    }

    const logOutput = gitOk(
      ['log', `--format=%H|%s|%an|%aI`, `-n`, String(limit)],
      root
    );

    const commits = logOutput
      ? logOutput.split('\n').filter(Boolean).map((line) => {
          const [hash, message, author, date] = line.split('|');
          return { hash, shortHash: hash?.substring(0, 7), message, author, date };
        })
      : [];

    res.json({ commits });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// POST /api/git/commit
router.post('/commit', (req: Request, res: Response) => {
  const { root, message, files } = req.body as {
    root: string;
    message: string;
    files?: string[];
  };

  const validRoot = validateRootParam(root, res);
  if (!validRoot) return;

  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  try {
    if (files && files.length > 0) {
      gitOk(['add', '--', ...files], validRoot);
    } else {
      gitOk(['add', '.'], validRoot);
    }

    const output = gitOk(['commit', '-m', message], validRoot);
    const hashMatch = output.match(/\[[\w\s/]+\s+([a-f0-9]+)\]/);
    const commitHash = hashMatch ? hashMatch[1] : '';

    res.json({ success: true, commitHash, message: output });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// POST /api/git/push
router.post('/push', (req: Request, res: Response) => {
  const { root, remote = 'origin', branch } = req.body as {
    root: string;
    remote?: string;
    branch?: string;
  };

  const validRoot = validateRootParam(root, res);
  if (!validRoot) return;

  try {
    let currentBranch = branch;
    if (!currentBranch) {
      currentBranch = gitOk(['branch', '--show-current'], validRoot);
    }

    // Inject token via GIT_ASKPASS to avoid exposing it in process arguments.
    // The token is passed via an env var (GIT_TOKEN) so the script never
    // contains the token value, preventing shell injection attacks.
    if (githubToken) {
      let askpassScript: string | null = null;
      try {
        const remoteUrl = gitOk(['remote', 'get-url', remote], validRoot);
        askpassScript = path.join(os.tmpdir(), `git-askpass-${crypto.randomBytes(8).toString('hex')}.sh`);
        fs.writeFileSync(askpassScript, '#!/bin/sh\necho "$GIT_TOKEN"\n', { mode: 0o700 });
        const pushEnv: NodeJS.ProcessEnv = {
          ...process.env,
          GIT_ASKPASS: askpassScript,
          GIT_TOKEN: githubToken,
          GIT_TERMINAL_PROMPT: '0',
        };
        const pushResult = runGit(['push', remoteUrl, currentBranch], validRoot, 60000, pushEnv);
        if (pushResult.status !== 0) {
          throw new Error(pushResult.stderr || pushResult.stdout || 'Push failed');
        }
        return res.json({ success: true, message: pushResult.stdout || pushResult.stderr });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Push failed';
        return res.status(500).json({ error: msg });
      } finally {
        if (askpassScript) {
          try { fs.unlinkSync(askpassScript); } catch { /* ignore */ }
        }
      }
    }

    const output = gitOk(['push', remote, currentBranch], validRoot, 60000);
    res.json({ success: true, message: output });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// POST /api/git/init
router.post('/init', (req: Request, res: Response) => {
  const { root } = req.body as { root: string };

  const validRoot = validateRootParam(root, res);
  if (!validRoot) return;

  try {
    const output = gitOk(['init'], validRoot);
    res.json({ success: true, message: output });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// POST /api/git/remote
router.post('/remote', (req: Request, res: Response) => {
  const { root, url } = req.body as { root: string; url: string };

  const validRoot = validateRootParam(root, res);
  if (!validRoot) return;

  if (!url) {
    return res.status(400).json({ error: 'url is required' });
  }

  // Basic URL validation: must be https:// or git@ URL
  if (!/^(https?:\/\/|git@)/.test(url)) {
    return res.status(400).json({ error: 'url must be a valid https or git remote URL' });
  }

  try {
    const hasOrigin = runGit(['remote', 'get-url', 'origin'], validRoot).status === 0;
    if (hasOrigin) {
      gitOk(['remote', 'set-url', 'origin', url], validRoot);
    } else {
      gitOk(['remote', 'add', 'origin', url], validRoot);
    }
    res.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// POST /api/git/config-token
router.post('/config-token', (req: Request, res: Response) => {
  const { token } = req.body as { token: string };

  if (!token) {
    return res.status(400).json({ error: 'token is required' });
  }

  githubToken = token;
  res.json({ success: true });
});

// Branch name validation — prevents command injection
function isValidBranchName(name: string): boolean {
  return (
    /^[a-zA-Z0-9._\-/]+$/.test(name) &&
    !name.includes('..') &&
    !name.startsWith('/') &&
    !name.endsWith('/') &&
    !name.startsWith('-') &&
    !/\/\//.test(name)
  );
}

// GET /api/git/branches?root=<projectPath>
router.get('/branches', (req: Request, res: Response) => {
  const root = validateRootParam(req.query.root as string, res);
  if (!root) return;

  try {
    if (!isInsideRepo(root)) {
      return res.json({ current: '', local: [], remote: [] });
    }

    const current = gitOk(['rev-parse', '--abbrev-ref', 'HEAD'], root);

    const localOutput = runGit(
      ['branch', '--format=%(refname:short)|%(objectname:short)|%(subject)|%(creatordate:iso8601)'],
      root
    );
    const local = localOutput.status === 0 && localOutput.stdout
      ? localOutput.stdout.split('\n').filter(Boolean).map((line) => {
          const [name, lastCommit, lastCommitMessage, lastCommitDate] = line.split('|');
          return {
            name: name?.trim() ?? '',
            isCurrent: (name?.trim() ?? '') === current,
            lastCommit: lastCommit?.trim() ?? '',
            lastCommitMessage: lastCommitMessage?.trim() ?? '',
            lastCommitDate: lastCommitDate?.trim() ?? '',
          };
        })
      : [];

    const remoteOutput = runGit(
      ['branch', '-r', '--format=%(refname:short)|%(objectname:short)'],
      root
    );
    const remote = remoteOutput.status === 0 && remoteOutput.stdout
      ? remoteOutput.stdout.split('\n').filter(Boolean).map((line) => {
          const [name, lastCommit] = line.split('|');
          return { name: name?.trim() ?? '', lastCommit: lastCommit?.trim() ?? '' };
        })
      : [];

    res.json({ current, local, remote });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// POST /api/git/branch/create
router.post('/branch/create', (req: Request, res: Response) => {
  const { root, name, baseBranch, checkout: doCheckout = false } = req.body as {
    root: string;
    name: string;
    baseBranch: string;
    checkout?: boolean;
  };

  const validRoot = validateRootParam(root, res);
  if (!validRoot) return;

  if (!name) return res.status(400).json({ error: 'name is required' });
  if (!baseBranch) return res.status(400).json({ error: 'baseBranch is required' });
  if (!isValidBranchName(name)) return res.status(400).json({ error: 'Invalid branch name' });
  if (!isValidBranchName(baseBranch)) return res.status(400).json({ error: 'Invalid baseBranch name' });

  try {
    gitOk(['branch', name, baseBranch], validRoot);
    if (doCheckout) {
      gitOk(['checkout', name], validRoot);
    }
    res.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// POST /api/git/branch/checkout
router.post('/branch/checkout', (req: Request, res: Response) => {
  const { root, name } = req.body as { root: string; name: string };

  const validRoot = validateRootParam(root, res);
  if (!validRoot) return;

  if (!name) return res.status(400).json({ error: 'name is required' });
  if (!isValidBranchName(name)) return res.status(400).json({ error: 'Invalid branch name' });

  try {
    gitOk(['checkout', name], validRoot);
    res.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// POST /api/git/branch/merge
router.post('/branch/merge', (req: Request, res: Response) => {
  const { root, sourceBranch, targetBranch } = req.body as {
    root: string;
    sourceBranch: string;
    targetBranch: string;
  };

  const validRoot = validateRootParam(root, res);
  if (!validRoot) return;

  if (!sourceBranch) return res.status(400).json({ error: 'sourceBranch is required' });
  if (!targetBranch) return res.status(400).json({ error: 'targetBranch is required' });
  if (!isValidBranchName(sourceBranch)) return res.status(400).json({ error: 'Invalid sourceBranch name' });
  if (!isValidBranchName(targetBranch)) return res.status(400).json({ error: 'Invalid targetBranch name' });

  try {
    gitOk(['checkout', targetBranch], validRoot);
    const mergeResult = runGit(['merge', sourceBranch], validRoot);
    if (mergeResult.status !== 0) {
      // Check for conflicts
      const conflictOutput = runGit(['diff', '--name-only', '--diff-filter=U'], validRoot);
      const conflicts = conflictOutput.status === 0 && conflictOutput.stdout
        ? conflictOutput.stdout.split('\n').filter(Boolean)
        : [];
      return res.status(409).json({
        success: false,
        message: mergeResult.stderr || mergeResult.stdout || 'Merge failed',
        conflicts,
      });
    }
    res.json({ success: true, message: mergeResult.stdout });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// POST /api/git/branch/delete
router.post('/branch/delete', (req: Request, res: Response) => {
  const { root, name, force = false } = req.body as {
    root: string;
    name: string;
    force?: boolean;
  };

  const validRoot = validateRootParam(root, res);
  if (!validRoot) return;

  if (!name) return res.status(400).json({ error: 'name is required' });
  if (!isValidBranchName(name)) return res.status(400).json({ error: 'Invalid branch name' });

  try {
    const flag = force ? '-D' : '-d';
    gitOk(['branch', flag, name], validRoot);
    res.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// POST /api/git/branch/pull
router.post('/branch/pull', (req: Request, res: Response) => {
  const { root, remote = 'origin', branch } = req.body as {
    root: string;
    remote?: string;
    branch: string;
  };

  const validRoot = validateRootParam(root, res);
  if (!validRoot) return;

  if (!branch) return res.status(400).json({ error: 'branch is required' });
  if (!isValidBranchName(branch)) return res.status(400).json({ error: 'Invalid branch name' });
  if (!isValidBranchName(remote)) return res.status(400).json({ error: 'Invalid remote name' });

  try {
    const output = gitOk(['pull', remote, branch], validRoot, 60000);
    res.json({ success: true, message: output });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// POST /api/git/branch/push
router.post('/branch/push', (req: Request, res: Response) => {
  const { root, remote = 'origin', branch, setUpstream = false } = req.body as {
    root: string;
    remote?: string;
    branch: string;
    setUpstream?: boolean;
  };

  const validRoot = validateRootParam(root, res);
  if (!validRoot) return;

  if (!branch) return res.status(400).json({ error: 'branch is required' });
  if (!isValidBranchName(branch)) return res.status(400).json({ error: 'Invalid branch name' });
  if (!isValidBranchName(remote)) return res.status(400).json({ error: 'Invalid remote name' });

  try {
    const args = setUpstream
      ? ['push', '--set-upstream', remote, branch]
      : ['push', remote, branch];
    const output = gitOk(args, validRoot, 60000);
    res.json({ success: true, message: output });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// POST /api/git/clone
router.post('/clone', (req: Request, res: Response) => {
  const { url, targetDir } = req.body as { url: string; targetDir: string };

  if (!url) {
    return res.status(400).json({ error: 'url is required' });
  }
  if (!targetDir) {
    return res.status(400).json({ error: 'targetDir is required' });
  }

  // Validate URL: must be https:// or git@ URL
  if (!/^(https?:\/\/|git@)/.test(url)) {
    return res.status(400).json({ error: 'url must be a valid https or git remote URL' });
  }

  if (!isPathSafe(targetDir, getAllowedRoots())) {
    return res.status(403).json({ error: 'Access denied: targetDir is outside allowed directories' });
  }

  try {
    const cloneUrl = url;
    let askpassScript: string | null = null;

    // Ensure parent directory exists before cloning
    const parentDir = path.dirname(targetDir);
    fs.mkdirSync(parentDir, { recursive: true });

    if (githubToken && /^https?:\/\//.test(url)) {
      // Token is passed via env var, not embedded in the script, to prevent injection
      askpassScript = path.join(os.tmpdir(), `git-askpass-${crypto.randomBytes(8).toString('hex')}.sh`);
      fs.writeFileSync(askpassScript, '#!/bin/sh\necho "$GIT_TOKEN"\n', { mode: 0o700 });
    }

    try {
      const cloneEnv: NodeJS.ProcessEnv = {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0',
        ...(askpassScript ? { GIT_ASKPASS: askpassScript, GIT_TOKEN: githubToken ?? '' } : {}),
      };
      gitOk(['clone', cloneUrl, targetDir], parentDir, 120000, cloneEnv);
      res.json({ success: true, path: targetDir });
    } finally {
      if (askpassScript) {
        try { fs.unlinkSync(askpassScript); } catch { /* ignore */ }
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Clone failed';
    res.status(500).json({ error: msg });
  }
});

export default router;
