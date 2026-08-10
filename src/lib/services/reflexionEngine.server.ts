import { z } from 'zod';
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

/**
 * 1. Verbal Self-Reflection (SR) Generation Worker
 * Generates an explicit verbal critique (SR_t) detailing root causes of candidate mistakes,
 * foundational concepts missed, and actionable test steps.
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
    skillTag: role.includes('Frontend') ? 'React & State' : role.includes('Backend') ? 'Distributed Systems' : 'Core Engineering',
    timestamp,
    mistakeSummary: isShort
      ? 'Under-explained architectural trade-offs and boundary error states.'
      : 'Stated high-level abstractions without deep quantitative metrics.',
    rootCauseAnalysis: isShort
      ? 'Root cause: Missing foundational knowledge in concurrency locks and failover handling.'
      : 'Root cause: Candidate focused on happy-path execution while omitting null and boundary states.',
    actionableRemediation: 'Incorporate concrete Big-O complexity numbers and failure recovery mechanics into response.',
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

      // Repeat mistake pattern detection: elevate severity if repeated
      if (existingNode.reflections.length > 2 && ref.severity !== 'HIGH') {
        const recentHighs = existingNode.reflections.filter((r) => r.severity === 'HIGH' || r.severity === 'MEDIUM');
        if (recentHighs.length >= 2) {
          ref.severity = 'HIGH';
        }
      }

      if (!existingNode.persistentDeficiencies.includes(ref.mistakeSummary)) {
        existingNode.persistentDeficiencies.push(ref.mistakeSummary);
      }

      // Calculate remediation progress: increases with attempts and lower severity
      const lowSevCount = existingNode.reflections.filter((r) => r.severity === 'LOW').length;
      const progress = Math.min(100, Math.round((lowSevCount / existingNode.reflections.length) * 100));
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
  const masteredCount = Object.values(store.nodes).filter((n) => n.proficiencyLevel === 'MASTERED').length;
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
