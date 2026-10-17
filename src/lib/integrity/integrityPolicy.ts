/**
 * Skillo AI - Session Integrity & Proctoring Policy
 * ====================================================================
 * Configurable thresholds, deduplication windows, and honest limitation
 * disclosures for placement cell proctoring.
 */

import type { SessionIntegrityTotals, IntegrityVerdict } from '@/types/integrity';

export const INTEGRITY_POLICY_VERSION = '1.0.0';

export const INTEGRITY_THRESHOLDS = {
  MAX_TAB_SWITCHES_BEFORE_FLAG: 3,
  MAX_PAUSED_MS_BEFORE_FLAG: 60_000,
  MAX_COPY_PASTE_BEFORE_FLAG: 5,
  MAX_NAVIGATION_BEFORE_FLAG: 2,
  SCORE_PENALTY_FOR_VIOLATIONS: 0, // Display-only: fairness contract forbids silent AI score penalties
  VIOLATION_DEDUPE_MS: 1000, // 1 second window to deduplicate blur + visibilitychange
} as const;

export const INTEGRITY_LIMITATIONS_NOTE =
  'Client-side proctoring detects browser-level window blur, tab switching, and input events; OS-level screen capture and external recording devices cannot be prevented by web applications.';

/**
 * Pure evaluator to compute the overall proctoring verdict from recorded totals.
 */
export function evaluateIntegrityVerdict(totals: SessionIntegrityTotals): IntegrityVerdict {
  if (
    totals.tabSwitches >= INTEGRITY_THRESHOLDS.MAX_TAB_SWITCHES_BEFORE_FLAG ||
    totals.pausedMs >= INTEGRITY_THRESHOLDS.MAX_PAUSED_MS_BEFORE_FLAG ||
    totals.copyPasteAttempts >= INTEGRITY_THRESHOLDS.MAX_COPY_PASTE_BEFORE_FLAG ||
    totals.navigationAttempts >= INTEGRITY_THRESHOLDS.MAX_NAVIGATION_BEFORE_FLAG
  ) {
    return 'flagged';
  }

  if (
    totals.tabSwitches > 0 ||
    totals.pausedMs > 15_000 ||
    totals.copyPasteAttempts > 0 ||
    totals.fullscreenExits > 0 ||
    totals.navigationAttempts > 0 ||
    totals.reloads > 0 ||
    totals.screenshotKeyAttempts > 0
  ) {
    return 'minor_flags';
  }

  return 'clean';
}
