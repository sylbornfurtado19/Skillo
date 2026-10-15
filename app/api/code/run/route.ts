import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { checkRateLimit, createRateLimitResponse } from '@/lib/services/rateLimiter.server';

export const dynamic = 'force-dynamic';

const LANGUAGE_VERSIONS = {
  javascript: { version: '18.15.0', extension: 'js' },
  typescript: { version: '5.0.3', extension: 'ts' },
  python: { version: '3.10.0', extension: 'py' },
  java: { version: '15.0.2', extension: 'java' },
} as const;

const codeRunSchema = z.object({
  language: z.enum(['javascript', 'typescript', 'python', 'java']),
  source: z.string().max(10 * 1024, 'Source exceeds 10 KB limit'),
  stdin: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    let user = null;

    if (authHeader?.startsWith('Bearer ')) {
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

    const rateLimit = await checkRateLimit({
      userId: user.id,
      action: 'code_run',
      maxRequests: 5,
      windowSeconds: 60,
    });

    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit, 'code runs');
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ status: 'error', message: 'Invalid JSON payload in request body.' }, { status: 400 });
    }

    const parsed = codeRunSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { status: 'error', message: 'Validation failed', errors: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const runnerUrl = process.env.CODE_RUNNER_URL;
    if (!runnerUrl) {
      return NextResponse.json({ message: 'Code runner not configured' }, { status: 501 });
    }

    const { language, source, stdin } = parsed.data;
    const runtime = LANGUAGE_VERSIONS[language];
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const startedAt = performance.now();

    try {
      const response = await fetch(runnerUrl, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language,
          version: runtime.version,
          files: [{ name: `main.${runtime.extension}`, content: source }],
          stdin: stdin ?? '',
        }),
      });

      if (!response.ok) {
        return NextResponse.json({ status: 'error', message: 'Code runner request failed.' }, { status: 502 });
      }

      const result = await response.json();
      const compile = result?.compile ?? {};
      const run = result?.run ?? {};
      return NextResponse.json({
        stdout: typeof run.stdout === 'string' ? run.stdout : '',
        stderr: [compile.stderr, run.stderr].filter((value): value is string => typeof value === 'string' && value.length > 0).join('\n'),
        exitCode: typeof run.code === 'number' ? run.code : 1,
        timeMs: Math.round(performance.now() - startedAt),
      });
    } catch (error: unknown) {
      const message = error instanceof DOMException && error.name === 'AbortError'
        ? 'Code runner timed out.'
        : 'Unable to reach code runner.';
      return NextResponse.json({ status: 'error', message }, { status: 504 });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('[API /api/code/run Error]:', error);
    return NextResponse.json({ status: 'error', message: 'Something went wrong running the code.' }, { status: 500 });
  }
}