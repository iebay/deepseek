/**
 * Regex patterns and utility for stripping XML/DSML-style tool-call tags that
 * some models emit as raw text instead of using the function-calling API.
 *
 * Handles:
 *   - The literal pipe form:  "< | DSML | function_calls>…</ | DSML | function_calls>"
 *   - The plain form:          "<function_calls>…</function_calls>"
 *   - "<invoke …>…</invoke>"
 *   - "<parameter …>…</parameter>"
 */
const DSML_TAG_RE = /< *\|? *DSML *\|? *[^>]*>[\s\S]*?< *\/ *\|? *DSML *\|? *[^>]*>/g;
const TOOL_CALL_TAG_RE = /<\s*(?:function_calls|invoke(?:\s[^>]*)?)>[\s\S]*?<\/\s*(?:function_calls|invoke)\s*>/g;
const PARAMETER_TAG_RE = /<\s*parameter(?:\s[^>]*)?>[\s\S]*?<\/\s*parameter\s*>/g;

export function sanitizeContent(text: string): string {
  return text
    .replace(DSML_TAG_RE, '')
    .replace(TOOL_CALL_TAG_RE, '')
    .replace(PARAMETER_TAG_RE, '')
    .trimEnd();
}
