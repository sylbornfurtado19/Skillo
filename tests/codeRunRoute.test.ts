const mockGetUser = jest.fn(async (token: string) => {
  if (token === 'valid_test_token') {
    return { data: { user: { id: 'usr_code_test' } }, error: null };
  }
  return { data: { user: null }, error: new Error('Invalid token') };
});

const mockSupabase = {
  auth: { getUser: mockGetUser },
};

const mockCheckRateLimit = jest.fn(async () => ({
  allowed: true,
  limit: 5,
  remaining: 4,
  resetSeconds: 60,
  store: 'in-memory-fallback',
}));
const mockCreateRateLimitResponse = jest.fn(
  () => new Response(JSON.stringify({ message: 'Rate limit exceeded' }), { status: 429 })
);

jest.mock('@/lib/supabase', () => ({ supabase: mockSupabase }));
jest.mock('../src/lib/supabase', () => ({ supabase: mockSupabase }));
jest.mock('@/lib/services/rateLimiter.server', () => ({
  checkRateLimit: mockCheckRateLimit,
  createRateLimitResponse: mockCreateRateLimitResponse,
}));

import { POST as runCode } from '../app/api/code/run/route';

describe('POST /api/code/run', () => {
  const authHeaders = { Authorization: 'Bearer valid_test_token', 'Content-Type': 'application/json' };

  afterEach(() => {
    delete process.env.CODE_RUNNER_URL;
    mockCheckRateLimit.mockClear();
    mockCreateRateLimitResponse.mockClear();
    jest.restoreAllMocks();
  });

  // ── Validation & Limits ──────────────────────────────────────────────────────

  it('rejects an unsupported language with 422', async () => {
    const response = await runCode(new Request('http://localhost/api/code/run', {
      method: 'POST', headers: authHeaders, body: JSON.stringify({ language: 'ruby', source: 'puts 1' }),
    }));
    expect(response.status).toBe(422);
  });

  it('rejects source larger than 10 KB with 422', async () => {
    const response = await runCode(new Request('http://localhost/api/code/run', {
      method: 'POST', headers: authHeaders, body: JSON.stringify({ language: 'javascript', source: 'x'.repeat(10241) }),
    }));
    expect(response.status).toBe(422);
  });

  it('returns 501 when the code runner is not configured', async () => {
    const response = await runCode(new Request('http://localhost/api/code/run', {
      method: 'POST', headers: authHeaders, body: JSON.stringify({ language: 'javascript', source: 'console.log(1)' }),
    }));
    expect(response.status).toBe(501);
    await expect(response.json()).resolves.toEqual({ message: 'Code runner not configured' });
  });

  // ── Auth boundary ────────────────────────────────────────────────────────────

  it('returns 401 when no Authorization header is provided', async () => {
    const response = await runCode(new Request('http://localhost/api/code/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: 'javascript', source: 'console.log(1)' }),
    }));
    expect(response.status).toBe(401);
  });

  it('returns 401 when an invalid Bearer token is provided', async () => {
    const response = await runCode(new Request('http://localhost/api/code/run', {
      method: 'POST',
      headers: { Authorization: 'Bearer bad_token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: 'javascript', source: 'console.log(1)' }),
    }));
    expect(response.status).toBe(401);
  });

  // ── Rate limiting ────────────────────────────────────────────────────────────

  it('returns 429 when the rate limit is exceeded', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({
      allowed: false,
      limit: 5,
      remaining: 0,
      resetSeconds: 45,
      store: 'in-memory-fallback',
    });

    const response = await runCode(new Request('http://localhost/api/code/run', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ language: 'javascript', source: 'console.log(1)' }),
    }));

    expect(mockCreateRateLimitResponse).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(429);
  });

  // ── Malformed request body ───────────────────────────────────────────────────

  it('returns 400 when the request body is not valid JSON', async () => {
    const response = await runCode(new Request('http://localhost/api/code/run', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid_test_token', 'Content-Type': 'application/json' },
      body: '{ this is not valid json }',
    }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.message).toMatch(/invalid json/i);
  });
});