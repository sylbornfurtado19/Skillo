/**
 * Evaluate route limits for real interview volumes:
 *  - ~10 FPS telemetry is downsampled (question-balanced), not rejected
 *  - up to 20 questions (10 planned + one follow-up each) are accepted
 *  - hard ceilings and per-answer limits are still enforced
 */

const mockPerformEvaluation = jest.fn(async (input: unknown) => ({
  overallScore: 70,
  evaluationMode: 'fallback',
  selectedQuestionIndex: 0,
  _input: input,
}));

jest.mock('@/lib/server/authenticateRequest', () => ({
  authenticateRequest: async () => ({ ok: true, user: { id: 'u1', email: null, provider: 'firebase' } }),
  authFailureResponse: jest.fn(),
}));
jest.mock('@/lib/services/rateLimiter.server', () => ({
  checkRateLimit: async () => ({ allowed: true, limit: 5, remaining: 4, resetSeconds: 60, store: 'in-memory-fallback' }),
  createRateLimitResponse: jest.fn(),
}));
jest.mock('@/lib/services/reflexionService', () => ({ dispatchReflexionWorker: jest.fn() }));
jest.mock('@/lib/services/interviewEvaluation.server', () => ({
  performInterviewEvaluation: (...args: unknown[]) => mockPerformEvaluation(...(args as [unknown])),
  PROMETHEUS2_RUBRICS: { technicalAccuracy: {}, systemDesignLogic: {}, edgeCaseHandling: {}, communicationClarity: {} },
}));

import { POST } from '../app/api/interview/evaluate/route';

const setupData = { role: 'Backend Engineer', experienceLevel: 'Mid-Level', type: 'Technical', domain: 'Computer Science', difficulty: 'Medium', questionCount: 5, persona: 'sarah' };
const q = (i: number) => ({ id: `q_${i}`, question: `Question ${i}: explain a distributed systems concept.` });
const a = (i: number) => ({ answerText: `Answer ${i}: quorum reads and writes with idempotent retries.` });
const frames = (n: number, questionIds: string[]) =>
  Array.from({ length: n }, (_, i) => ({
    timestampMs: i * 100,
    pitchDegrees: 1,
    yawDegrees: 2,
    confidence: 0.9,
    questionId: questionIds[i % questionIds.length],
    questionIndex: i % questionIds.length,
  }));

async function post(body: unknown) {
  const res = await POST(
    new Request('http://localhost/api/interview/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer x' },
      body: JSON.stringify(body),
    })
  );
  return { status: res.status, json: (await res.json()) as any };
}

beforeEach(() => mockPerformEvaluation.mockClear());

describe('/api/interview/evaluate payload limits', () => {
  it('accepts a 5-question interview with 6000 gaze frames and downsamples to 1000', async () => {
    const ids = ['q_1', 'q_2', 'q_3', 'q_4', 'q_5'];
    const { status } = await post({
      setupData,
      questionsList: [1, 2, 3, 4, 5].map(q),
      answersList: [1, 2, 3, 4, 5].map(a),
      gazeFrames: frames(6000, ids),
    });
    expect(status).toBe(200);

    const input: any = mockPerformEvaluation.mock.calls[0][0];
    expect(input.gazeFrames.length).toBeLessThanOrEqual(1000);
    expect(new Set(input.gazeFrames.map((f: any) => f.questionId))).toEqual(new Set(ids));
  });

  it('downsamples every telemetry stream', async () => {
    const { status } = await post({
      setupData,
      questionsList: [q(1)],
      answersList: [a(1)],
      gazeFrames: frames(2500, ['q_1']),
      headPoseFrames: frames(2500, ['q_1']),
      affectFrames: frames(2500, ['q_1']),
      syncWindows: frames(2500, ['q_1']),
    });
    expect(status).toBe(200);
    const input: any = mockPerformEvaluation.mock.calls[0][0];
    for (const key of ['gazeFrames', 'headPoseFrames', 'affectFrames', 'syncWindows']) {
      expect(input[key].length).toBeLessThanOrEqual(1000);
      expect(input[key].length).toBeGreaterThan(0);
    }
  });

  it('still rejects an absurd telemetry volume (abuse guard)', async () => {
    const { status, json } = await post({
      setupData,
      questionsList: [q(1)],
      answersList: [a(1)],
      gazeFrames: frames(20001, ['q_1']),
    });
    expect(status).toBe(422);
    expect(Object.keys(json.errors)).toContain('gazeFrames');
  });

  it('accepts 10 planned questions plus 10 follow-ups (20 total)', async () => {
    const ids = Array.from({ length: 20 }, (_, i) => i + 1);
    const { status } = await post({
      setupData: { ...setupData, questionCount: 10 },
      questionsList: ids.map(q),
      answersList: ids.map(a),
    });
    expect(status).toBe(200);
  });

  it('rejects more than 20 questions', async () => {
    const ids = Array.from({ length: 21 }, (_, i) => i + 1);
    const { status } = await post({ setupData, questionsList: ids.map(q), answersList: ids.map(a) });
    expect(status).toBe(422);
  });

  it('still enforces the per-answer character limit', async () => {
    const { status, json } = await post({
      setupData,
      questionsList: [q(1)],
      answersList: [{ answerText: 'a'.repeat(10001) }],
    });
    expect(status).toBe(422);
    expect(JSON.stringify(json.errors)).toContain('10,000 characters limit');
  });

  it('accepts 20 speech analytics entries', async () => {
    const entry = {
      wordsPerMinute: 120, fillerCount: 1, fillerRate: 1, fillerCounts: {}, longestPauseMs: 100, averagePauseMs: 50, deliveryScore: 80,
      breakdown: {
        speed: { score: 80, explanation: 'ok' }, fillers: { score: 80, explanation: 'ok' }, pauses: { score: 80, explanation: 'ok' },
      },
    };
    const speechAnalytics = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`q_${i + 1}`, entry]));
    const ids = Array.from({ length: 20 }, (_, i) => i + 1);
    const { status } = await post({ setupData, questionsList: ids.map(q), answersList: ids.map(a), speechAnalytics });
    expect(status).toBe(200);
  });
});
