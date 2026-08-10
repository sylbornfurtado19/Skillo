export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  created_at?: string;
  skillMemoryStore?: CandidateSkillMemoryStore;
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

// ── GraphRAG Types (Edge et al., Microsoft Research 2024) ────────────────────

export type GraphRAGLevel = 0 | 1 | 2; // Level 0: Macro Domain, Level 1: Core Pillar, Level 2: Leaf Utility
export type GraphNodeStatus = 'VERIFIED' | 'MISSING' | 'PARTIAL';
export type EntityType = 'SKILL' | 'FRAMEWORK' | 'CONCEPT' | 'DOMAIN';
export type RelationType = 'DEPENDS_ON' | 'APPLIED_IN' | 'EXPANDS_UPON' | 'REQUIRES' | 'BLOCKS' | 'ENHANCES';

export interface GraphEntity {
  id: string;
  name: string;
  type?: EntityType;
  description: string;
  communityIdLevel0?: string;
  communityIdLevel1?: string;
  level: GraphRAGLevel;
  status: GraphNodeStatus;
  communityId?: string;
  communityName?: string;
  prerequisites?: string[];
  downstreamImpacts?: string[];
}

export type GraphRAGNode = GraphEntity;

export interface GraphRelationship {
  sourceId: string;
  targetId: string;
  relationshipType: RelationType;
  weight: number;
  strength?: number;
  description: string;
}

export interface CommunitySummary {
  communityId: string;
  level: GraphRAGLevel;
  title?: string;
  summary: string;
  entityIds?: string[];
  prerequisiteFor?: string[];
  name?: string;
  entityCount?: number;
  coveragePercentage?: number;
}

export type GraphRAGCommunitySummary = CommunitySummary;

export interface PrerequisiteGapChain {
  id: string;
  missingSkill?: string;
  missingFoundation?: string;
  blockedCapability: string;
  macroDomainImpact?: string;
  downstreamImpact?: string;
  severity: 'CRITICAL' | 'MODERATE' | 'MINOR';
  remediationPath: string[];
}

export interface GraphRAGAnalysisResult {
  overallDomainCoverage: number; // 0.0 to 100.0%
  candidateGraph: {
    entities: GraphEntity[];
    nodes: GraphEntity[];
    relationships: GraphRelationship[];
    communities: CommunitySummary[];
  };
  missingPrerequisiteChains: PrerequisiteGapChain[];
  extractedEntityCount: number;
  synthesizedSummary: string;
}

// ── Reflexion Types (Shinn et al., NeurIPS 2023) ────────────────────────────

export interface VerbalReflection {
  id: string;
  sessionId: string;
  skillTag: string;
  timestamp: string;
  mistakeSummary: string;
  rootCauseAnalysis: string;
  actionableRemediation: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface SkillMemoryNode {
  skillId: string;
  skillName: string;
  proficiencyLevel: 'NOVICE' | 'DEVELOPING' | 'PROFICIENT' | 'MASTERED';
  attemptsCount: number;
  reflections: VerbalReflection[];
  persistentDeficiencies: string[];
  remediationProgress: number; // 0.0 to 100.0%
  lastUpdated: string;
}

export interface CandidateSkillMemoryStore {
  userId: string;
  nodes: Record<string, SkillMemoryNode>;
  globalReflectionSummary: string;
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
  graphRAGResult?: GraphRAGAnalysisResult;
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

// ── LATS Types (Language Agent Tree Search - Zhou et al., ICML 2024) ──────────

export type LATSActionType = 'DEEP_DIVE' | 'PIVOT' | 'EDGE_CASE_CHALLENGE';

export interface LATSTreeNode {
  id: string;
  parentId: string | null;
  actionType: LATSActionType;
  questionText: string;
  rationale: string;
  prmScore: number; // Process Reward Model score V in [0, 1]
  visitCount: number; // N(s, a)
  uctValue: number; // Upper Confidence Bound for Trees
  gapsDetected: string[];
  isVisited: boolean;
  isSelectedTrajectory: boolean;
  children: LATSTreeNode[];
}

export interface LATSTreeState {
  currentNodeId: string;
  trajectoryHistory: string[];
  rootNode: LATSTreeNode;
  simulatedBranches: LATSTreeNode[];
  activeActionType: LATSActionType;
  currentPRMScore: number; // 0..1 or 0..100%
  currentGaps: string[];
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
  latsTreeState?: LATSTreeState;
  skillMemoryStore?: CandidateSkillMemoryStore;
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
