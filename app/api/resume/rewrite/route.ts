import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, authFailureResponse } from '@/lib/server/authenticateRequest';
import { checkRateLimit, createRateLimitResponse } from '@/lib/services/rateLimiter.server';
import {
  resumeRewriteResultSchema,
  rewriteResumeBullets,
} from '@/lib/services/resumeAnalysis.server';

export const dynamic = 'force-dynamic';

const rewriteSchema = z.object({
  resumeText: z.string().min(1, 'resumeText is required').max(30000),
  jobTitle: z.string().min(1, 'jobTitle is required').max(150),
  jobDescription: z.string().min(1, 'jobDescription is required').max(10000),
});

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.ok) return authFailureResponse(auth);
    const user = auth.user;

    const rateLimit = await checkRateLimit({
      userId: user.id,
      action: 'resume_rewrite',
      maxRequests: 5,
      windowSeconds: 60,
    });
    if (!rateLimit.allowed) return createRateLimitResponse(rateLimit, 'resume rewrite');

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { status: 'error', message: 'Invalid JSON payload in request body.' },
        { status: 400 }
      );
    }

    const parsedInput = rewriteSchema.safeParse(body);
    if (!parsedInput.success) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Validation failed',
          errors: parsedInput.error.flatten().fieldErrors,
        },
        { status: 422 }
      );
    }

    const result = await rewriteResumeBullets(parsedInput.data);
    const validatedResult = resumeRewriteResultSchema.parse(result);
    return NextResponse.json({ status: 'success', data: validatedResult });
  } catch (err: unknown) {
    console.error('[API /api/resume/rewrite Error]:', err);
    return NextResponse.json(
      { status: 'error', message: 'Something went wrong rewriting your resume.' },
      { status: 500 }
    );
  }
}
