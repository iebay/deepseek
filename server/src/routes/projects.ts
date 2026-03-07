import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getAllowedRoots, isPathSafe } from '../utils/pathUtils';

const router = Router();

const METADATA_FILE = path.join(os.homedir(), '.deepseek-projects.json');

interface ProjectMeta {
  favorite: boolean;
  lastOpened: number | null;
}

interface MetadataStore {
  projects: Record<string, ProjectMeta>;
}

function readMetadata(): MetadataStore {
  try {
    if (fs.existsSync(METADATA_FILE)) {
      const raw = fs.readFileSync(METADATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.projects) {
        return parsed as MetadataStore;
      }
    }
  } catch (err) {
    console.warn('[projects] Failed to read metadata file:', err instanceof Error ? err.message : err);
  }
  return { projects: {} };
}

function writeMetadata(data: MetadataStore): void {
  try {
    fs.writeFileSync(METADATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[projects] Failed to write metadata file:', err instanceof Error ? err.message : err);
  }
}

function detectTechStack(dirPath: string): string[] {
  const techStack: string[] = [];

  const pkgPath = path.join(dirPath, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps['react']) techStack.push('React');
      if (deps['vue']) techStack.push('Vue');
      if (deps['next']) techStack.push('Next.js');
      if (deps['nuxt']) techStack.push('Nuxt');
      if (deps['typescript'] || deps['ts-node']) techStack.push('TypeScript');
      if (deps['tailwindcss']) techStack.push('Tailwind CSS');
      if (deps['vite']) techStack.push('Vite');
      if (deps['express']) techStack.push('Express');
      if (deps['@supabase/supabase-js']) techStack.push('Supabase');
      if (deps['prisma']) techStack.push('Prisma');
      if (!techStack.length) techStack.push('Node.js');
    } catch {
      techStack.push('Node.js');
    }
  } else if (fs.existsSync(path.join(dirPath, 'requirements.txt')) ||
             fs.existsSync(path.join(dirPath, 'pyproject.toml')) ||
             fs.existsSync(path.join(dirPath, 'setup.py'))) {
    techStack.push('Python');
  } else if (fs.existsSync(path.join(dirPath, 'go.mod'))) {
    techStack.push('Go');
  } else if (fs.existsSync(path.join(dirPath, 'Cargo.toml'))) {
    techStack.push('Rust');
  } else if (fs.existsSync(path.join(dirPath, 'pom.xml')) ||
             fs.existsSync(path.join(dirPath, 'build.gradle'))) {
    techStack.push('Java');
  }

  return techStack;
}

// GET /api/projects/list
router.get('/list', (_req: Request, res: Response) => {
  try {
    const allowedRoots = getAllowedRoots();

    if (allowedRoots.length === 0) {
      return res.json({
        projects: [],
        warning: 'No allowed root paths configured. Set ALLOWED_ROOT_PATHS in .env',
      });
    }

    const metadata = readMetadata();
    const projectMap = new Map<string, {
      name: string;
      path: string;
      techStack: string[];
      lastOpened: number | null;
      isFavorite: boolean;
    }>();

    for (const root of allowedRoots) {
      const resolvedRoot = path.resolve(root);
      if (!fs.existsSync(resolvedRoot)) continue;

      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(resolvedRoot, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const dirPath = path.join(resolvedRoot, entry.name);
        if (projectMap.has(dirPath)) continue;

        const meta = metadata.projects[dirPath] ?? { favorite: false, lastOpened: null };
        const techStack = detectTechStack(dirPath);

        projectMap.set(dirPath, {
          name: entry.name,
          path: dirPath,
          techStack,
          lastOpened: meta.lastOpened ?? null,
          isFavorite: meta.favorite ?? false,
        });
      }
    }

    // Also include any tracked projects that may not be in subdirectories
    for (const [projPath, meta] of Object.entries(metadata.projects)) {
      if (projectMap.has(projPath)) continue;
      if (!isPathSafe(projPath, allowedRoots)) continue;
      if (!fs.existsSync(projPath)) continue;

      const stat = fs.statSync(projPath);
      if (!stat.isDirectory()) continue;

      const techStack = detectTechStack(projPath);
      projectMap.set(projPath, {
        name: path.basename(projPath),
        path: projPath,
        techStack,
        lastOpened: meta.lastOpened ?? null,
        isFavorite: meta.favorite ?? false,
      });
    }

    const projects = Array.from(projectMap.values());
    res.json({ projects });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// POST /api/projects/favorite
router.post('/favorite', (req: Request, res: Response) => {
  const { path: projPath, favorite } = req.body as { path?: string; favorite?: boolean };
  if (!projPath) return res.status(400).json({ error: 'path is required' });
  if (typeof favorite !== 'boolean') return res.status(400).json({ error: 'favorite must be a boolean' });

  if (!isPathSafe(projPath, getAllowedRoots())) {
    return res.status(403).json({ error: 'Access denied: path is outside allowed directories' });
  }

  const metadata = readMetadata();
  metadata.projects[projPath] = {
    ...(metadata.projects[projPath] ?? { lastOpened: null }),
    favorite,
  };
  writeMetadata(metadata);
  res.json({ success: true });
});

// POST /api/projects/recent
router.post('/recent', (req: Request, res: Response) => {
  const { path: projPath } = req.body as { path?: string };
  if (!projPath) return res.status(400).json({ error: 'path is required' });

  if (!isPathSafe(projPath, getAllowedRoots())) {
    return res.status(403).json({ error: 'Access denied: path is outside allowed directories' });
  }

  const metadata = readMetadata();
  metadata.projects[projPath] = {
    ...(metadata.projects[projPath] ?? { favorite: false }),
    lastOpened: Date.now(),
  };
  writeMetadata(metadata);
  res.json({ success: true });
});

// POST /api/projects/open
router.post('/open', (req: Request, res: Response) => {
  const { path: projPath } = req.body as { path?: string };
  if (!projPath) return res.status(400).json({ error: 'path is required' });

  const allowedRoots = getAllowedRoots();
  if (!isPathSafe(projPath, allowedRoots)) {
    return res.status(403).json({ error: 'Access denied: path is outside allowed directories' });
  }

  if (!fs.existsSync(projPath)) {
    return res.status(404).json({ error: 'Path does not exist' });
  }

  const stat = fs.statSync(projPath);
  if (!stat.isDirectory()) {
    return res.status(400).json({ error: 'Path must be a directory' });
  }

  const metadata = readMetadata();
  metadata.projects[projPath] = {
    ...(metadata.projects[projPath] ?? { favorite: false }),
    lastOpened: Date.now(),
  };
  writeMetadata(metadata);

  const meta = metadata.projects[projPath];
  const techStack = detectTechStack(projPath);

  res.json({
    name: path.basename(projPath),
    path: projPath,
    techStack,
    lastOpened: meta.lastOpened ?? null,
    isFavorite: meta.favorite ?? false,
  });
});

// DELETE /api/projects/remove
router.delete('/remove', (req: Request, res: Response) => {
  const { path: projPath } = req.body as { path?: string };
  if (!projPath) return res.status(400).json({ error: 'path is required' });

  if (!isPathSafe(projPath, getAllowedRoots())) {
    return res.status(403).json({ error: 'Access denied: path is outside allowed directories' });
  }

  const metadata = readMetadata();
  delete metadata.projects[projPath];
  writeMetadata(metadata);
  res.json({ success: true });
});

export default router;
