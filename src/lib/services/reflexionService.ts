import { z } from 'zod';
import { supabaseAdmin } from '@/lib/server/supabaseAdmin';
import type {
  VerbalReflection,
  SkillMemoryNode,
  CandidateSkillMemoryStore,
} from '@/types/index';

// 1. Zod Validation Schema for Verbal Self-Reflection (SR) Output
export const verbalReflectionSchema = z.object({
  skillTag: z.string().min(1),
  mistakeSummary: z.string().min(5),
  rootCauseAnalysis: z.string().min(10),
  actionableRemediation: z.string().min(5),
  severity: z.enum(['HIGH', 'MEDIUM', 'LOW']),
});

export interface GenerateReflectionInput {
  sessionId: string;
  question: string;
  candidateAnswer: string;
  score: number; // 0..100
  role: string;
  historicalReflections?: VerbalReflection[];
}

export interface SkillMemoryNodeRecord {
  user_id: string;
  skill_id: string;
  critique: string;
  proficiency_level: 'NOVICE' | 'DEVELOPING' | 'PROFICIENT' | 'MASTERED';
  updated_at?: string;
  attempts_count?: number;
  remediation_progress?: number;
}

export interface PastCritique {
  skillId: string;
  skillName: string;
  summary: string;
  proficiencyLevel: 'NOVICE' | 'DEVELOPING' | 'PROFICIENT' | 'MASTERED';
  remediation?: string;
}

/**
 * 1. Verbal Self-Reflection (SR_t) Generation Worker
 * Generates an explicit verbal critique detailing root causes of candidate mistakes,
 * foundational concepts missed, and actionable remediation steps.
 */
export async function generateVerbalSelfReflection(
  input: GenerateReflectionInput
): Promise<VerbalReflection> {
  const { sessionId, question, candidateAnswer, score, role, historicalReflections } = input;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  const timestamp = new Date().toISOString();

  // If score is high (>88), generate positive mastery reflection trace
  if (score >= 88) {
    return {
      id: `sr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      sessionId,
      skillTag: role.split(' ')[0] || 'Technical',
      timestamp,
      mistakeSummary: 'Minimal execution errors observed.',
      rootCauseAnalysis: 'Candidate displayed strong structural grasp and precise terminology.',
      actionableRemediation: 'Maintain performance depth on complex edge-case boundary scenarios.',
      severity: 'LOW',
    };
  }

  if (anthropicApiKey) {
    try {
      const systemPrompt = `You are a Reflexion Verbal Self-Critique Agent (NeurIPS 2023).
Analyze the candidate's answer and evaluation score. Emit a concise verbal self-reflection trace detailing:
1. mistakeSummary: Concise summary of what went wrong.
2. rootCauseAnalysis: Deep explanation of WHY the mistake occurred and what foundational concept was missed.
3. actionableRemediation: Exact step candidate must take to fix this deficiency in future sessions.
4. severity: 'HIGH' | 'MEDIUM' | 'LOW'.
5. skillTag: Main technical skill or domain tag.

REQUIRED JSON OUTPUT FORMAT:
{
  "skillTag": "<Skill Name>",
  "mistakeSummary": "<Summary>",
  "rootCauseAnalysis": "<Root Cause>",
  "actionableRemediation": "<Remediation Step>",
  "severity": "HIGH" | "MEDIUM" | "LOW"
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
          max_tokens: 800,
          temperature: 0.3,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: `Role: ${role}\nQuestion: ${question}\nCandidate Answer: ${candidateAnswer}\nScore: ${score}/100\nPrior Reflections Count: ${historicalReflections?.length ?? 0}`,
            },
          ],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const textOutput = data?.content?.[0]?.text ?? '';
        const jsonMatch = textOutput.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const parseResult = verbalReflectionSchema.safeParse(parsed);
          if (parseResult.success) {
            return {
              id: `sr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              sessionId,
              timestamp,
              ...parseResult.data,
            };
          }
        }
      }
    } catch (err) {
      console.warn('[Reflexion Engine] LLM reflection generation fallback:', err);
    }
  }

  // Fallback Verbal Self-Reflection Generator
  const isShort = candidateAnswer.trim().length < 40;

  return {
    id: `sr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    sessionId,
    skillTag: role.includes('Frontend')
      ? 'React & State'
      : role.includes('Backend')
      ? 'Distributed Systems'
      : 'Core Engineering',
    timestamp,
    mistakeSummary: isShort
      ? 'Under-explained architectural trade-offs and boundary error states.'
      : 'Stated high-level abstractions without deep quantitative metrics.',
    rootCauseAnalysis: isShort
      ? 'Root cause: Missing foundational knowledge in concurrency locks and failover handling.'
      : 'Root cause: Candidate focused on happy-path execution while omitting null and boundary states.',
    actionableRemediation:
      'Incorporate concrete Big-O complexity numbers and failure recovery mechanics into response.',
    severity: isShort ? 'HIGH' : 'MEDIUM',
  };
}

/**
 * 2. Dual Memory Consolidation Pipeline
 * Updates CandidateSkillMemoryStore upon new interview evaluations.
 * Consolidates episodic reflection logs into persistent SkillMemoryNodes and updates proficiency levels:
 * NOVICE -> DEVELOPING -> PROFICIENT -> MASTERED.
 */
export function consolidateReflexionMemory(
  userId: string,
  newReflections: VerbalReflection[],
  existingStore?: CandidateSkillMemoryStore
): CandidateSkillMemoryStore {
  const store: CandidateSkillMemoryStore = existingStore || {
    userId,
    nodes: {},
    globalReflectionSummary: '',
  };

  const timestamp = new Date().toISOString();

  newReflections.forEach((ref) => {
    const skillKey = ref.skillTag.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const existingNode = store.nodes[skillKey];

    if (existingNode) {
      existingNode.attemptsCount += 1;
      existingNode.reflections.unshift(ref);

      // Repeat mistake pattern detection: elevate MEDIUM to HIGH if repeated
      if (existingNode.reflections.length > 2 && ref.severity === 'MEDIUM') {
        const recentHighs = existingNode.reflections.filter(
          (r) => r.severity === 'HIGH' || r.severity === 'MEDIUM'
        );
        if (recentHighs.length >= 2) {
          ref.severity = 'HIGH';
        }
      }

      if (!existingNode.persistentDeficiencies.includes(ref.mistakeSummary)) {
        existingNode.persistentDeficiencies.push(ref.mistakeSummary);
      }

      // Calculate remediation progress: weighted over recent reflections (max 5)
      const recent = existingNode.reflections.slice(0, 5);
      const lowSevCount = recent.filter((r) => r.severity === 'LOW').length;
      const medSevCount = recent.filter((r) => r.severity === 'MEDIUM').length;
      const progress = Math.min(
        100,
        Math.round((lowSevCount * 100 + medSevCount * 50) / recent.length)
      );
      existingNode.remediationProgress = progress;

      // Update Proficiency Level: NOVICE -> DEVELOPING -> PROFICIENT -> MASTERED
      if (progress >= 85 && existingNode.attemptsCount >= 3) {
        existingNode.proficiencyLevel = 'MASTERED';
      } else if (progress >= 65) {
        existingNode.proficiencyLevel = 'PROFICIENT';
      } else if (progress >= 40) {
        existingNode.proficiencyLevel = 'DEVELOPING';
      } else {
        existingNode.proficiencyLevel = 'NOVICE';
      }

      existingNode.lastUpdated = timestamp;
    } else {
      const initialProgress = ref.severity === 'LOW' ? 75 : ref.severity === 'MEDIUM' ? 45 : 20;
      let proficiency: 'NOVICE' | 'DEVELOPING' | 'PROFICIENT' | 'MASTERED' = 'NOVICE';
      if (initialProgress >= 65) proficiency = 'PROFICIENT';
      else if (initialProgress >= 40) proficiency = 'DEVELOPING';

      store.nodes[skillKey] = {
        skillId: skillKey,
        skillName: ref.skillTag,
        proficiencyLevel: proficiency,
        attemptsCount: 1,
        reflections: [ref],
        persistentDeficiencies: [ref.mistakeSummary],
        remediationProgress: initialProgress,
        lastUpdated: timestamp,
      };
    }
  });

  // Synthesize Global Reflection Summary across all skill memory nodes
  const totalNodes = Object.keys(store.nodes).length;
  const masteredCount = Object.values(store.nodes).filter(
    (n) => n.proficiencyLevel === 'MASTERED'
  ).length;
  const highSevDeficiencies = Object.values(store.nodes).flatMap((n) =>
    n.reflections.filter((r) => r.severity === 'HIGH').map((r) => r.mistakeSummary)
  );

  store.globalReflectionSummary = `Candidate has logged ${totalNodes} skill memory node(s) across sessions. ${masteredCount} skill(s) mastered. Identified ${highSevDeficiencies.length} high-severity deficiency trace(s) requiring targeted practice.`;

  return store;
}

/**
 * 3. Dynamic Memory Retrieval
 * Retrieves relevant historical reflections for a specific skill tag to inject into system prompts.
 */
export function getRelevantReflexionContext(
  skillTag: string,
  store?: CandidateSkillMemoryStore
): string {
  if (!store) return '';

  const skillKey = skillTag.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const node = store.nodes[skillKey];

  if (!node || node.reflections.length === 0) {
    return '';
  }

  const recentReflection = node.reflections[0];
  return `[Reflexion Memory Context for ${skillTag}]: Proficiency Level: ${node.proficiencyLevel} (Progress: ${node.remediationProgress}%). Prior Mistake: "${recentReflection.mistakeSummary}". Actionable Remediation: "${recentReflection.actionableRemediation}". Verify if candidate has resolved this deficiency.`;
}

/**
 * 4. Format Historical Memory Prompt Conditioning
 * Enforces the required prompt conditioning format:
 * `Candidate Historical Memory: ${pastCritiques.map(c => c.summary).join("; ")}.
 * Adaptively probe these specific weak points during this session.`
 */
export function formatHistoricalMemoryPrompt(
  pastCritiques: Array<{ summary: string }>
): string {
  if (!pastCritiques || pastCritiques.length === 0) {
    return '';
  }
  return `Candidate Historical Memory: ${pastCritiques.map((c) => c.summary).join('; ')}. \nAdaptively probe these specific weak points during this session.`;
}

/**
 * 5. Retrieve Past Critiques from Supabase
 * Extracts historical weak points and deficiencies from SkillMemoryNodes JSONB.
 */
export async function retrievePastCritiques(userId: string): Promise<PastCritique[]> {
  const store = await retrieveSkillMemoryStore(userId);
  if (!store || !store.nodes) return [];

  const critiques: PastCritique[] = [];

  for (const node of Object.values(store.nodes)) {
    // Collect persistent deficiencies or recent high/medium reflections
    if (node.persistentDeficiencies && node.persistentDeficiencies.length > 0) {
      for (const def of node.persistentDeficiencies) {
        if (def && !critiques.some((c) => c.summary === def)) {
          critiques.push({
            skillId: node.skillId,
            skillName: node.skillName,
            summary: def,
            proficiencyLevel: node.proficiencyLevel,
            remediation: node.reflections?.[0]?.actionableRemediation,
          });
        }
      }
    } else if (node.reflections && node.reflections.length > 0) {
      const topRef = node.reflections[0];
      critiques.push({
        skillId: node.skillId,
        skillName: node.skillName,
        summary: topRef.mistakeSummary,
        proficiencyLevel: node.proficiencyLevel,
        remediation: topRef.actionableRemediation,
      });
    }
  }

  return critiques;
}

/**
 * 6. Persist SkillMemoryStore & SkillMemoryNodes JSONB to Supabase
 * Upserts to profiles table (skill_memory_store & skill_memory_nodes JSONB)
 * as well as optional skill_memory_nodes table.
 */
export async function persistSkillMemoryStore(
  userId: string,
  memoryStore: CandidateSkillMemoryStore
): Promise<void> {
  try {
    // Build canonical SkillMemoryNodes JSONB map
    const skillMemoryNodesRecord: Record<string, SkillMemoryNodeRecord> = {};
    for (const [skillId, node] of Object.entries(memoryStore.nodes)) {
      skillMemoryNodesRecord[skillId] = {
        user_id: userId,
        skill_id: skillId,
        critique:
          node.reflections?.[0]?.mistakeSummary ||
          node.persistentDeficiencies?.[0] ||
          'Identified technical limitation.',
        proficiency_level: node.proficiencyLevel,
        updated_at: node.lastUpdated,
        attempts_count: node.attemptsCount,
        remediation_progress: node.remediationProgress,
      };
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        skill_memory_store: memoryStore as unknown as Record<string, unknown>,
        skill_memory_nodes: skillMemoryNodesRecord as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.warn('[Reflexion Memory] Supabase profiles upsert notice:', error.message);
    }

    // Optional: Also attempt writing to dedicated skill_memory_nodes table if it exists
    const rows = Object.values(skillMemoryNodesRecord).map((r) => ({
      user_id: r.user_id,
      skill_id: r.skill_id,
      critique: r.critique,
      proficiency_level: r.proficiency_level,
      updated_at: r.updated_at || new Date().toISOString(),
    }));

    if (rows.length > 0) {
      void supabaseAdmin
        .from('skill_memory_nodes')
        .upsert(rows)
        .then(
          ({ error: tableErr }) => {
            if (tableErr) {
              // Expected if table does not exist; silent fallback to profiles JSONB
            }
          },
          () => {}
        );
    }
  } catch (err) {
    console.warn('[Reflexion Memory] persistSkillMemoryStore failed gracefully:', err);
  }
}

/**
 * 7. Retrieve CandidateSkillMemoryStore from Supabase profiles table
 */
export async function retrieveSkillMemoryStore(
  userId: string
): Promise<CandidateSkillMemoryStore | undefined> {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('skill_memory_store')
      .eq('id', userId)
      .single();

    if (error || !data) return undefined;
    const raw = (data as Record<string, unknown>).skill_memory_store;
    if (!raw || typeof raw !== 'object') return undefined;
    return raw as CandidateSkillMemoryStore;
  } catch (err) {
    console.warn('[Reflexion Memory] retrieveSkillMemoryStore failed:', err);
    return undefined;
  }
}

export interface DispatchReflexionWorkerParams {
  userId: string;
  sessionId: string;
  question: string;
  candidateAnswer: string;
  overallScore: number;
  role: string;
  historicalContext?: string;
}

/**
 * 8. Asynchronous Non-Blocking Self-Critique ($SR_t$) Worker Dispatcher
 * Dispatched post-response in /api/interview/evaluate so candidate HTTP response is never blocked.
 * Generates structured verbal critique and persists to Supabase SkillMemoryNodes JSONB.
 */
export function dispatchReflexionWorker(params: DispatchReflexionWorkerParams): void {
  const { userId, sessionId, question, candidateAnswer, overallScore, role, historicalContext } =
    params;

  // Execute asynchronously in background microtask / detached promise
  queueMicrotask(async () => {
    try {
      const existingMemoryStore = await retrieveSkillMemoryStore(userId);

      const verbalReflection = await generateVerbalSelfReflection({
        sessionId,
        question,
        candidateAnswer,
        score: overallScore,
        role,
        historicalReflections: historicalContext
          ? [
              {
                id: `ctx_${Date.now()}`,
                sessionId: 'prior',
                skillTag: role,
                timestamp: new Date().toISOString(),
                mistakeSummary: historicalContext,
                rootCauseAnalysis: 'Historical recurring weakness.',
                actionableRemediation: 'Probed weak point during active evaluation.',
                severity: 'MEDIUM' as const,
              },
            ]
          : undefined,
      });

      const updatedStore = consolidateReflexionMemory(
        userId,
        [verbalReflection],
        existingMemoryStore
      );

      await persistSkillMemoryStore(userId, updatedStore);
    } catch (err) {
      console.warn('[Reflexion Worker] Background worker execution failed gracefully:', err);
    }
  });
}
