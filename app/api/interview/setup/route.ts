import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import {
  retrievePastCritiques,
  formatHistoricalMemoryPrompt,
} from '@/lib/services/reflexionService';
import { getQuestionsForSetup } from '@/services/constants';
import { checkRateLimit, createRateLimitResponse } from '@/lib/services/rateLimiter.server';

export const dynamic = 'force-dynamic';

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

const setupRequestSchema = z.object({
  setupData: setupDataSchema,
  userId: z.string().optional(),
});

export interface GeneratedQuestionItem {
  id: string;
  question: string;
  duration?: number;
  hint?: string;
  targetedWeakness?: string;
  idealConcepts?: string;
}

export async function POST(request: Request) {
  try {
    // 1. Auth check (optional for guest sessions, active for authenticated users)
    const authHeader = request.headers.get('authorization');
    let user = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data?.user) {
        user = data.user;
      }
    }

    // 2. Rate limiting check (10 requests per minute for setup)
    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'anonymous_user';
    const rateLimitIdentifier = user?.id || `anon_${clientIp}`;

    const rateLimit = await checkRateLimit({
      userId: rateLimitIdentifier,
      action: 'interview_setup',
      maxRequests: 10,
      windowSeconds: 60,
    });

    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit, 'interview setup');
    }

    // 3. Parse request payload
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { status: 'error', message: 'Invalid JSON payload in request body.' },
        { status: 400 }
      );
    }

    const parseResult = setupRequestSchema.safeParse(body);
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

    const { setupData, userId: bodyUserId } = parseResult.data;
    const count = setupData.questionCount || 5;
    const activeUserId = user?.id || bodyUserId;

    // 3. Retrieve Candidate Historical Memory from Supabase SkillMemoryNodes
    let pastCritiques: Array<{
      skillId: string;
      skillName: string;
      summary: string;
      proficiencyLevel: 'NOVICE' | 'DEVELOPING' | 'PROFICIENT' | 'MASTERED';
      remediation?: string;
    }> = [];

    if (activeUserId) {
      try {
        pastCritiques = await retrievePastCritiques(activeUserId);
      } catch (err) {
        console.warn('[Setup API] Failed to retrieve past critiques:', err);
      }
    }

    // 4. Closed-Loop Prompt Conditioning: Inject prior recurring weaknesses into LLM system prompt
    const memoryConditioning = formatHistoricalMemoryPrompt(pastCritiques);
    const hasHistoricalMemory = pastCritiques.length > 0;

    let recalledMemoryNotice = '';
    if (hasHistoricalMemory) {
      const summaries = pastCritiques.slice(0, 3).map((c) => c.summary);
      recalledMemoryNotice = `Interviewer recalled ${pastCritiques.length} prior technical weak point(s): ${summaries.join('; ')}`;
    }

    // 5. Question Generation: Generate questions adaptively conditioned on historical memory
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    let generatedQuestions: GeneratedQuestionItem[] = [];

    if (anthropicApiKey && hasHistoricalMemory) {
      try {
        const systemPrompt = `You are a Principal FAANG Technical Interviewer conducting a ${setupData.type} interview for a ${setupData.experienceLevel} ${setupData.role} at ${setupData.company}.
${memoryConditioning}

Generate exactly ${count} structured interview questions. Ensure at least 1-2 questions directly and adaptively probe the candidate's recorded historical weak points.

Output strict JSON with format:
{
  "questions": [
    {
      "id": "q_1",
      "question": "Full question text...",
      "hint": "Brief technical hint",
      "targetedWeakness": "Relevant weak point probed (if applicable)"
    }
  ]
}`;

        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicApiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 1200,
            temperature: 0.4,
            system: systemPrompt,
            messages: [
              {
                role: 'user',
                content: `Please generate ${count} questions for: Role: ${setupData.role}, Domain: ${setupData.domain}, Company: ${setupData.company}, Difficulty: ${setupData.difficulty}.`,
              },
            ],
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const text = data?.content?.[0]?.text ?? '';
          const match = text.match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
              generatedQuestions = parsed.questions.slice(0, count).map((q: any, i: number) => ({
                id: q.id || `q_${i + 1}`,
                question: String(q.question),
                hint: q.hint ? String(q.hint) : undefined,
                duration: typeof q.duration === 'number' ? q.duration : 120,
                targetedWeakness: q.targetedWeakness ? String(q.targetedWeakness) : undefined,
                idealConcepts: q.idealConcepts ? String(q.idealConcepts) : undefined,
              }));
            }
          }
        }
      } catch (err) {
        console.warn('[Setup API] LLM question generation fallback:', err);
      }
    }

    // 6. Fallback Question Pool Selection if LLM was skipped or returned empty
    if (generatedQuestions.length === 0) {
      const presetPool = getQuestionsForSetup(setupData);
      generatedQuestions = presetPool.slice(0, count).map((q, idx) => {
        // If candidate has historical weakness, attach notice to the first question
        const targetedWeakness =
          hasHistoricalMemory && idx === 0 ? pastCritiques[0].summary : undefined;
        return {
          id: q.id || `q_${idx + 1}`,
          question: q.question,
          duration: q.duration || 120,
          hint: q.hint,
          targetedWeakness,
          idealConcepts: q.idealConcepts,
        };
      });
    }

    return NextResponse.json({
      status: 'success',
      data: {
        questions: generatedQuestions,
        pastCritiques,
        recalledMemoryNotice: recalledMemoryNotice || undefined,
        adaptedPromptUsed: hasHistoricalMemory,
        memoryConditioningApplied: memoryConditioning || undefined,
      },
    });
  } catch (err: unknown) {
    console.error('[API /api/interview/setup Error]:', err);
    return NextResponse.json(
      { status: 'error', message: 'Failed to initialize interview setup.' },
      { status: 500 }
    );
  }
}
