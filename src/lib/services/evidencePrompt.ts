/**
 * Skillo AI - Evidence Prompt Formatter & Sanitizer
 * ====================================================================
 * Pure functions to generate compact, prompt-injected IVP evidence blocks
 * for delivery commentary while strictly preventing criterion score bias.
 */

import type { IVPEvidenceReceipt } from '@/types/ivpEvidence';

/**
 * Builds a compact, bounded prompt context block (approx <= 600 tokens)
 * summarizing verified edge computer vision telemetry for evaluator commentary.
 */
export function buildEvidencePromptBlock(evidence?: IVPEvidenceReceipt | null): string {
  if (!evidence || !evidence.perQuestion || evidence.perQuestion.length === 0) {
    return '';
  }

  const lines: string[] = [
    '',
    '=== CANDIDATE DELIVERY & CAPTURE TELEMETRY (IVP EDGE SENSOR EVIDENCE) ===',
    'CRITICAL FAIRNESS NOTICE FOR EVALUATOR: The following measurements were computed locally on the candidate device via real-time computer vision (histogram radiometric analysis, Otsu binarization, Sobel edge gradients, and inter-frame motion MAD).',
    'MANDATORY CONSTRAINT: This telemetry is provided SOLELY for physical delivery commentary (composure, eye contact, speaking cadence, capture lighting). You MUST NOT alter, reduce, or bias the 4 core technical rubric scores (technicalAccuracy, systemDesignLogic, edgeCaseHandling, communicationClarity) based on these sensor metrics.',
    '',
    `Session Telemetry Summary: ${evidence.framesAnalyzed} frames analyzed @ ~${evidence.samplingHz} Hz (Avg kernel latency: ${evidence.avgKernelMs}ms, Digest: ${evidence.digestSha256.slice(0, 12)}...)`,
    'Per-Question Observational Signals:',
  ];

  for (const q of evidence.perQuestion) {
    const blinkStr = q.blinkRatePerMin !== undefined ? `${q.blinkRatePerMin} blinks/min` : 'N/A';
    const mouthStr = q.mouthActivityPct !== undefined ? `${q.mouthActivityPct}% speech/mouth activity` : 'N/A';
    lines.push(
      `- [${q.evidenceId}] Q${q.questionIndex + 1}: Illumination: ${q.illumination} (mean: ${q.meanLuminance}, contrast std: ${q.contrastStdDev}) | Face Presence: ${(q.presenceRatio * 100).toFixed(0)}% (skin coverage: ${q.skinMaskCoveragePct}%) | Sharpness: ${q.sharpnessScore} | Motion: ${q.motionEnergy} | Dynamics: ${blinkStr}, ${mouthStr}`
    );
  }

  lines.push('');
  lines.push(
    'OPTIONAL OBSERVATION FIELD: If relevant to candidate delivery coaching, you may optionally include an "ivpObservations" array in your JSON output referencing exact evidenceIds:'
  );
  lines.push(
    '"ivpObservations": [ { "evidenceId": "IVP-Q1", "observation": "<1 sentence constructive observation on posture, delivery pace, or lighting>" } ]'
  );
  lines.push('=== END IVP EVIDENCE BLOCK ===');
  lines.push('');

  return lines.join('\n');
}

/**
 * Validates and sanitizes AI-generated ivpObservations.
 * Drops any entries whose evidenceId does not match the actual evidence receipt.
 */
export function sanitizeIvpObservations(
  raw: unknown,
  allowedEvidenceIds: Set<string>
): Array<{ evidenceId: string; observation: string }> {
  if (!Array.isArray(raw)) return [];

  const results: Array<{ evidenceId: string; observation: string }> = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const evidenceId = String((item as Record<string, unknown>).evidenceId ?? '').trim();
    const observation = String((item as Record<string, unknown>).observation ?? '').trim();

    if (allowedEvidenceIds.has(evidenceId) && observation.length > 0) {
      results.push({
        evidenceId,
        observation: observation.slice(0, 300), // Bounded length
      });
    }
  }

  return results;
}
