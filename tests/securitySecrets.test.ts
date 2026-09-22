/**
 * tests/securitySecrets.test.ts
 *
 * Negative security tests verifying:
 * 1. Server-side credentials and service-role keys are guarded against client-side exposure.
 * 2. Unconfigured Supabase environment throws actionable errors instead of silently dropping data.
 * 3. In-memory rate limiter emits production warnings when operating without Supabase persistence.
 */

import { validateEnvironment } from '../src/lib/server/env';
import { getSupabaseAdmin } from '../src/lib/server/supabaseAdmin';
import { supabase, isSupabaseConfigured } from '../src/lib/supabase';
import { checkRateLimit, resetRateLimiterMemoryState } from '../src/lib/services/rateLimiter.server';

describe('Security & Secrets Protection Suite', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    resetRateLimiterMemoryState();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('validateEnvironment — Accidental Public Leak Detection', () => {
    it('detects when NEXT_PUBLIC_ANTHROPIC_API_KEY is erroneously set', () => {
      const customEnv = {
        ...process.env,
        NEXT_PUBLIC_ANTHROPIC_API_KEY: 'sk-ant-public-leak',
      };
      const result = validateEnvironment(customEnv);
      expect(result.isValid).toBe(false);
      expect(result.errors['NEXT_PUBLIC_ANTHROPIC_API_KEY']).toBeDefined();
      expect(result.errors['NEXT_PUBLIC_ANTHROPIC_API_KEY'][0]).toContain('CRITICAL SECURITY LEAK');
    });

    it('detects when NEXT_PUBLIC_SERVICE_ROLE_KEY is erroneously set', () => {
      const customEnv = {
        ...process.env,
        NEXT_PUBLIC_SERVICE_ROLE_KEY: 'secret-service-role-leak',
      };
      const result = validateEnvironment(customEnv);
      expect(result.isValid).toBe(false);
      expect(result.errors['NEXT_PUBLIC_SERVICE_ROLE_KEY']).toBeDefined();
      expect(result.errors['NEXT_PUBLIC_SERVICE_ROLE_KEY'][0]).toContain('CRITICAL SECURITY LEAK');
    });

    it('detects when NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY is erroneously set', () => {
      const customEnv = {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: 'secret-service-role-leak-2',
      };
      const result = validateEnvironment(customEnv);
      expect(result.isValid).toBe(false);
      expect(result.errors['NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY']).toBeDefined();
    });

    it('passes clean environment when no server credentials are leaked into NEXT_PUBLIC_ namespace', () => {
      const cleanEnv = {
        NODE_ENV: 'test',
        ANTHROPIC_API_KEY: 'sk-ant-valid-server-key',
      };
      const result = validateEnvironment(cleanEnv);
      expect(result.errors['NEXT_PUBLIC_ANTHROPIC_API_KEY']).toBeUndefined();
      expect(result.errors['NEXT_PUBLIC_SERVICE_ROLE_KEY']).toBeUndefined();
    });
  });

  describe('getSupabaseAdmin — Environment Isolation', () => {
    it('throws an error if Supabase credentials are missing on the server', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      expect(() => getSupabaseAdmin()).toThrow(/must be configured for server-side admin access/);
    });
  });

  describe('Client-Side Supabase Unconfigured Guard', () => {
    it('throws actionable configuration error when database operations are attempted on unconfigured client', () => {
      if (!isSupabaseConfigured) {
        expect(() => supabase.from('test_table')).toThrow(/Supabase is not configured/);
      } else {
        expect(typeof supabase.from).toBe('function');
      }
    });

    it('throws actionable configuration error when auth operations are attempted on unconfigured client', () => {
      if (!isSupabaseConfigured) {
        expect(() => supabase.auth.getUser()).toThrow(/Supabase is not configured/);
      } else {
        expect(typeof supabase.auth.getUser).toBe('function');
      }
    });
  });

  describe('In-Memory Rate Limiter Production Warning', () => {
    it('emits a critical error warning if running in production without Supabase persistence', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const originalNodeEnv = process.env.NODE_ENV;
      (process.env as any).NODE_ENV = 'production';

      try {
        const res = await checkRateLimit({
          userId: 'prod-test-identifier',
          action: 'test_action',
          maxRequests: 5,
          windowSeconds: 60,
        });
        expect(res.allowed).toBe(true);
        expect(res.store).toBe('in-memory-fallback');
        expect(errorSpy).toHaveBeenCalledWith(
          expect.stringContaining('[CRITICAL PRODUCTION WARNING] RateLimiter is running in in-memory fallback mode in PRODUCTION!')
        );
      } finally {
        (process.env as any).NODE_ENV = originalNodeEnv;
        errorSpy.mockRestore();
      }
    });
  });
});
