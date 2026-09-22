import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { checkRateLimit, createRateLimitResponse } from "@/lib/services/rateLimiter.server";
import { runLATSMCTS } from "@/lib/services/latsEngine.server";

export const dynamic = "force-dynamic";

// ── Request Schema ────────────────────────────────────────────────────────────
const followupRequestSchema = z.object({
  question: z.string().min(1, "Question cannot be empty").max(1000, "Question exceeds 1000 characters limit"),
  answerText: z.string().max(10000, "Answer exceeds 10,000 characters limit"),
  role: z.string().max(100).optional().default("Software Engineer"),
  difficulty: z.string().max(50).optional().default("Medium"),
  type: z.string().max(50).optional().default("Technical"),
  /** Optional: stable session identifier for LATS tree continuity */
  sessionId: z.string().max(64).optional(),
  /** Optional: prior gap labels detected in earlier turns */
  priorGaps: z.array(z.string().max(100)).max(20).optional().default([]),
});

// ── Response Schema (for documentation) ──────────────────────────────────────
// {
//   needsFollowUp: boolean,
//   selectedBranch?: {
//     actionType: "DEEP_DIVE" | "PIVOT" | "EDGE_CASE_CHALLENGE",
//     questionText: string,
//     rationale: string,
//     prmScore: number,     // V ∈ [0,1]
//     uctValue: number,     // UCT(s,a)
//   },
//   allBranches?: Array<{ actionType, questionText, rationale, prmScore, uctValue }>,
//   currentGaps?: string[],
//   trajectoryDepth: number,
// }

export async function POST(request: Request) {
  try {
    // 1. Auth check
    const authHeader = request.headers.get("authorization");
    let user = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data?.user) {
        user = data.user;
      }
    }

    if (!user) {
      return NextResponse.json(
        { status: "error", message: "Authentication required. Please sign in." },
        { status: 401 }
      );
    }

    // 2. Rate limiting (10 requests per minute for follow-ups)
    const rateLimit = await checkRateLimit({
      userId: user.id,
      action: "interview_followup",
      maxRequests: 10,
      windowSeconds: 60,
    });

    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit, "interview follow-up questions");
    }

    // 3. Validate payload
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { status: "error", message: "Invalid JSON payload in request body." },
        { status: 400 }
      );
    }

    const parseResult = followupRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        { status: "error", message: "Invalid payload", errors: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { question, answerText, role, sessionId, priorGaps } = parseResult.data;

    // 4. Short-circuit: empty / trivial answers never need follow-up
    if (!answerText || answerText.trim().length < 20) {
      return NextResponse.json({ needsFollowUp: false, trajectoryDepth: 0 });
    }

    // 5. Short-circuit: no API key configured
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
      return NextResponse.json({ needsFollowUp: false, trajectoryDepth: 0 });
    }

    // 6. Run LATS MCTS engine — generates 3 branches, scores via PRM, selects via UCT
    const resolvedSessionId = sessionId ?? `followup_${Date.now()}`;

    const latsState = await runLATSMCTS({
      sessionId: resolvedSessionId,
      role,
      currentQuestion: question,
      candidateAnswer: answerText,
      priorGaps: priorGaps ?? [],
      anthropicApiKey,
    });

    // 7. Identify the UCT-selected branch (isSelectedTrajectory === true)
    const selectedNode = latsState.simulatedBranches.find(b => b.isSelectedTrajectory)
      ?? latsState.simulatedBranches[0];

    if (!selectedNode) {
      return NextResponse.json({ needsFollowUp: false, trajectoryDepth: 0 });
    }

    // 8. Build response
    return NextResponse.json({
      needsFollowUp: true,
      selectedBranch: {
        actionType: selectedNode.actionType,
        questionText: selectedNode.questionText,
        rationale: selectedNode.rationale,
        prmScore: Math.round(selectedNode.prmScore * 1000) / 1000,
        uctValue: Math.round(selectedNode.uctValue * 1000) / 1000,
      },
      allBranches: latsState.simulatedBranches.map(b => ({
        actionType: b.actionType,
        questionText: b.questionText,
        rationale: b.rationale,
        prmScore: Math.round(b.prmScore * 1000) / 1000,
        uctValue: Math.round(b.uctValue * 1000) / 1000,
        isSelected: b.isSelectedTrajectory,
      })),
      currentGaps: latsState.currentGaps,
      trajectoryDepth: latsState.trajectoryHistory.length,
    });
  } catch (err) {
    console.error("[FollowUp API Error]:", err);
    // Fail-safe default — never surface errors to the interview UI
    return NextResponse.json({ needsFollowUp: false, trajectoryDepth: 0 });
  }
}
