import { Router } from 'express';
import type { Request, Response } from 'express';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { validateRootParam } from '../utils/pathUtils';

const router = Router();

function isValidPackageName(name: string): boolean {
  return /^(@[a-zA-Z0-9\-_]+\/)?[a-zA-Z0-9\-_.]+(@[a-zA-Z0-9\-_.^~*+=]+)?$/.test(name);
}

// GET /api/npm/dependencies?root=/project/path
router.get('/dependencies', (req: Request, res: Response) => {
  const root = validateRootParam(req.query.root as string | undefined, res);
  if (!root) return;

  const resolvedRoot = path.resolve(root);
  const pkgPath = path.join(resolvedRoot, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    return res.status(404).json({ error: '当前项目没有 package.json' });
  }

  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch {
    return res.status(500).json({ error: '无法解析 package.json' });
  }

  const deps = (pkg.dependencies as Record<string, string> | undefined) ?? {};
  const devDeps = (pkg.devDependencies as Record<string, string> | undefined) ?? {};

  const dependencies = Object.entries(deps).map(([name, version]) => ({
    name,
    version,
    type: 'production' as const,
  }));
  const devDependencies = Object.entries(devDeps).map(([name, version]) => ({
    name,
    version,
    type: 'development' as const,
  }));

  const hasLockFile =
    fs.existsSync(path.join(resolvedRoot, 'package-lock.json')) ||
    fs.existsSync(path.join(resolvedRoot, 'yarn.lock')) ||
    fs.existsSync(path.join(resolvedRoot, 'pnpm-lock.yaml'));

  res.json({
    dependencies,
    devDependencies,
    packageManager: 'npm',
    hasLockFile,
  });
});

// POST /api/npm/install
router.post('/install', (req: Request, res: Response) => {
  const { root, packages, isDev } = req.body as {
    root: string;
    packages: string[];
    isDev?: boolean;
  };

  const validRoot = validateRootParam(root, res);
  if (!validRoot) return;

  if (!Array.isArray(packages) || packages.length === 0) {
    return res.status(400).json({ error: 'packages 不能为空' });
  }

  for (const pkg of packages) {
    if (!isValidPackageName(pkg)) {
      return res.status(400).json({ error: `无效的包名: ${pkg}` });
    }
  }

  const devFlag = isDev ? ' --save-dev' : '';
  const pkgList = packages.join(' ');
  const resolvedRoot = path.resolve(validRoot);
  exec(
    `npm install ${pkgList}${devFlag}`,
    { cwd: resolvedRoot, timeout: 120_000 },
    (error, stdout, stderr) => {
      if (error) return res.status(500).json({ error: stderr || error.message });
      res.json({ success: true, output: stdout });
    }
  );
});

// POST /api/npm/uninstall
router.post('/uninstall', (req: Request, res: Response) => {
  const { root, packages } = req.body as {
    root: string;
    packages: string[];
  };

  const validRoot = validateRootParam(root, res);
  if (!validRoot) return;

  if (!Array.isArray(packages) || packages.length === 0) {
    return res.status(400).json({ error: 'packages 不能为空' });
  }

  for (const pkg of packages) {
    if (!isValidPackageName(pkg)) {
      return res.status(400).json({ error: `无效的包名: ${pkg}` });
    }
  }

  const pkgList = packages.join(' ');
  const resolvedRoot = path.resolve(validRoot);
  exec(
    `npm uninstall ${pkgList}`,
    { cwd: resolvedRoot, timeout: 120_000 },
    (error, stdout, stderr) => {
      if (error) return res.status(500).json({ error: stderr || error.message });
      res.json({ success: true, output: stdout });
    }
  );
});

// POST /api/npm/update
router.post('/update', (req: Request, res: Response) => {
  const { root, packages } = req.body as {
    root: string;
    packages: string[];
  };

  const validRoot = validateRootParam(root, res);
  if (!validRoot) return;

  if (!Array.isArray(packages) || packages.length === 0) {
    return res.status(400).json({ error: 'packages 不能为空' });
  }

  for (const pkg of packages) {
    if (!isValidPackageName(pkg)) {
      return res.status(400).json({ error: `无效的包名: ${pkg}` });
    }
  }

  const pkgList = packages.join(' ');
  const resolvedRoot = path.resolve(validRoot);
  exec(
    `npm update ${pkgList}`,
    { cwd: resolvedRoot, timeout: 120_000 },
    (error, stdout, stderr) => {
      if (error) return res.status(500).json({ error: stderr || error.message });
      res.json({ success: true, output: stdout });
    }
  );
});

// GET /api/npm/outdated?root=/project/path
router.get('/outdated', (req: Request, res: Response) => {
  const root = validateRootParam(req.query.root as string | undefined, res);
  if (!root) return;

  const resolvedRoot = path.resolve(root);
  const pkgPath = path.join(resolvedRoot, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    return res.status(404).json({ error: '当前项目没有 package.json' });
  }

  exec(
    'npm outdated --json',
    { cwd: resolvedRoot, timeout: 60_000 },
    (_error, stdout) => {
      // npm outdated exits with code 1 when there are outdated packages — not a real error
      let parsed: Record<string, { current: string; wanted: string; latest: string }> = {};
      try {
        parsed = stdout ? JSON.parse(stdout) : {};
      } catch {
        parsed = {};
      }

      const outdated = Object.entries(parsed).map(([name, info]) => ({
        name,
        current: info.current,
        wanted: info.wanted,
        latest: info.latest,
      }));

      res.json({ outdated });
    }
  );
});

export default router;
