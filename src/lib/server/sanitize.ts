/**
 * src/lib/server/sanitize.ts
 *
 * Robust user text sanitization pipeline to prevent HTML/XML injection,
 * control/zero-width character smuggling, and prompt injection attacks.
 */

// Common prompt injection phrases (case-insensitive)
export const PROMPT_INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /disregard\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /forget\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /override\s+(all\s+)?(previous|prior|system)\s+instructions/i,
  /\bsystem\s+prompt\b/i,
  /reveal\s+(the\s+)?(system|initial)\s+prompt/i,
  /you\s+are\s+now\s+(a|an|in)\b/i,
  /\bjailbreak\b/i,
  /\bdan\s+mode\b/i,
  /developer\s+mode\s+enabled/i,
  /\bnew\s+instruction:/i,
  /act\s+as\s+an?\s+unrestricted/i,
  /bypass\s+(all\s+)?(safety|guardrails|instructions)/i,
];

/**
 * Sanitizes user-supplied text:
 * 1. Strips HTML/XML tags
 * 2. Strips control characters (except standard whitespace \n, \r, \t) and zero-width characters
 * 3. Neutralises common prompt-injection phrases by wrapping (not deleting) matching lines in a marker
 * 4. Collapses multiple whitespace while preserving paragraph structure
 * 5. Truncates output to maxLen (if specified)
 */
export function sanitizeUserText(text: string | null | undefined, maxLen?: number): string {
  if (!text) return '';

  // 1. Strip HTML/XML tags
  let cleaned = text.replace(/<[^>]*>/g, '');

  // 2. Strip control characters (ASCII 0-8, 11-12, 14-31, 127) and zero-width / invisible characters
  // \u200B: Zero-width space, \u200C: ZWNJ, \u200D: ZWJ, \u200E: LTR, \u200F: RTL, \u2060: Word joiner, \uFEFF: BOM
  cleaned = cleaned
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/[\u200B-\u200F\u2060-\u2064\uFEFF]/g, '');

  // 3. Neutralise prompt injection lines by wrapping in [POTENTIAL_PROMPT_INJECTION: ...]
  const lines = cleaned.split(/\r?\n/);
  const neutralisedLines = lines.map((line) => {
    const isInjection = PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(line));
    if (isInjection) {
      const trimmedLine = line.trim();
      return `[POTENTIAL_PROMPT_INJECTION: ${trimmedLine}]`;
    }
    return line;
  });
  cleaned = neutralisedLines.join('\n');

  // 4. Collapse whitespace:
  // - Replace multiple consecutive horizontal spaces/tabs with a single space
  // - Collapse 3 or more consecutive newlines into 2
  cleaned = cleaned
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // 5. Truncate to maxLen if provided
  if (typeof maxLen === 'number' && maxLen > 0 && cleaned.length > maxLen) {
    cleaned = cleaned.slice(0, maxLen).trim();
  }

  return cleaned;
}
