import {
  buildEvidencePromptBlock,
  sanitizeIvpObservations,
} from '../src/lib/services/evidencePrompt';
import type { IVPEvidenceReceipt } from '../src/types/ivpEvidence';
import type { SessionIntegrityReport } from '../src/types/integrity';

describe('Phase 5: IVP Evidence Evaluation & Prompt Injection (O5, D5, D7, D9, D10)', () => {
  const sampleValidEvidence: IVPEvidenceReceipt = {
    kernelVersion: '1.0.0-ivp-classical',
    samplingHz: 4,
    framesAnalyzed: 120,
    kernelCounts: {
      histogramEq: 120,
      otsuYCrCb: 120,
      sobel: 120,
      temporalMAD: 120,
      earMar: 120,
    },
    avgKernelMs: 3.1,
    perQuestion: [
      {
        questionId: 'q_1',
        questionIndex: 0,
        frames: 60,
        meanLuminance: 128.5,
        contrastStdDev: 42.2,
        clippedPct: 1.2,
        illumination: 'ok',
        skinMaskCoveragePct: 18.5,
        presenceRatio: 0.98,
        sobelEdgeDensity: 14.2,
        sharpnessScore: 68.4,
        motionEnergy: 0.15,
        blinkRatePerMin: 18,
        mouthActivityPct: 35,
        evidenceId: 'IVP-Q1',
      },
      {
        questionId: 'q_2',
        questionIndex: 1,
        frames: 60,
        meanLuminance: 124.0,
        contrastStdDev: 40.5,
        clippedPct: 0.8,
        illumination: 'ok',
        skinMaskCoveragePct: 19.1,
        presenceRatio: 0.99,
        sobelEdgeDensity: 15.0,
        sharpnessScore: 71.0,
        motionEnergy: 0.12,
        blinkRatePerMin: 16,
        mouthActivityPct: 40,
        evidenceId: 'IVP-Q2',
      },
    ],
    digestSha256: 'a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef',
    provenance: 'client-reported',
    consumedByEvaluator: false,
    transmitted: true,
  };

  const sampleValidIntegrity: SessionIntegrityReport = {
    events: [
      {
        id: 'evt_1',
        type: 'tab_hidden',
        atMs: 45000,
        questionId: 'q_1',
        questionIndex: 0,
        pauseReason: 'tab_hidden',
        durationMs: 3200,
        blocked: false,
      },
    ],
    totals: {
      pauses: 1,
      pausedMs: 3200,
      tabSwitches: 1,
      fullscreenExits: 0,
      copyPasteAttempts: 0,
      screenshotKeyAttempts: 0,
      navigationAttempts: 0,
      reloads: 0,
    },
    verdict: 'minor_flags',
    policyVersion: '1.0.0-academic',
    limitationsNote: 'Browser integrity monitoring provides detection and deterrence only.',
  };

  describe('Prompt injection formatting (D7 - Zero Score Drift)', () => {
    it('produces a compact, clearly bounded context block with explicit non-interference mandate', () => {
      const promptBlock = buildEvidencePromptBlock(sampleValidEvidence);

      expect(promptBlock).toContain('=== CANDIDATE DELIVERY & CAPTURE TELEMETRY (IVP EDGE SENSOR EVIDENCE) ===');
      expect(promptBlock).toContain('MANDATORY CONSTRAINT');
      expect(promptBlock).toContain('You MUST NOT alter, reduce, or bias the 4 core technical rubric scores');
      expect(promptBlock).toContain('[IVP-Q1] Q1:');
      expect(promptBlock).toContain('[IVP-Q2] Q2:');
      expect(promptBlock).toContain('=== END IVP EVIDENCE BLOCK ===');
    });

    it('returns empty string when evidence is null, undefined, or empty', () => {
      expect(buildEvidencePromptBlock(null)).toBe('');
      expect(buildEvidencePromptBlock(undefined)).toBe('');
      expect(buildEvidencePromptBlock({ ...sampleValidEvidence, perQuestion: [] })).toBe('');
    });
  });

  describe('Observation Sanitization (D10 - Verifiable proof)', () => {
    it('filters out hallucinated or invalid evidenceIds', () => {
      const allowed = new Set(['IVP-Q1', 'IVP-Q2']);
      const rawAiObservations = [
        { evidenceId: 'IVP-Q1', observation: 'Clear eye contact and steady delivery.' },
        { evidenceId: 'IVP-FAKE-99', observation: 'Candidate looked away frequently.' },
        { evidenceId: 'IVP-Q2', observation: 'Lighting was well balanced.' },
        { invalidField: 'test' },
      ];

      const cleaned = sanitizeIvpObservations(rawAiObservations, allowed);
      expect(cleaned).toHaveLength(2);
      expect(cleaned[0].evidenceId).toBe('IVP-Q1');
      expect(cleaned[1].evidenceId).toBe('IVP-Q2');
    });

    it('handles non-array AI responses gracefully', () => {
      const allowed = new Set(['IVP-Q1']);
      expect(sanitizeIvpObservations('invalid string', allowed)).toEqual([]);
      expect(sanitizeIvpObservations(null, allowed)).toEqual([]);
      expect(sanitizeIvpObservations({ key: 'val' }, allowed)).toEqual([]);
    });
  });

  describe('Zod Schema Constraints (D5 & D9 - Scalars Only, No Thumbnails)', () => {
    // Dynamic import to test schema rules in route
    it('rejects any payload containing thumbnails or raw images', async () => {
      const payloadWithThumbnails = {
        ...sampleValidEvidence,
        thumbnails: [
          { evidenceId: 'IVP-Q1', kind: 'sobel', dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==' },
        ],
      };

      // Ensure thumbnails are rejected by safe serialization
      const { toServerSafeEvidence } = await import('../src/lib/services/ivpEvidenceAggregator');
      const safe = toServerSafeEvidence(payloadWithThumbnails as any);
      expect(safe.thumbnails).toBeUndefined();
    });
  });
});
