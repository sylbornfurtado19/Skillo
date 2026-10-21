import {
  createQuestionAccumulator,
  addSampleToAccumulator,
  summarizeQuestionEvidence,
  computeCanonicalDigest,
  compileEvidenceReceipt,
  toServerSafeEvidence,
  type KernelSampleStats,
} from '../src/lib/services/ivpEvidenceAggregator';

describe('IVP Evidence Aggregator & Digest Suite', () => {
  const dummySample: KernelSampleStats = {
    meanLuminance: 120,
    minVal: 20,
    maxVal: 220,
    clippedPixelsPct: 1.5,
    skinPixelRatio: 0.22,
    skinMaskCoverage: 0.22,
    faceDetected: true,
    sobelMeanMagnitude: 35.4,
    sobelEdgeRatio: 0.08,
    madScore: 2.1,
    blinkRatePerMin: 18,
    isMouthActive: true,
    kernelDurationMs: 4.2,
  };

  it('handles empty accumulator gracefully with neutral defaults', () => {
    const acc = createQuestionAccumulator('q-test', 0);
    const summary = summarizeQuestionEvidence(acc);
    expect(summary.questionId).toBe('q-test');
    expect(summary.evidenceId).toBe('IVP-Q1');
    expect(summary.frames).toBe(0);
    expect(summary.meanLuminance).toBe(128);
    expect(summary.presenceRatio).toBe(0);
  });

  it('aggregates multiple samples into accurate statistics', () => {
    let acc = createQuestionAccumulator('q1', 0);
    acc = addSampleToAccumulator(acc, dummySample);
    acc = addSampleToAccumulator(acc, {
      ...dummySample,
      meanLuminance: 140,
      skinPixelRatio: 0.28,
      skinMaskCoverage: 0.28,
      sobelMeanMagnitude: 45.0,
      sobelEdgeRatio: 0.12,
      madScore: 3.5,
      blinkRatePerMin: 22,
      isMouthActive: false,
    });

    const summary = summarizeQuestionEvidence(acc);
    expect(summary.frames).toBe(2);
    expect(summary.meanLuminance).toBe(130);
    expect(summary.skinMaskCoveragePct).toBe(25); // (0.22 + 0.28) / 2 * 100
    expect(summary.presenceRatio).toBe(1); // both faceDetected = true
    expect(summary.sharpnessScore).toBe(40.2); // (35.4 + 45.0) / 2
    expect(summary.motionEnergy).toBe(2.8); // (2.1 + 3.5) / 2
    expect(summary.blinkRatePerMin).toBe(20); // (18 + 22) / 2
    expect(summary.mouthActivityPct).toBe(50); // 1 active out of 2 = 50%
  });

  it('degrades presence to null (unknown) when vision worker detection is unavailable', () => {
    let acc = createQuestionAccumulator('q-nodetect', 0);
    acc = addSampleToAccumulator(acc, {
      ...dummySample,
      faceDetected: null, // worker unavailable
      skinMaskCoverage: 0.25, // even if skin pixels exist!
    });
    const summary = summarizeQuestionEvidence(acc);
    expect(summary.presenceRatio).toBeNull();
    expect(summary.skinMaskCoveragePct).toBe(25);
  });

  it('classifies lighting illumination properly', () => {
    // Underexposed
    let accLow = createQuestionAccumulator('q-dark', 0);
    accLow = addSampleToAccumulator(accLow, { ...dummySample, meanLuminance: 40 });
    expect(summarizeQuestionEvidence(accLow).illumination).toBe('underexposed');

    // Overexposed
    let accHigh = createQuestionAccumulator('q-bright', 1);
    accHigh = addSampleToAccumulator(accHigh, { ...dummySample, meanLuminance: 210 });
    expect(summarizeQuestionEvidence(accHigh).illumination).toBe('overexposed');
  });

  it('computes deterministic SHA-256 digest', async () => {
    const payloadA = { test: 123, name: 'skillo' };
    const payloadB = { name: 'skillo', test: 123 }; // different key ordering
    const payloadC = { test: 999, name: 'skillo' };

    const digestA = await computeCanonicalDigest(payloadA);
    const digestB = await computeCanonicalDigest(payloadB);
    const digestC = await computeCanonicalDigest(payloadC);

    expect(digestA).toBe(digestB); // Deterministic key-sorted JSON
    expect(digestA).not.toBe(digestC);
    expect(digestA).toMatch(/^[a-f0-9]{64}$/);
  });

  it('compiles receipt and strictly caps thumbnails to 6 items', async () => {
    const thumbs = Array.from({ length: 10 }, (_, i) => ({
      evidenceId: `IVP-Q${i}`,
      kind: 'sobel' as const,
      dataUrl: `data:image/png;base64,mock${i}`,
    }));

    const receipt = await compileEvidenceReceipt({
      samplingHz: 4,
      framesAnalyzed: 120,
      kernelCounts: { histogramEq: 120, otsuYCrCb: 120, sobel: 120, temporalMAD: 120, earMar: 120 },
      avgKernelMs: 3.5,
      perQuestion: [],
      thumbnails: thumbs,
    });

    expect(receipt.thumbnails).toHaveLength(6);
    expect(receipt.digestSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(receipt.provenance).toBe('client-reported');
    expect(receipt.consumedByEvaluator).toBe(false);
  });

  it('strips all thumbnails in toServerSafeEvidence', async () => {
    const receipt = await compileEvidenceReceipt({
      samplingHz: 4,
      framesAnalyzed: 50,
      kernelCounts: { histogramEq: 50, otsuYCrCb: 50, sobel: 50, temporalMAD: 50, earMar: 50 },
      avgKernelMs: 3.2,
      perQuestion: [],
      thumbnails: [{ evidenceId: 'IVP-Q1', kind: 'otsu', dataUrl: 'data:mock' }],
    });

    expect(receipt.thumbnails).toHaveLength(1);
    const serverSafe = toServerSafeEvidence(receipt);
    expect(serverSafe.thumbnails).toBeUndefined();
    expect(serverSafe.digestSha256).toBe(receipt.digestSha256);
  });
});
