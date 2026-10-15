import { z } from 'zod';
import type { LATSTreeNode, LATSTreeState, LATSActionType, ProcessRewardResult } from '@/types/index';
import { executeAnthropicRequest, AI_CONFIG } from '@/lib/ai/aiConfig';

export const C_PUCT = 1.414;

// ── Zod schemas ──────────────────────────────────────────────────────────────

export const prmResponseSchema = z.object({
  score: z.number().min(0).max(1),
  reasoning: z.string().min(5),
  detectedGaps: z.array(z.string()),
});

export const branchExpansionSchema = z.object({
  branches: z.array(z.object({
    actionType: z.enum(['DEEP_DIVE', 'PIVOT', 'EDGE_CASE_CHALLENGE']),
    questionText: z.string().min(10),
    rationale: z.string().min(5),
  })).length(3),
});

export const latsTreeNodeSchema: z.ZodType<LATSTreeNode> = z.lazy(() =>
  z.object({
    id: z.string().max(128),
    parentId: z.string().max(128).nullable(),
    actionType: z.enum(['DEEP_DIVE', 'PIVOT', 'EDGE_CASE_CHALLENGE']),
    questionText: z.string().max(2000),
    rationale: z.string().max(2000),
    prmScore: z.number().min(0).max(1),
    visitCount: z.number().int().min(0),
    uctValue: z.number(),
    gapsDetected: z.array(z.string().max(200)).max(50),
    isVisited: z.boolean(),
    isSelectedTrajectory: z.boolean(),
    children: z.array(latsTreeNodeSchema).max(20),
    prior: z.number().min(0).max(1).optional(),
    qValue: z.number().min(0).max(1).optional(),
    depth: z.number().int().min(0).optional(),
  })
);

export const latsTreeStateSchema = z.object({
  currentNodeId: z.string().max(128),
  trajectoryHistory: z.array(z.string().max(128)).max(50),
  rootNode: latsTreeNodeSchema,
  simulatedBranches: z.array(latsTreeNodeSchema).max(20),
  activeActionType: z.enum(['DEEP_DIVE', 'PIVOT', 'EDGE_CASE_CHALLENGE']),
  currentPRMScore: z.number(),
  currentGaps: z.array(z.string().max(200)).max(50),
  fallback: z.boolean().optional(),
  source: z.enum(['live', 'fallback']).optional(),
  depth: z.number().optional(),
});

export interface LATSEngineInput {
  sessionId: string;
  role: string;
  company?: string;
  interviewModeId?: string;
  currentQuestion: string;
  candidateAnswer: string;
  priorGaps: string[];
  diagramState?: any;
  anthropicApiKey?: string;
  /** Optional previous LATS tree state for multi-turn persistence across follow-ups */
  previousTreeState?: LATSTreeState;
  /** Optional override for number of MCTS rounds (default 3 from AI_CONFIG) */
  maxRounds?: number;
  /** Optional total wall-clock budget in ms (default from AI_CONFIG.timeouts.latsWallClockMs or 10000 ms) */
  wallClockBudgetMs?: number;
}

// ── UCT Formula ──────────────────────────────────────────────────────────────
// UCT = Q(s,a) + c_puct * P(s,a) * sqrt(N(s)) / (1 + N(s,a))
export function computeUCT(
  qValue: number,
  priorProb: number,
  nParent: number,
  nChild: number
): number {
  return qValue + C_PUCT * priorProb * Math.sqrt(nParent) / (1 + nChild);
}

// ── Selection ────────────────────────────────────────────────────────────────
// Traverses from root down to a leaf using computeUCT with correct visit counts.
// Unvisited nodes (visitCount === 0) are selected first.
export function selectNode(node: LATSTreeNode): LATSTreeNode {
  if (!node.children || node.children.length === 0) return node;

  // 1. Pick unvisited children first
  const unvisited = node.children.filter((c) => c.visitCount === 0);
  if (unvisited.length > 0) {
    let bestUnvisited = unvisited[0];
    let bestUCT = computeUCT(
      bestUnvisited.qValue ?? bestUnvisited.prmScore,
      bestUnvisited.prior ?? (1 / node.children.length),
      Math.max(1, node.visitCount),
      bestUnvisited.visitCount
    );
    for (let i = 1; i < unvisited.length; i++) {
      const uct = computeUCT(
        unvisited[i].qValue ?? unvisited[i].prmScore,
        unvisited[i].prior ?? (1 / node.children.length),
        Math.max(1, node.visitCount),
        unvisited[i].visitCount
      );
      if (uct > bestUCT) {
        bestUCT = uct;
        bestUnvisited = unvisited[i];
      }
    }
    return selectNode(bestUnvisited);
  }

  // 2. All children visited: select child with highest UCT
  let bestChild = node.children[0];
  let bestUCT = computeUCT(
    bestChild.qValue ?? bestChild.prmScore,
    bestChild.prior ?? (1 / node.children.length),
    Math.max(1, node.visitCount),
    bestChild.visitCount
  );

  for (let i = 1; i < node.children.length; i++) {
    const child = node.children[i];
    const uct = computeUCT(
      child.qValue ?? child.prmScore,
      child.prior ?? (1 / node.children.length),
      Math.max(1, node.visitCount),
      child.visitCount
    );
    if (uct > bestUCT) {
      bestUCT = uct;
      bestChild = child;
    }
  }

  return selectNode(bestChild);
}

// ── Expansion ────────────────────────────────────────────────────────────────
// Generates 3 distinct action branches via LLM (or robust domain defaults)
export async function expandBranches(
  parentId: string,
  role: string,
  currentQuestion: string,
  candidateAnswer: string,
  priorGaps: string[],
  anthropicApiKey?: string
): Promise<{ branches: Array<{ actionType: LATSActionType; questionText: string; rationale: string }>; isFallback: boolean }> {
  const defaultBranches: Array<{ actionType: LATSActionType; questionText: string; rationale: string }> = [
    {
      actionType: 'DEEP_DIVE',
      questionText: `For the ${role} role: Dive deeper into the core technical mechanism you described. Explain the exact algorithmic complexity and why that tradeoff matters at scale.`,
      rationale: 'Probing depth of algorithmic knowledge and production-scale reasoning.',
    },
    {
      actionType: 'PIVOT',
      questionText: `Shifting topic for the ${role} role: How would you apply a similar architectural pattern to a different system component — such as a distributed message queue or event streaming layer?`,
      rationale: 'Testing conceptual portability and systems-thinking breadth.',
    },
    {
      actionType: 'EDGE_CASE_CHALLENGE',
      questionText: `Edge case for the ${role} role: What happens when your proposed solution encounters a network partition event, a zero-downtime deployment, or a null input boundary? How does it fail safely?`,
      rationale: 'Assessing fault tolerance awareness and defensive engineering mindset.',
    },
  ];

  if (!anthropicApiKey) return { branches: defaultBranches, isFallback: true };

  try {
    const systemPrompt = `You are a LATS (Language Agent Tree Search) Question Generator for a ${role} interview.
Given the candidate's latest answer, generate exactly 3 follow-up questions — one per action type:
1. DEEP_DIVE: A deeper technical question drilling into their stated mechanism.
2. PIVOT: A question that pivots to a related but different system or domain.
3. EDGE_CASE_CHALLENGE: A question probing failure modes and boundary conditions.

REQUIRED JSON OUTPUT:
{
  "branches": [
    { "actionType": "DEEP_DIVE", "questionText": "<question>", "rationale": "<why this question>" },
    { "actionType": "PIVOT", "questionText": "<question>", "rationale": "<why this question>" },
    { "actionType": "EDGE_CASE_CHALLENGE", "questionText": "<question>", "rationale": "<why this question>" }
  ]
}`;

    const res = await executeAnthropicRequest({
      apiKey: anthropicApiKey,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Role: ${role}\nPrior Question: ${currentQuestion}\nCandidate Answer: ${candidateAnswer}\nKnown Gaps: ${priorGaps.join(', ') || 'none'}`,
      }],
      maxTokens: 800,
      temperature: 0.7,
      timeoutMs: AI_CONFIG.timeouts.latsBranchMs,
    });

    if (res.success && res.text) {
      const match = res.text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        const result = branchExpansionSchema.safeParse(parsed);
        if (result.success) {
          return {
            branches: result.data.branches.map((b) => ({
              actionType: b.actionType as LATSActionType,
              questionText: b.questionText,
              rationale: b.rationale,
            })),
            isFallback: false,
          };
        }
      }
    }
  } catch (err) {
    console.warn('[LATS Expansion] LLM branch generation fallback:', err);
  }

  return { branches: defaultBranches, isFallback: true };
}

// ── PRM Evaluation ───────────────────────────────────────────────────────────
// Scores a node via Process Reward Model V in [0,1]
export async function evaluatePRM(
  nodeId: string,
  role: string,
  question: string,
  candidateAnswer: string,
  anthropicApiKey?: string,
  actionType?: LATSActionType
): Promise<{ result: ProcessRewardResult; isFallback: boolean }> {
  const defaultScore = actionType === 'DEEP_DIVE' ? 0.78 : actionType === 'EDGE_CASE_CHALLENGE' ? 0.72 : 0.65;
  const defaultResult: ProcessRewardResult = {
    nodeId,
    score: defaultScore,
    reasoning: 'Baseline PRM estimate. API key not configured or offline for live scoring.',
    detectedGaps: ['Depth of technical explanation', 'Edge case coverage'],
  };

  if (!anthropicApiKey) return { result: defaultResult, isFallback: true };

  try {
    const systemPrompt = `You are a Process Reward Model (PRM) evaluator for ${role} interview questions.
Score how well a candidate's answer addresses the question on a 0.0 to 1.0 scale.

SCORING RUBRIC:
- 0.0-0.3: Incorrect or dangerously incomplete
- 0.3-0.6: Partial understanding, missing key concepts
- 0.6-0.8: Good understanding, minor gaps
- 0.8-1.0: Expert-level, complete coverage

REQUIRED JSON OUTPUT:
{
  "score": <number 0.0 to 1.0>,
  "reasoning": "<explanation of score>",
  "detectedGaps": ["<gap1>", "<gap2>"]
}`;

    const res = await executeAnthropicRequest({
      apiKey: anthropicApiKey,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Role: ${role}\nQuestion: ${question}\nCandidate Answer: ${candidateAnswer}`,
      }],
      maxTokens: 400,
      temperature: 0.2,
      timeoutMs: AI_CONFIG.timeouts.latsBranchMs,
    });

    if (res.success && res.text) {
      const match = res.text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        const result = prmResponseSchema.safeParse(parsed);
        if (result.success) {
          return { result: { nodeId, ...result.data }, isFallback: false };
        }
      }
    }
  } catch (err) {
    console.warn('[LATS PRM] Evaluation fallback:', err);
  }

  return { result: defaultResult, isFallback: true };
}

// ── Backpropagation ──────────────────────────────────────────────────────────
// Backpropagates value v along the path to root, updating visitCount and running mean Q.
export function backpropagate(
  root: LATSTreeNode,
  targetId: string,
  value: number
): LATSTreeNode {
  function updateNode(node: LATSTreeNode, parentVisits: number): { updated: LATSTreeNode; onPath: boolean } {
    if (node.id === targetId) {
      const newVisitCount = node.visitCount + 1;
      const oldQ = node.qValue ?? node.prmScore;
      const newQ = node.visitCount === 0 ? value : (oldQ * node.visitCount + value) / newVisitCount;
      const prior = node.prior ?? (node.parentId === null ? 1.0 : 1 / 3);
      const uctValue = computeUCT(newQ, prior, parentVisits, newVisitCount);

      return {
        updated: {
          ...node,
          visitCount: newVisitCount,
          qValue: Math.round(newQ * 1000) / 1000,
          uctValue: Math.round(uctValue * 1000) / 1000,
        },
        onPath: true,
      };
    }

    if (!node.children || node.children.length === 0) {
      return { updated: node, onPath: false };
    }

    let foundChild = false;
    const updatedChildren = node.children.map((child) => {
      const res = updateNode(child, Math.max(1, node.visitCount));
      if (res.onPath) foundChild = true;
      return res.updated;
    });

    if (foundChild) {
      const newVisitCount = node.visitCount + 1;
      const oldQ = node.qValue ?? node.prmScore;
      const newQ = node.visitCount === 0 ? value : (oldQ * node.visitCount + value) / newVisitCount;
      const prior = node.prior ?? (node.parentId === null ? 1.0 : 1 / 3);
      const uctValue = computeUCT(newQ, prior, parentVisits, newVisitCount);

      return {
        updated: {
          ...node,
          children: updatedChildren,
          visitCount: newVisitCount,
          qValue: Math.round(newQ * 1000) / 1000,
          uctValue: Math.round(uctValue * 1000) / 1000,
        },
        onPath: true,
      };
    }

    return { updated: node, onPath: false };
  }

  return updateNode(root, Math.max(1, root.visitCount)).updated;
}

// ── Tree Traversal & Math Helpers ────────────────────────────────────────────

export function attachChildrenToNode(
  root: LATSTreeNode,
  targetId: string,
  newChildren: LATSTreeNode[]
): LATSTreeNode {
  if (root.id === targetId) {
    return {
      ...root,
      children: newChildren,
    };
  }
  if (!root.children || root.children.length === 0) {
    return root;
  }
  return {
    ...root,
    children: root.children.map((c) => attachChildrenToNode(c, targetId, newChildren)),
  };
}

export function getTreeMaxDepth(node: LATSTreeNode, currentDepth: number = 0): number {
  if (!node.children || node.children.length === 0) return currentDepth;
  return Math.max(...node.children.map((c) => getTreeMaxDepth(c, currentDepth + 1)));
}

/**
 * Recomputes visit counts and running mean Q bottom-up so that for all internal nodes:
 * 1. visitCount === sum of children's visitCounts
 * 2. qValue === weighted mean of children's qValues
 */
export function recomputeTreeStats(node: LATSTreeNode, parentVisits: number = 1): LATSTreeNode {
  if (!node.children || node.children.length === 0) {
    const prior = node.prior ?? 1 / 3;
    const q = node.qValue ?? node.prmScore;
    const uct = computeUCT(q, prior, parentVisits, node.visitCount);
    return {
      ...node,
      qValue: Math.round(q * 1000) / 1000,
      uctValue: Math.round(uct * 1000) / 1000,
    };
  }

  const updatedChildren = node.children.map((c) =>
    recomputeTreeStats(c, Math.max(1, node.visitCount))
  );

  const totalChildVisits = updatedChildren.reduce((sum, c) => sum + c.visitCount, 0);
  const totalWeightedQ = updatedChildren.reduce(
    (sum, c) => sum + c.visitCount * (c.qValue ?? c.prmScore),
    0
  );
  const runningMeanQ = totalChildVisits > 0 ? totalWeightedQ / totalChildVisits : (node.qValue ?? node.prmScore);
  const prior = node.prior ?? (node.parentId === null ? 1.0 : 1 / 3);
  const uct = computeUCT(runningMeanQ, prior, parentVisits, totalChildVisits);

  return {
    ...node,
    children: updatedChildren,
    visitCount: totalChildVisits,
    qValue: Math.round(runningMeanQ * 1000) / 1000,
    uctValue: Math.round(uct * 1000) / 1000,
  };
}

// ── Main Multi-Iteration Bounded MCTS Engine ─────────────────────────────────

export async function runLATSMCTS(input: LATSEngineInput): Promise<LATSTreeState> {
  const { sessionId, role, currentQuestion, candidateAnswer, priorGaps, anthropicApiKey, previousTreeState } = input;
  const K = input.maxRounds ?? AI_CONFIG.lats.rounds;
  const startTime = Date.now();
  const totalBudgetMs = input.wallClockBudgetMs ?? AI_CONFIG.timeouts.latsWallClockMs;
  let liveCallsSucceeded = 0;

  let rootNode: LATSTreeNode;
  let trajectoryHistory: string[] = [];

  if (previousTreeState && previousTreeState.rootNode) {
    // Restore persistent tree from previous turn
    rootNode = previousTreeState.rootNode;
    trajectoryHistory = [...previousTreeState.trajectoryHistory];
  } else {
    // Initialize root node for turn 1
    const rootNodeId = `node_${sessionId}_root`;
    rootNode = {
      id: rootNodeId,
      parentId: null,
      actionType: 'DEEP_DIVE',
      questionText: currentQuestion,
      rationale: 'Starting question — root of MCTS trajectory.',
      prmScore: 0.5,
      qValue: 0.5,
      visitCount: 1,
      uctValue: 0,
      gapsDetected: priorGaps,
      isVisited: true,
      isSelectedTrajectory: true,
      children: [],
      depth: 0,
      prior: 1.0,
    };
    trajectoryHistory = [rootNodeId];
  }

  // Iterate K rounds of Selection -> Expansion -> PRM Evaluation -> Backpropagation
  for (let round = 0; round < K; round++) {
    // Skip remaining rounds if total wall-clock budget has been exceeded, but ensure at least round 0 executes
    if (round > 0 && Date.now() - startTime >= totalBudgetMs) {
      break;
    }

    // 1. Selection: Traverse down to a leaf using computeUCT
    const leaf = selectNode(rootNode);

    // 2. Expansion: Expand leaf into 3 branches (DEEP_DIVE, PIVOT, EDGE_CASE_CHALLENGE)
    const expansion = await expandBranches(
      leaf.id,
      role,
      leaf.questionText,
      candidateAnswer,
      priorGaps,
      anthropicApiKey
    );
    if (!expansion.isFallback) {
      liveCallsSucceeded++;
    }

    const currentDepth = leaf.depth ?? 0;
    const childNodes: LATSTreeNode[] = expansion.branches.map((branch, idx) => ({
      id: `node_${sessionId}_${leaf.id}_c${idx}_r${round}`,
      parentId: leaf.id,
      actionType: branch.actionType,
      questionText: branch.questionText,
      rationale: branch.rationale,
      prmScore: 0,
      qValue: 0,
      visitCount: 0,
      uctValue: 0,
      gapsDetected: [],
      isVisited: false,
      isSelectedTrajectory: false,
      children: [],
      prior: 1 / 3, // P(s,a) uniform prior over siblings separate from PRM
      depth: currentDepth + 1,
    }));

    // 3. PRM Evaluation: Evaluate all 3 child branches
    const prmEvals = await Promise.all(
      childNodes.map((child) =>
        evaluatePRM(child.id, role, child.questionText, candidateAnswer, anthropicApiKey, child.actionType)
      )
    );
    for (const ev of prmEvals) {
      if (!ev.isFallback) {
        liveCallsSucceeded++;
      }
    }

    const evaluatedChildren: LATSTreeNode[] = childNodes.map((child, idx) => {
      const prm = prmEvals[idx].result;
      return {
        ...child,
        prmScore: prm.score,
        qValue: prm.score,
        visitCount: 1,
        gapsDetected: prm.detectedGaps,
        isVisited: true,
      };
    });

    // Attach children to the selected leaf
    rootNode = attachChildrenToNode(rootNode, leaf.id, evaluatedChildren);

    // 4. Backpropagation: Update visitCount and running mean Q along the whole path to root
    const bestChild = evaluatedChildren.reduce(
      (best, c) => (c.prmScore > best.prmScore ? c : best),
      evaluatedChildren[0]
    );
    rootNode = backpropagate(rootNode, bestChild.id, bestChild.prmScore);
  }

  // Final recompute: ensure visit counts and running mean Q sum and average cleanly across all levels
  rootNode = recomputeTreeStats(rootNode, 1);

  // Traverse down to find and mark the optimal trajectory
  function markSelectedTrajectory(node: LATSTreeNode): {
    updated: LATSTreeNode;
    selectedLeafId: string;
    selectedGaps: string[];
    selectedType: LATSActionType;
    selectedPRM: number;
  } {
    if (!node.children || node.children.length === 0) {
      return {
        updated: { ...node, isSelectedTrajectory: true },
        selectedLeafId: node.id,
        selectedGaps: node.gapsDetected,
        selectedType: node.actionType,
        selectedPRM: node.prmScore,
      };
    }

    let bestChild = node.children[0];
    for (const c of node.children) {
      if (c.uctValue > bestChild.uctValue) {
        bestChild = c;
      } else if (c.uctValue === bestChild.uctValue && (c.qValue ?? c.prmScore) > (bestChild.qValue ?? bestChild.prmScore)) {
        bestChild = c;
      }
    }

    let resultSelectedLeafId = bestChild.id;
    let resultSelectedGaps = bestChild.gapsDetected;
    let resultSelectedType = bestChild.actionType;
    let resultSelectedPRM = bestChild.prmScore;

    const newChildren = node.children.map((c) => {
      if (c.id === bestChild.id) {
        const res = markSelectedTrajectory(c);
        resultSelectedLeafId = res.selectedLeafId;
        resultSelectedGaps = res.selectedGaps;
        resultSelectedType = res.selectedType;
        resultSelectedPRM = res.selectedPRM;
        return res.updated;
      }
      return { ...c, isSelectedTrajectory: false };
    });

    return {
      updated: {
        ...node,
        children: newChildren,
        isSelectedTrajectory: true,
      },
      selectedLeafId: resultSelectedLeafId,
      selectedGaps: resultSelectedGaps,
      selectedType: resultSelectedType,
      selectedPRM: resultSelectedPRM,
    };
  }

  const { updated: finalRootNode, selectedLeafId, selectedGaps, selectedType, selectedPRM } =
    markSelectedTrajectory(rootNode);

  if (!trajectoryHistory.includes(selectedLeafId)) {
    trajectoryHistory.push(selectedLeafId);
  }

  const maxDepth = getTreeMaxDepth(finalRootNode);
  const hasLiveSuccess = liveCallsSucceeded > 0;

  return {
    currentNodeId: selectedLeafId,
    trajectoryHistory,
    rootNode: finalRootNode,
    simulatedBranches: finalRootNode.children,
    activeActionType: selectedType,
    currentPRMScore: Math.round(selectedPRM * 100),
    currentGaps: selectedGaps,
    fallback: !hasLiveSuccess,
    source: hasLiveSuccess ? 'live' : 'fallback',
    depth: maxDepth,
  };
}
