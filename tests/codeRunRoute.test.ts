const mockGetUser = jest.fn(async (token: string) => {
  if (token === 'valid_test_token') {
    return { data: { user: { id: 'usr_code_test' } }, error: null };
  }
  return { data: { user: null }, error: new Error('Invalid token') };
});

const mockSupabase = {
  auth: { getUser: mockGetUser },
};

jest.mock('@/lib/supabase', () => ({ supabase: mockSupabase }));
jest.mock('../src/lib/supabase', () => ({ supabase: mockSupabase }));
jest.mock('@/lib/services/rateLimiter.server', () => ({
  checkRateLimit: jest.fn(async () => ({ allowed: true, limit: 5, remaining: 4, resetSeconds: 60, store: 'in-memory-fallback' })),
  createRateLimitResponse: jest.fn(),
}));

import { POST as runCode } from '../app/api/code/run/route';

describe('POST /api/code/run', () => {
  const authHeaders = { Authorization: 'Bearer valid_test_token', 'Content-Type': 'application/json' };

  afterEach(() => {
    delete process.env.CODE_RUNNER_URL;
    jest.restoreAllMocks();
  });

  it('rejects an unsupported language', async () => {
    const response = await runCode(new Request('http://localhost/api/code/run', {
      method: 'POST', headers: authHeaders, body: JSON.stringify({ language: 'ruby', source: 'puts 1' }),
    }));
    expect(response.status).toBe(422);
  });

  it('rejects source larger than 10 KB', async () => {
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
});