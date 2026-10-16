/**
 * Helpers for reading interview questions aloud with the Web Speech API.
 */

/** Splits a question into speakable sentences. Always returns at least one entry. */
export function splitIntoSentences(text: string): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [''];
  const parts = cleaned.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [cleaned];
  const sentences = parts.map((s) => s.trim()).filter(Boolean);
  return sentences.length > 0 ? sentences : [cleaned];
}

/**
 * Rough upper bound for how long a question takes to read aloud.
 * Used as a watchdog so a silent/stalled speech engine can never freeze the interview.
 */
export function estimateNarrationMs(text: string, rate: number): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const safeRate = Number.isFinite(rate) && rate > 0 ? rate : 1;
  const wordsPerMinute = 150 * safeRate;
  return Math.max(1500, Math.round((words / wordsPerMinute) * 60_000));
}

interface VoiceLike {
  lang: string;
  localService?: boolean;
  default?: boolean;
}

/** Prefers a local English voice, then any English voice, then the engine default. */
export function pickEnglishVoice<T extends VoiceLike>(voices: readonly T[]): T | undefined {
  if (voices.length === 0) return undefined;
  const english = voices.filter((v) => v.lang?.toLowerCase().startsWith('en'));
  return (
    english.find((v) => v.lang.toLowerCase() === 'en-us' && v.localService) ??
    english.find((v) => v.localService) ??
    english.find((v) => v.lang.toLowerCase() === 'en-us') ??
    english[0] ??
    voices.find((v) => v.default)
  );
}
