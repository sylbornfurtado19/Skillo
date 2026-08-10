export type CompanyOption = 'Generic' | 'Google' | 'Meta' | 'Amazon' | 'Stripe' | 'Custom';

export type TargetRoleOption =
  | 'Software Engineer'
  | 'Frontend Engineer'
  | 'Backend Engineer'
  | 'Full Stack Engineer'
  | 'Data Engineer'
  | 'ML Engineer'
  | 'DevOps Engineer'
  | 'Product Manager'
  | 'Custom';

export type InterviewTypeOption = 'Coding' | 'System Design' | 'Behavioral' | 'Technical' | 'Mixed';

export type DifficultyOption = 'Easy' | 'Medium' | 'Hard' | 'Expert';

export type DurationOption = 15 | 30 | 45 | 60;

export interface ModeEvaluationRubric {
  technicalWeight: number;      // e.g. 0.35
  architectureWeight: number;   // e.g. 0.30
  edgeCaseWeight: number;       // e.g. 0.20
  communicationWeight: number;  // e.g. 0.15
  specificFocus: string[];
}

export interface InterviewerStyleConfig {
  tone: string;
  followUpPacing: 'rapid-fire' | 'probing' | 'conversational' | 'analytical';
  timePressure: 'relaxed' | 'standard' | 'intense' | 'strict';
  probingDepth: 'shallow' | 'moderate' | 'deep' | 'relentless';
}

export interface SystemPromptConfig {
  companyContextPrompt: string;
  interviewerPersonaOverride?: string;
  evaluationFocusPrompt: string;
  expectedAnswerStyle: string;
}

export interface InterviewMode {
  id: string;
  company: CompanyOption | string;
  role: TargetRoleOption | string;
  interviewType: InterviewTypeOption | string;
  difficulty: DifficultyOption | string;
  duration: DurationOption | number;
  questionCategories: string[];
  evaluationRubric: ModeEvaluationRubric;
  interviewerStyle: InterviewerStyleConfig;
  allowedQuestionTypes: string[];
  systemPromptConfig: SystemPromptConfig;
  skillsEvaluated: string[];
}

// ── Preset Registries ─────────────────────────────────────────────────────────

export const INTERVIEW_MODE_PRESETS: Record<string, InterviewMode> = {
  'google-swe-coding': {
    id: 'google-swe-coding',
    company: 'Google',
    role: 'Software Engineer',
    interviewType: 'Coding',
    difficulty: 'Hard',
    duration: 45,
    questionCategories: [
      'Data Structures & Algorithms',
      'Time & Space Complexity Analysis',
      'Follow-Up Edge Cases',
      'Scale & Memory Optimizations',
    ],
    evaluationRubric: {
      technicalWeight: 0.45,
      architectureWeight: 0.20,
      edgeCaseWeight: 0.25,
      communicationWeight: 0.10,
      specificFocus: [
        'Optimal Big-O time and space complexity',
        'Data structure selection trade-offs',
        'Clean code hygiene and boundary test cases',
        'Follow-up scale modifications (e.g. streaming, memory limits)',
      ],
    },
    interviewerStyle: {
      tone: 'Analytical, quiet, highly focused on code efficiency and rigor',
      followUpPacing: 'probing',
      timePressure: 'intense',
      probingDepth: 'deep',
    },
    allowedQuestionTypes: ['ALGORITHM', 'DATA_STRUCTURE', 'COMPLEXITY_PROBE', 'OPTIMIZATION'],
    systemPromptConfig: {
      companyContextPrompt:
        'Google-style Technical Interview: Prioritize algorithmic efficiency, optimal asymptotic bounds, memory trade-offs, and clear explanation of data structure choices.',
      interviewerPersonaOverride: 'techbot',
      evaluationFocusPrompt:
        'Deduct marks for suboptimal space/time complexity, unhandled boundary cases, or failure to state Big-O explicitly.',
      expectedAnswerStyle:
        'Propose initial approach, analyze complexity, code optimal solution, test edge cases, address scale follow-up.',
    },
    skillsEvaluated: ['Algorithms', 'Data Structures', 'Big-O Analysis', 'Code Execution', 'Edge Cases'],
  },

  'meta-swe-coding': {
    id: 'meta-swe-coding',
    company: 'Meta',
    role: 'Software Engineer',
    interviewType: 'Coding',
    difficulty: 'Hard',
    duration: 45,
    questionCategories: [
      'Rapid Coding Execution',
      'Algorithmic Accuracy',
      'System Scale Architecture',
      'Proactive Verification',
    ],
    evaluationRubric: {
      technicalWeight: 0.40,
      architectureWeight: 0.25,
      edgeCaseWeight: 0.20,
      communicationWeight: 0.15,
      specificFocus: [
        'Speed of working implementation',
        'Accuracy without syntax or logical bugs',
        'High throughput / distributed data structures',
        'Fast proactive dry-running of code',
      ],
    },
    interviewerStyle: {
      tone: 'Fast-paced, direct, pragmatic, evaluating implementation speed',
      followUpPacing: 'rapid-fire',
      timePressure: 'strict',
      probingDepth: 'moderate',
    },
    allowedQuestionTypes: ['FAST_CODING', 'GRAPH_TRAVERSAL', 'SYSTEM_COMPONENTS', 'DRY_RUN'],
    systemPromptConfig: {
      companyContextPrompt:
        'Meta-style Software Engineering Interview: Emphasize rapid problem-solving speed, clean working implementations, and quick pivot capabilities.',
      interviewerPersonaOverride: 'sarah',
      evaluationFocusPrompt:
        'Evaluate speed of reasoning, bug-free execution, and ability to handle multiple coding/design sub-questions under time constraints.',
      expectedAnswerStyle:
        'Quick high-level outline, rapid precise coding, immediate manual verification against sample test cases.',
    },
    skillsEvaluated: ['Implementation Speed', 'Algorithms', 'System Components', 'Bug Detection'],
  },

  'amazon-behavioral': {
    id: 'amazon-behavioral',
    company: 'Amazon',
    role: 'Software Engineer',
    interviewType: 'Behavioral',
    difficulty: 'Medium',
    duration: 45,
    questionCategories: [
      'Leadership Principles',
      'STAR Framework (Situation, Task, Action, Result)',
      'Customer Obsession & Ownership',
      'Bias for Action & Deep Dives',
    ],
    evaluationRubric: {
      technicalWeight: 0.15,
      architectureWeight: 0.15,
      edgeCaseWeight: 0.20,
      communicationWeight: 0.50,
      specificFocus: [
        'Strict STAR structure adherence',
        'Quantifiable results and metrics (% improvements, latency drops, cost savings)',
        'Demonstrable Customer Obsession and Ownership',
        'Deep dive details when probed on individual choices',
      ],
    },
    interviewerStyle: {
      tone: 'Probing, inquisitively skeptical, digging into "What did YOU specifically do?"',
      followUpPacing: 'probing',
      timePressure: 'standard',
      probingDepth: 'relentless',
    },
    allowedQuestionTypes: ['STAR_BEHAVIORAL', 'LEADERSHIP_PRINCIPLE', 'PROBING_FOLLOWUP', 'CONFLICT_RESOLUTION'],
    systemPromptConfig: {
      companyContextPrompt:
        'Amazon Leadership Principles Interview: Ask deep STAR-formatted questions. Probe incessantly on individual contribution ("I" vs "We") and hard metrics.',
      interviewerPersonaOverride: 'david',
      evaluationFocusPrompt:
        'Require concrete metrics, explicit ownership, clear STAR narrative arc, and evidence of customer impact.',
      expectedAnswerStyle:
        'Situation -> Task -> Specific Individual Actions -> Quantified Impact & Lessons Learned.',
    },
    skillsEvaluated: ['Customer Obsession', 'Ownership', 'STAR Delivery', 'Bias for Action', 'Metrics & Impact'],
  },

  'stripe-backend': {
    id: 'stripe-backend',
    company: 'Stripe',
    role: 'Backend Engineer',
    interviewType: 'System Design',
    difficulty: 'Hard',
    duration: 60,
    questionCategories: [
      'API & Schema Design',
      'Idempotency & Financial Consistency',
      'Distributed Systems Reliability',
      'Backward Compatibility & Versioning',
    ],
    evaluationRubric: {
      technicalWeight: 0.35,
      architectureWeight: 0.40,
      edgeCaseWeight: 0.15,
      communicationWeight: 0.10,
      specificFocus: [
        'Clean, intuitive REST/gRPC API interface design',
        'Strict financial consistency, ACID guarantees, and idempotency keys',
        'Handling partial failure, retries, and network partitions',
        'Developer experience and clear error response structures',
      ],
    },
    interviewerStyle: {
      tone: 'Pragmatic, developer-centric, focused on production reliability and elegance',
      followUpPacing: 'conversational',
      timePressure: 'standard',
      probingDepth: 'deep',
    },
    allowedQuestionTypes: ['API_DESIGN', 'IDEMPOTENCY_PROBE', 'SYSTEM_ARCHITECTURE', 'SCHEMA_DESIGN'],
    systemPromptConfig: {
      companyContextPrompt:
        'Stripe-style Backend & API Design Interview: Focus heavily on elegant developer interfaces, robust idempotency, failure domain isolation, and data durability.',
      interviewerPersonaOverride: 'sarah',
      evaluationFocusPrompt:
        'Reward API ergonomics, explicit failure recovery mechanisms, data consistency guarantees, and rate-limiting strategies.',
      expectedAnswerStyle:
        'Requirements & API payload contracts -> Data models & state transitions -> Distributed guarantees & fault recovery.',
    },
    skillsEvaluated: ['API Design', 'System Reliability', 'Idempotency', 'Distributed DBs', 'Developer Experience'],
  },

  'generic-technical': {
    id: 'generic-technical',
    company: 'Generic',
    role: 'Software Engineer',
    interviewType: 'Technical',
    difficulty: 'Medium',
    duration: 45,
    questionCategories: [
      'Core Programming Fundamentals',
      'Data Structures & Concepts',
      'Problem Solving Methodology',
      'Code Quality & Testing',
    ],
    evaluationRubric: {
      technicalWeight: 0.35,
      architectureWeight: 0.30,
      edgeCaseWeight: 0.20,
      communicationWeight: 0.15,
      specificFocus: [
        'Clear problem explanation',
        'Sound logic and syntax correctness',
        'Basic complexity understanding',
        'Good structured response delivery',
      ],
    },
    interviewerStyle: {
      tone: 'Balanced, supportive, professional',
      followUpPacing: 'conversational',
      timePressure: 'standard',
      probingDepth: 'moderate',
    },
    allowedQuestionTypes: ['TECHNICAL_EXPLANATION', 'CODING', 'PROBLEM_SOLVING'],
    systemPromptConfig: {
      companyContextPrompt:
        'Standard Industry Technical Mock Assessment: Evaluate core technical fluency, problem solving, and structured reasoning.',
      interviewerPersonaOverride: 'sarah',
      evaluationFocusPrompt:
        'Assess technical accuracy, logical organization, and overall communication competence.',
      expectedAnswerStyle:
        'Clear definition -> Core implementation explanation -> Trade-offs & summary.',
    },
    skillsEvaluated: ['Core Technical Concepts', 'Problem Solving', 'Communication', 'Basic Complexity'],
  },

  'generic-system-design': {
    id: 'generic-system-design',
    company: 'Generic',
    role: 'Software Engineer',
    interviewType: 'System Design',
    difficulty: 'Medium',
    duration: 45,
    questionCategories: [
      'High-Level Architecture',
      'Database & Caching Strategy',
      'Scalability & Load Balancing',
      'Fault Tolerance & Monitoring',
    ],
    evaluationRubric: {
      technicalWeight: 0.30,
      architectureWeight: 0.45,
      edgeCaseWeight: 0.15,
      communicationWeight: 0.10,
      specificFocus: [
        'Functional & non-functional requirements scope',
        'Component separation (Web servers, DBs, Caches, Queues)',
        'Data model choice and scaling bottlenecks',
        'High availability and disaster recovery',
      ],
    },
    interviewerStyle: {
      tone: 'Collaborative system architect, testing breadth and component choices',
      followUpPacing: 'conversational',
      timePressure: 'standard',
      probingDepth: 'moderate',
    },
    allowedQuestionTypes: ['SYSTEM_DESIGN', 'SCALING_PROBE', 'DATABASE_MODELING'],
    systemPromptConfig: {
      companyContextPrompt:
        'Standard System Design Assessment: Evaluate end-to-end architecture breakdown, data storage strategies, and bottleneck resolution.',
      interviewerPersonaOverride: 'david',
      evaluationFocusPrompt:
        'Evaluate system decomposition, throughput estimations, caching layers, and database scaling choices.',
      expectedAnswerStyle:
        'Clarify requirements -> High-level architecture -> Deep dive components -> Bottlenecks & scaling.',
    },
    skillsEvaluated: ['System Design', 'Scalability', 'Databases', 'Caching & Load Balancing'],
  },

  'generic-behavioral': {
    id: 'generic-behavioral',
    company: 'Generic',
    role: 'Software Engineer',
    interviewType: 'Behavioral',
    difficulty: 'Medium',
    duration: 30,
    questionCategories: [
      'Teamwork & Collaboration',
      'Conflict Resolution',
      'Project Ownership & Execution',
      'Adaptability & Failure Learning',
    ],
    evaluationRubric: {
      technicalWeight: 0.10,
      architectureWeight: 0.10,
      edgeCaseWeight: 0.20,
      communicationWeight: 0.60,
      specificFocus: [
        'STAR format structure',
        'Conflict resolution maturity',
        'Personal responsibility and reflection',
        'Clear narrative delivery',
      ],
    },
    interviewerStyle: {
      tone: 'Encouraging, empathetic, listening for behavioral maturity and soft skills',
      followUpPacing: 'conversational',
      timePressure: 'relaxed',
      probingDepth: 'moderate',
    },
    allowedQuestionTypes: ['STAR_BEHAVIORAL', 'SOFT_SKILLS', 'SITUATIONAL'],
    systemPromptConfig: {
      companyContextPrompt:
        'Standard Behavioral Assessment: Evaluate soft skills, teamwork dynamics, project ownership, and interpersonal reflection.',
      interviewerPersonaOverride: 'david',
      evaluationFocusPrompt:
        'Focus on clarity of situation/action, self-awareness, and constructive team collaboration.',
      expectedAnswerStyle:
        'Context -> Personal actions -> Resolution & reflection.',
    },
    skillsEvaluated: ['Communication', 'Teamwork', 'Conflict Resolution', 'Ownership'],
  },
};

// ── Resolver Helper ───────────────────────────────────────────────────────────

export function resolveInterviewMode(input: {
  company?: string;
  role?: string;
  interviewType?: string;
  difficulty?: string;
  duration?: number;
  interviewModeId?: string;
}): InterviewMode {
  const modeId = input.interviewModeId;

  // 1. Direct preset lookup if valid preset ID
  if (modeId && INTERVIEW_MODE_PRESETS[modeId]) {
    const basePreset = INTERVIEW_MODE_PRESETS[modeId];
    return {
      ...basePreset,
      company: input.company || basePreset.company,
      role: input.role || basePreset.role,
      interviewType: input.interviewType || basePreset.interviewType,
      difficulty: input.difficulty || basePreset.difficulty,
      duration: input.duration || basePreset.duration,
    };
  }

  // 2. Lookup matching preset based on company & type
  const companyKey = (input.company || 'Generic').toLowerCase();
  const typeKey = (input.interviewType || 'Technical').toLowerCase();

  if (companyKey.includes('google')) {
    return {
      ...INTERVIEW_MODE_PRESETS['google-swe-coding'],
      role: input.role || 'Software Engineer',
      difficulty: input.difficulty || 'Hard',
      duration: input.duration || 45,
    };
  }

  if (companyKey.includes('meta')) {
    return {
      ...INTERVIEW_MODE_PRESETS['meta-swe-coding'],
      role: input.role || 'Software Engineer',
      difficulty: input.difficulty || 'Hard',
      duration: input.duration || 45,
    };
  }

  if (companyKey.includes('amazon')) {
    return {
      ...INTERVIEW_MODE_PRESETS['amazon-behavioral'],
      role: input.role || 'Software Engineer',
      difficulty: input.difficulty || 'Medium',
      duration: input.duration || 45,
    };
  }

  if (companyKey.includes('stripe')) {
    return {
      ...INTERVIEW_MODE_PRESETS['stripe-backend'],
      role: input.role || 'Backend Engineer',
      difficulty: input.difficulty || 'Hard',
      duration: input.duration || 60,
    };
  }

  // 3. Generic Fallbacks based on Interview Type
  if (typeKey.includes('system')) {
    const base = INTERVIEW_MODE_PRESETS['generic-system-design'];
    return {
      ...base,
      company: input.company || 'Generic',
      role: input.role || 'Software Engineer',
      difficulty: input.difficulty || 'Medium',
      duration: input.duration || 45,
    };
  }

  if (typeKey.includes('behavioral')) {
    const base = INTERVIEW_MODE_PRESETS['generic-behavioral'];
    return {
      ...base,
      company: input.company || 'Generic',
      role: input.role || 'Software Engineer',
      difficulty: input.difficulty || 'Medium',
      duration: input.duration || 30,
    };
  }

  // Default Generic Technical
  const base = INTERVIEW_MODE_PRESETS['generic-technical'];
  return {
    ...base,
    company: input.company || 'Generic',
    role: input.role || 'Software Engineer',
    interviewType: input.interviewType || 'Technical',
    difficulty: input.difficulty || 'Medium',
    duration: input.duration || 45,
  };
}
