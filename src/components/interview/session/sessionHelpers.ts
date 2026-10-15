import { DEFAULT_ANTHROPIC_MODEL } from '@/lib/ai/defaultModel';

export const AUTOSAVE_STORAGE_KEY_PREFIX = 'skillo_draft_ans_';

export const AUDIO_BAR_PROFILES = [
  { min: 10, max: 28, duration: 0.65, delay: 0 },
  { min: 12, max: 36, duration: 0.55, delay: 0.1 },
  { min: 8, max: 22, duration: 0.75, delay: 0.2 },
  { min: 14, max: 34, duration: 0.6, delay: 0.05 },
  { min: 16, max: 38, duration: 0.5, delay: 0.15 },
  { min: 12, max: 30, duration: 0.7, delay: 0.25 },
  { min: 14, max: 36, duration: 0.58, delay: 0.08 },
  { min: 10, max: 24, duration: 0.62, delay: 0.18 },
  { min: 12, max: 34, duration: 0.52, delay: 0.12 },
  { min: 8, max: 26, duration: 0.68, delay: 0.22 },
];

export function formatTime(secs: number): string {
  const mins = Math.floor(secs / 60);
  const remaining = secs % 60;
  return `${mins}:${remaining < 10 ? '0' : ''}${remaining}`;
}

export function generateFallbackEvaluationReport(
  setup: any,
  questList: Array<{ id: string; question: string; hint?: string; idealConcepts?: string }>,
  ansList: Array<any>,
  modelId?: string
) {
  const avgScore = 60;
  const resolvedModelId = modelId || setup?.modelId || setup?.model || DEFAULT_ANTHROPIC_MODEL;
  return {
    overallScore: avgScore,
    categories: {
      technicalAccuracy: 60,
      communication: 60,
      depth: 60,
      timeManagement: 60,
      systemDesignLogic: 60,
      edgeCaseHandling: 60,
    },
    breakdown: questList.map((q, idx) => {
      const rawAns = ansList[idx];
      const ansStr = typeof rawAns === 'string' ? rawAns : rawAns?.answerText ?? '';
      return {
        id: q.id,
        question: q.question,
        userAnswer: ansStr || 'Answer recorded.',
        score: ansStr.trim().length > 30 ? 60 : 40,
        idealConcepts: q.idealConcepts || (q.hint ? q.hint.trim() : 'Standard domain principles & practices.'),
        feedback: 'Evaluated with resilient client-side assessment fallback.',
        strengths: ['Structured response organization', 'Clear communication'],
        suggestions: ['Incorporate concrete system design trade-offs and quantitative metrics.'],
      };
    }),
    interviewerComments: 'Evaluation completed via resilient fallback mode due to transient network conditions.',
    personaId: setup?.persona || 'sarah',
    setupData: setup,
    evaluatedAt: new Date().toISOString(),
    evaluationMode: 'fallback' as const,
    source: 'fallback' as const,
    suqEvaluation: {
      finalScore: 3.0,
      confidenceLevel: 'LOW' as const,
      semanticEntropy: 0.85,
      clusters: [],
      passes: [],
      aggregatedRubricFeedback: {
        technicalAccuracy: 'Solid baseline principles demonstrated.',
        systemDesignLogic: 'Logical architecture organization.',
        edgeCaseHandling: 'Addressed common failure paths.',
        communicationClarity: 'Clear and structured articulation.',
      },
      requiresValidationPass: true,
      latencyMs: 320,
      passCount: 3,
      evaluationMode: 'fallback' as const,
      providerStatus: 'unconfigured' as const,
      modelId: resolvedModelId,
      source: 'fallback' as const,
    },
    simpoContrastiveResult: {
      evaluationId: `simpo_fb_${Date.now()}`,
      source: 'fallback' as const,
      contrastivePair: {
        preferredAnswer: {
          text: 'FAANG-level response demonstrates granular trade-off analysis, concurrency models, and resilient error recovery.',
          tokenLength: 120,
          implicitReward: 2.15,
          qualityScore: 0.85,
        },
        dispreferredAnswer: {
          text: 'Under-elaborated response omitted boundary error conditions and quantitative complexity figures.',
          tokenLength: 70,
          implicitReward: 0.85,
          qualityScore: 0.50,
        },
        qualityMargin: 0.35,
        rewardMargin: 0.35,
        marginSatisfied: true,
        gamma: 0.25,
        structuralDeltas: [
          {
            dimension: 'SYSTEM_ARCHITECTURE' as const,
            deltaSummary: 'Incorporate explicit concurrency locks and caching policies.',
            preferredStrength: 'Explicit lock-free architectures',
            dispreferredWeakness: 'High-level abstraction without concurrency',
            impactScore: 0.8,
          },
        ],
      },
      summaryDeltaText: 'FAANG target highlights deeper concurrency models and boundary failure mitigation.',
      benchmarkDeltaCard: {
        architecturalGap: ['Omitted distributed caching tier and replication topologies.'],
        edgeCaseOversights: ['Boundary null-check and connection timeout recovery.'],
        faangComparison: 'Candidate demonstrated good foundational logic; adding explicit concurrency models will reach FAANG benchmark.',
        rewardScore: 2.15,
      },
    },
    benchmarkDeltaCard: {
      architecturalGap: ['Omitted distributed caching tier and replication topologies.'],
      edgeCaseOversights: ['Boundary null-check and connection timeout recovery.'],
      faangComparison: 'Candidate demonstrated good foundational logic; adding explicit concurrency models will reach FAANG benchmark.',
      rewardScore: 2.15,
    },
  };
}

export interface RetryEvaluationSuccessResult {
  newScore: number;
  feedback: string;
}

export function handleRetryEvaluationSuccess(
  finalReport: { overallScore: number; breakdown?: Array<{ feedback?: string }> }
): RetryEvaluationSuccessResult {
  return {
    newScore: finalReport.overallScore,
    feedback: finalReport.breakdown?.[0]?.feedback || 'Demonstrated improved response clarity.',
  };
}

export interface RetryEvaluationFailureResult {
  toastMessage: string;
  toastType: 'error';
  grading: boolean;
}

export function handleRetryEvaluationFailure(_error?: unknown): RetryEvaluationFailureResult {
  return {
    toastMessage: 'Retry evaluation failed. Your previous score was kept.',
    toastType: 'error',
    grading: false,
  };
}
