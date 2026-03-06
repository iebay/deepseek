import { execSync, execFileSync } from 'child_process';
import path from 'path';
import { readFile, writeFile, getFileTree } from '../services/fileService';
import { isPathSafe, getAllowedRoots } from '../utils/pathUtils';

const SAFE_COMMANDS = /^(npm |npx |tsc |eslint |prettier |cat |ls |dir |echo )/;
const MAX_RESULT_LENGTH = 3000;

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
          isRegex ? '-rn' : '-rn',
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
          return `错误: 命令不在安全白名单中。允许的命令前缀: npm, npx, tsc, eslint, prettier, cat, ls, dir, echo, node -e`;
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
          const result = execSync(command, {
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

      default:
        return `错误: 未知工具 "${toolName}"`;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '未知错误';
    return `工具执行错误: ${msg}`;
  }
}
