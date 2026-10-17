/**
 * Skillo AI - Pure IVP Evidence Aggregator
 * ====================================================================
 * Aggregates per-sample classical kernel metrics into canonical
 * per-question evidence records, computes cryptographic SHA-256 digests,
 * and strips image payloads for safe transmission.
 */

import type {
  IVPEvidenceReceipt,
  IVPKernelCounts,
  IVPQuestionEvidence,
  IVPEvidenceThumbnail,
} from '@/types/ivpEvidence';

export interface KernelSampleStats {
  meanLuminance: number;
  minVal: number;
  maxVal: number;
  clippedPixelsPct: number;
  skinPixelRatio: number;
  sobelMeanMagnitude: number;
  sobelEdgeRatio: number;
  madScore: number;
  blinkRatePerMin?: number;
  isMouthActive?: boolean;
  kernelDurationMs: number;
}

export interface QuestionSampleAccumulator {
  questionId: string;
  questionIndex: number;
  samples: KernelSampleStats[];
}

/**
 * Creates an empty sample accumulator for a question.
 */
export function createQuestionAccumulator(
  questionId: string,
  questionIndex: number
): QuestionSampleAccumulator {
  return {
    questionId,
    questionIndex,
    samples: [],
  };
}

/**
 * Pushes a new sample measurement into the question accumulator.
 */
export function addSampleToAccumulator(
  acc: QuestionSampleAccumulator,
  sample: KernelSampleStats
): QuestionSampleAccumulator {
  return {
    ...acc,
    samples: [...acc.samples, sample],
  };
}

/**
 * Aggregates a question accumulator into a finalized IVPQuestionEvidence record.
 */
export function summarizeQuestionEvidence(acc: QuestionSampleAccumulator): IVPQuestionEvidence {
  const n = acc.samples.length;
  const evidenceId = `IVP-Q${acc.questionIndex + 1}`;

  if (n === 0) {
    return {
      questionId: acc.questionId,
      questionIndex: acc.questionIndex,
      frames: 0,
      meanLuminance: 128,
      contrastStdDev: 0,
      clippedPct: 0,
      illumination: 'ok',
      skinMaskCoveragePct: 0,
      presenceRatio: 0,
      sobelEdgeDensity: 0,
      sharpnessScore: 0,
      motionEnergy: 0,
      blinkRatePerMin: 0,
      mouthActivityPct: 0,
      evidenceId,
    };
  }

  let sumLum = 0;
  let sumClipped = 0;
  let sumSkin = 0;
  let presentCount = 0;
  let sumSobelMean = 0;
  let sumSobelEdge = 0;
  let sumMad = 0;
  let sumBlinkRate = 0;
  let blinkSamples = 0;
  let mouthActiveCount = 0;

  for (const s of acc.samples) {
    sumLum += s.meanLuminance;
    sumClipped += s.clippedPixelsPct;
    sumSkin += s.skinPixelRatio;
    if (s.skinPixelRatio > 0.05) presentCount += 1;
    sumSobelMean += s.sobelMeanMagnitude;
    sumSobelEdge += s.sobelEdgeRatio;
    sumMad += s.madScore;
    if (s.blinkRatePerMin !== undefined && isFinite(s.blinkRatePerMin)) {
      sumBlinkRate += s.blinkRatePerMin;
      blinkSamples += 1;
    }
    if (s.isMouthActive) mouthActiveCount += 1;
  }

  const meanLuminance = sumLum / n;

  // Compute contrast standard deviation
  let varianceSum = 0;
  for (const s of acc.samples) {
    const diff = s.meanLuminance - meanLuminance;
    varianceSum += diff * diff;
  }
  const contrastStdDev = Math.sqrt(varianceSum / n);

  // Illumination classification
  let illumination: 'underexposed' | 'ok' | 'overexposed' | 'uneven' = 'ok';
  if (meanLuminance < 60) {
    illumination = 'underexposed';
  } else if (meanLuminance > 195) {
    illumination = 'overexposed';
  } else if (contrastStdDev > 65) {
    illumination = 'uneven';
  }

  return {
    questionId: acc.questionId,
    questionIndex: acc.questionIndex,
    frames: n,
    meanLuminance: Math.round(meanLuminance * 10) / 10,
    contrastStdDev: Math.round(contrastStdDev * 10) / 10,
    clippedPct: Math.round((sumClipped / n) * 10) / 10,
    illumination,
    skinMaskCoveragePct: Math.round((sumSkin / n) * 1000) / 10,
    presenceRatio: Math.round((presentCount / n) * 100) / 100,
    sobelEdgeDensity: Math.round((sumSobelEdge / n) * 1000) / 1000,
    sharpnessScore: Math.round((sumSobelMean / n) * 10) / 10,
    motionEnergy: Math.round((sumMad / n) * 10) / 10,
    blinkRatePerMin: blinkSamples > 0 ? Math.round(sumBlinkRate / blinkSamples) : undefined,
    mouthActivityPct: Math.round((mouthActiveCount / n) * 1000) / 10,
    evidenceId,
  };
}

/**
 * Computes a deterministic SHA-256 hash digest of a canonical JSON payload.
 * Works across both browser (crypto.subtle) and Node test runtimes.
 */
export async function computeCanonicalDigest(data: unknown): Promise<string> {
  const jsonStr = JSON.stringify(data, Object.keys(data as object).sort());

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const msgBuffer = new TextEncoder().encode(jsonStr);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Node runtime fallback for unit tests
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeCrypto = require('crypto');
    return nodeCrypto.createHash('sha256').update(jsonStr).digest('hex');
  } catch {
    // Basic hash fallback if environment lacks crypto
    let hash = 0;
    for (let i = 0; i < jsonStr.length; i++) {
      hash = (hash << 5) - hash + jsonStr.charCodeAt(i);
      hash |= 0;
    }
    return `fallback-${Math.abs(hash).toString(16)}`;
  }
}

/**
 * Compiles aggregated question evidence into a finalized verifiable IVPEvidenceReceipt.
 */
export async function compileEvidenceReceipt(params: {
  kernelVersion?: string;
  samplingHz: number;
  framesAnalyzed: number;
  kernelCounts: IVPKernelCounts;
  avgKernelMs: number;
  perQuestion: IVPQuestionEvidence[];
  thumbnails?: IVPEvidenceThumbnail[];
  consumedByEvaluator?: boolean;
  transmitted?: boolean;
}): Promise<IVPEvidenceReceipt> {
  const kernelVersion = params.kernelVersion ?? '1.0.0-plus-ultra';

  // Canonical payload for cryptographic digest computation (excluding thumbnails and mutable flags)
  const canonicalPayload = {
    kernelVersion,
    samplingHz: params.samplingHz,
    framesAnalyzed: params.framesAnalyzed,
    kernelCounts: params.kernelCounts,
    perQuestion: params.perQuestion,
  };

  const digestSha256 = await computeCanonicalDigest(canonicalPayload);

  return {
    kernelVersion,
    samplingHz: params.samplingHz,
    framesAnalyzed: params.framesAnalyzed,
    kernelCounts: params.kernelCounts,
    avgKernelMs: params.avgKernelMs,
    perQuestion: params.perQuestion,
    digestSha256,
    provenance: 'client-reported',
    consumedByEvaluator: params.consumedByEvaluator ?? false,
    transmitted: params.transmitted ?? false,
    thumbnails: params.thumbnails?.slice(0, 6), // Strictly capped at 6
  };
}

/**
 * Returns a server/database-safe clone of the evidence receipt by stripping all client-only thumbnails.
 */
export function toServerSafeEvidence(receipt: IVPEvidenceReceipt): IVPEvidenceReceipt {
  return {
    ...receipt,
    thumbnails: undefined,
  };
}
