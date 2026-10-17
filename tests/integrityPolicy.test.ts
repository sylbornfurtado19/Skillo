import {
  INTEGRITY_POLICY_VERSION,
  INTEGRITY_THRESHOLDS,
  INTEGRITY_LIMITATIONS_NOTE,
  evaluateIntegrityVerdict,
} from '../src/lib/integrity/integrityPolicy';
import type { SessionIntegrityTotals } from '../src/types/integrity';

describe('Integrity Policy & Verdict Evaluator', () => {
  const cleanTotals: SessionIntegrityTotals = {
    pauses: 0,
    pausedMs: 0,
    tabSwitches: 0,
    fullscreenExits: 0,
    copyPasteAttempts: 0,
    screenshotKeyAttempts: 0,
    navigationAttempts: 0,
    reloads: 0,
  };

  it('exposes immutable policy version and thresholds', () => {
    expect(INTEGRITY_POLICY_VERSION).toBe('1.0.0');
    expect(INTEGRITY_THRESHOLDS.SCORE_PENALTY_FOR_VIOLATIONS).toBe(0);
    expect(INTEGRITY_THRESHOLDS.MAX_TAB_SWITCHES_BEFORE_FLAG).toBe(3);
    expect(INTEGRITY_THRESHOLDS.MAX_PAUSED_MS_BEFORE_FLAG).toBe(60000);
    expect(INTEGRITY_THRESHOLDS.VIOLATION_DEDUPE_MS).toBe(1000);
  });

  it('contains honest limitation disclosures without impossible claims', () => {
    expect(INTEGRITY_LIMITATIONS_NOTE).toContain('detects');
    expect(INTEGRITY_LIMITATIONS_NOTE).toContain('cannot be prevented');
    expect(INTEGRITY_LIMITATIONS_NOTE).not.toContain('impossible');
    expect(INTEGRITY_LIMITATIONS_NOTE).not.toContain('guaranteed');
  });

  it('evaluates clean session verdict', () => {
    expect(evaluateIntegrityVerdict(cleanTotals)).toBe('clean');
  });

  it('evaluates minor flags for isolated non-critical events', () => {
    expect(evaluateIntegrityVerdict({ ...cleanTotals, tabSwitches: 1 })).toBe('minor_flags');
    expect(evaluateIntegrityVerdict({ ...cleanTotals, fullscreenExits: 1 })).toBe('minor_flags');
    expect(evaluateIntegrityVerdict({ ...cleanTotals, copyPasteAttempts: 2 })).toBe('minor_flags');
    expect(evaluateIntegrityVerdict({ ...cleanTotals, reloads: 1 })).toBe('minor_flags');
    expect(evaluateIntegrityVerdict({ ...cleanTotals, pausedMs: 20000 })).toBe('minor_flags');
  });

  it('escalates to flagged verdict when policy thresholds are breached', () => {
    expect(
      evaluateIntegrityVerdict({
        ...cleanTotals,
        tabSwitches: INTEGRITY_THRESHOLDS.MAX_TAB_SWITCHES_BEFORE_FLAG,
      })
    ).toBe('flagged');

    expect(
      evaluateIntegrityVerdict({
        ...cleanTotals,
        pausedMs: INTEGRITY_THRESHOLDS.MAX_PAUSED_MS_BEFORE_FLAG,
      })
    ).toBe('flagged');

    expect(
      evaluateIntegrityVerdict({
        ...cleanTotals,
        copyPasteAttempts: INTEGRITY_THRESHOLDS.MAX_COPY_PASTE_BEFORE_FLAG,
      })
    ).toBe('flagged');

    expect(
      evaluateIntegrityVerdict({
        ...cleanTotals,
        navigationAttempts: INTEGRITY_THRESHOLDS.MAX_NAVIGATION_BEFORE_FLAG,
      })
    ).toBe('flagged');
  });
});
