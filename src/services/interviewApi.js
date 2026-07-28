// Interview setup and questions service for InterviewIQ
import { simulateDelay } from './api';

export const INTERVIEWER_PERSONAS = {
  sarah: {
    id: 'sarah',
    name: 'Sarah Chen',
    role: 'Staff Engineer & Tech Lead',
    company: 'InterviewIQ (ex-Netflix)',
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
    company: 'InterviewIQ (ex-Stripe)',
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
    company: 'InterviewIQ Core Protocol',
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

// Database of domain-specific mock questions
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
  },
  'Artificial Intelligence': {
    technical: [
      {
        question: 'Explain the self-attention mechanism in Transformer architectures. How does it resolve sequence order details?',
        duration: 180,
        hint: 'Mention query-key-value projections, scaled dot-product attention, and positional encodings.'
      },
      {
        question: 'What is the core difference between fine-tuning a Large Language Model and applying Retrieval-Augmented Generation (RAG)?',
        duration: 150,
        hint: 'Analyze memory-weight updates, context window limitations, and latency costs.'
      },
      {
        question: 'How do you handle issues of vanishing or exploding gradients when training deep neural network architectures?',
        duration: 120,
        hint: 'Mention residual connections, batch normalization, gradient clipping, and activation functions.'
      },
      {
        question: 'Explain the difference between supervised learning, unsupervised learning, and reinforcement learning.',
        duration: 120,
        hint: 'Discuss labeled datasets, clustering algorithms, reward functions, and policy gradients.'
      }
    ]
  },
  'Data & Analytics': {
    technical: [
      {
        question: 'How would you write an optimized SQL query to perform a rolling average calculation over user activities without subqueries?',
        duration: 150,
        hint: 'Mention window functions, PARTITION BY, and ROWS BETWEEN.'
      },
      {
        question: 'What is the difference between a dimensional model (star schema) and a normalized model (snowflake schema)? When would you use each?',
        duration: 120,
        hint: 'Discuss database normalization, query join performance, and data warehousing.'
      },
      {
        question: 'How do you clean and preprocess a raw dataset containing significant levels of missing data and outliers?',
        duration: 120,
        hint: 'Mention imputation methods, z-scores, interquartile range (IQR), and scaling.'
      }
    ]
  },
  'Finance': {
    technical: [
      {
        question: 'Walk me through how you build a discounted cash flow (DCF) model and how you calculate the Weighted Average Cost of Capital (WACC).',
        duration: 180,
        hint: 'Explain free cash flows, terminal value, cost of equity (CAPM), and cost of debt.'
      },
      {
        question: 'How do the three financial statements link together? Walk me through how a $10 depreciation expense flows through them.',
        duration: 150,
        hint: 'Track changes from income statement net income, cash flow adjustments, to balance sheet assets.'
      },
      {
        question: 'Explain the capital asset pricing model (CAPM) and how we would estimate beta for a private company.',
        duration: 120,
        hint: 'Mention risk-free rate, market risk premium, and pure-play comparable public companies.'
      }
    ]
  },
  'Science & Education': {
    technical: [
      {
        question: 'How do you explain the concept of chemical equilibrium and Le Chatelier\'s principle to a class of high school students?',
        duration: 120,
        hint: 'Focus on analogies, pressure/temperature stresses, and reversible reactions.'
      },
      {
        question: 'Describe a laboratory experiment you would design to teach students about acid-base titrations. What indicators would you use?',
        duration: 150,
        hint: 'Discuss safety protocols, buret setups, phenolphthalein, and pH curves.'
      },
      {
        question: 'How do you structure a lesson plan on quadratic equations for students with diverse mathematical backgrounds?',
        duration: 120,
        hint: 'Mention differentiated learning, visual graphs, factoring, and the quadratic formula.'
      }
    ]
  },
  // Shared generic behavioral questions
  behavioral: [
    {
      question: 'Describe a situation where you had a disagreement with a team member regarding a technical implementation. How did you resolve it?',
      duration: 120,
      hint: 'Focus on communication, objective criteria, and team alignment.'
    },
    {
      question: 'Tell me about a project that failed or had a significant setback. What was your role, and what steps did you take to mitigate it?',
      duration: 150,
      hint: 'Show extreme ownership, constructive review, and prevention systems.'
    },
    {
      question: 'How do you handle scope creep and tight deadlines when working on critical product launches?',
      duration: 150,
      hint: 'Emphasize data-driven estimations, prioritization matrices, and stakeholder communication.'
    }
  ],
  // Shared generic system design questions
  'system-design': [
    {
      question: 'Design a highly available and scalable notification service capable of sending billions of push alerts daily. How do you handle delivery deduplication?',
      duration: 180,
      hint: 'Message queues (Kafka), idempotency keys, rate limiters, mail delivery providers.'
    },
    {
      question: 'Design a real-time collaborative document editor like Google Docs. How do you manage concurrent editing conflicts?',
      duration: 180,
      hint: 'Operational Transformation (OT) vs Conflict-free Replicated Data Types (CRDTs), WebSockets.'
    },
    {
      question: 'Design a distributed rate limiter middleware for a high-traffic API gateway. What algorithms would you choose?',
      duration: 180,
      hint: 'Token bucket vs leaky bucket, Redis cluster counters, sliding window logs.'
    }
  ]
};

/**
 * Returns dynamic mock questions tailored to chosen setup criteria
 * @param {string} type - Technical, Behavioral, System Design, Mixed
 * @param {string} difficulty - Easy, Medium, Hard
 * @param {string} domain - Computer Science, Finance, etc.
 * @returns {Array} List of question objects
 */
export const getQuestionsForSetup = (type = 'technical', difficulty = 'medium', domain = 'Computer Science') => {
  const normType = type.toLowerCase();
  let questions = [];

  if (normType === 'behavioral') {
    questions = [...QUESTION_DATABASE.behavioral];
  } else if (normType === 'system design' || normType === 'system-design') {
    questions = [...QUESTION_DATABASE['system-design']];
  } else if (normType === 'mixed') {
    const domainTech = QUESTION_DATABASE[domain]?.technical || QUESTION_DATABASE['Computer Science'].technical;
    questions = [
      ...domainTech.slice(0, 2),
      ...QUESTION_DATABASE.behavioral.slice(0, 1),
      ...QUESTION_DATABASE['system-design'].slice(0, 1)
    ];
  } else {
    // default to technical
    questions = QUESTION_DATABASE[domain]?.technical || QUESTION_DATABASE['Computer Science'].technical;
  }

  // Inject ID and format question strings slightly based on difficulty
  return questions.map((q, idx) => {
    let diffPrefix = '';
    if (difficulty.toLowerCase() === 'easy') {
      diffPrefix = '[Fundamentals] ';
    } else if (difficulty.toLowerCase() === 'hard') {
      diffPrefix = '[Advanced Theory] ';
    }
    
    return {
      id: `q_${normType}_${idx}`,
      question: `${diffPrefix}${q.question}`,
      duration: q.duration,
      hint: q.hint
    };
  });
};

/**
 * Async API: Fetch available interviewer personas
 * @returns {Promise<Object>}
 */
export const fetchPersonas = async () => {
  await simulateDelay(600);
  return INTERVIEWER_PERSONAS;
};

/**
 * Async API: Fetch question set based on criteria
 */
export const fetchQuestions = async (type, difficulty, domain) => {
  await simulateDelay(800);
  return getQuestionsForSetup(type, difficulty, domain);
};
