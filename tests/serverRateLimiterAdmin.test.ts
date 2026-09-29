/**
 * tests/serverRateLimiterAdmin.test.ts
 *
 * Focused verification test suite for the server-side distributed rate limiter:
 * 1. Verifies that checkRateLimit queries request_logs using supabaseAdmin (bypassing RLS)
 * 2. Verifies that incoming allowed requests insert an audit record via supabaseAdmin
 * 3. Verifies that exceeding the limit via supabaseAdmin returns allowed: false and store: 'supabase'
 * 4. Verifies that if supabaseAdmin throws an exception, checkRateLimit catches it and falls back safely to in-memory store
 * 5. Verifies that if supabaseAdmin returns a database error, checkRateLimit falls back safely to in-memory store
 * 6. Verifies that in-memory fallback correctly enforces rate limits when database is unavailable
 */

const mockGte = jest.fn();
const mockEqAction = jest.fn(() => ({ gte: mockGte }));
const mockEqUser = jest.fn(() => ({ eq: mockEqAction }));
const mockSelect = jest.fn(() => ({ eq: mockEqUser }));
const mockInsert = jest.fn().mockResolvedValue({ data: null, error: null });

const mockFrom = jest.fn((table: string) => {
  return {
    select: mockSelect,
    insert: mockInsert,
  };
});

const mockAdminClient = {
  from: mockFrom,
};

jest.mock('../src/lib/server/supabaseAdmin', () => ({
  __esModule: true,
  getSupabaseAdmin: jest.fn(() => mockAdminClient),
  supabaseAdmin: mockAdminClient,
}));

import { checkRateLimit, resetRateLimiterMemoryState } from '../src/lib/services/rateLimiter.server';

describe('Server-Side Supabase Admin Rate Limiter Suite', () => {
  beforeEach(() => {
    resetRateLimiterMemoryState();
    jest.clearAllMocks();
  });

  describe('1. Server-Side Supabase Admin Client Usage', () => {
    it('queries request_logs via supabaseAdmin and logs the request when under limit', async () => {
      mockGte.mockResolvedValueOnce({ count: 1, error: null });

      const result = await checkRateLimit({
        userId: 'usr_admin_test_1',
        action: 'interview_evaluate',
        maxRequests: 5,
        windowSeconds: 60,
      });

      // Verify supabaseAdmin query chain
      expect(mockFrom).toHaveBeenCalledWith('request_logs');
      expect(mockSelect).toHaveBeenCalledWith('id', { count: 'exact', head: true });
      expect(mockEqUser).toHaveBeenCalledWith('user_id', 'usr_admin_test_1');
      expect(mockEqAction).toHaveBeenCalledWith('action', 'interview_evaluate');

      // Verify result using supabase store
      expect(result.allowed).toBe(true);
      expect(result.store).toBe('supabase');
      expect(result.limit).toBe(5);
      expect(result.remaining).toBe(3); // 5 - (1 + 1)

      // Verify async insert was triggered via supabaseAdmin
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'usr_admin_test_1',
          action: 'interview_evaluate',
        })
      );
    });

    it('rejects requests and does not insert new log when count exceeds maxRequests via supabaseAdmin', async () => {
      mockGte.mockResolvedValueOnce({ count: 5, error: null });

      const result = await checkRateLimit({
        userId: 'usr_admin_test_2',
        action: 'interview_setup',
        maxRequests: 5,
        windowSeconds: 60,
      });

      expect(mockFrom).toHaveBeenCalledWith('request_logs');
      expect(result.allowed).toBe(false);
      expect(result.store).toBe('supabase');
      expect(result.remaining).toBe(0);
      expect(result.retryAfterSeconds).toBe(60);

      // Blocked request must NOT insert into request_logs
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  describe('2. Graceful Fallback Handling on Database Failure', () => {
    it('falls back safely to in-memory store when supabaseAdmin query throws an exception', async () => {
      mockFrom.mockImplementationOnce(() => {
        throw new Error('[Supabase Admin Error] SUPABASE_SERVICE_ROLE_KEY unconfigured');
      });

      const result = await checkRateLimit({
        userId: 'usr_throw_fallback',
        action: 'interview_followup',
        maxRequests: 5,
        windowSeconds: 60,
      });

      expect(result.allowed).toBe(true);
      expect(result.store).toBe('in-memory-fallback');
      expect(result.limit).toBe(5);
    });

    it('falls back safely to in-memory store when supabaseAdmin returns a database error', async () => {
      mockGte.mockResolvedValueOnce({
        count: null,
        error: { message: 'relation "request_logs" does not exist' },
      });

      const result = await checkRateLimit({
        userId: 'usr_db_error_fallback',
        action: 'resume_analyze',
        maxRequests: 5,
        windowSeconds: 60,
      });

      expect(result.allowed).toBe(true);
      expect(result.store).toBe('in-memory-fallback');
    });

    it('correctly enforces rate limits in in-memory fallback mode across multiple requests', async () => {
      // Simulate database down permanently
      mockFrom.mockImplementation(() => {
        throw new Error('Connection refused');
      });

      const userId = 'usr_offline_repeated';
      const action = 'test_fallback_enforcement';

      // 3 allowed requests
      for (let i = 0; i < 3; i++) {
        const res = await checkRateLimit({
          userId,
          action,
          maxRequests: 3,
          windowSeconds: 60,
        });
        expect(res.allowed).toBe(true);
        expect(res.store).toBe('in-memory-fallback');
      }

      // 4th request must be rejected in in-memory fallback
      const blocked = await checkRateLimit({
        userId,
        action,
        maxRequests: 3,
        windowSeconds: 60,
      });

      expect(blocked.allowed).toBe(false);
      expect(blocked.store).toBe('in-memory-fallback');
      expect(blocked.remaining).toBe(0);
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    });
  });
});
