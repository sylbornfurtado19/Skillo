/**
 * Client side of the evaluation request (src/services/constants.ts submitInterviewAnswers):
 * payload shaping, typed errors, honest failure messages, and the follow-up id helpers.
 */

jest.mock('../src/services/auth', () => ({ getAuthToken: async () => 'test-token' }));

import {
  submitInterviewAnswers,
  EvaluationRequestError,
  describeEvaluationFailure,
} from '../src/services/constants';
import { buildFollowUpQuestion, resolveQuestionId } from '../src/components/interview/session/sessionHelpers';

type FetchMock = jest.Mock<Promise<Response>, [string, RequestInit]>;
const originalFetch = global.fetch;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const setup = { role: 'Backend Engineer' };
const questions = [{ id: 'q_1', question: 'Explain CAP.' }, { id: 'q_2', question: 'Explain Raft.' }];
const answers = ['CAP is a trade-off.', 'Raft is a consensus protocol.'];
const frames = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ timestampMs: i, questionId: i % 2 ? 'q_1' : 'q_2', pitchDegrees: 0, yawDegrees: 0 }));

afterEach(() => {
  global.fetch = originalFetch;
});

describe('submitInterviewAnswers payload shaping', () => {
  it('downsamples telemetry, clips long text and sends a Bearer token', async () => {
    const fetchMock: FetchMock = jest.fn(async (_url: string, _init: RequestInit) =>
      jsonResponse(200, { data: { overallScore: 80 } })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await submitInterviewAnswers(
      setup,
      [{ id: 'q_1', question: 'Q'.repeat(1500), hint: 'h'.repeat(900) }, questions[1]],
      ['A'.repeat(12000), answers[1]],
      undefined,
      frames(5000)
    );

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/interview/evaluate');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-token');
    const body = JSON.parse(init.body as string);
    expect(body.gazeFrames.length).toBeLessThanOrEqual(1000);
    expect(body.questionsList[0].question).toHaveLength(1000);
    expect(body.questionsList[0].hint).toHaveLength(500);
    expect(body.answersList[0]).toHaveLength(10000);
  });
});

describe('submitInterviewAnswers failure handling', () => {
  it('retries once with only questions and answers when optional payload is rejected (422)', async () => {
    const fetchMock: FetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(422, { message: 'Validation failed' }))
      .mockResolvedValueOnce(jsonResponse(200, { data: { overallScore: 71 } }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await submitInterviewAnswers(setup, questions, answers, undefined, frames(10));
    expect(result).toEqual({ overallScore: 71 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(Object.keys(retryBody).sort()).toEqual(['answersList', 'questionsList', 'setupData']);
  });

  it('does not retry on 401 and raises an auth error', async () => {
    const fetchMock: FetchMock = jest.fn(async (_url: string, _init: RequestInit) =>
      jsonResponse(401, { message: 'Authentication required.' })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(submitInterviewAnswers(setup, questions, answers, undefined, frames(10))).rejects.toMatchObject({
      name: 'EvaluationRequestError',
      kind: 'auth',
      status: 401,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('classifies 429, 5xx and network failures', async () => {
    global.fetch = jest.fn(async () => jsonResponse(429, { message: 'slow down' })) as unknown as typeof fetch;
    await expect(submitInterviewAnswers(setup, questions, answers)).rejects.toMatchObject({ kind: 'rate-limit' });

    global.fetch = jest.fn(async () => jsonResponse(500, { message: 'boom' })) as unknown as typeof fetch;
    await expect(submitInterviewAnswers(setup, questions, answers)).rejects.toMatchObject({ kind: 'server' });

    global.fetch = jest.fn(async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    await expect(submitInterviewAnswers(setup, questions, answers)).rejects.toMatchObject({ kind: 'network' });
  });
});

describe('describeEvaluationFailure', () => {
  it('gives distinct, honest messages per failure kind', () => {
    const kinds = ['auth', 'rate-limit', 'validation', 'server', 'network'] as const;
    const toasts = kinds.map((k) => describeEvaluationFailure(new EvaluationRequestError('x', k)).toast);
    expect(new Set(toasts).size).toBe(kinds.length);
    toasts.forEach((t) => expect(t).toMatch(/offline estimate/i));
    // Only a real network failure may claim the service could not be reached.
    expect(describeEvaluationFailure(new EvaluationRequestError('x', 'validation')).toast).not.toMatch(/reach|timeout/i);
    expect(describeEvaluationFailure(new Error('anything')).toast).toMatch(/reach/i);
  });
});

describe('follow-up question ids', () => {
  it('derives a unique id from the parent so later questions keep theirs', () => {
    const planned = [
      { id: 'q_1', question: 'One' },
      { id: 'q_2', question: 'Two' },
      { id: 'q_3', question: 'Three' },
    ];
    const followUp = buildFollowUpQuestion({ id: 'q_1', duration: 90 }, 'Why does that matter at scale?');
    const list = [planned[0], followUp, planned[1], planned[2]];

    const ids = list.map((item, idx) => resolveQuestionId(item, idx));
    expect(ids).toEqual(['q_1', 'q_1_fu', 'q_2', 'q_3']);
    expect(new Set(ids).size).toBe(ids.length);
    expect(followUp.duration).toBe(90);
  });

  it('clips follow-up text and ids to server limits', () => {
    const followUp = buildFollowUpQuestion({ id: 'x'.repeat(100) }, 'y'.repeat(2000));
    expect(followUp.id!.length).toBeLessThanOrEqual(64);
    expect(followUp.question.length).toBe(1000);
  });

  it('falls back to a positional id for plain string questions', () => {
    expect(resolveQuestionId('Plain text question', 2)).toBe('q_3');
  });
});
