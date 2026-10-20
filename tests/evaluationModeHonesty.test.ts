/**
 * A configured API key must not make fabricated results look live: if every model call fails
 * (bad key, missing model, quota), the evaluation must say so.
 */


import { performInterviewEvaluation } from '../src/lib/services/interviewEvaluation.server';

const ENV_KEYS = ['AI_PROVIDER', 'GROQ_API_KEY', 'ANTHROPIC_API_KEY'] as const;
const saved: Record<string, string | undefined> = {};
const originalFetch = global.fetch;

const input = {
  setupData: { role: 'Backend Engineer', experienceLevel: 'Mid-Level', type: 'Technical', domain: 'Computer Science', difficulty: 'Medium', questionCount: 1 },
  questionsList: [{ id: 'q_1', question: 'How would you design a distributed rate limiter?' }],
  answersList: [{ answerText: 'I would use a sliding window in Redis with Lua scripts, O(log N) per check, plus a circuit breaker for outages and partitions.' }],
} as any;

beforeEach(() => {
  ENV_KEYS.forEach((k) => {
    saved[k] = process.env[k];
    delete process.env[k];
  });
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  ENV_KEYS.forEach((k) => {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  });
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe('evaluation mode honesty', () => {
  it('reports fallback (LOW confidence, capped score) when a configured provider rejects every call', async () => {
    process.env.AI_PROVIDER = 'groq';
    process.env.GROQ_API_KEY = 'gsk_invalid_key_for_test_123456';
    const fetchMock = jest.fn(
      async () =>
        new Response(JSON.stringify({ error: { message: 'model not found' } }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const report: any = await performInterviewEvaluation(input, 'user-1');

    expect(fetchMock).toHaveBeenCalled();
    expect(report.evaluationMode).toBe('fallback');
    expect(report.source).toBe('fallback');
    expect(report.suqEvaluation.source).toBe('fallback');
    expect(report.suqEvaluation.providerStatus).toBe('error');
    expect(report.suqEvaluation.confidenceLevel).toBe('LOW');
    expect(report.suqEvaluation.finalScore).toBeLessThanOrEqual(3);
    expect(report.suqEvaluation.passes.every((pass: any) => pass.fromFallback === true)).toBe(true);
  });

  it('reports fallback and unconfigured when no key exists at all', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const report: any = await performInterviewEvaluation(input, 'user-1');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(report.evaluationMode).toBe('fallback');
    expect(report.suqEvaluation.providerStatus).toBe('unconfigured');
  });
});
