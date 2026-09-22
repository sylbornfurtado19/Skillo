var mockFakeStore: Record<string, any> = {};

var mockFrom = jest.fn((table: string) => ({
  upsert: jest.fn(async (data: any) => {
    if (Array.isArray(data)) {
      data.forEach((item) => {
        mockFakeStore[`${table}_${item.user_id || item.id}`] = item;
      });
    } else {
      mockFakeStore[`${table}_${data.id || data.user_id}`] = data;
    }
    return { data: null, error: null };
  }),
  select: jest.fn(() => ({
    eq: jest.fn((field: string, val: string) => ({
      single: jest.fn(async () => {
        const key = `${table}_${val}`;
        return { data: mockFakeStore[key] || null, error: null };
      }),
    })),
  })),
}));

var mockAdminClient = {
  from: mockFrom,
  auth: { getUser: jest.fn(), getSession: jest.fn() },
};

jest.mock('@/lib/supabase', () => ({
  __esModule: true,
  isSupabaseConfigured: true,
  supabase: mockAdminClient,
}));

jest.mock('../src/lib/supabase', () => ({
  __esModule: true,
  isSupabaseConfigured: true,
  supabase: mockAdminClient,
}));

jest.mock('@/lib/server/supabaseAdmin', () => ({
  __esModule: true,
  getSupabaseAdmin: jest.fn(() => mockAdminClient),
  supabaseAdmin: mockAdminClient,
}));

jest.mock('../src/lib/server/supabaseAdmin', () => ({
  __esModule: true,
  getSupabaseAdmin: jest.fn(() => mockAdminClient),
  supabaseAdmin: mockAdminClient,
}));

import {
  verbalReflectionSchema,
  generateVerbalSelfReflection,
  consolidateReflexionMemory,
  formatHistoricalMemoryPrompt,
  retrievePastCritiques,
  persistSkillMemoryStore,
  retrieveSkillMemoryStore,
  dispatchReflexionWorker,
} from '../src/lib/services/reflexionService';
import type { CandidateSkillMemoryStore, VerbalReflection } from '../src/types/index';

describe('Closed-Loop Reflexion & Memory Integration (Part 3)', () => {
  describe('1. Verbal Self-Reflection (SR_t) Generation', () => {
    it('generates structured verbal critique adhering to Zod schema on low/medium scores', async () => {
      const reflection = await generateVerbalSelfReflection({
        sessionId: 'sess_101',
        question: 'Explain optimistic concurrency control vs pessimistic locking in Postgres.',
        candidateAnswer: 'I use transactions sometimes.',
        score: 45,
        role: 'Backend Engineer',
      });

      expect(reflection).toBeDefined();
      expect(reflection.sessionId).toBe('sess_101');
      expect(reflection.severity).toMatch(/HIGH|MEDIUM|LOW/);
      expect(reflection.mistakeSummary.length).toBeGreaterThanOrEqual(5);
      expect(reflection.rootCauseAnalysis.length).toBeGreaterThanOrEqual(10);
      expect(reflection.actionableRemediation.length).toBeGreaterThanOrEqual(5);

      const parsed = verbalReflectionSchema.safeParse(reflection);
      expect(parsed.success).toBe(true);
    });

    it('generates low-severity mastery trace when score exceeds 88%', async () => {
      const reflection = await generateVerbalSelfReflection({
        sessionId: 'sess_102',
        question: 'Explain distributed 2-phase commit and Raft consensus.',
        candidateAnswer: 'Detailed comprehensive answer explaining leader election and WAL logs.',
        score: 95,
        role: 'Distributed Systems Engineer',
      });

      expect(reflection.severity).toBe('LOW');
      expect(reflection.mistakeSummary).toContain('Minimal execution errors');
    });
  });

  describe('2. Dual Memory Consolidation & Proficiency Progression', () => {
    const makeReflection = (overrides?: Partial<VerbalReflection>): VerbalReflection => ({
      id: `sr_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      sessionId: 'sess_test',
      skillTag: 'Concurrency',
      timestamp: new Date().toISOString(),
      mistakeSummary: 'Failed to handle deadlocks.',
      rootCauseAnalysis: 'Missing familiarity with deadlock detection graphs.',
      actionableRemediation: 'Implement lock ordering conventions.',
      severity: 'HIGH',
      ...overrides,
    });

    it('creates initial node with NOVICE proficiency on high severity reflection', () => {
      const ref = makeReflection({ severity: 'HIGH' });
      const store = consolidateReflexionMemory('cand_001', [ref]);

      expect(store.nodes['concurrency']).toBeDefined();
      expect(store.nodes['concurrency'].proficiencyLevel).toBe('NOVICE');
      expect(store.nodes['concurrency'].attemptsCount).toBe(1);
      expect(store.nodes['concurrency'].persistentDeficiencies).toContain('Failed to handle deadlocks.');
    });

    it('progresses proficiency NOVICE -> DEVELOPING -> PROFICIENT -> MASTERED with remediation', () => {
      const userId = 'cand_002';
      let store: CandidateSkillMemoryStore | undefined;

      // Attempt 1: High severity -> NOVICE
      store = consolidateReflexionMemory(userId, [makeReflection({ severity: 'HIGH' })], store);
      expect(store.nodes['concurrency'].proficiencyLevel).toBe('NOVICE');

      // Attempt 2: Medium severity -> DEVELOPING
      store = consolidateReflexionMemory(userId, [makeReflection({ severity: 'MEDIUM' })], store);
      expect(['NOVICE', 'DEVELOPING']).toContain(store.nodes['concurrency'].proficiencyLevel);

      // Attempt 3 & 4: Low severity reflections -> PROFICIENT then MASTERED
      store = consolidateReflexionMemory(userId, [makeReflection({ severity: 'LOW' })], store);
      store = consolidateReflexionMemory(userId, [makeReflection({ severity: 'LOW' })], store);
      store = consolidateReflexionMemory(userId, [makeReflection({ severity: 'LOW' })], store);

      expect(['PROFICIENT', 'MASTERED']).toContain(store.nodes['concurrency'].proficiencyLevel);
      expect(store.nodes['concurrency'].attemptsCount).toBe(5);
    });

    it('elevates severity to HIGH when repeat mistakes occur', () => {
      const userId = 'cand_003';
      const ref1 = makeReflection({ severity: 'MEDIUM', mistakeSummary: 'Repeated cache stampede issue' });
      const ref2 = makeReflection({ severity: 'MEDIUM', mistakeSummary: 'Repeated cache stampede issue' });
      const ref3 = makeReflection({ severity: 'MEDIUM', mistakeSummary: 'Repeated cache stampede issue' });

      let store = consolidateReflexionMemory(userId, [ref1]);
      store = consolidateReflexionMemory(userId, [ref2], store);
      store = consolidateReflexionMemory(userId, [ref3], store);

      // Third reflection was created with MEDIUM, but elevated to HIGH due to repeat medium history
      expect(store.nodes['concurrency'].reflections[0].severity).toBe('HIGH');
    });

    it('updates globalReflectionSummary with node count and high-severity traces', () => {
      const store = consolidateReflexionMemory('cand_004', [
        makeReflection({ skillTag: 'Kubernetes', severity: 'HIGH' }),
        makeReflection({ skillTag: 'PostgreSQL', severity: 'MEDIUM' }),
      ]);

      expect(store.globalReflectionSummary).toContain('2 skill memory node(s)');
      expect(store.globalReflectionSummary).toContain('high-severity deficiency');
    });
  });

  describe('3. Active Context Injection & Prompt Conditioning', () => {
    it('formats prompt conditioning with exact candidate historical memory syntax', () => {
      const pastCritiques = [
        { summary: 'Under-explained concurrency locks' },
        { summary: 'Omitted boundary null-checks' },
      ];

      const prompt = formatHistoricalMemoryPrompt(pastCritiques);
      expect(prompt).toContain('Candidate Historical Memory: Under-explained concurrency locks; Omitted boundary null-checks.');
      expect(prompt).toContain('Adaptively probe these specific weak points during this session.');
    });

    it('returns empty string when past critiques array is empty', () => {
      expect(formatHistoricalMemoryPrompt([])).toBe('');
    });

    it('wraps historical prompt with strict candidate_historical_memory delimiter tags', () => {
      const pastCritiques = [
        { summary: 'Under-explained concurrency locks', proficiencyLevel: 'DEVELOPING' as const },
      ];
      const prompt = formatHistoricalMemoryPrompt(pastCritiques);
      expect(prompt).toContain('<candidate_historical_memory>');
      expect(prompt).toContain('- Prior Weakness: Under-explained concurrency locks (Proficiency: DEVELOPING)');
      expect(prompt).toContain('- Core Instruction: Actively probe edge cases and challenge assumptions around these specific weak points.');
      expect(prompt).toContain('</candidate_historical_memory>');
    });
  });

  describe('4. Supabase SkillMemoryNodes JSONB Persistence & Retrieval', () => {
    it('persists and retrieves CandidateSkillMemoryStore with SkillMemoryNodes JSONB', async () => {
      const userId = 'user_reflexion_test_1';
      const store = consolidateReflexionMemory(userId, [
        {
          id: 'sr_1',
          sessionId: 'sess_1',
          skillTag: 'Distributed Systems',
          timestamp: new Date().toISOString(),
          mistakeSummary: 'Omitted consensus quorum numbers in Raft explanation.',
          rootCauseAnalysis: 'Unclear distinction between majority and supermajority quorums.',
          actionableRemediation: 'Review Raft leader election quorum calculations.',
          severity: 'HIGH',
        },
      ]);

      await persistSkillMemoryStore(userId, store);

      const retrievedStore = await retrieveSkillMemoryStore(userId);
      expect(retrievedStore).toBeDefined();
      expect(retrievedStore?.userId).toBe(userId);
      expect(retrievedStore?.nodes['distributed_systems']).toBeDefined();

      const critiques = await retrievePastCritiques(userId);
      expect(critiques.length).toBeGreaterThanOrEqual(1);
      expect(critiques[0].summary).toContain('quorum');
    });
  });

  describe('5. Asynchronous Non-Blocking Worker Dispatch', () => {
    it('executes dispatchReflexionWorker without throwing or blocking caller', () => {
      expect(() => {
        dispatchReflexionWorker({
          userId: 'user_async_test',
          sessionId: 'sess_async',
          question: 'What is tail latency?',
          candidateAnswer: 'It is the p99 latency of system responses.',
          overallScore: 78,
          role: 'Backend Engineer',
        });
      }).not.toThrow();
    });
  });
});
