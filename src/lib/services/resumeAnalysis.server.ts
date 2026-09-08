import { executeGraphRAGAnalysis } from './graphRAG.server';
import { analyzeVisualDocumentLayout } from './documentVision.server';
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
  const sanitizedJobTitle = input.jobTitle.trim().replace(/[<>]/g, '');

  const graphRAGResult = await executeGraphRAGAnalysis({
    jobTitle: sanitizedJobTitle,
    jobDescription: input.jobDescription,
    fileName: input.fileName,
    resumeText: input.resumeText,
  });

  // Run LayoutLMv3 visual document layout analysis in parallel
  const visualLayoutAnalysis = analyzeVisualDocumentLayout(
    input.resumeText ?? '',
    input.fileName
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
