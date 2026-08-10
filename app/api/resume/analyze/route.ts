import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { performResumeAnalysis } from '@/lib/services/resumeAnalysis.server';

export const dynamic = 'force-dynamic';


const analyzeSchema = z.object({
  fileName: z.string().min(1, 'fileName is required').max(255),
  jobTitle: z.string().min(1, 'jobTitle is required').max(150),
  jobDescription: z.string().min(1, 'jobDescription is required').max(10000),
  resumeText: z.string().optional(),
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
