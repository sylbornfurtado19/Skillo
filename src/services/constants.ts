import { supabase } from '../lib/supabase';

export interface InterviewerPersona {
  id: string;
  name: string;
  role: string;
  company: string;
  avatar: string;
  description: string;
  accentColor: string;
  borderColor: string;
  bgColor: string;
  glowColor: string;
  voicePitch: number;
  voiceRate: number;
}

export const INTERVIEWER_PERSONAS: Record<string, InterviewerPersona> = {
  sarah: {
    id: 'sarah',
    name: 'Sarah Chen',
    role: 'Staff Engineer & Tech Lead',
    company: 'Skillo (ex-Netflix)',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=120',
    description:
      'Encouraging but detailed. Focuses heavily on clean architecture, performance, code readability, and deep problem-solving skills.',
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
    description:
      'Pragmatic, product-minded engineering manager. Focuses on execution, scope management, scalability, trade-offs, and communication.',
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
    description:
      'Strict, analytical, and highly structured. Evaluates edge cases, algorithmic complexities, and rigorous logic without emotional bias.',
    accentColor: 'text-cyan-400',
    borderColor: 'border-cyan-500/30',
    bgColor: 'bg-cyan-950/20',
    glowColor: 'glow-accent',
    voicePitch: 1.2,
    voiceRate: 1.1,
  },
};

export const CAREER_DOMAINS: Record<string, string[]> = {
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
  Finance: [
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

interface QuestionItem {
  id?: string;
  question: string;
  duration: number;
  hint: string;
}

const QUESTION_DATABASE: Record<string, Record<string, QuestionItem[]>> = {
  'Computer Science': {
    technical: [
      {
        question:
          'Explain React’s reconciliation algorithm and virtual DOM diffing. Why are keys important when rendering dynamic arrays?',
        duration: 120,
        hint: 'Mention time complexity, element identity, and sibling reordering.',
      },
      {
        question:
          'What is the event loop in JavaScript? How does the browser handle microtasks (Promises) vs macrotasks (setTimeout)?',
        duration: 150,
        hint: 'Talk about the call stack, task queues, and render cycles.',
      },
      {
        question:
          'Describe how closures work in JavaScript and how they can potentially cause memory leaks in modern single-page apps.',
        duration: 120,
        hint: 'Discuss lexical scoping, garbage collection references, and clearing intervals.',
      },
      {
        question:
          'How would you optimize the Core Web Vitals (specifically LCP, INP, and CLS) for a large enterprise dashboard application?',
        duration: 180,
        hint: 'Mention code splitting, dynamic imports, font swaps, and element sizing.',
      },
      {
        question:
          'What are the main architectural differences between SQL and NoSQL databases? In what scenarios would you choose one over the other?',
        duration: 150,
        hint: 'Discuss transactions, ACID compliance, horizontal scaling, and document structures.',
      },
    ],
  },
};

export const PRESET_QUESTION_POOLS: Record<string, QuestionItem[]> = {
  Google: [
    {
      question:
        '[Google Coding] Design an in-memory caching data structure that supports O(1) time complexity for get and put, with dynamic LRU eviction and memory footprint bounds.',
      duration: 180,
      hint: 'Combine a doubly-linked list with a hash map. Discuss pointer overhead and thread-safety.',
    },
    {
      question:
        '[Google Algorithms] Given a massive stream of integers, how would you find the top-K most frequent elements in real-time with sub-linear space?',
      duration: 180,
      hint: 'Consider Min-Heap vs Count-Min Sketch. Analyze time complexity for update and query.',
    },
    {
      question:
        '[Google Systems] Follow-Up Complexity: What happens if your input graph exceeds machine memory limit? How would you compute shortest paths using external memory or map-reduce?',
      duration: 210,
      hint: 'Mention Pregel/GraphX BSP model, partitioning strategies, and disk IO bottlenecks.',
    },
    {
      question:
        '[Google Coding] Write an algorithm to serialize and deserialize an N-ary tree cleanly, minimizing output string size.',
      duration: 150,
      hint: 'Use DFS pre-order traversal with child counts or sentinel markers.',
    },
    {
      question:
        '[Google Optimization] How would you detect cycles in a concurrent dependency graph where nodes are dynamically registered and deregistered?',
      duration: 180,
      hint: 'Discuss Tarjan’s SCC vs Kahn’s algorithm with read-write locks or lock-free atomics.',
    },
  ],

  Meta: [
    {
      question:
        '[Meta Fast Coding] Implement a fast function to calculate the lowest common ancestor (LCA) of two nodes in a binary tree with parent pointers in O(1) auxiliary space.',
      duration: 150,
      hint: 'Calculate node depths first, align depth pointers, then move upward in parallel.',
    },
    {
      question:
        '[Meta Scale] How would you design a real-time online status indicator (Active Now / Last Seen) for 3 Billion daily active users?',
      duration: 180,
      hint: 'Discuss heartbeat polling, Redis bitmaps/hyperloglog, gateway websockets, and batch flushing.',
    },
    {
      question:
        '[Meta Coding] Given a matrix of 0s and 1s representing a social network graph, find the largest connected island of mutual connections.',
      duration: 150,
      hint: 'Use BFS/DFS with in-place matrix mutating to avoid extra space visited sets.',
    },
    {
      question:
        '[Meta Systems] How do you handle rapid burst spikes during global live events without dropping critical user posts or notifications?',
      duration: 180,
      hint: 'Talk about leaky bucket rate limiting, push vs pull feed architecture, and dynamic queue shedding.',
    },
  ],

  Amazon: [
    {
      question:
        '[Amazon Leadership - Customer Obsession] Describe a high-stakes scenario where you advocated for customer experience over short-term engineering convenience. What tradeoffs did you make?',
      duration: 180,
      hint: 'Follow strict STAR framework. Quantify impact on customer latency, error rates, or NPS metrics.',
    },
    {
      question:
        '[Amazon Leadership - Ownership] Tell me about a time when a critical project failed or suffered an outage. What was your personal role, and how did you own the remediation?',
      duration: 180,
      hint: 'Detail your exact individual actions ("I" vs "We"), root cause COE analysis, and preventive mechanisms.',
    },
    {
      question:
        '[Amazon Leadership - Bias for Action] Give an example of when you had to make a high-concurrency technical decision with incomplete data. How did you assess risk?',
      duration: 180,
      hint: 'Focus on 2-way vs 1-way door decisions, rollback plans, and rapid iterative deployment.',
    },
    {
      question:
        '[Amazon Leadership - Deep Dive] Walk through the most complex systemic bug you personally diagnosed in production. How did you trace telemetry to find the root cause?',
      duration: 210,
      hint: 'Describe log correlation, flamegraphs, memory dumps, or packet captures.',
    },
  ],

  Stripe: [
    {
      question:
        '[Stripe API & Architecture] Design an idempotent Payment Intent API that prevents double-charging customers even during severe client retries and network timeouts.',
      duration: 210,
      hint: 'Discuss Idempotency-Key headers, DB row locking/unique constraints, state machines (PENDING/SUCCEEDED), and exponential backoff.',
    },
    {
      question:
        '[Stripe Reliability] How do you guarantee exact-once event delivery semantics in a distributed webhook delivery engine serving millions of merchant webhooks?',
      duration: 210,
      hint: 'Explain dead-letter queues, message deduplication IDs, backoff policies, and transactional outbox patterns.',
    },
    {
      question:
        '[Stripe Schema & Versioning] How would you safely perform a zero-downtime database schema migration (removing a required column used by external REST clients)?',
      duration: 180,
      hint: 'Follow Expand & Contract migration pattern: dual-writing, feature flags, version headers, deprecation timelines.',
    },
    {
      question:
        '[Stripe Developer Experience] How do you construct clear, actionable JSON API error responses with granular field-level validation and rate-limit headers?',
      duration: 150,
      hint: 'Discuss RFC 7807 Problem Details, error codes, doc links, and 429 Retry-After headers.',
    },
  ],
};

export const getQuestionsForSetup = (setupData: {
  company?: string;
  domain?: string;
  interviewType?: string;
  questionCount?: number;
  [key: string]: unknown;
}) => {
  const company = setupData.company || 'Generic';
  const domain = setupData.domain || 'Computer Science';
  const count = setupData.questionCount || 5;

  let pool: QuestionItem[] = [];

  if (PRESET_QUESTION_POOLS[company]) {
    pool = PRESET_QUESTION_POOLS[company];
  } else {
    pool = QUESTION_DATABASE[domain]?.technical || QUESTION_DATABASE['Computer Science'].technical;
  }

  // Ensure we return requested count
  const result: QuestionItem[] = [];
  for (let i = 0; i < count; i++) {
    const item = pool[i % pool.length];
    result.push({
      id: `q_${i + 1}`,
      question: item.question,
      duration: item.duration,
      hint: item.hint,
    });
  }

  return result;
};

export const submitInterviewAnswers = async (
  setupData: Record<string, any>,
  questionsList: Array<{ id: string; question: string; hint?: string }>,
  answersList: Array<string | { answerText?: string }>,
  showToast?: (message: string, variant?: 'info' | 'success' | 'error') => void
) => {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  const response = await fetch('/api/interview/evaluate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      setupData,
      questionsList,
      answersList,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message = errorBody.message || `Evaluation request failed with status ${response.status}`;
    if (showToast) {
      showToast(message, 'error');
    }
    throw new Error(message);
  }

  const result = await response.json();
  return result.data;
};

export const simulateResumeAnalysis = async (
  fileName: string,
  jobTitle: string,
  jobDescription: string,
  showToast?: (message: string, variant?: 'info' | 'success' | 'error') => void
) => {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  const response = await fetch('/api/resume/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      fileName,
      jobTitle,
      jobDescription,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message = errorBody.message || `Analysis request failed with status ${response.status}`;
    if (showToast) {
      showToast(message, 'error');
    }
    throw new Error(message);
  }

  const result = await response.json();
  return result.data;
};
