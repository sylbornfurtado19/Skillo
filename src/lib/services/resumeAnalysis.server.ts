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
}

export function performResumeAnalysis(
  input: ResumeAnalysisInput,
  userId: string
): ResumeAnalysisResult {
  const sanitizedJobTitle = input.jobTitle.trim().replace(/[<>]/g, '');

  return {
    matchPercentage: 82,
    fileName: input.fileName,
    skillsMatched: ['React', 'JavaScript', 'Tailwind', 'Git'],
    skillsMissing: ['Next.js', 'Docker'],
    summary: `Your resume demonstrates a strong match for the ${sanitizedJobTitle} role.`,
    scoreBreakdown: {
      formatting: 90,
      skills: 84,
      experienceRelevance: 80,
      impactMetrics: 75,
    },
    recommendations: ['Quantify accomplishments with metrics.'],
    analyzedAt: new Date().toISOString(),
    userId,
  };
}
