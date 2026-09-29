/**
 * tests/interviewSetupRateLimit.test.ts
 *
 * Focused verification test:
 * Proves that POST /api/interview/setup enforces rate limiting via checkRateLimit,
 * rejecting requests beyond the configured limit (10 requests/minute) with HTTP 429.
 */

const mockSupabaseClient = {
  auth: {
    getUser: jest.fn(async (token: string) => {
      if (token === 'valid_test_token') {
        return { data: { user: { id: 'usr_rate_limit_setup_test', email: 'tester@example.com' } }, error: null };
      }
      return { data: { user: null }, error: new Error('Invalid token') };
    }),
  },
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    eq: jest.fn(() => ({
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      gte: jest.fn().mockResolvedValue({ data: [], count: 0, error: null }),
    })),
    gte: jest.fn().mockResolvedValue({ data: [], count: 0, error: null }),
  })),
};

jest.mock('../src/lib/supabase', () => ({
  __esModule: true,
  supabase: mockSupabaseClient,
  isSupabaseConfigured: true,
}));

jest.mock('../src/lib/server/supabaseAdmin', () => ({
  __esModule: true,
  getSupabaseAdmin: jest.fn(() => mockSupabaseClient),
  supabaseAdmin: mockSupabaseClient,
}));

import { POST as setupHandler } from '../app/api/interview/setup/route';
import { resetRateLimiterMemoryState } from '../src/lib/services/rateLimiter.server';

const validSetupPayload = {
  setupData: {
    company: 'Generic',
    domain: 'Computer Science',
    role: 'Software Engineer',
    experienceLevel: 'Mid-Level',
    type: 'Technical',
    difficulty: 'Medium',
    questionCount: 3,
  },
};

describe('POST /api/interview/setup Rate Limiting', () => {
  beforeEach(() => {
    resetRateLimiterMemoryState();
    jest.clearAllMocks();
  });

  it('rejects unauthenticated requests that exceed the configured limit with HTTP 429', async () => {
    const testIp = '198.51.100.42';

    const makeRequest = () =>
      new Request('http://localhost:3000/api/interview/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': testIp,
        },
        body: JSON.stringify(validSetupPayload),
      });

    // Send 10 allowed requests (maxRequests = 10)
    for (let i = 0; i < 10; i++) {
      const res = await setupHandler(makeRequest());
      expect(res.status).toBe(200);
    }

    // 11th request must be rejected with HTTP 429
    const blockedRes = await setupHandler(makeRequest());
    expect(blockedRes.status).toBe(429);

    const data = await blockedRes.json();
    expect(data.status).toBe('error');
    expect(data.message).toContain('Rate limit exceeded for interview setup');
    expect(data.message).toContain('10 requests per minute');

    // Verify rate limit headers
    expect(blockedRes.headers.get('Retry-After')).toBeDefined();
    expect(blockedRes.headers.get('X-RateLimit-Limit')).toBe('10');
    expect(blockedRes.headers.get('X-RateLimit-Remaining')).toBe('0');
  });

  it('enforces rate limiting per authenticated user ID', async () => {
    const makeAuthRequest = () =>
      new Request('http://localhost:3000/api/interview/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid_test_token',
        },
        body: JSON.stringify(validSetupPayload),
      });

    // Send 10 allowed requests
    for (let i = 0; i < 10; i++) {
      const res = await setupHandler(makeAuthRequest());
      expect(res.status).toBe(200);
    }

    // 11th request by the same authenticated user must be rejected
    const blockedRes = await setupHandler(makeAuthRequest());
    expect(blockedRes.status).toBe(429);

    const data = await blockedRes.json();
    expect(data.status).toBe('error');
    expect(data.message).toContain('Rate limit exceeded');
  });
});
