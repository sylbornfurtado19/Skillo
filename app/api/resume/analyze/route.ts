import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, authFailureResponse } from '@/lib/server/authenticateRequest';
import { performResumeAnalysis } from '@/lib/services/resumeAnalysis.server';
import { checkRateLimit, createRateLimitResponse } from '@/lib/services/rateLimiter.server';

export const dynamic = 'force-dynamic';


const analyzeSchema = z.object({
  fileName: z.string().min(1, 'fileName is required').max(255),
  jobTitle: z.string().min(1, 'jobTitle is required').max(150),
  jobDescription: z.string().min(1, 'jobDescription is required').max(10000),
  resumeText: z.string().max(30000, 'Resume text exceeds 30,000 characters limit').optional(),
});

export async function POST(request: Request) {
  try {
    // 1. Auth check (Firebase or Supabase, fails closed)
    const auth = await authenticateRequest(request);
    if (!auth.ok) return authFailureResponse(auth);
    const user = auth.user;

    // 2. Rate limiting check (5 requests per minute for resume analysis)
    const rateLimit = await checkRateLimit({
      userId: user.id,
      action: 'resume_analyze',
      maxRequests: 5,
      windowSeconds: 60,
    });

    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit, 'resume analysis');
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
    const parseResult = analyzeSchema.safeParse(body);
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

    // 4. Perform server-side GraphRAG analysis
    const resultData = await performResumeAnalysis(parseResult.data, user.id);

    // 5. Return computed analysis result (no body echo)
    return NextResponse.json({
      status: 'success',
      data: resultData,
    });
  } catch (err: unknown) {
    console.error('[API /api/resume/analyze Error]:', err);
    return NextResponse.json(
      { status: 'error', message: 'Something went wrong processing your request.' },
      { status: 500 }
    );
  }
}
