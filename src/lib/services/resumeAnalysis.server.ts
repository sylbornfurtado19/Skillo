import { z } from 'zod';
import { executeGraphRAGAnalysis } from './graphRAG.server';
import { analyzeVisualDocumentLayout } from './documentVision.server';
import { executeAnthropicRequest, AI_CONFIG } from '@/lib/ai/aiConfig';
import { safeParseModelJson } from '@/lib/ai/safeJsonParser';
import { sanitizeUserText } from '@/lib/server/sanitize';
import type { GraphRAGAnalysisResult, VisualLayoutAnalysisResult } from '@/types/index';

export interface ResumeAnalysisInput {
  fileName: string;
  jobTitle: string;
  jobDescription: string;
  resumeText?: string;
}

export interface ResumeAnalysisResult {
  matchPercentage: number;
  fileName: string;
  skillsMatched: string[];
  skillsMissing: string[];
  summary: string;
  scoreBreakdown: {
    formatting: number;
    skills: number;
    experienceRelevance: number;
    impactMetrics: number;
  };
  recommendations: string[];
  analyzedAt: string;
  userId: string;
  graphRAGResult?: GraphRAGAnalysisResult;
  visualLayoutAnalysis?: VisualLayoutAnalysisResult;
}

export const resumeRewriteItemSchema = z.object({
  original: z.string().min(1),
  rewritten: z.string().min(1),
  reason: z.string().min(1),
  targetSkill: z.string().min(1),
  metricPlaceholders: z.array(z.string().regex(/^\[[^\]]+\]$/)).default([]),
  source: z.enum(['live', 'fallback']),
});

export const resumeRewriteResultSchema = z.array(resumeRewriteItemSchema).max(5);

export interface ResumeRewriteInput {
  resumeText: string;
  jobTitle: string;
  jobDescription: string;
}

export type ResumeRewriteItem = z.infer<typeof resumeRewriteItemSchema>;

const STOP_WORDS = new Set([
  'about', 'above', 'after', 'again', 'against', 'all', 'and', 'any', 'are', 'aren',
  'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'can',
  'could', 'did', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from',
  'further', 'had', 'has', 'have', 'having', 'her', 'here', 'hers', 'herself',
  'him', 'himself', 'his', 'how', 'into', 'its', 'itself', 'just', 'more', 'most',
  'must', 'not', 'off', 'once', 'only', 'other', 'our', 'ours', 'ourselves', 'out',
  'over', 'own', 'same', 'should', 'some', 'such', 'than', 'that', 'the', 'their',
  'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this', 'those',
  'through', 'too', 'under', 'until', 'very', 'was', 'were', 'what', 'when', 'where',
  'which', 'while', 'who', 'whom', 'why', 'will', 'with', 'would', 'you', 'your',
  'yours', 'yourself', 'yourselves',
]);

function extractKeywords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9#+.-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 3 && !STOP_WORDS.has(w))
  );
}

/**
 * Computes an impact metrics score (0-100) based on the presence and density
 * of quantified achievements, percentages, financial figures, scale metrics,
 * and measurable impact verbs in the candidate's resume text.
 */
export function computeImpactMetricsScore(resumeText?: string): number {
  if (!resumeText || resumeText.trim().length < 10) {
    return 0; // Documented empty-input case
  }

  const text = resumeText;

  // 1. Percentages (e.g. "30%", "15.5%")
  const percentages = text.match(/\b\d+(?:\.\d+)?%/g) || [];

  // 2. Financial figures & currencies (e.g. "$1.2M", "$50,000", "€10k", "500k USD")
  const currencies =
    text.match(
      /(?:[\$\€\£\₹]\s*\d+(?:,\d{3})*(?:\.\d+)?|\b\d+(?:,\d{3})*(?:\.\d+)?\s*(?:USD|EUR|GBP|INR|million|billion|k|M)\b)/gi
    ) || [];

  // 3. Scale and throughput metrics (e.g. "10k users", "500 qps", "120ms latency", "5x faster")
  const scaleMetrics =
    text.match(
      /\b\d+(?:\.\d+)?\s*(?:x|users|clients|customers|requests|req\/s|qps|rps|tps|ms|seconds|minutes|hours|days|engineers|members|teams|services|endpoints|nodes|instances)\b/gi
    ) || [];

  // 4. Quantified impact action phrases (e.g. "reduced latency by 40%", "increased revenue by 25%")
  const impactActions =
    text.match(
      /\b(?:reduced|increased|improved|optimized|scaled|accelerated|saved|delivered|generated|boosted|grew|decreased)\b[^.\n]{1,60}\b\d+/gi
    ) || [];

  // 5. Standalone quantified numbers (integers >= 10, excluding calendar years 1980-2035)
  const allNumbers = text.match(/\b\d+(?:,\d{3})*\b/g) || [];
  const validQuantifiedNumbers = allNumbers.filter(n => {
    const val = parseInt(n.replace(/,/g, ''), 10);
    return val >= 10 && (val < 1980 || val > 2035);
  });

  const weightedSignalCount =
    percentages.length * 3.0 +
    currencies.length * 3.0 +
    scaleMetrics.length * 2.5 +
    impactActions.length * 3.5 +
    Math.min(validQuantifiedNumbers.length, 12) * 0.75;

  // Density scoring: metrics relative to word count
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const metricsDensity = wordCount > 0 ? (weightedSignalCount / wordCount) * 100 : 0;

  // Combine volume (up to 60 pts) and density (up to 40 pts)
  const volumeScore = Math.min(60, weightedSignalCount * 5.5);
  const densityScore = Math.min(40, metricsDensity * 18);

  const rawScore = Math.round(volumeScore + densityScore);
  return Math.max(0, Math.min(100, rawScore));
}

const ACTION_VERBS = new Set([
  'achieved', 'architected', 'automated', 'built', 'created', 'decreased', 'delivered',
  'designed', 'developed', 'drove', 'enhanced', 'established', 'generated', 'grew',
  'implemented', 'improved', 'increased', 'launched', 'led', 'optimized', 'reduced',
  'scaled', 'streamlined',
]);

function numericLiterals(text: string): string[] {
  return text.match(/\b\d+(?:[.,]\d+)?%?|\$[\d.,]+/g) ?? [];
}

function isBulletLine(line: string): boolean {
  return /^\s*(?:[-*•‣▪◦]|\d+[.)])\s+\S/.test(line);
}

function targetSkillFor(jobTitle: string, jobDescription: string): string {
  const title = jobTitle.trim();
  if (title) return title;
  const firstPhrase = jobDescription.split(/[.;,\n]/).map((part) => part.trim()).find(Boolean);
  return firstPhrase || 'target role';
}

function fallbackRewrite(original: string, targetSkill: string): ResumeRewriteItem {
  const withoutMarker = original.replace(/^\s*(?:[-*•‣▪◦]|\d+[.)])\s+/, '').trim();
  const words = withoutMarker.split(/\s+/);
  const firstWord = (words[0] ?? '').replace(/[,:;.]$/, '').toLowerCase();
  const verb = ACTION_VERBS.has(firstWord) ? words[0] : 'Delivered';
  const body = ACTION_VERBS.has(firstWord) ? words.slice(1).join(' ') : withoutMarker;
  const rewritten = `${verb} ${body || `high-impact work for ${targetSkill}`}, delivering [X%] measurable improvement.`;

  return {
    original,
    rewritten,
    reason: 'Strengthened the opening action and reserved a measurable outcome for a verified result.',
    targetSkill,
    metricPlaceholders: ['[X%]'],
    source: 'fallback',
  };
}

function modelItemsAreGrounded(items: ResumeRewriteItem[], selectedLines: string[]): boolean {
  const originals = new Map(selectedLines.map((line) => [line, numericLiterals(line)]));
  return items.every((item) => {
    const sourceNumbers = originals.get(item.original);
    if (!sourceNumbers) return false;
    const rewrittenNumbers = numericLiterals(item.rewritten);
    return rewrittenNumbers.every((value) => sourceNumbers.includes(value));
  });
}

export async function rewriteResumeBullets(input: ResumeRewriteInput): Promise<ResumeRewriteItem[]> {
  const sanitizedResumeText = sanitizeUserText(input.resumeText, 30000);
  const sanitizedJobTitle = sanitizeUserText(input.jobTitle, 200);
  const sanitizedJobDescription = sanitizeUserText(input.jobDescription, 5000);
  const targetSkill = targetSkillFor(sanitizedJobTitle, sanitizedJobDescription);

  const selectedLines = sanitizedResumeText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 10 && isBulletLine(line))
    .map((line, index) => ({ line, index, score: computeImpactMetricsScore(line) }))
    .sort((left, right) => left.score - right.score || left.index - right.index)
    .slice(0, 5)
    .map(({ line }) => line);

  if (selectedLines.length === 0) return [];

  const fallback = selectedLines.map((line) => fallbackRewrite(line, targetSkill));
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fallback;

  const response = await executeAnthropicRequest({
    apiKey,
    system: `Rewrite resume bullets for the target role. Return JSON only as an array of at most 5 objects with keys:
original, rewritten, reason, targetSkill, metricPlaceholders, source.
Use a strong action verb and a quantified outcome placeholder such as [X%], [N], or [$X].
Never invent numeric literals. Preserve every number from the original exactly, or use placeholders only.
Set source to "live" and metricPlaceholders to the placeholders used in rewritten.
Each original must match one supplied bullet exactly.`,
    messages: [{
      role: 'user',
      content: `Target role: ${sanitizedJobTitle}\nJob description: ${sanitizedJobDescription}\nBullets:\n${selectedLines.join('\n')}`,
    }],
    maxTokens: AI_CONFIG.maxTokens.resumeAnalysis,
    temperature: 0.2,
    timeoutMs: AI_CONFIG.timeouts.resumeAnalysisMs,
  });

  if (!response.success || !response.text) return fallback;
  const parsed = safeParseModelJson(response.text, resumeRewriteResultSchema, {
    maxCharLength: 30000,
    logContext: 'resume rewrite',
  });
  if (!parsed.success || !parsed.data || !modelItemsAreGrounded(parsed.data, selectedLines)) return fallback;
  return parsed.data.map((item) => ({ ...item, source: 'live' as const }));
}

/**
 * Computes an experience relevance score (0-100) based on keyword overlap
 * between the resume and target job requirements, title alignment, and
 * GraphRAG candidate domain graph verification.
 */
export function computeExperienceRelevanceScore(
  resumeText: string | undefined,
  jobTitle: string,
  jobDescription: string,
  graphRAGResult?: GraphRAGAnalysisResult
): number {
  if (!resumeText || resumeText.trim().length < 10) {
    return 0; // Documented empty-input case
  }

  const resumeKeywords = extractKeywords(resumeText);
  const targetText = `${jobTitle} ${jobDescription}`;
  const targetKeywords = extractKeywords(targetText);

  // 1. Keyword containment score: fraction of target requirement keywords found in resume
  let keywordOverlapScore = 0;
  if (targetKeywords.size > 0) {
    let matchedCount = 0;
    for (const kw of targetKeywords) {
      if (resumeKeywords.has(kw)) matchedCount++;
    }
    keywordOverlapScore = (matchedCount / targetKeywords.size) * 100;
  }

  // 2. Job title term alignment (role and seniority matching)
  const titleKeywords = extractKeywords(jobTitle);
  let titleMatchScore = 0;
  if (titleKeywords.size > 0) {
    let titleMatches = 0;
    for (const kw of titleKeywords) {
      if (resumeKeywords.has(kw)) titleMatches++;
    }
    titleMatchScore = (titleMatches / titleKeywords.size) * 100;
  }

  // 3. GraphRAG verified node topology coverage
  let graphCoverageScore = 0;
  if (graphRAGResult?.candidateGraph?.nodes?.length) {
    const totalNodes = graphRAGResult.candidateGraph.nodes.length;
    const verifiedNodes = graphRAGResult.candidateGraph.nodes.filter(
      n => n.status === 'VERIFIED'
    ).length;
    const partialNodes = graphRAGResult.candidateGraph.nodes.filter(
      n => n.status === 'PARTIAL'
    ).length;
    graphCoverageScore =
      ((verifiedNodes * 1.0 + partialNodes * 0.5) / totalNodes) * 100;
  } else {
    graphCoverageScore = keywordOverlapScore;
  }

  // Weighted synthesis:
  // 45% Requirement Keyword Overlap + 35% GraphRAG Skill Graph Coverage + 20% Role Title Alignment
  const combined =
    keywordOverlapScore * 0.45 +
    graphCoverageScore * 0.35 +
    titleMatchScore * 0.2;
  return Math.max(0, Math.min(100, Math.round(combined)));
}

export async function performResumeAnalysis(
  input: ResumeAnalysisInput,
  userId: string
): Promise<ResumeAnalysisResult> {
  const sanitizedJobTitle = sanitizeUserText(input.jobTitle, 200);
  const sanitizedJobDescription = sanitizeUserText(input.jobDescription, 5000);
  const sanitizedResumeText = sanitizeUserText(input.resumeText, 15000);
  const sanitizedFileName = sanitizeUserText(input.fileName, 255);

  const graphRAGResult = await executeGraphRAGAnalysis({
    jobTitle: sanitizedJobTitle,
    jobDescription: sanitizedJobDescription,
    fileName: sanitizedFileName,
    resumeText: sanitizedResumeText,
  });

  // Run LayoutLMv3 visual document layout analysis in parallel
  const visualLayoutAnalysis = analyzeVisualDocumentLayout(
    sanitizedResumeText,
    sanitizedFileName
  );

  // Derive skillsMatched from VERIFIED nodes
  const skillsMatched = graphRAGResult.candidateGraph.nodes
    .filter(n => n.status === 'VERIFIED')
    .map(n => n.name);

  // Derive skillsMissing from MISSING nodes + prerequisite gap chain skills
  const missingFromNodes = graphRAGResult.candidateGraph.nodes
    .filter(n => n.status === 'MISSING')
    .map(n => n.name);
  const missingFromChains = graphRAGResult.missingPrerequisiteChains
    .map(c => c.missingSkill ?? c.missingFoundation ?? '')
    .filter(Boolean);
  const skillsMissing = [...new Set([...missingFromNodes, ...missingFromChains])];

  // Dynamically compute component scores
  const formatting = visualLayoutAnalysis.layoutIntegrityScore;
  const skills = graphRAGResult.overallDomainCoverage;
  const experienceRelevance = computeExperienceRelevanceScore(
    input.resumeText,
    sanitizedJobTitle,
    input.jobDescription,
    graphRAGResult
  );
  const impactMetrics = computeImpactMetricsScore(input.resumeText);

  return {
    matchPercentage: graphRAGResult.overallDomainCoverage,
    fileName: input.fileName,
    skillsMatched,
    skillsMissing,
    summary: `GraphRAG Hierarchical Analysis completed for ${sanitizedJobTitle}. ${graphRAGResult.synthesizedSummary}`,
    scoreBreakdown: {
      formatting,
      skills,
      experienceRelevance,
      impactMetrics,
    },
    recommendations: [
      skillsMissing.length > 0
        ? `Bridge identified prerequisite gaps: ${skillsMissing.slice(0, 3).join(', ')}.`
        : 'Excellent domain coverage — no critical skill gaps detected.',
      impactMetrics < 60
        ? 'Add more quantified production metrics (e.g. latency, throughput, scale %, and dollar impact) to your bullet points.'
        : 'Strong presentation of quantified impact and scale across your experience.',
    ],
    analyzedAt: new Date().toISOString(),
    userId,
    graphRAGResult,
    visualLayoutAnalysis,
  };
}
