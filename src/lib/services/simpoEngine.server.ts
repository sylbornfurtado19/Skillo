/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * SimPO Contrastive Preference Optimization Engine (Meng et al., ICML 2024)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * CONTRASTIVE SCORING DESIGN & REDESIGN FORMULATION:
 *
 * 1. Background & The Length Inversion Problem:
 *    SimPO defines length-normalized implicit reward as:
 *      r(x, y) = (beta / |y|) * log(pi_theta(y | x))
 *    Because token log-probabilities are unavailable via standard model APIs, an
 *    early heuristic substituted the quality score q in [0, 1] directly into:
 *      r(x, y) = (beta * q) / max(1, |y|)
 *    However, FAANG-level benchmark answers (y_preferred) are systematically more
 *    detailed and comprehensive than candidate answers (|y_preferred| >> |y_dispreferred|).
 *    Consequently, dividing by length heavily penalized the benchmark, resulting in
 *    r_preferred < r_dispreferred (rewardMargin < 0), causing marginSatisfied (gamma = 0.5)
 *    to almost never evaluate to true even when the benchmark was vastly superior.
 *
 * 2. Redesigned Separation of Quality Margin vs. Verbosity Penalty:
 *    To produce mathematically meaningful and intuitive contrastive evaluations:
 *
 *    a) Quality-Scale Comparison Margin:
 *       margin = q_preferred - q_candidate   (both bounded in [0, 1])
 *       - q_preferred: Target FAANG benchmark quality (default 0.85).
 *       - q_candidate: Evaluated quality score from judge/rubric (clamped [0.05, 0.95],
 *         with empty answers capped at <= 0.35 floor).
 *       - qualityMargin = q_preferred - q_candidate
 *
 *    b) Margin Satisfaction Condition:
 *       marginSatisfied is true if and only if the benchmark is meaningfully better
 *       than the candidate by at least gamma on the quality scale:
 *         marginSatisfied = (q_candidate < q_preferred) && (qualityMargin >= gamma)
 *       - Default threshold: gamma = 0.25 (DEFAULT_SIMPO_GAMMA).
 *       - When candidate >= benchmark (q_candidate >= q_preferred), marginSatisfied
 *         is strictly FALSE because the candidate already meets or exceeds the target.
 *
 *    c) Length-Normalized Reward as an Exposed Verbosity-Penalty Metric:
 *       The SimPO surrogate implicit reward r(x, y) = (beta * q) / max(1, |y|)
 *       remains preserved and exposed on both candidate and benchmark answers.
 *       It serves as a separate token-density / verbosity penalty indicator,
 *       rewarding high-information density without skewing the primary quality margin.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { z } from 'zod';
import type {
  StructuralDelta,
  SimPOContrastivePair,
  ContrastiveEvaluationResult,
  BenchmarkDeltaCard,
} from '@/types/index';
import { executeAnthropicRequest, AI_CONFIG } from '@/lib/ai/aiConfig';
import { retrieveBenchmarkAnswer } from './benchmarkRetrieval.server';

export const DEFAULT_SIMPO_GAMMA = 0.25;

// ── Zod Schema: FAANG BenchmarkDeltaCard ────────────────────────────────────
export const benchmarkDeltaCardSchema = z.object({
  architecturalGap: z.array(z.string().min(3)),
  edgeCaseOversights: z.array(z.string().min(3)),
  faangComparison: z.string().min(10),
  rewardScore: z.number().min(0),
});

/**
 * Derives a Zod-validated BenchmarkDeltaCard from SimPO structural deltas
 * and the contrastive reward pair.
 */
function deriveBenchmarkDeltaCard(
  deltas: StructuralDelta[],
  preferredReward: number,
  role: string
): BenchmarkDeltaCard {
  const architecturalGap = deltas
    .filter(d => d.dimension === 'SYSTEM_ARCHITECTURE' || d.dimension === 'COMPLEXITY')
    .map(d => d.candidateDeficiency)
    .filter(Boolean);

  const edgeCaseOversights = deltas
    .filter(d => d.dimension === 'EDGE_CASES' || d.dimension === 'TERMINOLOGY')
    .map(d => d.candidateDeficiency)
    .filter(Boolean);

  // Ensure non-empty arrays even when no matching deltas exist
  if (architecturalGap.length === 0) {
    architecturalGap.push(`${role} answer lacks explicit production-scale architectural trade-off analysis.`);
  }
  if (edgeCaseOversights.length === 0) {
    edgeCaseOversights.push(`${role} answer does not address network partition, null-boundary, or zero-downtime deployment edge cases.`);
  }

  const topDelta = deltas.reduce(
    (best, d) => (d.impactScore > (best?.impactScore ?? -1) ? d : best),
    deltas[0]
  );

  const faangComparison = topDelta
    ? `FAANG benchmark prioritises "${topDelta.preferredBenchmark}" — candidate's response instead exhibits "${topDelta.candidateDeficiency}".`
    : `FAANG-level response for ${role} requires explicit Big-O bounds, distributed fault tolerance, and cache invalidation semantics.`;

  const card: BenchmarkDeltaCard = {
    architecturalGap,
    edgeCaseOversights,
    faangComparison,
    rewardScore: Math.round(preferredReward * 1000) / 1000,
  };

  // Validate through Zod — fall back to raw card on schema error (should never happen)
  const parsed = benchmarkDeltaCardSchema.safeParse(card);
  return parsed.success ? parsed.data : card;
}

// 1. Zod Validation Schemas for Contrastive Engine Output
export const structuralDeltaSchema = z.object({
  dimension: z.enum(['COMPLEXITY', 'SYSTEM_ARCHITECTURE', 'EDGE_CASES', 'TERMINOLOGY']),
  candidateDeficiency: z.string().min(3),
  preferredBenchmark: z.string().min(3),
  impactScore: z.number().min(0.0).max(10.0),
});

export interface GenerateSimPOInput {
  evaluationId?: string;
  question: string;
  candidateAnswer: string;
  role: string;
  score: number; // 0..100
  gamma?: number; // Target quality margin threshold (default DEFAULT_SIMPO_GAMMA = 0.25)
}

/**
 * Length-Normalized Implicit Reward (SimPO surrogate)
 * r(x,y) = (beta * qualityScore) / max(1, |y|)
 * True SimPO uses log π_θ(y|x)/|y|. Since LLM log-probs are unavailable via API,
 * we substitute an LLM-judged quality score as the surrogate for log-probability.
 * beta = 2.0 controls the reward scale.
 * Note: Length-normalized reward is exposed as an information-density / verbosity-penalty
 * metric, while contrastive margin evaluation is performed on the quality scale.
 */
export function calculateLengthNormalizedReward(
  text: string,
  qualityScore: number = 0.5,
  beta: number = 2.0
): { tokenLength: number; implicitReward: number } {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const tokenLength = Math.max(1, Math.round(words.length * 1.3)); // ~1.3 tokens per word

  // Empty or whitespace answers trigger empty-answer floor (r <= 0.1)
  if (words.length === 0) {
    return { tokenLength: 1, implicitReward: 0.1 };
  }

  // Ensure qualityScore is anchored: support [1.0, 5.0] scale normalized or [0.0, 1.0]
  const q = qualityScore > 1.0
    ? Math.max(1.0, Math.min(5.0, qualityScore)) / 5.0
    : Math.max(0, Math.min(1.0, qualityScore));

  // r = (beta * qualityScore) / |y|
  const implicitReward = Math.round(((beta * q) / tokenLength) * 1000) / 1000;

  return { tokenLength, implicitReward };
}

/**
 * SimPO Contrastive Pair Generator.
 * Generates preferred (y_preferred) vs candidate (y_dispreferred) pairs,
 * computes the comparison margin on quality (q_preferred - q_candidate in [0, 1]),
 * checks if margin satisfies gamma (default 0.25), and exposes length-normalized
 * rewards as separate verbosity penalty metrics alongside structural deltas.
 */
export async function generateSimPOContrastiveEvaluation(
  input: GenerateSimPOInput
): Promise<ContrastiveEvaluationResult> {
  const { evaluationId = `simpo_${Date.now()}`, question, candidateAnswer, role, score } = input;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  const beta = 2.0;
  const gamma = input.gamma ?? DEFAULT_SIMPO_GAMMA;

  // Retrieve benchmark using lightweight TF-IDF retriever with domain boost (CRAG idea)
  const retrieval = retrieveBenchmarkAnswer(question, { role });
  const benchmarkSource = retrieval.source;
  const retrievalSimilarity = retrieval.similarity;
  const retrievedEntry = retrieval.bestMatch;

  const isEmptyAnswer = !candidateAnswer || candidateAnswer.trim().length === 0;
  let effectiveScore = score;
  let dispQualityInit = Math.max(0.05, Math.min(0.95, score / 100));

  if (isEmptyAnswer) {
    // Empty-answer floor: <= 2.0 / 5.0, score <= 35%, q <= 0.35, r <= 0.1
    effectiveScore = Math.min(effectiveScore, 35);
    dispQualityInit = Math.min(dispQualityInit, 0.35);
  }

  const dispreferredTokenInfo = calculateLengthNormalizedReward(candidateAnswer, dispQualityInit, beta);
  let dispreferredReward = isEmptyAnswer ? Math.min(0.1, dispreferredTokenInfo.implicitReward) : dispreferredTokenInfo.implicitReward;

  if (anthropicApiKey) {
    try {
      let systemPrompt = '';
      const userPrompt = `Role: ${role}\nQuestion: ${question}\nCandidate Answer: ${candidateAnswer}\nScore: ${score}/100`;

      if (benchmarkSource === 'corpus' && retrievedEntry) {
        systemPrompt = `You are a SimPO (Simple Preference Optimization) Contrastive Evaluator (Meng et al., ICML 2024).
Compare the candidate's answer against the verified FAANG benchmark answer retrieved from our benchmark corpus.

VERIFIED FAANG BENCHMARK (preferredText):
${retrievedEntry.preferred}

REQUIRED JSON OUTPUT FORMAT:
{
  "preferredText": ${JSON.stringify(retrievedEntry.preferred)},
  "dispreferredText": "<Standardized representation of candidate actual answer>",
  "structuralDeltas": [
    {
      "dimension": "COMPLEXITY" | "SYSTEM_ARCHITECTURE" | "EDGE_CASES" | "TERMINOLOGY",
      "candidateDeficiency": "<Candidate gap description>",
      "preferredBenchmark": "<Optimal target pattern>",
      "impactScore": <0.0 to 10.0>
    }
  ]
}`;
      } else if (benchmarkSource === 'hybrid' && retrievedEntry) {
        systemPrompt = `You are a SimPO (Simple Preference Optimization) Contrastive Evaluator (Meng et al., ICML 2024).
We have retrieved a relevant FAANG benchmark entry from our corpus, but the candidate's question has specific context or nuances.
Synthesize a hybrid benchmark answer that combines the retrieved corpus entry with refined technical details directly answering the user's specific question.

RETRIEVED CORPUS ENTRY:
"${retrievedEntry.preferred}"

REQUIRED JSON OUTPUT FORMAT:
{
  "preferredText": "<Hybrid benchmark: combine core patterns from retrieved corpus entry with refinements tailored to the candidate's question>",
  "dispreferredText": "<Standardized representation of candidate actual answer>",
  "structuralDeltas": [
    {
      "dimension": "COMPLEXITY" | "SYSTEM_ARCHITECTURE" | "EDGE_CASES" | "TERMINOLOGY",
      "candidateDeficiency": "<Candidate gap description>",
      "preferredBenchmark": "<Optimal target pattern>",
      "impactScore": <0.0 to 10.0>
    }
  ]
}`;
      } else {
        systemPrompt = `You are a SimPO (Simple Preference Optimization) Contrastive Evaluator (Meng et al., ICML 2024).
Compare the candidate's answer against a FAANG-grade optimal benchmark for the specific question.

REQUIRED JSON OUTPUT FORMAT:
{
  "preferredText": "<High-density FAANG-grade optimal answer matching question context>",
  "dispreferredText": "<Standardized representation of candidate actual answer>",
  "structuralDeltas": [
    {
      "dimension": "COMPLEXITY" | "SYSTEM_ARCHITECTURE" | "EDGE_CASES" | "TERMINOLOGY",
      "candidateDeficiency": "<Candidate gap description>",
      "preferredBenchmark": "<Optimal target pattern>",
      "impactScore": <0.0 to 10.0>
    }
  ]
}`;
      }

      const anthropicRes = await executeAnthropicRequest({
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        maxTokens: AI_CONFIG.maxTokens.simpo,
        temperature: AI_CONFIG.temperatureDefaults.simpoContrastive,
        timeoutMs: AI_CONFIG.timeouts.simpoMs,
        apiKey: anthropicApiKey,
      });

      if (anthropicRes.success && anthropicRes.text) {
        const textOutput = anthropicRes.text;
        const jsonMatch = textOutput.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const preferredText = benchmarkSource === 'corpus' && retrievedEntry
            ? retrievedEntry.preferred
            : (parsed.preferredText ?? (retrievedEntry?.preferred ?? ''));
          const dispreferredText = parsed.dispreferredText ?? candidateAnswer;
          const rawDeltas = parsed.structuralDeltas ?? [];
          const validatedDeltas: StructuralDelta[] = [];
          for (const d of rawDeltas) {
            const result = structuralDeltaSchema.safeParse(d);
            if (result.success) validatedDeltas.push(result.data);
          }
          const deltas = validatedDeltas;

          const prefQuality = 0.85; // FAANG target benchmark quality
          const dispQuality = isEmptyAnswer
            ? Math.min(0.35, Math.max(0.05, score / 100))
            : Math.max(0.05, Math.min(0.95, score / 100)); // from evaluation score
          const prefTokenInfo = calculateLengthNormalizedReward(preferredText, prefQuality, beta);
          const dispTokenInfo = calculateLengthNormalizedReward(dispreferredText, dispQuality, beta);

          const preferredReward = prefTokenInfo.implicitReward;
          const dispreferredRewardFinal = isEmptyAnswer ? Math.min(0.1, dispTokenInfo.implicitReward) : dispTokenInfo.implicitReward;
          
          // Quality comparison margin: margin = q_preferred - q_candidate in [-1, 1]
          const qualityMargin = Math.round((prefQuality - dispQuality) * 100) / 100;
          // Benchmark must be meaningfully better by gamma, strictly false when candidate >= benchmark
          const marginSatisfied = dispQuality < prefQuality && qualityMargin >= gamma;
          const rewardMargin = qualityMargin;

          return {
            evaluationId,
            contrastivePair: {
              questionContext: question,
              dispreferredAnswer: {
                text: dispreferredText,
                tokenLength: dispTokenInfo.tokenLength,
                implicitReward: dispreferredRewardFinal,
                qualityScore: dispQuality,
              },
              preferredAnswer: {
                text: preferredText,
                tokenLength: prefTokenInfo.tokenLength,
                implicitReward: preferredReward,
                qualityScore: prefQuality,
              },
              qualityMargin,
              rewardMargin,
              marginSatisfied,
              gamma,
              structuralDeltas: deltas,
            },
            summaryDeltaText: `SimPO contrastive evaluation: Quality Margin Δq = ${qualityMargin >= 0 ? '+' : ''}${qualityMargin.toFixed(2)} (${marginSatisfied ? 'Benchmark Target Satisfied' : dispQuality >= prefQuality ? 'Candidate Meets or Exceeds Benchmark' : 'Pending Quality Alignment'}). Identified ${deltas.length} structural delta(s).`,
            benchmarkDeltaCard: deriveBenchmarkDeltaCard(deltas, preferredReward, role),
            source: 'live',
            benchmarkSource,
            retrievalSimilarity,
          };
        }
      }
    } catch (err) {
      console.warn('[SimPO Engine] LLM contrastive generation fallback:', err);
    }
  }

  // Fallback SimPO Benchmark Generator
  let preferredText = `Optimal FAANG Target for ${role}: Construct a resilient execution architecture incorporating explicit Big-O bounds, atomic cache-aside mutation locks (e.g. Redlock with auto-lease extension), and comprehensive fallback circuits for network split-brain recovery.`;
  if (benchmarkSource === 'corpus' && retrievedEntry) {
    preferredText = retrievedEntry.preferred;
  } else if (benchmarkSource === 'hybrid' && retrievedEntry) {
    preferredText = `[Corpus Benchmark (${retrievedEntry.domain})]: ${retrievedEntry.preferred} \n\n[Refined Context for ${role}]: Tailored to address "${question}" with specific architectural safeguards and operational metrics.`;
  }

  const dispreferredText = candidateAnswer.trim().length > 10 ? candidateAnswer : 'Candidate provided a high-level explanation without concrete Big-O bounds or failure circuit specifications.';

  const prefQuality = 0.85;
  const dispQuality = isEmptyAnswer
    ? Math.min(0.35, Math.max(0.05, effectiveScore / 100))
    : Math.max(0.05, Math.min(0.95, effectiveScore / 100));
  const prefTokenInfo = calculateLengthNormalizedReward(preferredText, prefQuality, beta);
  const dispTokenInfo = calculateLengthNormalizedReward(dispreferredText, dispQuality, beta);

  const preferredReward = prefTokenInfo.implicitReward;
  const dispreferredRewardFinal = isEmptyAnswer ? Math.min(0.1, dispTokenInfo.implicitReward) : dispTokenInfo.implicitReward;
  
  // Quality comparison margin: margin = q_preferred - q_candidate in [-1, 1]
  const qualityMargin = Math.round((prefQuality - dispQuality) * 100) / 100;
  // Benchmark must be meaningfully better by gamma, strictly false when candidate >= benchmark
  const marginSatisfied = dispQuality < prefQuality && qualityMargin >= gamma;
  const rewardMargin = qualityMargin;

  const structuralDeltas: StructuralDelta[] = [
    {
      dimension: 'COMPLEXITY',
      candidateDeficiency: 'Candidate answer omitted explicit Big-O algorithmic time and space complexity bounds.',
      preferredBenchmark: 'Optimal response specifies O(1) memory lookup with O(N) worst-case index rebalancing.',
      impactScore: 8.5,
    },
    {
      dimension: 'SYSTEM_ARCHITECTURE',
      candidateDeficiency: 'Candidate described single-node execution without handling distributed split-brain network failures.',
      preferredBenchmark: 'FAANG benchmark incorporates Redlock distributed locks and circuit breaker auto-failover.',
      impactScore: 9.0,
    },
    {
      dimension: 'TERMINOLOGY',
      candidateDeficiency: 'Used informal phrasing ("save to cache") instead of precise technical nomenclature.',
      preferredBenchmark: 'Leverages industry-standard terms ("cache-aside invalidation pattern", "write-through mutator").',
      impactScore: 7.0,
    },
  ];

  return {
    evaluationId,
    contrastivePair: {
      questionContext: question,
      dispreferredAnswer: {
        text: dispreferredText,
        tokenLength: dispTokenInfo.tokenLength,
        implicitReward: dispreferredRewardFinal,
        qualityScore: dispQuality,
      },
      preferredAnswer: {
        text: preferredText,
        tokenLength: prefTokenInfo.tokenLength,
        implicitReward: preferredReward,
        qualityScore: prefQuality,
      },
      qualityMargin,
      rewardMargin,
      marginSatisfied,
      gamma,
      structuralDeltas,
    },
    summaryDeltaText: `SimPO contrastive evaluation: Quality Margin Δq = ${qualityMargin >= 0 ? '+' : ''}${qualityMargin.toFixed(2)} (${marginSatisfied ? 'Benchmark Target Satisfied' : dispQuality >= prefQuality ? 'Candidate Meets or Exceeds Benchmark' : 'Pending Quality Alignment'}). Identified ${structuralDeltas.length} structural delta(s).`,
    benchmarkDeltaCard: deriveBenchmarkDeltaCard(structuralDeltas, preferredReward, role),
    source: 'fallback',
    benchmarkSource,
    retrievalSimilarity,
  };
}
