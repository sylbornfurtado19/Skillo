import {
  buildEvidencePromptBlock,
  sanitizeIvpObservations,
} from '../src/lib/services/evidencePrompt';
import type { IVPEvidenceReceipt, IVPQuestionEvidence } from '../src/types/ivpEvidence';

describe('Evidence Prompt Formatter & Sanitizer', () => {
  const dummyQuestionEvidence: IVPQuestionEvidence = {
    questionId: 'q1',
    questionIndex: 0,
    frames: 45,
    meanLuminance: 118.5,
    contrastStdDev: 35.2,
    clippedPct: 0.8,
    illumination: 'ok',
    skinMaskCoveragePct: 22.4,
    presenceRatio: 0.98,
    sobelEdgeDensity: 0.082,
    sharpnessScore: 38.6,
    motionEnergy: 1.9,
    blinkRatePerMin: 16,
    mouthActivityPct: 38.5,
    evidenceId: 'IVP-Q1',
  };

  const dummyReceipt: IVPEvidenceReceipt = {
    kernelVersion: '1.0.0-plus-ultra',
    samplingHz: 4,
    framesAnalyzed: 180,
    kernelCounts: { histogramEq: 180, otsuYCrCb: 180, sobel: 180, temporalMAD: 180, earMar: 180 },
    avgKernelMs: 3.4,
    perQuestion: [dummyQuestionEvidence],
    digestSha256: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
    provenance: 'client-reported',
    consumedByEvaluator: false,
    transmitted: true,
  };

  it('returns empty string when evidence is null or empty', () => {
    expect(buildEvidencePromptBlock(null)).toBe('');
    expect(buildEvidencePromptBlock(undefined)).toBe('');
    expect(buildEvidencePromptBlock({ ...dummyReceipt, perQuestion: [] })).toBe('');
  });

  it('contains mandatory fairness disclaimer forbidding criterion score penalties', () => {
    const block = buildEvidencePromptBlock(dummyReceipt);
    expect(block).toContain('CRITICAL FAIRNESS NOTICE FOR EVALUATOR');
    expect(block).toContain('Skin-mask coverage is a lighting-sensitive heuristic and must not be used as evidence of absence');
    expect(block).toContain('MUST NOT alter, reduce, or bias the 4 core technical rubric scores');
    expect(block).toContain('technicalAccuracy, systemDesignLogic, edgeCaseHandling, communicationClarity');
  });

  it('formats telemetry scalars concisely with evidenceId', () => {
    const block = buildEvidencePromptBlock(dummyReceipt);
    expect(block).toContain('[IVP-Q1] Q1:');
    expect(block).toContain('Illumination: ok');
    expect(block).toContain('Face Presence: 98%');
    expect(block).toContain('skinMaskCoverage: 22.4%');
    expect(block).toContain('16 blinks/min');
    expect(block).toContain('38.5% speech/mouth activity');
    expect(block).toContain('Digest: a1b2c3d4e5f6...');
  });

  it('formats unknown presence gracefully when presenceRatio is null', () => {
    const receiptWithNullPresence: IVPEvidenceReceipt = {
      ...dummyReceipt,
      perQuestion: [{ ...dummyQuestionEvidence, presenceRatio: null }],
    };
    const block = buildEvidencePromptBlock(receiptWithNullPresence);
    expect(block).toContain('Face Presence: unknown');
  });

  it('sanitizes and filters AI-generated ivpObservations strictly', () => {
    const allowed = new Set(['IVP-Q1', 'IVP-Q2']);

    const raw = [
      { evidenceId: 'IVP-Q1', observation: 'Clear posture and stable eye contact.' },
      { evidenceId: 'IVP-UNKNOWN', observation: 'This should be discarded.' },
      { evidenceId: 'IVP-Q2', observation: '   Good pacing with minimal fidgeting.   ' },
      null,
      { evidenceId: 'IVP-Q1', observation: '' },
    ];

    const sanitized = sanitizeIvpObservations(raw, allowed);
    expect(sanitized).toHaveLength(2);
    expect(sanitized[0].evidenceId).toBe('IVP-Q1');
    expect(sanitized[0].observation).toBe('Clear posture and stable eye contact.');
    expect(sanitized[1].evidenceId).toBe('IVP-Q2');
    expect(sanitized[1].observation).toBe('Good pacing with minimal fidgeting.');
  });
});
