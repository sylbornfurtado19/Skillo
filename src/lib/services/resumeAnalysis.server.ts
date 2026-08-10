import { executeGraphRAGAnalysis } from './graphRAG.server';
import type { GraphRAGAnalysisResult } from '@/types/index';

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

  return {
    matchPercentage: graphRAGResult.overallDomainCoverage,
    fileName: input.fileName,
    skillsMatched,
    skillsMissing,
    summary: `GraphRAG Hierarchical Analysis completed for ${sanitizedJobTitle}. ${graphRAGResult.synthesizedSummary}`,
    scoreBreakdown: {
      formatting: 90,
      skills: graphRAGResult.overallDomainCoverage,
      experienceRelevance: 85,
      impactMetrics: 80,
    },
    recommendations: [
      skillsMissing.length > 0
        ? `Bridge identified prerequisite gaps: ${skillsMissing.slice(0, 3).join(', ')}.`
        : 'Excellent domain coverage — no critical skill gaps detected.',
      'Quantify production impact metrics across full-stack API handlers.',
    ],
    analyzedAt: new Date().toISOString(),
    userId,
    graphRAGResult,
  };
}
