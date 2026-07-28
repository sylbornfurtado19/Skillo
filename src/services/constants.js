export const INTERVIEWER_PERSONAS = {
  sarah: {
    id: 'sarah',
    name: 'Sarah Chen',
    role: 'Staff Engineer & Tech Lead',
    company: 'Skillo (ex-Netflix)',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=120',
    description: 'Encouraging but detailed. Focuses heavily on clean architecture, performance, code readability, and deep problem-solving skills.',
    accentColor: 'text-indigo-400',
    borderColor: 'border-indigo-500/30',
    bgColor: 'bg-indigo-950/20',
    glowColor: 'glow-primary',
    voicePitch: 1.0,
    voiceRate: 1.0,
  },
  david: {
    id: 'david',
    name: 'David Vance',
    role: 'Engineering Manager',
    company: 'Skillo (ex-Stripe)',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=120',
    description: 'Pragmatic, product-minded engineering manager. Focuses on execution, scope management, scalability, trade-offs, and communication.',
    accentColor: 'text-violet-400',
    borderColor: 'border-violet-500/30',
    bgColor: 'bg-violet-950/20',
    glowColor: 'glow-secondary',
    voicePitch: 0.9,
    voiceRate: 0.95,
  },
  techbot: {
    id: 'techbot',
    name: 'TechBot v2.4',
    role: 'Autonomous AI Assessor',
    company: 'Skillo Core Protocol',
    avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=120',
    description: 'Strict, analytical, and highly structured. Evaluates edge cases, algorithmic complexities, and rigorous logic without emotional bias.',
    accentColor: 'text-cyan-400',
    borderColor: 'border-cyan-500/30',
    bgColor: 'bg-cyan-950/20',
    glowColor: 'glow-accent',
    voicePitch: 1.2,
    voiceRate: 1.1,
  }
};

export const CAREER_DOMAINS = {
  'Computer Science': [
    'Software Engineer',
    'Frontend Developer',
    'Backend Developer',
    'Full Stack Developer',
    'Mobile App Developer',
    'DevOps Engineer',
    'Cloud Engineer',
    'Cybersecurity Analyst',
    'Network Engineer',
    'Database Engineer',
  ],
  'Artificial Intelligence': [
    'AI Engineer',
    'Machine Learning Engineer',
    'Deep Learning Engineer',
    'NLP Engineer',
    'Computer Vision Engineer',
    'Prompt Engineer',
  ],
  'Data & Analytics': [
    'Data Analyst',
    'Data Scientist',
    'Business Intelligence Analyst',
    'Data Engineer',
  ],
  'Finance': [
    'Financial Analyst',
    'Investment Analyst',
    'Equity Research Analyst',
    'Financial Planning Analyst',
  ],
  'Science & Education': [
    'Chemistry Teacher',
    'Physics Teacher',
    'Biology Teacher',
    'Mathematics Teacher',
    'Computer Science Teacher',
  ],
};

const QUESTION_DATABASE = {
  'Computer Science': {
    technical: [
      {
        question: 'Explain React’s reconciliation algorithm and virtual DOM diffing. Why are keys important when rendering dynamic arrays?',
        duration: 120,
        hint: 'Mention time complexity, element identity, and sibling reordering.'
      },
      {
        question: 'What is the event loop in JavaScript? How does the browser handle microtasks (Promises) vs macrotasks (setTimeout)?',
        duration: 150,
        hint: 'Talk about the call stack, task queues, and render cycles.'
      },
      {
        question: 'Describe how closures work in JavaScript and how they can potentially cause memory leaks in modern single-page apps.',
        duration: 120,
        hint: 'Discuss lexical scoping, garbage collection references, and clearing intervals.'
      },
      {
        question: 'How would you optimize the Core Web Vitals (specifically LCP, INP, and CLS) for a large enterprise dashboard application?',
        duration: 180,
        hint: 'Mention code splitting, dynamic imports, font swaps, and element sizing.'
      },
      {
        question: 'What are the main architectural differences between SQL and NoSQL databases? In what scenarios would you choose one over the other?',
        duration: 150,
        hint: 'Discuss transactions, ACID compliance, horizontal scaling, and document structures.'
      }
    ]
  }
};

export const getQuestionsForSetup = (setupData) => {
  const domain = setupData.domain || 'Computer Science';
  const domainQuestions = QUESTION_DATABASE[domain]?.technical || QUESTION_DATABASE['Computer Science'].technical;
  const count = setupData.questionCount || 5;

  return domainQuestions.slice(0, count).map((q, idx) => ({
    id: `q_${idx + 1}`,
    ...q
  }));
};

export const generateFeedbackReport = (setupData, questionsList, answersList) => {
  const scores = {
    technicalAccuracy: 85,
    communication: 88,
    depth: 82,
    timeManagement: 90,
  };

  const overallScore = 86;

  const questionFeedbacks = questionsList.map((q, index) => {
    const userAnswer = answersList[index] || "No answer provided.";
    return {
      id: q.id,
      question: q.question,
      userAnswer,
      score: 85,
      idealConcepts: q.hint || "Core concepts related to the topic.",
      feedback: "Great structural clarity and technical presentation.",
      suggestions: [
        "Include more concrete examples of how you applied this in a past production system."
      ],
      strengths: "Detailed response structure, use of industry terminology."
    };
  });

  return {
    overallScore,
    categories: scores,
    breakdown: questionFeedbacks,
    interviewerComments: `You performed well during this ${setupData.type || 'Mock'} interview.`,
    personaId: setupData.persona || 'sarah',
    setupData
  };
};

export const submitInterviewAnswers = async (setupData, questionsList, answersList) => {
  return generateFeedbackReport(setupData, questionsList, answersList);
};

export const simulateResumeAnalysis = (fileName, jobTitle, jobDesc) => {
  return {
    matchPercentage: 82,
    fileName,
    skillsMatched: ['React', 'JavaScript', 'Tailwind', 'Git'],
    skillsMissing: ['Next.js', 'Docker'],
    summary: `Your resume demonstrates a strong match for the ${jobTitle || 'Software Engineer'} role.`,
    scoreBreakdown: {
      formatting: 90,
      skills: 84,
      experienceRelevance: 80,
      impactMetrics: 75
    },
    recommendations: [
      "Quantify accomplishments with metrics."
    ]
  };
};
