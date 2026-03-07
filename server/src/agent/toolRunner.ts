import { execFileSync } from 'child_process';
import path from 'path';
import { readFile, writeFile, getFileTree } from '../services/fileService';
import { isPathSafe, getAllowedRoots } from '../utils/pathUtils';
import { search as semanticSearch } from '../services/semanticSearchService';
import { search as webSearch } from '../services/webSearchService';

const SAFE_COMMANDS = /^(npm |npx |tsc |eslint |prettier |cat |ls |dir |echo )/;
const SHELL_METACHARACTERS = /[;&|`$<>\\]/;
const MAX_RESULT_LENGTH = 3000;

const GITHUB_API_BASE = 'https://api.github.com';

function githubHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'DeepSeek-Code-Agent',
  };
}

async function createGithubBranch(
  owner: string,
  repo: string,
  branchName: string,
  sha: string,
  token: string,
): Promise<string> {
  const url = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/refs`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { ...githubHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    return `GitHub API 错误 (${resp.status}): ${body}`;
  }
  return `分支已创建: ${branchName}`;
}

function isValidGitRef(ref: string): boolean {
  // Allow only safe characters; also reject git-specific invalid patterns
  return (
    /^[a-zA-Z0-9_\-/]+$/.test(ref) &&
    !ref.includes('..') &&
    !ref.startsWith('-') &&
    !ref.startsWith('/') &&
    !ref.endsWith('/') &&
    !ref.endsWith('.lock') &&
    !ref.includes('@{') &&
    !/\/\//.test(ref)
  );
}

function truncate(str: string, max = MAX_RESULT_LENGTH): string {
  if (str.length <= max) return str;
  return str.slice(0, max) + `\n...[输出已截断，共 ${str.length} 字符]`;
}

function formatFileTree(node: ReturnType<typeof getFileTree>, indent = 0): string {
  const prefix = '  '.repeat(indent);
  if (node.type === 'file') return `${prefix}${node.name}`;
  const childLines = (node.children || []).map(c => formatFileTree(c, indent + 1)).join('\n');
  return childLines ? `${prefix}${node.name}/\n${childLines}` : `${prefix}${node.name}/`;
}

export interface ToolCallArgs {
  [key: string]: unknown;
}

export async function runTool(
  toolName: string,
  args: ToolCallArgs,
  projectRoot: string,
): Promise<string> {
  try {
    switch (toolName) {
      case 'read_file': {
        const filePath = args.path as string;
        if (!filePath) return '错误: 缺少 path 参数';
        const absPath = path.isAbsolute(filePath)
          ? filePath
          : path.join(projectRoot, filePath);
        const allowedRoots = getAllowedRoots();
        if (!isPathSafe(absPath, allowedRoots)) {
          return '错误: 文件路径不在允许的目录范围内';
        }
        const content = readFile(absPath);
        return truncate(content);
      }

      case 'write_file': {
        const filePath = args.path as string;
        const content = args.content as string;
        if (!filePath) return '错误: 缺少 path 参数';
        if (content === undefined || content === null) return '错误: 缺少 content 参数';
        const absPath = path.isAbsolute(filePath)
          ? filePath
          : path.join(projectRoot, filePath);
        const normalised = path.resolve(absPath);
        const allowedRoots = getAllowedRoots();
        if (!isPathSafe(normalised, allowedRoots)) {
          return '错误: 文件路径不在允许的目录范围内';
        }
        if (
          normalised.includes(`${path.sep}node_modules${path.sep}`) ||
          normalised.includes(`${path.sep}.git${path.sep}`) ||
          normalised.endsWith(`${path.sep}node_modules`) ||
          normalised.endsWith(`${path.sep}.git`)
        ) {
          return '错误: 禁止写入 node_modules 或 .git 目录';
        }
        writeFile(absPath, content);
        return `已成功写入文件: ${absPath}`;
      }

      case 'search_code': {
        const pattern = args.pattern as string;
        if (!pattern) return '错误: 缺少 pattern 参数';
        const searchPath = args.path
          ? path.isAbsolute(args.path as string)
            ? (args.path as string)
            : path.join(projectRoot, args.path as string)
          : projectRoot;
        const allowedRoots = getAllowedRoots();
        if (!isPathSafe(searchPath, allowedRoots)) {
          return '错误: 搜索路径不在允许的目录范围内';
        }
        const isRegex = Boolean(args.is_regex);
        const grepArgs: string[] = [
          '-rn',
          '--include=*.ts',
          '--include=*.tsx',
          '--include=*.js',
          '--include=*.jsx',
          '--include=*.json',
          '--include=*.css',
          '--include=*.html',
          '--include=*.md',
        ];
        if (!isRegex) grepArgs.push('--fixed-strings');
        grepArgs.push('--', pattern, searchPath);
        try {
          const result = execFileSync('grep', grepArgs, {
            encoding: 'utf-8',
            timeout: 10000,
            maxBuffer: 512 * 1024,
          });
          const lines = result.split('\n').slice(0, 50).join('\n');
          return lines || '未找到匹配结果';
        } catch (err: unknown) {
          const execErr = err as { status?: number; stdout?: string };
          if (execErr.status === 1) return '未找到匹配结果';
          return `搜索出错: ${execErr.stdout || '未知错误'}`;
        }
      }

      case 'list_directory': {
        const dirPath = args.path as string;
        if (!dirPath) return '错误: 缺少 path 参数';
        const absPath = path.isAbsolute(dirPath)
          ? dirPath
          : path.join(projectRoot, dirPath);
        const allowedRoots = getAllowedRoots();
        if (!isPathSafe(absPath, allowedRoots)) {
          return '错误: 目录路径不在允许的目录范围内';
        }
        const tree = getFileTree(absPath);
        return truncate(formatFileTree(tree));
      }

      case 'run_command': {
        const command = args.command as string;
        if (!command) return '错误: 缺少 command 参数';
        if (!SAFE_COMMANDS.test(command)) {
          return `错误: 命令不在安全白名单中。允许的命令前缀: npm, npx, tsc, eslint, prettier, cat, ls, dir, echo`;
        }
        if (SHELL_METACHARACTERS.test(command)) {
          return '错误: 命令包含不允许的特殊字符（; & | ` $ < > \\）';
        }
        const cwd = args.cwd
          ? path.isAbsolute(args.cwd as string)
            ? (args.cwd as string)
            : path.join(projectRoot, args.cwd as string)
          : projectRoot;
        const allowedRoots = getAllowedRoots();
        if (!isPathSafe(cwd, allowedRoots)) {
          return '错误: 工作目录不在允许的目录范围内';
        }
        try {
          const [cmd, ...cmdArgs] = command.split(/\s+/);
          const result = execFileSync(cmd, cmdArgs, {
            cwd,
            encoding: 'utf-8',
            timeout: 30000,
            stdio: ['pipe', 'pipe', 'pipe'],
          });
          return truncate(result || '命令执行成功（无输出）');
        } catch (err: unknown) {
          const execErr = err as { stdout?: string; stderr?: string; message?: string };
          const output = [execErr.stdout, execErr.stderr].filter(Boolean).join('\n');
          return truncate(`命令执行失败:\n${output || execErr.message || '未知错误'}`);
        }
      }

      case 'git_status': {
        const allowedRoots = getAllowedRoots();
        if (!isPathSafe(projectRoot, allowedRoots)) {
          return '错误: 项目根目录不在允许的目录范围内';
        }
        try {
          const status = execFileSync('git', ['status', '--porcelain'], {
            cwd: projectRoot,
            encoding: 'utf-8',
            timeout: 10000,
          });
          const branch = execFileSync('git', ['branch', '--show-current'], {
            cwd: projectRoot,
            encoding: 'utf-8',
            timeout: 10000,
          }).trim();
          return `当前分支: ${branch}\n变更文件:\n${status || '（无变更）'}`;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : '未知错误';
          return `获取 git 状态失败: ${msg}`;
        }
      }

      case 'task_complete': {
        const summary = args.summary as string;
        const filesModified = args.files_modified as string[] | undefined;
        return JSON.stringify({
          status: 'complete',
          summary: summary || '任务已完成',
          files_modified: filesModified || [],
        });
      }

      case 'semantic_search': {
        const query = args.query as string;
        if (!query) return '错误: 缺少 query 参数';
        const fileExtensions = args.file_extensions as string[] | undefined;
        const maxResults = (args.max_results as number | undefined) ?? 5;
        const results = semanticSearch(projectRoot, query, { fileExtensions, maxResults });
        if (results.length === 0) return '未找到相关代码文件';
        const output = results
          .map((r, i) => {
            const relPath = path.relative(projectRoot, r.filePath);
            return `[${i + 1}] ${relPath} (相关性: ${r.score.toFixed(3)})\n${r.snippet}`;
          })
          .join('\n\n---\n\n');
        return truncate(output);
      }

      case 'git_log': {
        const allowedRoots = getAllowedRoots();
        if (!isPathSafe(projectRoot, allowedRoots)) {
          return '错误: 项目根目录不在允许的目录范围内';
        }
        const limit = (args.limit as number | undefined) ?? 10;
        const logArgs: string[] = [
          'log',
          `--format=%h %ai %an: %s`,
          `-n`,
          String(Math.min(limit, 100)),
        ];
        if (args.since) logArgs.push(`--since=${args.since as string}`);
        if (args.path) {
          const filePath = args.path as string;
          const absPath = path.isAbsolute(filePath)
            ? filePath
            : path.join(projectRoot, filePath);
          logArgs.push('--', absPath);
        }
        try {
          const result = execFileSync('git', logArgs, {
            cwd: projectRoot,
            encoding: 'utf-8',
            timeout: 15000,
          });
          return result.trim() || '（无提交记录）';
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : '未知错误';
          return `获取 git 日志失败: ${msg}`;
        }
      }

      case 'git_diff': {
        const allowedRoots = getAllowedRoots();
        if (!isPathSafe(projectRoot, allowedRoots)) {
          return '错误: 项目根目录不在允许的目录范围内';
        }
        const from = (args.from as string | undefined) ?? 'HEAD~1';
        const to = (args.to as string | undefined) ?? 'HEAD';
        const diffArgs: string[] = ['diff', from, to];
        if (args.path) {
          const filePath = args.path as string;
          const absPath = path.isAbsolute(filePath)
            ? filePath
            : path.join(projectRoot, filePath);
          diffArgs.push('--', absPath);
        }
        try {
          const result = execFileSync('git', diffArgs, {
            cwd: projectRoot,
            encoding: 'utf-8',
            timeout: 15000,
            maxBuffer: 1024 * 1024,
          });
          return truncate(result.trim() || '（无差异）');
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : '未知错误';
          return `获取 git diff 失败: ${msg}`;
        }
      }

      case 'git_blame': {
        const allowedRoots = getAllowedRoots();
        if (!isPathSafe(projectRoot, allowedRoots)) {
          return '错误: 项目根目录不在允许的目录范围内';
        }
        const filePath = args.path as string;
        if (!filePath) return '错误: 缺少 path 参数';
        const absPath = path.isAbsolute(filePath)
          ? filePath
          : path.join(projectRoot, filePath);
        if (!isPathSafe(absPath, allowedRoots)) {
          return '错误: 文件路径不在允许的目录范围内';
        }
        const blameArgs: string[] = ['blame'];
        const startLine = args.start_line as number | undefined;
        const endLine = args.end_line as number | undefined;
        if (startLine !== undefined && endLine !== undefined) {
          blameArgs.push(`-L`, `${startLine},${endLine}`);
        } else if (startLine !== undefined) {
          blameArgs.push(`-L`, `${startLine},+50`);
        }
        blameArgs.push(absPath);
        try {
          const result = execFileSync('git', blameArgs, {
            cwd: projectRoot,
            encoding: 'utf-8',
            timeout: 15000,
            maxBuffer: 512 * 1024,
          });
          return truncate(result.trim());
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : '未知错误';
          return `获取 git blame 失败: ${msg}`;
        }
      }

      case 'find_references': {
        const symbol = args.symbol as string;
        if (!symbol) return '错误: 缺少 symbol 参数';
        // Only allow word characters and $ to avoid regex injection
        if (!/^[\w$]+$/.test(symbol)) {
          return '错误: symbol 只能包含字母、数字、_ 或 $';
        }
        // Escape any regex-special characters before embedding in patterns
        const escapedSymbol = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const allowedRoots = getAllowedRoots();
        if (!isPathSafe(projectRoot, allowedRoots)) {
          return '错误: 项目根目录不在允许的目录范围内';
        }
        const excludes = [
          '--exclude-dir=node_modules',
          '--exclude-dir=.git',
          '--exclude-dir=dist',
          '--exclude-dir=build',
          '--exclude-dir=coverage',
          '--exclude-dir=.next',
        ];
        const includes = [
          '--include=*.ts', '--include=*.tsx',
          '--include=*.js', '--include=*.jsx',
        ];
        const patterns = [
          { label: 'import', regex: `(import|require).*${escapedSymbol}` },
          { label: 'call', regex: `${escapedSymbol}\\(` },
          { label: 'jsx', regex: `<${escapedSymbol}[\\s/>]` },
          { label: 'type', regex: `: ${escapedSymbol}[\\s<,;)]` },
        ];
        const grouped: Record<string, string[]> = {};
        for (const { label, regex } of patterns) {
          const grepArgs = ['-rn', '-E', ...excludes, ...includes, '--', regex, projectRoot];
          try {
            const result = execFileSync('grep', grepArgs, {
              encoding: 'utf-8',
              timeout: 10000,
              maxBuffer: 512 * 1024,
            });
            const lines = result.split('\n').filter(Boolean).slice(0, 30);
            if (lines.length > 0) grouped[label] = lines;
          } catch (err: unknown) {
            const execErr = err as { status?: number };
            if (execErr.status !== 1) {
              grouped[label] = [`搜索出错`];
            }
          }
        }
        if (Object.keys(grouped).length === 0) return `未找到符号 "${symbol}" 的引用`;
        const output = Object.entries(grouped)
          .map(([label, lines]) => `### ${label}\n${lines.join('\n')}`)
          .join('\n\n');
        return truncate(output);
      }

      case 'web_search': {
        const query = args.query as string;
        if (!query) return '错误: 缺少 query 参数';
        const maxResults = (args.max_results as number | undefined) ?? 5;
        try {
          const results = await webSearch(query, Math.min(maxResults, 10));
          if (results.length === 0) return '未找到搜索结果';
          return results
            .map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.snippet}`)
            .join('\n\n');
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : '未知错误';
          return `网络搜索失败: ${msg}`;
        }
      }

      // ── GitHub API remote tools ────────────────────────────────────────────

      case 'github_read_file': {
        const token = process.env.GITHUB_TOKEN ?? process.env.GITHUB_PAT ?? '';
        if (!token) return '错误: 未配置 GITHUB_TOKEN 或 GITHUB_PAT 环境变量';
        const owner = args.owner as string;
        const repo = args.repo as string;
        const filePath = args.path as string;
        if (!owner || !repo || !filePath) return '错误: 缺少必要参数 owner、repo 或 path';
        const ref = args.ref as string | undefined;
        const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${filePath.split('/').map(encodeURIComponent).join('/')}${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`;
        const resp = await fetch(url, { headers: githubHeaders(token) });
        if (!resp.ok) {
          const body = await resp.text();
          return `GitHub API 错误 (${resp.status}): ${body}`;
        }
        const data = await resp.json() as { content?: string; encoding?: string; name?: string };
        if (data.encoding !== 'base64' || !data.content) {
          return '错误: 返回内容不是 base64 编码文件，可能是目录';
        }
        const decoded = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8');
        return truncate(decoded);
      }

      case 'github_write_file': {
        const token = process.env.GITHUB_TOKEN ?? process.env.GITHUB_PAT ?? '';
        if (!token) return '错误: 未配置 GITHUB_TOKEN 或 GITHUB_PAT 环境变量';
        const owner = args.owner as string;
        const repo = args.repo as string;
        const filePath = args.path as string;
        const content = args.content as string;
        const message = args.message as string;
        if (!owner || !repo || !filePath || content == null || !message) {
          return '错误: 缺少必要参数 owner、repo、path、content 或 message';
        }
        const branch = args.branch as string | undefined;
        const sha = args.sha as string | undefined;
        const encoded = Buffer.from(content, 'utf-8').toString('base64');
        const body: Record<string, string> = { message, content: encoded };
        if (branch) body['branch'] = branch;
        if (sha) body['sha'] = sha;
        const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${filePath.split('/').map(encodeURIComponent).join('/')}`;
        const resp = await fetch(url, {
          method: 'PUT',
          headers: { ...githubHeaders(token), 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!resp.ok) {
          const errBody = await resp.text();
          return `GitHub API 错误 (${resp.status}): ${errBody}`;
        }
        const result = await resp.json() as { commit?: { sha?: string } };
        return `文件已成功写入 GitHub: ${filePath}，commit SHA: ${result.commit?.sha ?? '未知'}`;
      }

      case 'github_list_repo': {
        const token = process.env.GITHUB_TOKEN ?? process.env.GITHUB_PAT ?? '';
        if (!token) return '错误: 未配置 GITHUB_TOKEN 或 GITHUB_PAT 环境变量';
        const owner = args.owner as string;
        const repo = args.repo as string;
        if (!owner || !repo) return '错误: 缺少必要参数 owner 或 repo';
        const dirPath = (args.path as string | undefined) ?? '';
        const ref = args.ref as string | undefined;
        const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${dirPath.split('/').filter(Boolean).map(encodeURIComponent).join('/')}${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`;
        const resp = await fetch(url, { headers: githubHeaders(token) });
        if (!resp.ok) {
          const body = await resp.text();
          return `GitHub API 错误 (${resp.status}): ${body}`;
        }
        const data = await resp.json() as Array<{ name: string; type: string; size?: number; path: string }>;
        if (!Array.isArray(data)) return '错误: 返回内容不是目录列表，可能是文件';
        const lines = data.map(item => `${item.type === 'dir' ? '[目录]' : '[文件]'} ${item.path}${item.size !== undefined ? ` (${item.size} bytes)` : ''}`);
        return lines.join('\n') || '（空目录）';
      }

      case 'github_create_branch': {
        const token = process.env.GITHUB_TOKEN ?? process.env.GITHUB_PAT ?? '';
        if (!token) return '错误: 未配置 GITHUB_TOKEN 或 GITHUB_PAT 环境变量';
        const owner = args.owner as string;
        const repo = args.repo as string;
        const branchName = args.branch_name as string;
        if (!owner || !repo || !branchName) return '错误: 缺少必要参数 owner、repo 或 branch_name';
        const fromBranch = (args.from_branch as string | undefined) ?? 'main';
        // Get SHA of source branch
        const refUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/ref/heads/${encodeURIComponent(fromBranch)}`;
        const refResp = await fetch(refUrl, { headers: githubHeaders(token) });
        if (!refResp.ok) {
          // Fallback: try master
          if (fromBranch === 'main') {
            const masterUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/ref/heads/master`;
            const masterResp = await fetch(masterUrl, { headers: githubHeaders(token) });
            if (!masterResp.ok) {
              const body = await masterResp.text();
              return `GitHub API 错误: 无法获取源分支 SHA (${masterResp.status}): ${body}`;
            }
            const masterData = await masterResp.json() as { object?: { sha?: string } };
            const sha = masterData.object?.sha;
            if (!sha) return '错误: 无法获取源分支 SHA';
            return createGithubBranch(owner, repo, branchName, sha, token);
          }
          const body = await refResp.text();
          return `GitHub API 错误 (${refResp.status}): ${body}`;
        }
        const refData = await refResp.json() as { object?: { sha?: string } };
        const sha = refData.object?.sha;
        if (!sha) return '错误: 无法获取源分支 SHA';
        return createGithubBranch(owner, repo, branchName, sha, token);
      }

      case 'github_create_pr': {
        const token = process.env.GITHUB_TOKEN ?? process.env.GITHUB_PAT ?? '';
        if (!token) return '错误: 未配置 GITHUB_TOKEN 或 GITHUB_PAT 环境变量';
        const owner = args.owner as string;
        const repo = args.repo as string;
        const title = args.title as string;
        const head = args.head as string;
        if (!owner || !repo || !title || !head) return '错误: 缺少必要参数 owner、repo、title 或 head';
        const base = (args.base as string | undefined) ?? 'main';
        const body = (args.body as string | undefined) ?? '';
        const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: { ...githubHeaders(token), 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, body, head, base }),
        });
        if (!resp.ok) {
          const errBody = await resp.text();
          return `GitHub API 错误 (${resp.status}): ${errBody}`;
        }
        const pr = await resp.json() as { html_url?: string; number?: number };
        return `Pull Request 已创建: #${pr.number} — ${pr.html_url}`;
      }

      // ── Local git tools ────────────────────────────────────────────────────

      case 'git_commit': {
        const allowedRoots = getAllowedRoots();
        if (!isPathSafe(projectRoot, allowedRoots)) {
          return '错误: 项目根目录不在允许的目录范围内';
        }
        const message = args.message as string;
        if (!message) return '错误: 缺少 message 参数';
        try {
          execFileSync('git', ['add', '-A'], { cwd: projectRoot, encoding: 'utf-8', timeout: 15000 });
          const result = execFileSync('git', ['commit', '-m', message], {
            cwd: projectRoot,
            encoding: 'utf-8',
            timeout: 15000,
          });
          return result.trim();
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : '未知错误';
          return `git commit 失败: ${msg}`;
        }
      }

      case 'git_push': {
        const allowedRoots = getAllowedRoots();
        if (!isPathSafe(projectRoot, allowedRoots)) {
          return '错误: 项目根目录不在允许的目录范围内';
        }
        const remote = (args.remote as string | undefined) ?? 'origin';
        const branch = args.branch as string | undefined;
        if (!isValidGitRef(remote)) return '错误: remote 包含非法字符';
        if (branch !== undefined && !isValidGitRef(branch)) return '错误: branch 包含非法字符';
        const pushArgs = ['push', remote];
        if (branch) pushArgs.push(branch);
        try {
          const result = execFileSync('git', pushArgs, {
            cwd: projectRoot,
            encoding: 'utf-8',
            timeout: 60000,
          });
          return result.trim() || 'push 成功';
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : '未知错误';
          return `git push 失败: ${msg}`;
        }
      }

      case 'git_pull': {
        const allowedRoots = getAllowedRoots();
        if (!isPathSafe(projectRoot, allowedRoots)) {
          return '错误: 项目根目录不在允许的目录范围内';
        }
        const remote = (args.remote as string | undefined) ?? 'origin';
        const branch = args.branch as string | undefined;
        if (!isValidGitRef(remote)) return '错误: remote 包含非法字符';
        if (branch !== undefined && !isValidGitRef(branch)) return '错误: branch 包含非法字符';
        const pullArgs = ['pull', remote];
        if (branch) pullArgs.push(branch);
        try {
          const result = execFileSync('git', pullArgs, {
            cwd: projectRoot,
            encoding: 'utf-8',
            timeout: 60000,
          });
          return result.trim() || 'pull 成功';
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : '未知错误';
          return `git pull 失败: ${msg}`;
        }
      }

      case 'git_clone': {
        const url = args.url as string;
        if (!url) return '错误: 缺少 url 参数';
        // Validate URL: must be https:// or git@ with no shell metacharacters
        if (!/^(https?:\/\/|git@)/.test(url)) {
          return '错误: url 必须是合法的 https:// 或 git@ 地址';
        }
        if (/[\s;&|`$<>'"]/.test(url)) {
          return '错误: url 包含非法字符';
        }
        const directory = args.directory as string | undefined;
        const cloneArgs = ['clone', url];
        if (directory) {
          const allowedRoots = getAllowedRoots();
          const absDir = path.resolve(
            path.isAbsolute(directory) ? directory : path.join(projectRoot, directory),
          );
          if (!isPathSafe(absDir, allowedRoots)) {
            return '错误: 克隆目标目录不在允许的目录范围内';
          }
          cloneArgs.push(absDir);
        }
        try {
          const result = execFileSync('git', cloneArgs, {
            cwd: projectRoot,
            encoding: 'utf-8',
            timeout: 120000,
          });
          return result.trim() || 'clone 成功';
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : '未知错误';
          return `git clone 失败: ${msg}`;
        }
      }

      default:
        return `错误: 未知工具 "${toolName}"`;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '未知错误';
    return `工具执行错误: ${msg}`;
  }
}
