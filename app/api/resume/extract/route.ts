import { NextResponse } from 'next/server';
import { authenticateRequest, authFailureResponse } from '@/lib/server/authenticateRequest';
import { checkRateLimit, createRateLimitResponse } from '@/lib/services/rateLimiter.server';
import { extractResumeText, ResumeExtractionError } from '@/lib/services/resumeExtraction.server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    // 1. Auth check (Firebase or Supabase, fails closed)
    const auth = await authenticateRequest(request);
    if (!auth.ok) return authFailureResponse(auth);
    const user = auth.user;

    // 2. Rate limiting check: identical pattern to /api/resume/analyze
    const rateLimit = await checkRateLimit({
      userId: user.id,
      action: 'resume_extract',
      maxRequests: 10,
      windowSeconds: 60,
    });

    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit, 'resume extraction');
    }

    // 3. Parse multipart form data
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { status: 'error', message: 'Invalid multipart form data in request body.' },
        { status: 400 }
      );
    }

    const file = formData.get('file');
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { status: 'error', message: 'No file provided. Please attach a file under the "file" field.' },
        { status: 400 }
      );
    }

    const fileName = (file as File).name || 'resume';
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 4. Server-side text extraction (magic byte validation, PDF/DOCX/TXT extraction, min/max limits)
    const result = await extractResumeText({
      buffer,
      fileName,
      mimeType: file.type,
    });

    return NextResponse.json({
      status: 'success',
      text: result.text,
      pageCount: result.pageCount,
      charCount: result.charCount,
      data: {
        text: result.text,
        pageCount: result.pageCount,
        charCount: result.charCount,
      },
    });
  } catch (err: unknown) {
    if (err instanceof ResumeExtractionError) {
      return NextResponse.json(
        {
          status: 'error',
          code: err.code,
          message: err.message,
        },
        { status: err.statusCode }
      );
    }

    console.error('[API /api/resume/extract Error]:', err);
    return NextResponse.json(
      { status: 'error', message: 'Something went wrong processing your resume file.' },
      { status: 500 }
    );
  }
}
