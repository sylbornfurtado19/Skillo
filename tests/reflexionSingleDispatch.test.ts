/**
 * tests/reflexionSingleDispatch.test.ts
 *
 * Focused verification suite:
 * Proves that an interview evaluation triggers exactly ONE Reflexion generation/persistence call,
 * with dispatchReflexionWorker as the single entry point.
 */

var mockFakeStore: Record<string, any> = {};
var mockProfileUpsert = jest.fn(async (data: any) => {
  mockFakeStore[`profiles_${data.id || data.user_id}`] = data;
  return { data: null, error: null };
});

var mockFrom = jest.fn((table: string) => {
  if (table === 'profiles') {
    return {
      upsert: mockProfileUpsert,
      select: jest.fn(() => ({
        eq: jest.fn((field: string, val: string) => ({
          single: jest.fn(async () => {
            const key = `profiles_${val}`;
            return { data: mockFakeStore[key] || null, error: null };
          }),
        })),
      })),
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
  }
  return {
    upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
        gte: jest.fn().mockResolvedValue({ data: [], count: 0, error: null }),
      })),
    })),
    insert: jest.fn().mockResolvedValue({ data: null, error: null }),
  };
});

var mockAdminClient = {
  from: mockFrom,
  auth: {
    getUser: jest.fn(async (token: string) => {
      if (token === 'valid_test_token') {
        return { data: { user: { id: 'usr_single_reflexion_test', email: 'tester@example.com' } }, error: null };
      }
      return { data: { user: null }, error: new Error('Invalid token') };
    }),
    getSession: jest.fn(),
  },
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

import * as reflexionService from '../src/lib/services/reflexionService';
import { performInterviewEvaluation } from '../src/lib/services/interviewEvaluation.server';
import { POST as evaluateHandler } from '../app/api/interview/evaluate/route';

const AUTH_HEADER = { Authorization: 'Bearer valid_test_token' };

describe('Single Reflexion Worker Execution Suite', () => {
  beforeEach(() => {
    mockFakeStore = {};
    mockProfileUpsert.mockClear();
    jest.clearAllMocks();
  });

  it('1. performInterviewEvaluation does NOT persist or generate reflections directly', async () => {
    const input = {
      setupData: { role: 'Backend Engineer', experienceLevel: 'Senior', type: 'Technical' },
      questionsList: [{ id: 'q1', question: 'Explain two-phase commit protocol.' }],
      answersList: ['Two-phase commit coordinates commit or abort across all participating resource managers via prepare and commit phases.'],
    };

    const report = await performInterviewEvaluation(input, 'user_test_isolated');
    expect(report).toBeDefined();
    expect(report.overallScore).toBeGreaterThan(0);

    // Wait for any unawaited async IIFEs that might have been scheduled
    await new Promise((resolve) => setTimeout(resolve, 60));

    // performInterviewEvaluation must not upsert into profiles (no background reflection worker)
    expect(mockProfileUpsert).toHaveBeenCalledTimes(0);
    expect(mockFakeStore['profiles_user_test_isolated']).toBeUndefined();
  });

  it('2. POST /api/interview/evaluate dispatches dispatchReflexionWorker exactly once', async () => {
    const dispatchSpy = jest.spyOn(reflexionService, 'dispatchReflexionWorker');

    const req = new Request('http://localhost:3000/api/interview/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
      body: JSON.stringify({
        setupData: { role: 'Distributed Systems Engineer', difficulty: 'Senior', type: 'Technical' },
        questionsList: [{ question: 'How do you prevent split-brain in Raft consensus clusters?' }],
        answersList: ['By requiring an odd node count and requiring quorum majority before electing a leader or committing log entries.'],
      }),
    });

    const res = await evaluateHandler(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.status).toBe('success');
    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'usr_single_reflexion_test',
        role: 'Distributed Systems Engineer',
      })
    );

    dispatchSpy.mockRestore();
  });

  it('3. One interview evaluation triggers exactly ONE Reflexion persistence call via the worker', async () => {
    const req = new Request('http://localhost:3000/api/interview/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
      body: JSON.stringify({
        setupData: { role: 'Full Stack Engineer', difficulty: 'Mid-Level', type: 'Technical' },
        questionsList: [{ question: 'What is hydration in React SSR?' }],
        answersList: ['Hydration attaches event listeners to pre-rendered server HTML to make the DOM interactive.'],
      }),
    });

    const res = await evaluateHandler(req);
    expect(res.status).toBe(200);

    // Drain microtasks to allow the single background worker to run and persist
    await new Promise((resolve) => setTimeout(resolve, 80));

    // Verify exactly ONE profiles upsert occurred for this evaluation
    expect(mockProfileUpsert).toHaveBeenCalledTimes(1);
    const persisted = mockFakeStore['profiles_usr_single_reflexion_test'];
    expect(persisted).toBeDefined();
    expect(persisted.skill_memory_store).toBeDefined();
    expect(persisted.skill_memory_nodes).toBeDefined();
  });
});
