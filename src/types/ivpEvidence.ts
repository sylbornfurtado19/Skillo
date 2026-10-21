/**
 * Skillo AI - IVP Evidence Data Contracts
 * ====================================================================
 * Cryptographically verifiable, structured evidence of edge computer
 * vision execution during the interview session.
 */

export interface IVPKernelCounts {
  histogramEq: number;
  otsuYCrCb: number;
  sobel: number;
  temporalMAD: number;
  earMar: number;
}

export interface IVPQuestionEvidence {
  questionId: string;
  questionIndex: number;
  frames: number;
  meanLuminance: number;
  contrastStdDev: number;
  clippedPct: number; // histogram stats
  illumination: 'underexposed' | 'ok' | 'overexposed' | 'uneven';
  skinMaskCoveragePct: number;
  presenceRatio: number | null; // MediaPipe face detection presence ratio (null = vision worker unavailable)
  sobelEdgeDensity: number;
  sharpnessScore: number; // focus/blur
  motionEnergy: number; // temporal MAD
  blinkRatePerMin?: number;
  mouthActivityPct?: number; // EAR/MAR (landmark-based, optional)
  evidenceId: string; // e.g. "IVP-Q1"
}

export interface IVPEvidenceThumbnail {
  evidenceId: string;
  kind: 'sobel' | 'otsu' | 'motion' | 'equalized';
  dataUrl: string;
}

export interface IVPEvidenceReceipt {
  kernelVersion: string;
  samplingHz: number;
  framesAnalyzed: number;
  kernelCounts: IVPKernelCounts;
  avgKernelMs: number;
  perQuestion: IVPQuestionEvidence[];
  digestSha256: string;
  provenance: 'client-reported';
  consumedByEvaluator: boolean;
  transmitted: boolean;
  thumbnails?: IVPEvidenceThumbnail[]; // client-only, never serialized to server/DB
}
