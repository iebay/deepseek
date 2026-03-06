import fs from 'fs';
import path from 'path';

export interface ProjectInfo {
  name: string;
  path: string;
  techStack: string[];
  fileCount: number;
  lastOpened: string;
}

export function analyzeProject(rootPath: string): ProjectInfo {
  const name = path.basename(rootPath);
  const techStack: string[] = [];
  let fileCount = 0;

  const pkgPath = path.join(rootPath, 'package.json');
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
      if (deps['@supabase/supabase-js']) techStack.push('Supabase');
      if (deps['prisma']) techStack.push('Prisma');
      if (deps['express']) techStack.push('Express');
    } catch { }
  }

  function countFiles(dir: string) {
    try {
      const entries = fs.readdirSync(dir);
      for (const entry of entries) {
        if (['node_modules', '.git', 'dist', 'build'].includes(entry)) continue;
        const full = path.join(dir, entry);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) countFiles(full);
        else fileCount++;
      }
    } catch { }
  }
  countFiles(rootPath);

  return { name, path: rootPath, techStack, fileCount, lastOpened: new Date().toISOString() };
}