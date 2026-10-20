/**
 * tests/serverRateLimiterAdmin.test.ts
 *
 * Focused verification test suite for the server-side distributed rate limiter:
 * 1. Verifies that checkRateLimit queries request_logs using Firebase Admin Firestore
 * 2. Verifies that incoming allowed requests insert an audit record via Firebase Admin
 * 3. Verifies that exceeding the limit via Firebase Admin returns allowed: false and store: 'firebase'
 * 4. Verifies that if Firebase Admin throws an exception, checkRateLimit catches it and falls back safely to in-memory store
 * 5. Verifies that when unconfigured, checkRateLimit falls back safely to in-memory store
 * 6. Verifies that in-memory fallback correctly enforces rate limits when database is unavailable
 */

const mockAdd = jest.fn().mockResolvedValue({ id: 'log_doc_1' });
const mockGet = jest.fn().mockResolvedValue({ size: 1, docs: [] });
const mockWhereTime = jest.fn(() => ({ get: mockGet }));
const mockWhereAction = jest.fn(() => ({ where: mockWhereTime }));
const mockWhereUser = jest.fn(() => ({ where: mockWhereAction }));

const mockCollection = jest.fn((col: string) => ({
  where: mockWhereUser,
  add: mockAdd,
}));

const mockAdminDb = {
  collection: mockCollection,
};

let mockIsConfigured = true;

jest.mock('@/lib/firebase/admin', () => ({
  get isFirebaseAdminConfigured() {
    return mockIsConfigured;
  },
  getAdminFirestore: jest.fn(() => mockAdminDb),
}));

import { checkRateLimit, resetRateLimiterMemoryState } from '../src/lib/services/rateLimiter.server';

describe('Server-Side Firebase Admin Rate Limiter Suite', () => {
  beforeEach(() => {
    resetRateLimiterMemoryState();
    jest.clearAllMocks();
    mockIsConfigured = true;
  });

  describe('1. Server-Side Firebase Admin Client Usage', () => {
    it('queries request_logs via Firebase Admin and logs the request when under limit', async () => {
      mockGet.mockResolvedValueOnce({ size: 1, docs: [] });

      const result = await checkRateLimit({
        userId: 'usr_admin_test_1',
        action: 'interview_evaluate',
        maxRequests: 5,
        windowSeconds: 60,
      });

      // Verify Firestore query chain
      expect(mockCollection).toHaveBeenCalledWith('request_logs');
      expect(mockWhereUser).toHaveBeenCalledWith('user_id', '==', 'usr_admin_test_1');
      expect(mockWhereAction).toHaveBeenCalledWith('action', '==', 'interview_evaluate');

      // Verify result using firebase store
      expect(result.allowed).toBe(true);
      expect(result.store).toBe('firebase');
      expect(result.limit).toBe(5);
      expect(result.remaining).toBe(3); // 5 - (1 + 1)

      // Verify async insert was triggered via Firebase Admin
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'usr_admin_test_1',
          action: 'interview_evaluate',
        })
      );
    });

    it('rejects requests and does not insert new log when count exceeds maxRequests via Firebase Admin', async () => {
      mockGet.mockResolvedValueOnce({ size: 5, docs: [] });

      const result = await checkRateLimit({
        userId: 'usr_admin_test_2',
        action: 'interview_setup',
        maxRequests: 5,
        windowSeconds: 60,
      });

      expect(mockCollection).toHaveBeenCalledWith('request_logs');
      expect(result.allowed).toBe(false);
      expect(result.store).toBe('firebase');
      expect(result.remaining).toBe(0);
      expect(result.retryAfterSeconds).toBe(60);

      // Blocked request must NOT insert into request_logs
      expect(mockAdd).not.toHaveBeenCalled();
    });
  });

  describe('2. Graceful Fallback Handling on Database Failure', () => {
    it('falls back safely to in-memory store when Firebase Admin query throws an exception', async () => {
      mockCollection.mockImplementationOnce(() => {
        throw new Error('[Firebase Admin Error] Firestore unreachable');
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

    it('falls back safely to in-memory store when Firebase Admin is unconfigured', async () => {
      mockIsConfigured = false;

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
      mockIsConfigured = false;

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
