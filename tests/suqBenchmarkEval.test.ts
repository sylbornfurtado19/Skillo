/**
 * suqBenchmarkEval.test.ts
 * Jest suite for Part 1: SUQ N=3 calibration, BenchmarkDeltaCard schema,
 * benchmark corpus split integrity, and length-penalty verbosity suppression.
 */

import { computeSemanticEquivalenceAndEntropy } from '../src/lib/services/interviewEvaluation.server';
import { calculateLengthNormalizedReward, benchmarkDeltaCardSchema } from '../src/lib/services/simpoEngine.server';
import type { SinglePassEvaluation } from '../src/types/index';
import * as path from 'path';
import * as fs from 'fs';

function makePass(overallScore: number): SinglePassEvaluation {
  return {
    cotReasoning: `Mock CoT reasoning for score ${overallScore}`,
    scores: { technicalAccuracy: overallScore, systemDesignLogic: overallScore, edgeCaseHandling: overallScore, communicationClarity: overallScore },
    overallScore,
    feedback: 'Mock feedback',
  };
}

// === P1: Recalibrated SE thresholds (HIGH <=0.3, MEDIUM 0.3-0.8, LOW >0.8) ===

describe('P1 — SUQ: N=3 recalibrated SE thresholds', () => {
  it('single cluster (all 3 passes identical) → SE = 0 → HIGH', () => {
    const passes = [4.0, 4.0, 4.0].map(makePass);
    const result = computeSemanticEquivalenceAndEntropy(passes, 0.5);
    expect(result.semanticEntropy).toBeCloseTo(0, 5);
    expect(result.confidenceLevel).toBe('HIGH');
    expect(result.requiresValidationPass).toBe(false);
  });

  it('2+1 cluster split from N=3 → SE ≈ 0.918 → LOW (> 0.8)', () => {
    const passes = [1.0, 1.0, 5.0].map(makePass);
    const { semanticEntropy, confidenceLevel, requiresValidationPass } = computeSemanticEquivalenceAndEntropy(passes, 0.5);
    expect(semanticEntropy).toBeGreaterThan(0.8);
    expect(confidenceLevel).toBe('LOW');
    expect(requiresValidationPass).toBe(true);
  });

  it('3 distinct clusters from N=3 → SE = log2(3) ≈ 1.585 → LOW', () => {
    const passes = [1.0, 2.0, 5.0].map(makePass);
    const { semanticEntropy, confidenceLevel } = computeSemanticEquivalenceAndEntropy(passes, 0.5);
    expect(semanticEntropy).toBeCloseTo(Math.log2(3), 1);
    expect(confidenceLevel).toBe('LOW');
  });

  it('N=3 clustering: total pass indices across all clusters equals 3', () => {
    const passes = [1.0, 3.0, 5.0].map(makePass);
    const { clusters } = computeSemanticEquivalenceAndEntropy(passes, 0.5);
    const total = clusters.reduce((s, c) => s + c.passIndices.length, 0);
    expect(total).toBe(3);
  });

  it('cluster probabilities sum to 1.0', () => {
    const passes = [1.0, 1.5, 4.0].map(makePass);
    const { clusters } = computeSemanticEquivalenceAndEntropy(passes, 0.5);
    const sum = clusters.reduce((s, c) => s + c.probability, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('requiresValidationPass is false when SE = 0', () => {
    const passes = [3.5, 3.5, 3.5].map(makePass);
    const { requiresValidationPass } = computeSemanticEquivalenceAndEntropy(passes, 0.5);
    expect(requiresValidationPass).toBe(false);
  });
});

// === P2: BenchmarkDeltaCard Zod schema ===

describe('P2 — BenchmarkDeltaCard Zod schema', () => {
  it('validates a well-formed BenchmarkDeltaCard', () => {
    const card = {
      architecturalGap: ['Missing distributed lock mechanism for cache mutations.'],
      edgeCaseOversights: ['Does not address null-input boundary on empty request body.'],
      faangComparison: 'FAANG response includes Redlock; candidate used simple in-memory lock.',
      rewardScore: 0.042,
    };
    expect(benchmarkDeltaCardSchema.safeParse(card).success).toBe(true);
  });

  it('rejects card with faangComparison shorter than 10 chars', () => {
    const card = {
      architecturalGap: ['Gap description here'],
      edgeCaseOversights: ['Oversight description here'],
      faangComparison: 'Short',
      rewardScore: 0.1,
    };
    expect(benchmarkDeltaCardSchema.safeParse(card).success).toBe(false);
  });

  it('rejects card with negative rewardScore', () => {
    const card = {
      architecturalGap: ['Architecture gap description here'],
      edgeCaseOversights: ['Edge case oversight description here'],
      faangComparison: 'FAANG comparison sentence here to meet minimum length.',
      rewardScore: -0.5,
    };
    expect(benchmarkDeltaCardSchema.safeParse(card).success).toBe(false);
  });

  it('accepts rewardScore of 0', () => {
    const card = {
      architecturalGap: ['Gap item longer than three chars'],
      edgeCaseOversights: ['Oversight longer than three chars'],
      faangComparison: 'FAANG-level comparison summary sentence here.',
      rewardScore: 0,
    };
    expect(benchmarkDeltaCardSchema.safeParse(card).success).toBe(true);
  });
});

// === P3: Benchmark corpus split integrity ===

interface BenchmarkEntry { id: string; domain: string; split: string; question: string; preferred: string; dispreferred: string; }
interface BenchmarkCorpus { version: string; entries: BenchmarkEntry[]; }

const CORPUS_PATH = path.resolve(__dirname, '..', 'data', 'benchmarks', 'interview_benchmarks.json');

describe('P3 — Benchmark corpus split integrity', () => {
  let corpus: BenchmarkCorpus;

  beforeAll(() => {
    const raw = fs.readFileSync(CORPUS_PATH, 'utf-8');
    corpus = JSON.parse(raw) as BenchmarkCorpus;
  });

  it('corpus has exactly 30 entries', () => {
    expect(corpus.entries).toHaveLength(30);
  });

  it('calibration split has 21 entries (70%)', () => {
    expect(corpus.entries.filter(e => e.split === 'calibration')).toHaveLength(21);
  });

  it('validation split has 4-5 entries (~15%)', () => {
    const count = corpus.entries.filter(e => e.split === 'validation').length;
    expect(count).toBeGreaterThanOrEqual(4);
    expect(count).toBeLessThanOrEqual(5);
  });

  it('test split has 4-5 entries (~15%)', () => {
    const count = corpus.entries.filter(e => e.split === 'test').length;
    expect(count).toBeGreaterThanOrEqual(4);
    expect(count).toBeLessThanOrEqual(5);
  });

  it('zero split leakage: no entry id appears in more than one split', () => {
    const seen = new Map<string, string>();
    for (const entry of corpus.entries) {
      expect(seen.has(entry.id)).toBe(false);
      seen.set(entry.id, entry.split);
    }
  });

  it('all three domains represented with at least 8 entries each', () => {
    const domains = ['Distributed Systems', 'System Design', 'Frontend Architecture'];
    for (const domain of domains) {
      const count = corpus.entries.filter(e => e.domain === domain).length;
      expect(count).toBeGreaterThanOrEqual(8);
    }
  });

  it('all entries have non-empty preferred and dispreferred answers', () => {
    for (const entry of corpus.entries) {
      expect(entry.preferred.trim().length).toBeGreaterThan(20);
      expect(entry.dispreferred.trim().length).toBeGreaterThan(10);
    }
  });

  it('all entry ids are unique', () => {
    const ids = corpus.entries.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// === P4: Length-normalized reward verbosity suppression ===

describe('P4 — Length-normalized reward verbosity suppression', () => {
  const BETA = 2.0;

  it('preferred (longer, higher quality) has greater tokenLength than dispreferred', () => {
    const preferred = calculateLengthNormalizedReward(
      'Implement distributed sliding window counter using Redis Sorted Sets with atomic Lua scripts. Use ZREMRANGEBYSCORE for window cleanup and ZCARD for cardinality. Add Redlock distributed mutex for cross-region failover and circuit breaker auto-failover patterns with exponential backoff.',
      0.85, BETA
    );
    const dispreferred = calculateLengthNormalizedReward('Use Redis to count requests and reset every minute.', 0.3, BETA);
    expect(preferred.tokenLength).toBeGreaterThan(dispreferred.tokenLength);
    expect(Number.isFinite(preferred.implicitReward)).toBe(true);
    expect(Number.isFinite(dispreferred.implicitReward)).toBe(true);
  });

  it('same text — higher quality always yields higher reward', () => {
    const text = 'Design a scalable distributed rate limiter using Redis Sorted Sets.';
    const highQ = calculateLengthNormalizedReward(text, 0.9, BETA);
    const lowQ = calculateLengthNormalizedReward(text, 0.3, BETA);
    expect(highQ.implicitReward).toBeGreaterThan(lowQ.implicitReward);
  });

  it('reward scales linearly with beta parameter', () => {
    const text = 'Redis Sorted Sets for rate limiting with atomic Lua scripts.';
    const r1 = calculateLengthNormalizedReward(text, 0.5, 1.0);
    const r2 = calculateLengthNormalizedReward(text, 0.5, 2.0);
    expect(r2.implicitReward).toBeCloseTo(r1.implicitReward * 2, 2);
  });

  it('benchmark test-split: preferred answers are longer than dispreferred', () => {
    const raw = fs.readFileSync(CORPUS_PATH, 'utf-8');
    const corp: BenchmarkCorpus = JSON.parse(raw);
    const testEntries = corp.entries.filter(e => e.split === 'test');
    for (const entry of testEntries) {
      expect(entry.preferred.length).toBeGreaterThan(entry.dispreferred.length);
    }
  });
});
