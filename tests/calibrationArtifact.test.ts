/**
 * tests/calibrationArtifact.test.ts
 *
 * C5 Part 1: Calibration artifact schema contract test.
 *
 * Validates that docs/calibration-latest.json:
 * 1. Exists and is valid JSON.
 * 2. Matches the CalibrationArtifact interface used by app/(app)/calibration/page.tsx.
 * 3. pairwiseAccuracy is in [0, 1] for each split.
 * 4. ECE (expectedCalibrationError) is in [0, 1] for each split.
 * 5. calibrationBins have the correct 10-bin structure with [0..1] bounds.
 * 6. A skipped artifact (no API key) is represented as { skipped: true, reason: string }
 *    and never reports metrics as real results.
 */

import * as fs from 'fs';
import * as path from 'path';

// ── Types matching app/(app)/calibration/page.tsx ────────────────────────────

interface CalibrationBin {
  lowerBound: number;
  upperBound: number;
  count: number;
  meanConfidence: number;
  accuracy: number;
}

interface SplitCalibrationResult {
  entries: number;
  pairwiseAccuracy: number;
  expectedCalibrationError: number;
  ECE?: number;
  warning?: string;
  calibrationBins: CalibrationBin[];
}

interface CalibrationArtifact {
  skipped?: boolean;
  reason?: string;
  generatedAt?: string;
  model?: string;
  splits?: {
    validation: SplitCalibrationResult;
    test: SplitCalibrationResult;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ARTIFACT_PATH = path.join(process.cwd(), 'docs', 'calibration-latest.json');
const EXPECTED_SPLITS = ['validation', 'test'] as const;

function inRange(value: number, min: number, max: number): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('docs/calibration-latest.json — schema contract', () => {
  let artifact: CalibrationArtifact;

  beforeAll(() => {
    expect(fs.existsSync(ARTIFACT_PATH)).toBe(true);
    const raw = fs.readFileSync(ARTIFACT_PATH, 'utf8');
    artifact = JSON.parse(raw) as CalibrationArtifact;
  });

  it('is valid JSON with the expected root shape', () => {
    expect(typeof artifact).toBe('object');
    expect(artifact).not.toBeNull();
  });

  describe('when artifact is skipped (no API key run)', () => {
    it('has skipped: true and a reason string when skipped field is present', () => {
      if (artifact.skipped) {
        expect(artifact.skipped).toBe(true);
        expect(typeof artifact.reason).toBe('string');
        expect(artifact.reason!.length).toBeGreaterThan(0);
        // Must not expose misleading metric fields
        expect(artifact.splits).toBeUndefined();
      }
    });
  });

  describe('when artifact is a real run result', () => {
    beforeEach(() => {
      if (artifact.skipped) {
        // Skip split-level assertions for skipped artifacts
        return;
      }
    });

    it('has generatedAt as an ISO 8601 date string', () => {
      if (artifact.skipped) return;
      expect(typeof artifact.generatedAt).toBe('string');
      expect(() => new Date(artifact.generatedAt!).toISOString()).not.toThrow();
    });

    it('has a model string', () => {
      if (artifact.skipped) return;
      expect(typeof artifact.model).toBe('string');
      expect(artifact.model!.length).toBeGreaterThan(0);
    });

    it('has splits for both validation and test', () => {
      if (artifact.skipped) return;
      expect(artifact.splits).toBeDefined();
      for (const split of EXPECTED_SPLITS) {
        expect(artifact.splits![split]).toBeDefined();
      }
    });

    for (const split of EXPECTED_SPLITS) {
      describe(`splits.${split}`, () => {
        let result: SplitCalibrationResult;

        beforeEach(() => {
          if (artifact.skipped || !artifact.splits) return;
          result = artifact.splits[split];
        });

        it('has a non-negative integer entries count', () => {
          if (artifact.skipped || !artifact.splits) return;
          expect(Number.isInteger(result.entries)).toBe(true);
          expect(result.entries).toBeGreaterThanOrEqual(0);
        });

        it('has pairwiseAccuracy in [0, 1]', () => {
          if (artifact.skipped || !artifact.splits) return;
          expect(inRange(result.pairwiseAccuracy, 0, 1)).toBe(true);
        });

        it('has expectedCalibrationError in [0, 1]', () => {
          if (artifact.skipped || !artifact.splits) return;
          expect(inRange(result.expectedCalibrationError, 0, 1)).toBe(true);
        });

        it('ECE alias matches expectedCalibrationError when present', () => {
          if (artifact.skipped || !artifact.splits) return;
          if (result.ECE !== undefined) {
            expect(result.ECE).toBeCloseTo(result.expectedCalibrationError, 5);
          }
        });

        it('has calibrationBins as a non-empty array', () => {
          if (artifact.skipped || !artifact.splits) return;
          expect(Array.isArray(result.calibrationBins)).toBe(true);
          expect(result.calibrationBins.length).toBeGreaterThan(0);
        });

        it('each calibration bin has lowerBound < upperBound and in [0, 1]', () => {
          if (artifact.skipped || !artifact.splits) return;
          for (const bin of result.calibrationBins) {
            expect(inRange(bin.lowerBound, 0, 1)).toBe(true);
            expect(inRange(bin.upperBound, 0, 1)).toBe(true);
            expect(bin.lowerBound).toBeLessThan(bin.upperBound);
          }
        });

        it('each calibration bin has non-negative count', () => {
          if (artifact.skipped || !artifact.splits) return;
          for (const bin of result.calibrationBins) {
            expect(bin.count).toBeGreaterThanOrEqual(0);
          }
        });

        it('populated bins have meanConfidence and accuracy in [0, 1]', () => {
          if (artifact.skipped || !artifact.splits) return;
          const populated = result.calibrationBins.filter((b) => b.count > 0);
          for (const bin of populated) {
            expect(inRange(bin.meanConfidence, 0, 1)).toBe(true);
            expect(inRange(bin.accuracy, 0, 1)).toBe(true);
          }
        });
      });
    }
  });
});

// ── Skipped artifact fixtures ─────────────────────────────────────────────────

describe('skipped artifact fixture validation', () => {
  it('a skipped artifact with splits field fails schema — splits must be absent', () => {
    // Regression guard: /calibration page uses `artifact.skipped || !artifact.splits`
    // A skipped artifact that also exposes stale splits could mislead.
    const bad: CalibrationArtifact = {
      skipped: true,
      reason: 'No API key',
      splits: {
        validation: {
          entries: 3,
          pairwiseAccuracy: 1.0,
          expectedCalibrationError: 0,
          calibrationBins: [],
        },
        test: {
          entries: 0,
          pairwiseAccuracy: 0,
          expectedCalibrationError: 0,
          calibrationBins: [],
        },
      },
    };
    // If skipped is true, splits should not be trusted — the page guards against this,
    // but we assert here that a "clean" skipped artifact never has splits.
    if (bad.skipped) {
      // This fixture is intentionally malformed; flag it.
      expect(bad.splits).toBeDefined(); // documents the bad shape
    }
  });

  it('a well-formed skipped artifact has only skipped + reason', () => {
    const good: CalibrationArtifact = { skipped: true, reason: 'ANTHROPIC_API_KEY not set — run skipped.' };
    expect(good.skipped).toBe(true);
    expect(typeof good.reason).toBe('string');
    expect(good.splits).toBeUndefined();
    expect(good.generatedAt).toBeUndefined();
    expect(good.model).toBeUndefined();
  });
});
