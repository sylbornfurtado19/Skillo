import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { performInterviewEvaluation } from '@/lib/services/interviewEvaluation.server';
import { checkRateLimit, createRateLimitResponse } from '@/lib/services/rateLimiter.server';

export const dynamic = 'force-dynamic';


const questionSchema = z.object({
  id: z.string().optional(),
  question: z.string().min(1),
  duration: z.number().optional(),
  hint: z.string().optional(),
});

const answerSchema = z.object({
  questionId: z.string().optional(),
  answerText: z.string(),
  timeSpent: z.number().optional(),
  speakMode: z.boolean().optional(),
  diagramState: z.any().optional(),
});

const setupDataSchema = z.object({
  company: z.string().default('Generic'),
  domain: z.string().default('Computer Science'),
  role: z.string().default('Software Engineer'),
  experienceLevel: z.string().default('Mid-Level'),
  type: z.string().default('Technical'),
  difficulty: z.string().default('Medium'),
  duration: z.number().default(45),
  questionCount: z.number().default(5),
  focusAreas: z.array(z.string()).default([]),
  persona: z.string().default('sarah'),
  interviewModeId: z.string().optional(),
});

const gazeFrameSchema = z.object({
  timestampMs: z.number().nonnegative(),
  pitchLogits: z.array(z.number()).optional(),
  yawLogits: z.array(z.number()).optional(),
  pitchDegrees: z.number().min(-90).max(90).optional(),
  yawDegrees: z.number().min(-90).max(90).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

const headPoseFrameSchema = z.object({
  timestampMs: z.number().nonnegative(),
  yawLogits: z.array(z.number()).optional(),
  pitchLogits: z.array(z.number()).optional(),
  rollLogits: z.array(z.number()).optional(),
  yawDegrees: z.number().min(-90).max(90).optional(),
  pitchDegrees: z.number().min(-90).max(90).optional(),
  rollDegrees: z.number().min(-90).max(90).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

const affectFrameSchema = z.object({
  timestampMs: z.number().nonnegative(),
  valence: z.number().min(-1).max(1).optional(),
  arousal: z.number().min(-1).max(1).optional(),
  valenceLogits: z.array(z.number()).optional(),
  arousalLogits: z.array(z.number()).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

const syncWindowSchema = z.object({
  timestampMs: z.number().nonnegative(),
  visualDistance: z.number().optional(),
  offsetMs: z.number().optional(),
  audioEnergy: z.number().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

const evaluateSchema = z.object({
  setupData: setupDataSchema,
  questionsList: z.array(questionSchema).min(1, 'questionsList must contain at least one question'),
  answersList: z.array(z.union([z.string(), answerSchema])),
  /** Optional L2CS-Net gaze frames captured during the session */
  gazeFrames: z.array(gazeFrameSchema).max(3600).optional(), // cap at 3600 frames (1hr @ 1fps)
  /** Optional HopeNet 3D head pose frames captured during the session */
  headPoseFrames: z.array(headPoseFrameSchema).max(3600).optional(),
  /** Optional AffectNet facial expression frames captured during the session */
  affectFrames: z.array(affectFrameSchema).max(3600).optional(),
  /** Optional SyncNet audio-visual lip sync windows captured during the session */
  syncWindows: z.array(syncWindowSchema).max(3600).optional(),
});





export async function POST(request: Request) {
  try {
    // 1. Auth check
    const authHeader = request.headers.get('authorization');
    let user = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data?.user) {
        user = data.user;
      }
    }

    if (!user) {
      return NextResponse.json(
        { status: 'error', message: 'Authentication required. Please sign in.' },
        { status: 401 }
      );
    }

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

    // 4. Perform Prometheus-2 & SUQ server-side evaluation (N=5 CoT Sampling Passes)
    const evaluationResult = await performInterviewEvaluation(parseResult.data, user.id);

    // 5. Return computed evaluation result (no body echo)
    return NextResponse.json({
      status: 'success',
      data: evaluationResult,
    });
  } catch (err: unknown) {
    console.error('[API /api/interview/evaluate Error]:', err);
    return NextResponse.json(
      { status: 'error', message: 'Something went wrong processing your request.' },
      { status: 500 }
    );
  }
}
