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

/**
 * Strip DSML/tool-call tags from a buffer without trimming trailing whitespace,
 * so that remainder text after a tag is preserved for further processing.
 */
function stripTagsOnly(text: string): string {
  return text
    .replace(DSML_TAG_RE, '')
    .replace(TOOL_CALL_TAG_RE, '')
    .replace(PARAMETER_TAG_RE, '');
}

/**
 * Regex to detect whether a `<`-prefixed buffer could be the opening of a
 * DSML/tool-call tag we need to strip.  Matches things like:
 *   < | DSML …    <DSML …    <function_calls    <invoke    <parameter
 *   and their closing forms:  </function_calls  </invoke  </parameter
 */
const MAYBE_TAG_RE = /^<(?:\s*\|\s*)?\/? *(?:DSML|function_calls|invoke|parameter)/i;

/**
 * Number of characters (from the `<`) we need to accumulate before we can
 * rule out that a `<` starts a DSML tag.  The longest opening keyword is
 * "function_calls" (14 chars), plus the leading `<`, giving 15.  We use 20
 * for a 5-character safety margin.
 */
const TAG_LOOKAHEAD = 20;

/** If the buffer grows beyond this size, flush it regardless. */
const MAX_BUFFER = 10_000;

/**
 * Stateful sanitizer for **streaming** content.
 *
 * When DSML/XML tool-call tags are split across SSE chunks the per-chunk
 * `sanitizeContent()` call never sees a complete tag and lets all fragments
 * through.  `StreamSanitizer` buffers text from the moment it detects a
 * potential tag opening (`<`) and only emits it once the tag is complete (and
 * therefore removable) or once it can be determined that the `<` is not part
 * of a DSML tag.
 *
 * Usage:
 * ```ts
 * const sanitizer = new StreamSanitizer();
 * for await (const chunk of stream) {
 *   const safe = sanitizer.process(chunk);
 *   if (safe) emit(safe);
 * }
 * const remaining = sanitizer.flush();
 * if (remaining) emit(remaining);
 * ```
 */
export class StreamSanitizer {
  private buffer = '';

  /**
   * Process the next streaming chunk.  Returns any text that is safe to emit
   * immediately; may return an empty string while buffering a potential tag.
   */
  process(chunk: string): string {
    this.buffer += chunk;
    return this.drain();
  }

  /**
   * Call at end-of-stream to flush any remaining buffered content.  Returns
   * the final sanitized text.
   */
  flush(): string {
    if (!this.buffer) return '';
    const out = sanitizeContent(this.buffer);
    this.buffer = '';
    return out;
  }

  private drain(): string {
    let out = '';

    for (;;) {
      const lt = this.buffer.indexOf('<');

      if (lt === -1) {
        // No potential tag start — safe to emit everything.
        out += sanitizeContent(this.buffer);
        this.buffer = '';
        return out;
      }

      // Emit the safe prefix that appears before the `<`.
      if (lt > 0) {
        out += sanitizeContent(this.buffer.slice(0, lt));
        this.buffer = this.buffer.slice(lt);
      }

      // Buffer now starts with `<`.

      // Safety valve: if the buffer has grown very large, flush the portion
      // before the last `<` so any in-progress tag can still be completed.
      if (this.buffer.length >= MAX_BUFFER) {
        const lastLt = this.buffer.lastIndexOf('<');
        if (lastLt > 0) {
          // Emit everything before the last '<', keep the rest buffered.
          out += sanitizeContent(this.buffer.slice(0, lastLt));
          this.buffer = this.buffer.slice(lastLt);
        }
        // When lastLt === 0, the entire buffer is one potential tag starting
        // at position 0.  Keep it buffered so the closing tag can still arrive
        // and be matched; do not emit raw incomplete tag fragments.
        return out;
      }

      // We need enough context to determine whether this `<` starts a DSML
      // tag.  Wait until we have TAG_LOOKAHEAD chars OR the buffer contains a
      // `>` (which means any single-line tag is already complete).
      if (this.buffer.length < TAG_LOOKAHEAD && !this.buffer.includes('>')) {
        return out;
      }

      // If the text after `<` doesn't match any DSML tag keyword, it is
      // ordinary text — emit the `<` and continue processing the rest.
      if (!MAYBE_TAG_RE.test(this.buffer)) {
        out += '<';
        this.buffer = this.buffer.slice(1);
        continue;
      }

      // The buffer looks like the opening of a DSML tag.  Check whether it
      // already contains the matching closing tag.
      const stripped = stripTagsOnly(this.buffer);
      if (stripped !== this.buffer) {
        // A complete tag was found and stripped.  Put the remainder back in
        // the buffer and loop so any following content is processed normally.
        this.buffer = stripped;
        continue;
      }

      // The tag is not yet complete — stop draining and wait for more chunks.
      return out;
    }
  }
}
