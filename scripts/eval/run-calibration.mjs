#!/usr/bin/env node
/**
 * scripts/eval/run-calibration.mjs
 *
 * C5 Part 1: Calibration harness — runs the benchmark corpus validation + test
 * splits through the evaluator and persists results to docs/calibration-latest.json.
 *
 * Usage:
 *   node scripts/eval/run-calibration.mjs           # live run (requires API key)
 *   node scripts/eval/run-calibration.mjs --dry-run # schema-only, no API calls
 *
 * Output:
 *   docs/calibration-latest.json  (read by app/(app)/calibration/page.tsx)
 *
 * Metrics:
 *   - pairwiseAccuracy  : fraction of pairs where preferred outscores dispreferred
 *   - ECE               : Expected Calibration Error (10 equal-width confidence bins)
 *   - meanConfidence    : mean pass confidence across HIGH/MEDIUM/LOW tiers
 *
 * Exit codes:
 *   0 — artifact written (or dry-run complete)
 *   1 — fatal error (missing corpus, schema mismatch, unexpected exception)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');

// ── ANSI ──────────────────────────────────────────────────────────────────────
const G = '\x1b[32m';
const R = '\x1b[31m';
const C = '\x1b[36m';
const Y = '\x1b[33m';
const B = '\x1b[1m';
const X = '\x1b[0m';

function log(prefix, msg) { console.log(`${prefix}${msg}${X}`); }

// ── Load .env.local without overriding real env vars ─────────────────────────
function loadLocalEnv() {
  for (const name of ['.env.local', '.env']) {
    const file = path.resolve(ROOT, name);
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
      if (!match || line.trim().startsWith('#')) continue;
      const value = match[2].replace(/^(['"])(.*)\1$/, '$2');
      if (process.env[match[1]] === undefined) process.env[match[1]] = value;
    }
  }
}

// ── Corpus loader ─────────────────────────────────────────────────────────────
function loadCorpus() {
  const corpusPath = path.join(ROOT, 'data', 'benchmarks', 'interview_benchmarks.json');
  if (!fs.existsSync(corpusPath)) {
    throw new Error(`Benchmark corpus not found at ${corpusPath}`);
  }
  const raw = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));
  const entries = raw.entries ?? [];
  // Validate basic schema
  for (const e of entries) {
    if (!e.id || !e.split || !e.preferred || !e.dispreferred) {
      throw new Error(`Corpus entry ${e.id ?? '?'} is missing required fields.`);
    }
  }
  return entries;
}

// ── Calibration bin helpers (10 equal-width bins over [0, 1]) ─────────────────
const N_BINS = 10;

function makeBins() {
  return Array.from({ length: N_BINS }, (_, i) => ({
    lowerBound: +(i / N_BINS).toFixed(2),
    upperBound: +((i + 1) / N_BINS).toFixed(2),
    count: 0,
    sumConfidence: 0,
    sumAccuracy: 0,
  }));
}

function assignBin(bins, confidence) {
  const idx = Math.min(Math.floor(confidence * N_BINS), N_BINS - 1);
  return bins[idx];
}

function finalizeBins(bins) {
  return bins.map(({ lowerBound, upperBound, count, sumConfidence, sumAccuracy }) => ({
    lowerBound,
    upperBound,
    count,
    meanConfidence: count > 0 ? +(sumConfidence / count).toFixed(4) : 0,
    accuracy: count > 0 ? +(sumAccuracy / count).toFixed(4) : 0,
  }));
}

function computeECE(bins) {
  const total = bins.reduce((s, b) => s + b.count, 0);
  if (total === 0) return 0;
  return +bins.reduce((ece, b) => {
    if (b.count === 0) return ece;
    const midConf = (b.lowerBound + b.upperBound) / 2;
    return ece + (b.count / total) * Math.abs(midConf - b.accuracy);
  }, 0).toFixed(4);
}

// ── Confidence tier → numeric ─────────────────────────────────────────────────
// Maps SUQ confidenceLevel to a numeric probability used for calibration bins.
// HIGH → 0.90, MEDIUM → 0.65, LOW → 0.35
const CONFIDENCE_MAP = { HIGH: 0.90, MEDIUM: 0.65, LOW: 0.35 };

// ── Simulated evaluator (dry-run) ─────────────────────────────────────────────
// Returns a deterministic dummy result so the schema contract is exercised
// without making real API calls.
function dryRunEvaluate(entry, isPreferred) {
  return {
    overallScore: isPreferred ? 8.5 : 3.5,
    suqEvaluation: {
      confidenceLevel: 'HIGH',
      semanticEntropy: 0.0,
    },
    source: 'fallback',
  };
}

// ── Live evaluator (delegates to the Next.js service layer via tsx) ──────────
async function liveEvaluate(entry, text, apiKey, isDryRun) {
  if (isDryRun) {
    // Return synthetic result — no actual network call
    const isPreferred = text === entry.preferred;
    return dryRunEvaluate(entry, isPreferred);
  }

  // Dynamic import so this script only requires the evaluator when API key exists.
  // We call the calibration-mode path that skips Reflexion + SimPO lookups.
  const { performInterviewEvaluation } = await import(
    '../../src/lib/services/interviewEvaluation.server.js'
  ).catch(() => {
    throw new Error(
      'Could not import interviewEvaluation.server. Run with --dry-run or compile first.'
    );
  });

  const result = await performInterviewEvaluation({
    question: entry.question,
    answer: text,
    anthropicApiKey: apiKey,
    calibrationMode: true,
  });
  return result;
}

// ── Per-split evaluation ───────────────────────────────────────────────────────
async function evaluateSplit(entries, split, apiKey, isDryRun) {
  const splitEntries = entries.filter((e) => e.split === split);
  if (splitEntries.length === 0) {
    return {
      entries: 0,
      pairwiseAccuracy: 0,
      preferredWins: 0,
      ties: 0,
      meanConfidence: 0,
      meanConfidencePerTier: { HIGH: null, MEDIUM: null, LOW: null },
      confidenceTierCounts: { HIGH: 0, MEDIUM: 0, LOW: 0 },
      expectedCalibrationError: 0,
      ECE: 0,
      warning: `No entries found for split "${split}"`,
      calibrationBins: finalizeBins(makeBins()),
    };
  }

  log(C, `  Evaluating ${splitEntries.length} entries in "${split}" split...`);

  const bins = makeBins();
  let preferredWins = 0;
  let ties = 0;
  const tierSums = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  const tierCounts = { HIGH: 0, MEDIUM: 0, LOW: 0 };

  for (let i = 0; i < splitEntries.length; i++) {
    const entry = splitEntries[i];
    process.stdout.write(`    [${i + 1}/${splitEntries.length}] ${entry.id}... `);

    const [prefResult, disprefResult] = await Promise.all([
      liveEvaluate(entry, entry.preferred, apiKey, isDryRun),
      liveEvaluate(entry, entry.dispreferred, apiKey, isDryRun),
    ]);

    const prefScore = prefResult?.overallScore ?? 0;
    const disprefScore = disprefResult?.overallScore ?? 0;
    const accuracy = prefScore > disprefScore ? 1 : prefScore === disprefScore ? 0.5 : 0;

    if (prefScore > disprefScore) preferredWins++;
    else if (prefScore === disprefScore) ties++;

    // Calibration: use preferred-answer confidence as the model's "certainty"
    const confLevel = prefResult?.suqEvaluation?.confidenceLevel ?? 'MEDIUM';
    const confNumeric = CONFIDENCE_MAP[confLevel] ?? 0.65;

    const bin = assignBin(bins, confNumeric);
    bin.count++;
    bin.sumConfidence += confNumeric;
    bin.sumAccuracy += accuracy;

    if (confLevel in tierSums) {
      tierSums[confLevel] += confNumeric;
      tierCounts[confLevel]++;
    }

    process.stdout.write(`${accuracy === 1 ? '✓' : accuracy === 0.5 ? '~' : '✗'} (pref=${prefScore.toFixed(1)}, dis=${disprefScore.toFixed(1)})\n`);
  }

  const finalBins = finalizeBins(bins);
  const pairwiseAccuracy = +((preferredWins + ties * 0.5) / splitEntries.length).toFixed(4);
  const ECE = computeECE(finalBins);

  const totalConf = Object.values(tierSums).reduce((s, v) => s + v, 0);
  const totalCount = Object.values(tierCounts).reduce((s, v) => s + v, 0);
  const meanConfidence = totalCount > 0 ? +(totalConf / totalCount).toFixed(4) : 0;

  const meanConfidencePerTier = Object.fromEntries(
    Object.entries(tierSums).map(([tier, sum]) => [
      tier,
      tierCounts[tier] > 0 ? +(sum / tierCounts[tier]).toFixed(4) : null,
    ])
  );

  return {
    entries: splitEntries.length,
    pairwiseAccuracy,
    preferredWins,
    ties,
    meanConfidence,
    meanConfidencePerTier,
    confidenceTierCounts: { ...tierCounts },
    expectedCalibrationError: ECE,
    ECE,
    calibrationBins: finalBins,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  loadLocalEnv();

  const isDryRun = process.argv.includes('--dry-run');
  const artifactPath = path.join(ROOT, 'docs', 'calibration-latest.json');

  log(B + C, '\n═══ Skillo Calibration Harness (C5) ═══\n');

  if (isDryRun) {
    log(Y, '⚠  DRY-RUN MODE: using synthetic scores, no API calls will be made.\n');
  }

  // Load corpus
  let entries;
  try {
    entries = loadCorpus();
    log(G, `✓ Corpus loaded — ${entries.length} total entries`);
  } catch (err) {
    log(R, `✗ ${err.message}`);
    process.exit(1);
  }

  // Resolve API key
  const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.GROQ_API_KEY ?? '';
  const modelName = process.env.ANTHROPIC_API_KEY
    ? `anthropic:${process.env.AI_MODEL ?? 'claude-sonnet-5-5'}`
    : process.env.GROQ_API_KEY
    ? `groq:${process.env.AI_MODEL ?? 'openai/gpt-oss-120b'}`
    : 'none';

  if (!apiKey && !isDryRun) {
    log(Y, `⚠  No API key found (ANTHROPIC_API_KEY / GROQ_API_KEY). Writing skipped artifact.`);
    const skipped = {
      skipped: true,
      reason: 'No AI API key is configured. Set ANTHROPIC_API_KEY or GROQ_API_KEY and re-run.',
    };
    fs.writeFileSync(artifactPath, JSON.stringify(skipped, null, 2), 'utf8');
    log(G, `✓ Skipped artifact written to ${path.relative(ROOT, artifactPath)}`);
    process.exit(0);
  }

  if (!isDryRun) {
    log(C, `  Model: ${modelName}`);
  }

  // Evaluate validation + test splits
  let validationResult, testResult;
  try {
    validationResult = await evaluateSplit(entries, 'validation', apiKey, isDryRun);
    testResult = await evaluateSplit(entries, 'test', apiKey, isDryRun);
  } catch (err) {
    log(R, `\n✗ Evaluation failed: ${err.message}`);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  }

  // Build artifact
  const artifact = {
    generatedAt: new Date().toISOString(),
    model: isDryRun ? 'dry-run (no-api)' : modelName,
    splits: {
      validation: validationResult,
      test: testResult,
    },
  };

  // Write
  fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2), 'utf8');

  // Summary
  const vPct = (validationResult.pairwiseAccuracy * 100).toFixed(1);
  const tPct = (testResult.pairwiseAccuracy * 100).toFixed(1);
  const vECE = (validationResult.ECE * 100).toFixed(1);
  const tECE = (testResult.ECE * 100).toFixed(1);

  log(B, '\n── Results ──────────────────────────────');
  log(G, `  validation: pairwise accuracy ${vPct}%  ECE ${vECE}%  (${validationResult.entries} pairs)`);
  log(G, `  test:       pairwise accuracy ${tPct}%  ECE ${tECE}%  (${testResult.entries} pairs)`);
  log(G, `\n✓ Artifact written to ${path.relative(ROOT, artifactPath)}`);

  if (isDryRun) {
    log(Y, '  (dry-run: values are synthetic — re-run without --dry-run for real metrics)');
  }
}

main().catch((err) => {
  console.error('\x1b[31m✗ Fatal:\x1b[0m', err.message);
  process.exit(1);
});
