import fs from 'fs';
import path from 'path';

const MEMORY_DIR = '.deepseek';

/** 读取项目的 AI 记忆（personality.md + decisions.md + context.md） */
export function loadProjectMemory(projectRoot: string): string {
  const memDir = path.join(projectRoot, MEMORY_DIR);
  if (!fs.existsSync(memDir)) return '';

  const parts: string[] = [];
  const files = ['personality.md', 'decisions.md', 'context.md'];

  for (const f of files) {
    const fp = path.join(memDir, f);
    if (fs.existsSync(fp)) {
      parts.push(`--- ${f} ---\n${fs.readFileSync(fp, 'utf-8')}`);
    }
  }
  return parts.join('\n\n');
}

/** 追加技术决策到 decisions.md */
export function appendDecision(projectRoot: string, decision: string): void {
  const memDir = path.join(projectRoot, MEMORY_DIR);
  if (!fs.existsSync(memDir)) fs.mkdirSync(memDir, { recursive: true });

  const fp = path.join(memDir, 'decisions.md');
  const date = new Date().toISOString().slice(0, 10);
  const entry = `\n## ${date}\n- ${decision}\n`;

  fs.appendFileSync(fp, entry, 'utf-8');
}

/** 保存对话摘要到 context.md */
export function saveContextSummary(projectRoot: string, summary: string): void {
  const memDir = path.join(projectRoot, MEMORY_DIR);
  if (!fs.existsSync(memDir)) fs.mkdirSync(memDir, { recursive: true });

  const fp = path.join(memDir, 'context.md');
  const date = new Date().toISOString().slice(0, 10);
  const entry = `\n### ${date} ${new Date().toLocaleTimeString('zh-CN')}\n${summary}\n`;

  fs.appendFileSync(fp, entry, 'utf-8');
}

/** 初始化默认 personality.md（不覆盖已有的） */
export function initPersonality(projectRoot: string): void {
  const memDir = path.join(projectRoot, MEMORY_DIR);
  if (!fs.existsSync(memDir)) fs.mkdirSync(memDir, { recursive: true });

  const fp = path.join(memDir, 'personality.md');
  if (fs.existsSync(fp)) return;

  const defaultContent = `# AI 行为规则

## 代码风格
- 使用 TypeScript strict mode
- React 用函数组件 + Hooks
- 修改文件时给出完整内容，不要给片段

## 回复风格
- 直接执行指令，不要反问
- 中文回答
- 先做再解释

## 禁止行为
- 不要说"我无法访问本地文件系统"
- 不要删除已有注释（除非用户要求）
- 不要引入新的第三方库（除非用户同意）
`;
  fs.writeFileSync(fp, defaultContent, 'utf-8');
}

/** 读取 personality.md 内容 */
export function readPersonality(projectRoot: string): string {
  const fp = path.join(projectRoot, MEMORY_DIR, 'personality.md');
  if (!fs.existsSync(fp)) {
    initPersonality(projectRoot);
  }
  return fs.readFileSync(fp, 'utf-8');
}

/** 保存 personality.md 内容 */
export function writePersonality(projectRoot: string, content: string): void {
  const memDir = path.join(projectRoot, MEMORY_DIR);
  if (!fs.existsSync(memDir)) fs.mkdirSync(memDir, { recursive: true });
  fs.writeFileSync(path.join(memDir, 'personality.md'), content, 'utf-8');
}

/** 读取 context.md 内容 */
export function readContext(projectRoot: string): string {
  const fp = path.join(projectRoot, MEMORY_DIR, 'context.md');
  return fs.existsSync(fp) ? fs.readFileSync(fp, 'utf-8') : '';
}

/** 保存 context.md 内容（覆盖写入） */
export function writeContext(projectRoot: string, content: string): void {
  const memDir = path.join(projectRoot, MEMORY_DIR);
  if (!fs.existsSync(memDir)) fs.mkdirSync(memDir, { recursive: true });
  fs.writeFileSync(path.join(memDir, 'context.md'), content, 'utf-8');
}
