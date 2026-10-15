#!/usr/bin/env tsx
/**
 * verify_ai_benchmarks.ts
 * Standalone verification harness for the Skillo AI Evaluation Benchmark Corpus.
 *
 * Usage:
 *   npx tsx scripts/eval/verify_ai_benchmarks.ts
 *
 * Asserts:
 *   1. Zero split leakage — no entry id appears in more than one split.
 *   2. SE entropy matches analytical bounds for N=3 passes.
 *   3. Length penalty suppresses verbosity exploitation.
 *   4. Benchmark corpus structure is valid.
 *
 * Exit codes:
 *   0 — all assertions passed
 *   1 — one or more assertions failed
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  computeSemanticEquivalenceAndEntropy,
  performInterviewEvaluation,
} from '../../src/lib/services/interviewEvaluation.server';
import { calculateLengthNormalizedReward } from '../../src/lib/services/simpoEngine.server';
import type { SinglePassEvaluation } from '../../src/types/index';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── ANSI colours ─────────────────────────────────────────────────────────────
const GREEN = '\x1b[32m';
const RED   = '\x1b[31m';
const CYAN  = '\x1b[36m';
const RESET = '\x1b[0m';
const BOLD  = '\x1b[1m';

// ── Assertion helper ──────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string): void {
  if (condition) {
    console.log(`  ${GREEN}✓${RESET} ${label}`);
    passed++;
  } else {
    console.error(`  ${RED}✗ FAIL${RESET} ${label}${detail ? `\n       ${RED}${detail}${RESET}` : ''}`);
    failed++;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function makePass(score: number): SinglePassEvaluation {
  return {
    cotReasoning: `Synthetic CoT for score ${score}`,
    scores: { technicalAccuracy: score, systemDesignLogic: score, edgeCaseHandling: score, communicationClarity: score },
    overallScore: score,
    feedback: 'Synthetic feedback',
  };
}

interface BenchmarkEntry {
  id: string;
  domain: string;
  split: string;
  question: string;
  preferred: string;
  dispreferred: string;
}

interface BenchmarkCorpus {
  version: string;
  entries: BenchmarkEntry[];
}

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
  preferredWins: number;
  ties: number;
  meanConfidence: number;
  meanConfidencePerTier: Record<'HIGH' | 'MEDIUM' | 'LOW', number | null>;
  confidenceTierCounts: Record<'HIGH' | 'MEDIUM' | 'LOW', number>;
  expectedCalibrationError: number;
  calibrationBins: CalibrationBin[];
}

interface CalibrationOutput {
  generatedAt: string;
  model: string;
  splits: Record<'validation' | 'test', SplitCalibrationResult>;
}

const CALIBRATION_BIN_COUNT = 10;
const MAX_SEMANTIC_ENTROPY = Math.log2(3);

function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function confidenceFromEntropy(semanticEntropy: number): number {
  return Math.max(0, Math.min(1, 1 - semanticEntropy / MAX_SEMANTIC_ENTROPY));
}

function makeCalibrationBins(
  observations: Array<{ confidence: number; correct: boolean }>
): { bins: CalibrationBin[]; expectedCalibrationError: number } {
  const bins = Array.from({ length: CALIBRATION_BIN_COUNT }, (_, index) => ({
    lowerBound: index / CALIBRATION_BIN_COUNT,
    upperBound: (index + 1) / CALIBRATION_BIN_COUNT,
    observations: [] as Array<{ confidence: number; correct: boolean }>,
  }));

  for (const observation of observations) {
    const index = Math.min(
      CALIBRATION_BIN_COUNT - 1,
      Math.floor(observation.confidence * CALIBRATION_BIN_COUNT)
    );
    bins[index].observations.push(observation);
  }

  let expectedCalibrationError = 0;
  const result = bins.map(({ lowerBound, upperBound, observations: binObservations }) => {
    const count = binObservations.length;
    const meanConfidence = count === 0
      ? 0
      : binObservations.reduce((sum, item) => sum + item.confidence, 0) / count;
    const accuracy = count === 0
      ? 0
      : binObservations.filter((item) => item.correct).length / count;

    expectedCalibrationError += observations.length === 0
      ? 0
      : (count / observations.length) * Math.abs(meanConfidence - accuracy);

    return {
      lowerBound: round(lowerBound),
      upperBound: round(upperBound),
      count,
      meanConfidence: round(meanConfidence),
      accuracy: round(accuracy),
    };
  });

  return { bins: result, expectedCalibrationError: round(expectedCalibrationError) };
}

async function evaluateSplit(
  split: 'validation' | 'test',
  entries: BenchmarkEntry[]
): Promise<SplitCalibrationResult> {
  const observations: Array<{ confidence: number; correct: boolean }> = [];
  const confidenceByTier: Record<'HIGH' | 'MEDIUM' | 'LOW', number[]> = {
    HIGH: [],
    MEDIUM: [],
    LOW: [],
  };
  let preferredWins = 0;
  let ties = 0;

  for (const entry of entries.filter((candidate) => candidate.split === split)) {
    const baseInput = {
      setupData: {
        role: 'Technical Interview Candidate',
        experienceLevel: 'senior',
        type: entry.domain,
      },
      questionsList: [{ id: entry.id, question: entry.question }],
      deepAnalysisMode: false,
    };

    const [preferredReport, dispreferredReport] = await Promise.all([
      performInterviewEvaluation(
        { ...baseInput, answersList: [entry.preferred] },
        `benchmark-${entry.id}-preferred`
      ),
      performInterviewEvaluation(
        { ...baseInput, answersList: [entry.dispreferred] },
        `benchmark-${entry.id}-dispreferred`
      ),
    ]);

    const reports = [preferredReport, dispreferredReport];
    if (reports.some((report) =>
      report.evaluationMode !== 'live' ||
      report.suqEvaluation?.evaluationMode !== 'live' ||
      report.source !== 'live'
    )) {
      throw new Error(`Evaluator returned a non-live result for ${entry.id}; refusing to report fallback scores`);
    }
    if (reports.some((report) => !report.suqEvaluation)) {
      throw new Error(`Evaluator returned no structured result for ${entry.id}`);
    }

    const preferredEvaluation = preferredReport.suqEvaluation;
    const dispreferredEvaluation = dispreferredReport.suqEvaluation;
    if (!preferredEvaluation || !dispreferredEvaluation) {
      throw new Error(`Evaluator returned no structured result for ${entry.id}`);
    }

    const preferredScore = preferredEvaluation.finalScore;
    const dispreferredScore = dispreferredEvaluation.finalScore;
    const preferredWon = preferredScore > dispreferredScore;
    if (preferredWon) {
      preferredWins++;
    } else if (preferredScore === dispreferredScore) {
      ties++;
    }

    const pairConfidence = (
      confidenceFromEntropy(preferredEvaluation.semanticEntropy) +
      confidenceFromEntropy(dispreferredEvaluation.semanticEntropy)
    ) / 2;
    observations.push({ confidence: pairConfidence, correct: preferredWon });

    for (const report of reports) {
      const evaluation = report.suqEvaluation;
      if (!evaluation) {
        throw new Error(`Evaluator returned no structured result for ${entry.id}`);
      }
      const tier = evaluation.confidenceLevel;
      confidenceByTier[tier].push(confidenceFromEntropy(evaluation.semanticEntropy));
    }
  }

  const { bins, expectedCalibrationError } = makeCalibrationBins(observations);
  const tierNames: Array<'HIGH' | 'MEDIUM' | 'LOW'> = ['HIGH', 'MEDIUM', 'LOW'];
  const meanConfidencePerTier = Object.fromEntries(
    tierNames.map((tier) => [
      tier,
      confidenceByTier[tier].length === 0
        ? null
        : round(confidenceByTier[tier].reduce((sum, value) => sum + value, 0) / confidenceByTier[tier].length),
    ])
  ) as Record<'HIGH' | 'MEDIUM' | 'LOW', number | null>;

  return {
    entries: entries.filter((candidate) => candidate.split === split).length,
    pairwiseAccuracy: round(preferredWins / observations.length),
    preferredWins,
    ties,
    meanConfidence: round(
      observations.reduce((sum, observation) => sum + observation.confidence, 0) / observations.length
    ),
    meanConfidencePerTier,
    confidenceTierCounts: Object.fromEntries(
      tierNames.map((tier) => [tier, confidenceByTier[tier].length])
    ) as Record<'HIGH' | 'MEDIUM' | 'LOW', number>,
    expectedCalibrationError,
    calibrationBins: bins,
  };
}

async function writeCalibrationResults(entries: BenchmarkEntry[]): Promise<void> {
  const outputPath = path.resolve(__dirname, '..', '..', 'docs', 'calibration-latest.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    fs.writeFileSync(outputPath, `${JSON.stringify({
      skipped: true,
      reason: 'ANTHROPIC_API_KEY is not configured; live calibration was not run.',
    }, null, 2)}\n`);
    console.log(`\nCalibration skipped; wrote ${outputPath}`);
    return;
  }

  try {
    const output: CalibrationOutput = {
      generatedAt: new Date().toISOString(),
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
      splits: {
        validation: await evaluateSplit('validation', entries),
        test: await evaluateSplit('test', entries),
      },
    };
    fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
    console.log(`\nLive calibration results wrote ${outputPath}`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    fs.writeFileSync(outputPath, `${JSON.stringify({
      skipped: true,
      reason: `Live calibration did not complete: ${reason}`,
    }, null, 2)}\n`);
    throw error;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log(`\n${BOLD}${CYAN}Skillo AI Evaluation Benchmark Verification Harness${RESET}`);
  console.log(`${'─'.repeat(55)}\n`);

  // ── 1. Load corpus ─────────────────────────────────────────────────────────
  const corpusPath = path.resolve(__dirname, '..', '..', 'data', 'benchmarks', 'interview_benchmarks.json');
  assert(fs.existsSync(corpusPath), 'Benchmark corpus file exists at data/benchmarks/interview_benchmarks.json');

  const corpus: BenchmarkCorpus = JSON.parse(fs.readFileSync(corpusPath, 'utf-8'));
  const entries = corpus.entries;

  console.log(`\n${BOLD}Section 1: Corpus Structure${RESET}`);
  assert(entries.length === 50, `Total entries = 50 (actual: ${entries.length})`);

  const calibration = entries.filter(e => e.split === 'calibration');
  const validation  = entries.filter(e => e.split === 'validation');
  const test        = entries.filter(e => e.split === 'test');

  assert(calibration.length === 35, `Calibration split = 35 (70%) — actual: ${calibration.length}`);
  assert(validation.length === 7, `Validation split = 7 (15%) — actual: ${validation.length}`);
  assert(test.length === 8, `Test split = 8 (15%) — actual: ${test.length}`);

  // ── 2. Zero leakage check ──────────────────────────────────────────────────
  console.log(`\n${BOLD}Section 2: Zero Split Leakage${RESET}`);
  const idToSplits = new Map<string, string[]>();
  for (const e of entries) {
    const splits = idToSplits.get(e.id) ?? [];
    splits.push(e.split);
    idToSplits.set(e.id, splits);
  }
  let leakageFound = false;
  for (const [id, splits] of idToSplits) {
    if (splits.length > 1) {
      leakageFound = true;
      assert(false, `No leakage for entry "${id}"`, `appears in splits: ${splits.join(', ')}`);
    }
  }
  if (!leakageFound) {
    assert(true, `Zero leakage: all ${entries.length} entry ids are unique across splits`);
  }

  // ── 3. Domain coverage ─────────────────────────────────────────────────────
  console.log(`\n${BOLD}Section 3: Domain Coverage${RESET}`);
  const domains = ['Distributed Systems', 'System Design', 'Frontend Architecture'];
  for (const domain of domains) {
    const count = entries.filter(e => e.domain === domain).length;
    assert(count >= 8, `Domain "${domain}" has >= 8 entries — actual: ${count}`);
  }

  // ── 4. SE entropy analytical bounds (N=3) ─────────────────────────────────
  console.log(`\n${BOLD}Section 4: SE Entropy Analytical Bounds (N=3)${RESET}`);

  // Case A: single cluster → SE = 0 → HIGH
  const caseA = computeSemanticEquivalenceAndEntropy([4.0, 4.0, 4.0].map(makePass), 0.5);
  assert(Math.abs(caseA.semanticEntropy) < 0.001, `SE = 0 for identical scores — actual: ${caseA.semanticEntropy}`);
  assert(caseA.confidenceLevel === 'HIGH', `Confidence HIGH when SE ≈ 0 — actual: ${caseA.confidenceLevel}`);

  // Case B: 2+1 split → SE ≈ 0.918 → LOW (> 0.8)
  const caseB = computeSemanticEquivalenceAndEntropy([1.0, 1.0, 5.0].map(makePass), 0.5);
  const expectedB = -(2/3) * Math.log2(2/3) - (1/3) * Math.log2(1/3);
  assert(Math.abs(caseB.semanticEntropy - expectedB) < 0.05,
    `SE ≈ ${expectedB.toFixed(3)} for 2+1 split — actual: ${caseB.semanticEntropy}`);
  assert(caseB.confidenceLevel === 'LOW', `Confidence LOW when SE ≈ 0.918 (> 0.8) — actual: ${caseB.confidenceLevel}`);
  assert(caseB.requiresValidationPass === true, `requiresValidationPass = true when LOW`);

  // Case C: 3 clusters → SE ≈ log2(3) = 1.585 → LOW
  const caseC = computeSemanticEquivalenceAndEntropy([1.0, 2.0, 5.0].map(makePass), 0.5);
  const expectedC = Math.log2(3);
  assert(Math.abs(caseC.semanticEntropy - expectedC) < 0.1,
    `SE ≈ log2(3) = ${expectedC.toFixed(3)} for 3 distinct clusters — actual: ${caseC.semanticEntropy}`);

  // ── 5. Length penalty verbosity suppression ────────────────────────────────
  console.log(`\n${BOLD}Section 5: Length Penalty Verbosity Suppression${RESET}`);
  const BETA = 2.0;

  // Same quality — shorter text gets higher reward (verbosity penalised)
  const short = calculateLengthNormalizedReward('Use Redis for rate limiting.', 0.5, BETA);
  const long  = calculateLengthNormalizedReward(
    'Implement sliding window counter in Redis Sorted Sets using ZREMRANGEBYSCORE for expiry and ZCARD for cardinality. Add Redlock distributed mutex for cross-region consistency with quorum=3 and auto-lease extension.',
    0.5, BETA
  );
  assert(short.implicitReward > long.implicitReward,
    `Shorter text has higher reward at equal quality (verbosity suppressed): ${short.implicitReward.toFixed(4)} > ${long.implicitReward.toFixed(4)}`);

  // Same length — higher quality wins
  const text = 'Rate limiter using Redis Sorted Sets with atomic Lua scripts and Redlock.';
  const highQ = calculateLengthNormalizedReward(text, 0.85, BETA);
  const lowQ  = calculateLengthNormalizedReward(text, 0.30, BETA);
  assert(highQ.implicitReward > lowQ.implicitReward,
    `Higher quality scores higher reward at same length: ${highQ.implicitReward.toFixed(4)} > ${lowQ.implicitReward.toFixed(4)}`);

  // Benchmark test-split: preferred always longer than dispreferred
  let allPreferredLonger = true;
  for (const entry of test) {
    if (entry.preferred.length <= entry.dispreferred.length) {
      allPreferredLonger = false;
      assert(false, `Test entry "${entry.id}": preferred length (${entry.preferred.length}) > dispreferred (${entry.dispreferred.length})`);
    }
  }
  if (allPreferredLonger) {
    assert(true, `All test-split preferred answers are longer than dispreferred`);
  }

  await writeCalibrationResults(entries);

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(55)}`);
  const totalAssertions = passed + failed;
  if (failed === 0) {
    console.log(`${GREEN}${BOLD}All ${passed}/${totalAssertions} assertions passed.${RESET}\n`);
    process.exit(0);
  } else {
    console.error(`${RED}${BOLD}${failed}/${totalAssertions} assertions FAILED.${RESET}\n`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(`${RED}Unhandled error:${RESET}`, err);
  process.exit(1);
});
