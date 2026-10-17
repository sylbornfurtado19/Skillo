import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, authFailureResponse } from '@/lib/server/authenticateRequest';
import { dispatchReflexionWorker } from '@/lib/services/reflexionService';
import { performInterviewEvaluation, PROMETHEUS2_RUBRICS } from '@/lib/services/interviewEvaluation.server';
import { validateEnvironment, getServerEnv } from '@/lib/server/env';
import { checkRateLimit, createRateLimitResponse } from '@/lib/services/rateLimiter.server';
import { systemDesignDiagramStateSchema } from '@/lib/schemas/diagramSchema';
import { downsampleByGroup } from '@/lib/utils/downsample';

export const dynamic = 'force-dynamic';

const questionSchema = z.object({
  id: z.string().max(64).optional(),
  question: z.string().min(1, 'Question text cannot be empty').max(1000, 'Question text exceeds 1000 characters limit'),
  duration: z.number().finite().positive().max(7200).optional(),
  hint: z.string().max(500, 'Hint exceeds 500 characters limit').optional(),
  idealConcepts: z.string().max(1000).optional(),
  targetedWeakness: z.string().max(500).optional(),
});

const answerSchema = z.object({
  questionId: z.string().max(64).optional(),
  answerText: z.string().max(10000, 'Answer text exceeds 10,000 characters limit'),
  timeSpent: z.number().finite().nonnegative().max(7200).optional(),
  speakMode: z.boolean().optional(),
  diagramState: systemDesignDiagramStateSchema.optional(),
});

const setupDataSchema = z.object({
  company: z.string().max(100).default('Generic'),
  domain: z.string().max(100).default('Computer Science'),
  role: z.string().max(100).default('Software Engineer'),
  experienceLevel: z.string().max(50).default('Mid-Level'),
  type: z.string().max(50).default('Technical'),
  difficulty: z.string().max(50).default('Medium'),
  duration: z.number().finite().positive().max(300).default(45),
  questionCount: z.number().int().min(1).max(10).default(5),
  focusAreas: z.array(z.string().max(100)).max(10).default([]),
  persona: z.string().max(50).default('sarah'),
  interviewModeId: z.string().max(50).optional(),
});

const gazeFrameSchema = z.object({
  timestampMs: z.number().finite().nonnegative(),
  questionId: z.string().max(64).optional(),
  questionIndex: z.number().int().nonnegative().optional(),
  pitchLogits: z.array(z.number().finite()).max(10).optional(),
  yawLogits: z.array(z.number().finite()).max(10).optional(),
  pitchDegrees: z.number().finite().min(-90).max(90).optional(),
  yawDegrees: z.number().finite().min(-90).max(90).optional(),
  confidence: z.number().finite().min(0).max(1).optional(),
});

const headPoseFrameSchema = z.object({
  timestampMs: z.number().finite().nonnegative(),
  questionId: z.string().max(64).optional(),
  questionIndex: z.number().int().nonnegative().optional(),
  yawLogits: z.array(z.number().finite()).max(10).optional(),
  pitchLogits: z.array(z.number().finite()).max(10).optional(),
  rollLogits: z.array(z.number().finite()).max(10).optional(),
  yawDegrees: z.number().finite().min(-90).max(90).optional(),
  pitchDegrees: z.number().finite().min(-90).max(90).optional(),
  rollDegrees: z.number().finite().min(-90).max(90).optional(),
  confidence: z.number().finite().min(0).max(1).optional(),
});

const affectFrameSchema = z.object({
  timestampMs: z.number().finite().nonnegative(),
  questionId: z.string().max(64).optional(),
  questionIndex: z.number().int().nonnegative().optional(),
  valence: z.number().finite().min(-1).max(1).optional(),
  arousal: z.number().finite().min(-1).max(1).optional(),
  valenceLogits: z.array(z.number().finite()).max(10).optional(),
  arousalLogits: z.array(z.number().finite()).max(10).optional(),
  confidence: z.number().finite().min(0).max(1).optional(),
});

const syncWindowSchema = z.object({
  timestampMs: z.number().finite().nonnegative(),
  questionId: z.string().max(64).optional(),
  questionIndex: z.number().int().nonnegative().optional(),
  visualDistance: z.number().finite().optional(),
  offsetMs: z.number().finite().optional(),
  audioEnergy: z.number().finite().optional(),
  confidence: z.number().finite().min(0).max(1).optional(),
});

const codeAnswerSchema = z.object({
  language: z.enum(['javascript', 'typescript', 'python', 'java']),
  source: z.string().max(10 * 1024),
  stdout: z.string().max(10000),
  stderr: z.string().max(10000),
});

const speechAnalyticsSchema = z.object({
  wordsPerMinute: z.number().finite().nonnegative(),
  fillerCount: z.number().int().nonnegative(),
  fillerRate: z.number().finite().nonnegative(),
  fillerCounts: z.record(z.string().max(20), z.number().int().nonnegative()),
  longestPauseMs: z.number().finite().nonnegative(),
  averagePauseMs: z.number().finite().nonnegative(),
  deliveryScore: z.number().finite().min(0).max(100),
  breakdown: z.object({
    speed: z.object({ score: z.number().finite().min(0).max(100), explanation: z.string().max(500) }),
    fillers: z.object({ score: z.number().finite().min(0).max(100), explanation: z.string().max(500) }),
    pauses: z.object({ score: z.number().finite().min(0).max(100), explanation: z.string().max(500) }),
  }),
});

/**
 * Up to 10 planned questions plus at most one adaptive follow-up per question.
 */
const MAX_INTERVIEW_QUESTIONS = 20;

/** Telemetry is sampled at ~10 FPS, so real sessions exceed the budget we keep. */
const MAX_TELEMETRY_INPUT = 20000; // hard ceiling: reject beyond this (abuse guard)
const MAX_TELEMETRY_KEPT = 1000; // what the evaluators actually receive

function telemetryArray<T extends z.ZodTypeAny>(frameSchema: T) {
  return z
    .array(frameSchema)
    .max(MAX_TELEMETRY_INPUT, `Telemetry exceeds ${MAX_TELEMETRY_INPUT} frames limit`)
    .transform((frames) =>
      downsampleByGroup(frames, MAX_TELEMETRY_KEPT, (frame) => (frame as { questionId?: string }).questionId)
    )
    .optional();
}

const ivpKernelCountsSchema = z.object({
  histogramEq: z.number().int().nonnegative(),
  otsuYCrCb: z.number().int().nonnegative(),
  sobel: z.number().int().nonnegative(),
  temporalMAD: z.number().int().nonnegative(),
  earMar: z.number().int().nonnegative(),
});

const ivpQuestionEvidenceSchema = z.object({
  questionId: z.string().max(64),
  questionIndex: z.number().int().nonnegative(),
  frames: z.number().int().nonnegative(),
  meanLuminance: z.number().finite(),
  contrastStdDev: z.number().finite(),
  clippedPct: z.number().finite(),
  illumination: z.enum(['underexposed', 'ok', 'overexposed', 'uneven']),
  skinMaskCoveragePct: z.number().finite(),
  presenceRatio: z.number().finite(),
  sobelEdgeDensity: z.number().finite(),
  sharpnessScore: z.number().finite(),
  motionEnergy: z.number().finite(),
  blinkRatePerMin: z.number().finite().optional(),
  mouthActivityPct: z.number().finite().optional(),
  evidenceId: z.string().max(64),
});

const ivpEvidenceSchema = z
  .object({
    kernelVersion: z.string().max(50),
    samplingHz: z.number().finite().positive().max(60),
    framesAnalyzed: z.number().int().nonnegative(),
    kernelCounts: ivpKernelCountsSchema,
    avgKernelMs: z.number().finite().nonnegative(),
    perQuestion: z.array(ivpQuestionEvidenceSchema).max(MAX_INTERVIEW_QUESTIONS),
    digestSha256: z.string().regex(/^[a-f0-9]{64}$/i, 'Must be 64-character SHA-256 hex string'),
    provenance: z.literal('client-reported'),
    consumedByEvaluator: z.boolean().default(false),
    transmitted: z.boolean().default(true),
    thumbnails: z.undefined().optional(),
  })
  .strict();

const integrityEventSchema = z.object({
  id: z.string().max(64),
  type: z.enum([
    'pause',
    'copy_attempt',
    'cut_attempt',
    'paste_attempt',
    'context_menu',
    'screenshot_key',
    'print_attempt',
    'drag_attempt',
    'tab_hidden',
    'window_blur',
    'fullscreen_exit',
    'fullscreen_unavailable',
    'navigation_attempt',
    'multi_tab',
    'session_reload',
    'permission_revoked',
  ]),
  atMs: z.number().finite().nonnegative(),
  questionId: z.string().max(64).optional(),
  questionIndex: z.number().int().nonnegative().optional(),
  pauseReason: z
    .enum([
      'camera_off',
      'microphone_off',
      'permission_revoked',
      'tab_hidden',
      'window_blur',
      'fullscreen_exit',
      'navigation_attempt',
      'multi_tab',
      'session_reload',
    ])
    .optional(),
  durationMs: z.number().finite().nonnegative().optional(),
  blocked: z.boolean().optional(),
});

const integrityTotalsSchema = z.object({
  pauses: z.number().int().nonnegative(),
  pausedMs: z.number().finite().nonnegative(),
  tabSwitches: z.number().int().nonnegative(),
  fullscreenExits: z.number().int().nonnegative(),
  copyPasteAttempts: z.number().int().nonnegative(),
  screenshotKeyAttempts: z.number().int().nonnegative(),
  navigationAttempts: z.number().int().nonnegative(),
  reloads: z.number().int().nonnegative(),
});

const sessionIntegritySchema = z.object({
  events: z.array(integrityEventSchema).max(500),
  totals: integrityTotalsSchema,
  verdict: z.enum(['clean', 'minor_flags', 'flagged']),
  policyVersion: z.string().max(50),
  limitationsNote: z.string().max(500),
});

const evaluateSchema = z
  .object({
    setupData: setupDataSchema,
    questionsList: z
      .array(questionSchema)
      .min(1, 'questionsList must contain at least one question')
      .max(MAX_INTERVIEW_QUESTIONS, `Cannot exceed ${MAX_INTERVIEW_QUESTIONS} questions`),
    answersList: z
      .array(z.union([z.string().max(10000, 'Answer exceeds 10,000 characters limit'), answerSchema]))
      .min(1)
      .max(MAX_INTERVIEW_QUESTIONS, `Cannot exceed ${MAX_INTERVIEW_QUESTIONS} answers`),
    deepAnalysisMode: z.boolean().optional(),
    gazeFrames: telemetryArray(gazeFrameSchema),
    headPoseFrames: telemetryArray(headPoseFrameSchema),
    affectFrames: telemetryArray(affectFrameSchema),
    syncWindows: telemetryArray(syncWindowSchema),
    codeAnswer: codeAnswerSchema.optional(),
    speechAnalytics: z.record(z.string().max(64), speechAnalyticsSchema)
      .refine(
        (value) => Object.keys(value).length <= MAX_INTERVIEW_QUESTIONS,
        `Cannot exceed ${MAX_INTERVIEW_QUESTIONS} speech analytics entries`
      )
      .optional(),
    ivpEvidence: ivpEvidenceSchema.optional(),
    sessionIntegrity: sessionIntegritySchema.optional(),
  })
  .refine((data) => data.questionsList.length === data.answersList.length, {
    message: 'questionsList and answersList must have exactly equal lengths to prevent evaluation misalignment',
    path: ['answersList'],
  });





export async function POST(request: Request) {
  try {
    // 0. Runtime server environment validation
    validateEnvironment();
    getServerEnv();

    // 1. Auth check (Firebase or Supabase, fails closed)
    const auth = await authenticateRequest(request);
    if (!auth.ok) return authFailureResponse(auth);
    const user = auth.user;

    // 2. Rate limiting check (5 requests per minute for deep evaluation)
    const rateLimit = await checkRateLimit({
      userId: user.id,
      action: 'interview_evaluate',
      maxRequests: 5,
      windowSeconds: 60,
    });

    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit, 'interview evaluation');
    }

    // 3. Parse request body JSON
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { status: 'error', message: 'Invalid JSON payload in request body.' },
        { status: 400 }
      );
    }

    // 3. Schema validation
    const parseResult = evaluateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Validation failed',
          errors: parseResult.error.flatten().fieldErrors,
        },
        { status: 422 }
      );
    }

    // 4. Perform Prometheus-2 & SUQ server-side evaluation (configurable N passes, default N=3)
    const evaluationResult = await performInterviewEvaluation(parseResult.data, user.id);

    // 5. Asynchronous Non-Blocking Self-Critique (SR_t) Worker
    // Dispatched post-evaluation to upsert candidate SkillMemoryNodes JSONB without delaying HTTP response
    const targetIdx = evaluationResult.selectedQuestionIndex ?? 0;
    const targetQuestion = parseResult.data.questionsList[targetIdx]?.question || 'Technical Assessment Question';
    const targetAns = typeof parseResult.data.answersList[targetIdx] === 'string'
      ? (parseResult.data.answersList[targetIdx] as string)
      : (parseResult.data.answersList[targetIdx] as any)?.answerText ?? '';

    dispatchReflexionWorker({
      userId: user.id,
      sessionId: `sess_${Date.now()}`,
      question: targetQuestion,
      candidateAnswer: targetAns,
      overallScore: evaluationResult.overallScore,
      role: parseResult.data.setupData.role,
    });

    // 6. Return computed evaluation result (no body echo)
    return NextResponse.json({
      status: 'success',
      data: {
        ...evaluationResult,
        rubricCriteria: PROMETHEUS2_RUBRICS ? Object.keys(PROMETHEUS2_RUBRICS) : [],
      },
    });
  } catch (err: unknown) {
    console.error('[API /api/interview/evaluate Error]:', err);
    return NextResponse.json(
      { status: 'error', message: 'Something went wrong processing your request.' },
      { status: 500 }
    );
  }
}
