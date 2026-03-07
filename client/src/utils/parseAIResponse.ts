/** Utilities for parsing structured information from AI responses. */

export interface FileChange {
  path: string;
  content: string;
}

export interface ParsedFileChanges {
  files: FileChange[];
  explanation?: string;
}

export interface CodeBlock {
  language: string;
  code: string;
  index: number;
}

export interface ParsedSections {
  analysis?: string;
  plan?: string;
  codeChanges?: string;
  summary?: string;
  rest: string;
}

/**
 * Extracts the first ```json {...}``` block that contains a "files" array.
 * Returns null if none found or the JSON is invalid.
 */
export function parseFileChanges(text: string): ParsedFileChanges | null {
  const codeRegex = /```json\s*([\s\S]*?)```/g;
  let match;
  while ((match = codeRegex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]) as Record<string, unknown>;
      if (parsed.files && Array.isArray(parsed.files) && parsed.files.length > 0) {
        return {
          files: parsed.files as FileChange[],
          explanation: typeof parsed.explanation === 'string' ? parsed.explanation : undefined,
        };
      }
    } catch {
      // not a valid JSON
    }
  }
  return null;
}

/**
 * Extracts all code blocks from an AI response.
 */
export function extractCodeBlocks(text: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const codeRegex = /```(\w*)\n?([\s\S]*?)```/g;
  let match;
  let index = 0;
  while ((match = codeRegex.exec(text)) !== null) {
    blocks.push({ language: match[1], code: match[2].trim(), index: index++ });
  }
  return blocks;
}

/**
 * Parses an AI response into structured sections based on markdown headings.
 * Looks for ## 分析, ## 方案, ## 代码修改, ## 总结 headings.
 */
export function parseSections(text: string): ParsedSections {
  const sectionMap: Record<string, string> = {};
  const sectionRegex = /^##\s+(分析|方案|代码修改|总结)\s*\n([\s\S]*?)(?=^##\s+|\Z)/gm;
  let match;
  let hasStructure = false;

  while ((match = sectionRegex.exec(text)) !== null) {
    sectionMap[match[1]] = match[2].trim();
    hasStructure = true;
  }

  if (!hasStructure) {
    return { rest: text };
  }

  return {
    analysis: sectionMap['分析'],
    plan: sectionMap['方案'],
    codeChanges: sectionMap['代码修改'],
    summary: sectionMap['总结'],
    rest: text,
  };
}
