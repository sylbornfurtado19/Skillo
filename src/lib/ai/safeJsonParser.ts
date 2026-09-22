import { z } from 'zod';

export interface SafeJsonParseResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  rawExcerpt?: string;
}

/**
 * Extracts a candidate JSON substring from raw model output.
 * Handles markdown code fences (```json ... ```) and finds matching outermost braces.
 */
export function extractJsonString(rawText: string, maxCharLength: number = 50000): string | null {
  if (!rawText || typeof rawText !== 'string') return null;

  if (rawText.length > maxCharLength) {
    return null; // Reject oversized payloads
  }

  // 1. Try stripping markdown code fences
  const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const targetText = fenceMatch ? fenceMatch[1].trim() : rawText.trim();

  // 2. Find balanced JSON object { ... } or array [ ... ]
  const firstBrace = targetText.indexOf('{');
  const firstBracket = targetText.indexOf('[');

  let startIdx = -1;
  let endChar = '';

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    endChar = '}';
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    endChar = ']';
  }

  if (startIdx === -1) return null;

  const lastIdx = targetText.lastIndexOf(endChar);
  if (lastIdx <= startIdx) return null;

  return targetText.slice(startIdx, lastIdx + 1);
}

/**
 * Safely parses and validates LLM JSON response payloads against a Zod schema.
 * Replaces unsafe regex patterns and naked JSON.parse calls with guarded execution.
 */
export function safeParseModelJson<T>(
  rawText: string,
  schema: z.ZodSchema<T>,
  options?: {
    maxCharLength?: number;
    logContext?: string;
  }
): SafeJsonParseResult<T> {
  const jsonStr = extractJsonString(rawText, options?.maxCharLength);

  if (!jsonStr) {
    return {
      success: false,
      error: 'No valid JSON structure found in model output.',
      rawExcerpt: rawText.slice(0, 200),
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (err: any) {
    return {
      success: false,
      error: `JSON syntax error: ${err.message}`,
      rawExcerpt: jsonStr.slice(0, 200),
    };
  }

  const validation = schema.safeParse(parsed);
  if (!validation.success) {
    const errorDetails = validation.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .slice(0, 5)
      .join('; ');

    if (options?.logContext) {
      console.warn(`[SafeJsonParser] Validation failed for ${options.logContext}:`, errorDetails);
    }

    return {
      success: false,
      error: `Schema validation failed: ${errorDetails}`,
      rawExcerpt: jsonStr.slice(0, 200),
    };
  }

  return {
    success: true,
    data: validation.data,
  };
}
