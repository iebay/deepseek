const IGNORED_DIRS = new Set([
  'node_modules', '.git', '.svn', '.hg',
  'dist', 'build', 'out', '.next', '.nuxt', '.vite',
  '.cache', '.parcel-cache', '.turbo',
  'coverage', '.nyc_output',
  '.idea', '.vscode', '__pycache__', '.pytest_cache',
  '.DS_Store', 'Thumbs.db',
]);

const IGNORED_FILES = new Set([
  '.DS_Store', 'Thumbs.db', 'desktop.ini',
  '.env', '.env.local', '.env.production', '.env.development',
]);

const IGNORED_EXTENSIONS = new Set([
  '.exe', '.dll', '.so', '.dylib', '.bin', '.obj', '.o',
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico', '.webp', '.avif',
  '.mp3', '.mp4', '.wav', '.ogg', '.avi', '.mkv', '.mov',
  '.zip', '.tar', '.gz', '.bz2', '.rar', '.7z',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.ttf', '.otf', '.woff', '.woff2', '.eot',
  '.map',
]);

const ALLOWED_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.css', '.scss', '.sass', '.less',
  '.html', '.htm', '.xml', '.svg',
  '.json', '.jsonc', '.yaml', '.yml', '.toml', '.ini',
  '.md', '.mdx', '.txt', '.rst',
  '.py', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.hpp',
  '.sh', '.bash', '.zsh', '.fish',
  '.prisma', '.graphql', '.gql',
  '.vue', '.svelte',
  '.lock', '.gitignore', '.gitattributes', '.editorconfig', '.prettierrc', '.eslintrc',
  '.env.example',
]);

export function shouldIgnoreDir(name: string): boolean {
  return IGNORED_DIRS.has(name) || name.startsWith('.');
}

export function shouldIgnoreFile(name: string): boolean {
  if (IGNORED_FILES.has(name)) return true;
  const ext = name.includes('.') ? '.' + (name.split('.').pop()?.toLowerCase() ?? '') : '';
  return IGNORED_EXTENSIONS.has(ext);
}

export function isAllowedFileExtension(name: string): boolean {
  const ext = name.includes('.') ? '.' + (name.split('.').pop()?.toLowerCase() ?? '') : '';
  if (ext === '' || ext === '.') return true;
  return ALLOWED_EXTENSIONS.has(ext);
}
