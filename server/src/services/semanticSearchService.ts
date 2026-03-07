import fs from 'fs';
import path from 'path';

const MAX_FILES = 500;
const MAX_FILE_SIZE = 256 * 1024; // 256 KB
const SNIPPET_CONTEXT_LINES = 3;

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.cache']);
const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.scss', '.html', '.md',
  '.py', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.sh', '.yaml', '.yml',
]);

interface SearchResult {
  filePath: string;
  score: number;
  snippet: string;
}

function tokenize(text: string): string[] {
  return text
    // Split camelCase: "handleSend" → "handle Send"
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    // Split snake_case: "handle_send" → "handle send"
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
    .split(' ')
    .filter(t => t.length > 1);
}

function collectFiles(dir: string, extensions: Set<string>, results: string[]): void {
  if (results.length >= MAX_FILES) return;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (results.length >= MAX_FILES) return;
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        collectFiles(path.join(dir, entry.name), extensions, results);
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (extensions.has(ext)) {
        results.push(path.join(dir, entry.name));
      }
    }
  }
}

function scoreFile(fileTokens: string[], queryTerms: string[], fileContent: string): number {
  const tokenFreq = new Map<string, number>();
  for (const t of fileTokens) {
    tokenFreq.set(t, (tokenFreq.get(t) ?? 0) + 1);
  }
  const totalTokens = fileTokens.length || 1;
  let score = 0;
  const lowerContent = fileContent.toLowerCase();
  for (const term of queryTerms) {
    const tf = (tokenFreq.get(term) ?? 0) / totalTokens;
    // bonus for exact substring match (case-insensitive)
    const exactBonus = lowerContent.includes(term) ? 0.5 : 0;
    score += tf + exactBonus;
  }
  return score;
}

function extractSnippet(content: string, queryTerms: string[], contextLines: number): string {
  const lines = content.split('\n');
  let bestLine = -1;
  let bestCount = 0;
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    const count = queryTerms.filter(t => lower.includes(t)).length;
    if (count > bestCount) {
      bestCount = count;
      bestLine = i;
    }
  }
  if (bestLine === -1) {
    return lines.slice(0, contextLines * 2 + 1).join('\n');
  }
  const start = Math.max(0, bestLine - contextLines);
  const end = Math.min(lines.length - 1, bestLine + contextLines);
  return lines.slice(start, end + 1).join('\n');
}

export function search(
  projectRoot: string,
  query: string,
  options: { fileExtensions?: string[]; maxResults?: number } = {},
): SearchResult[] {
  const maxResults = options.maxResults ?? 5;
  const extensions =
    options.fileExtensions && options.fileExtensions.length > 0
      ? new Set(options.fileExtensions.map(e => (e.startsWith('.') ? e : `.${e}`)))
      : CODE_EXTENSIONS;

  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) return [];

  const files: string[] = [];
  collectFiles(projectRoot, extensions, files);

  const scored: SearchResult[] = [];
  for (const filePath of files) {
    let content: string;
    try {
      const stat = fs.statSync(filePath);
      if (stat.size > MAX_FILE_SIZE) continue;
      content = fs.readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }
    const fileTokens = tokenize(content);
    const score = scoreFile(fileTokens, queryTerms, content);
    if (score > 0) {
      const snippet = extractSnippet(content, queryTerms, SNIPPET_CONTEXT_LINES);
      scored.push({ filePath, score, snippet });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxResults);
}
