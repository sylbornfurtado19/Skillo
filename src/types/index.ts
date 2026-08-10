export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  created_at?: string;
}

export interface JobRecord {
  id: string;
  user_id: string;
  title: string;
  description: string;
  company?: string;
  location?: string;
  created_at?: string;
}

export interface ResumeAnalysis {
  id: string;
  user_id: string;
  file_name: string;
  match_percentage: number;
  skills_matched: string[];
  skills_missing: string[];
  summary: string;
  score_breakdown: Record<string, number>;
  recommendations: string[];
  created_at?: string;
}

export type ResumeRecord = ResumeAnalysis;

export interface AnswerBreakdown {
  id?: string;
  questionId?: string;
  question: string;
  userAnswer?: string;
  answerText?: string;
  score: number;
  idealConcepts?: string;
  idealConcept?: string;
  feedback: string;
  suggestions?: string[];
  strengths?: string | string[];
}

export interface EvaluationCategories {
  technicalAccuracy?: number;
  communication?: number;
  depth?: number;
  timeManagement?: number;
  systemDesignLogic?: number;
  edgeCaseHandling?: number;
  [key: string]: number | undefined;
}

export interface RubricCriterion {
  name: string;
  weight: number;
  description: string;
  scoreDescriptors: Record<1 | 2 | 3 | 4 | 5, string>;
}

export interface SinglePassEvaluation {
  cotReasoning: string;
  scores: {
    technicalAccuracy: number;
    systemDesignLogic: number;
    edgeCaseHandling: number;
    communicationClarity: number;
  };
  overallScore: number;
  feedback: string;
}

export interface SemanticCluster {
  clusterId: number;
  representativeScore: number;
  passIndices: number[];
  probability: number;
}

export interface SUQEvaluationResult {
  finalScore: number;
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  semanticEntropy: number;
  clusters: SemanticCluster[];
  passes: SinglePassEvaluation[];
  aggregatedRubricFeedback: Record<string, string>;
  requiresValidationPass: boolean;
  latencyMs: number;
}

export interface EvaluationReport {
  overallScore: number;
  categories: EvaluationCategories;
  breakdown: AnswerBreakdown[];
  interviewerComments?: string;
  personaId?: string;
  setupData?: Record<string, any>;
  strengths?: string[];
  weaknesses?: string[];
  plan?: Array<{ topic: string; desc: string }>;
  evaluatedAt?: string;
  userId?: string;
  suqEvaluation?: SUQEvaluationResult;
}

export interface MockInterview {
  id: string;
  user_id: string;
  role: string;
  difficulty: string;
  score: number;
  feedback: EvaluationReport;
  created_at?: string;
}

export interface ServiceResponse<T> {
  data: T | null;
  error: unknown;
}
