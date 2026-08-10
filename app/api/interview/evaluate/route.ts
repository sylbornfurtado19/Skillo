import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { performInterviewEvaluation } from '@/lib/services/interviewEvaluation.server';

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
});

const setupDataSchema = z.object({
  domain: z.string().default('Computer Science'),
  role: z.string().default('Software Engineer'),
  experienceLevel: z.string().default('Mid-Level'),
  type: z.string().default('Technical'),
  difficulty: z.string().default('Medium'),
  questionCount: z.number().default(5),
  focusAreas: z.array(z.string()).default([]),
  persona: z.string().default('sarah'),
});

const evaluateSchema = z.object({
  setupData: setupDataSchema,
  questionsList: z.array(questionSchema).min(1, 'questionsList must contain at least one question'),
  answersList: z.array(z.union([z.string(), answerSchema])),
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

    // 2. Parse request body JSON
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
