import type { ProjectContext } from '../services/deepseekService';

/**
 * 截断文件树字符串
 * 保留前 maxChars 字符，超出时添加截断提示
 */
export function truncateFileTree(tree: string, maxChars = 5000): string {
  if (!tree || tree.length <= maxChars) return tree;
  return tree.slice(0, maxChars) + '\n[... 已截断]';
}

/**
 * 截断文件内容
 * 保留头部（约 75%）和尾部（约 25%），中间用省略标注替代
 */
export function truncateFileContent(content: string, maxChars = 8000): string {
  if (!content || content.length <= maxChars) return content;
  const headChars = Math.floor(maxChars * 0.75); // 默认 6000
  const tailChars = maxChars - headChars;         // 默认 2000
  const head = content.slice(0, headChars);
  const tail = content.slice(content.length - tailChars);
  const omittedChars = content.length - headChars - tailChars;
  return `${head}\n[... 省略了 ${omittedChars} 字符 ...]\n${tail}`;
}

/**
 * 智能截断工具调用结果
 * 保留头部（约 2/3）和尾部（约 4/15），中间标注省略字符数
 */
export function truncateResult(str: string, maxChars = 3000): string {
  if (!str || str.length <= maxChars) return str;
  const headChars = Math.floor(maxChars * 2 / 3);  // 默认 2000
  const tailChars = maxChars - headChars;            // 默认 1000（充分利用预算）
  const head = str.slice(0, headChars);
  const tail = str.slice(str.length - tailChars);
  const omitted = str.length - headChars - tailChars;
  return `${head}\n[... 省略了 ${omitted} 字符 ...]\n${tail}`;
}

/**
 * 按优先级将上下文字段截断到总预算内
 * 优先级：fileTree (25%) > currentFileContent (40%) > relatedFiles (35%)
 */
export function buildContextWithBudget(
  context: ProjectContext,
  totalBudget = 20_000,
): {
  fileTree: string;
  currentFileContent: string;
  relatedFiles: { path: string; content: string }[];
} {
  const FILE_TREE_BUDGET = Math.floor(totalBudget * 0.25);     // 5000
  const CURRENT_FILE_BUDGET = Math.floor(totalBudget * 0.4);   // 8000
  const RELATED_FILES_BUDGET = totalBudget - FILE_TREE_BUDGET - CURRENT_FILE_BUDGET; // 7000

  const fileTree = truncateFileTree(context.fileTree || '', FILE_TREE_BUDGET);
  const currentFileContent = truncateFileContent(context.currentFileContent || '', CURRENT_FILE_BUDGET);

  const rawRelated = context.relatedFiles ?? [];
  const perFileBudget = rawRelated.length > 0
    ? Math.floor(RELATED_FILES_BUDGET / rawRelated.length)
    : RELATED_FILES_BUDGET;

  const relatedFiles = rawRelated.map(f => ({
    path: f.path,
    content: truncateFileContent(f.content, perFileBudget),
  }));

  return { fileTree, currentFileContent, relatedFiles };
}
