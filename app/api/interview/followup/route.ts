import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const followupRequestSchema = z.object({
  question: z.string().min(1),
  answerText: z.string(),
  role: z.string().optional().default('Software Engineer'),
  difficulty: z.string().optional().default('Medium'),
  type: z.string().optional().default('Technical'),
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

    // 2. Validate payload
    const body = await request.json();
    const parseResult = followupRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { status: 'error', message: 'Invalid payload', errors: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { question, answerText, role, difficulty, type } = parseResult.data;

    // Fail-safe: if answer is extremely short or empty, or if Anthropic API key is missing
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
      return NextResponse.json({
        needsFollowUp: false,
      });
    }

    // 3. Single fast Anthropic API call (~300 max_tokens)
    const systemPrompt = `You are a real-time AI technical interviewer evaluating a candidate's response during a live mock session.
Determine whether the candidate's answer has a genuine, specific gap in depth, technical specificity, architectural trade-offs, or concrete real-world examples (not just "could be longer").

CRITICAL REQUIREMENT: Return ONLY a valid JSON object in this format:
{
  "needsFollowUp": true | false,
  "gapReason": "Concise 1-sentence explanation of the specific technical or architectural gap",
  "followUpQuestion": "A targeted, highly specific follow-up question digging into the missing details" | null
}

If needsFollowUp is false, gapReason should be null or omitted, and followUpQuestion MUST be null.`;

    const userPrompt = `Role: ${role} (${difficulty}, ${type})
Original Question: ${question}
Candidate Answer: ${answerText || '[No answer text provided]'}`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 300,
        temperature: 0.3,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      }),
    });

    if (!res.ok) {
      console.warn(`[FollowUp API] Anthropic API returned status ${res.status}`);
      return NextResponse.json({ needsFollowUp: false });
    }

    const data = await res.json();
    const textOutput = data?.content?.[0]?.text ?? '';
    const jsonMatch = textOutput.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (typeof parsed.needsFollowUp === 'boolean') {
        return NextResponse.json({
          needsFollowUp: parsed.needsFollowUp,
          gapReason: parsed.needsFollowUp ? (parsed.gapReason || 'Answer lacks technical specificity.') : undefined,
          followUpQuestion: parsed.needsFollowUp ? (parsed.followUpQuestion || null) : null,
        });
      }
    }

    return NextResponse.json({ needsFollowUp: false });
  } catch (err) {
    console.error('[FollowUp API Error]:', err);
    // Fail-safe default
    return NextResponse.json({ needsFollowUp: false });
  }
}
