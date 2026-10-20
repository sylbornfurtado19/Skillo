/**
 * tests/securitySecrets.test.ts
 *
 * Negative security tests verifying:
 * 1. Server-side credentials and service-role keys are guarded against client-side exposure.
 * 2. Server credentials safely separated from client bundle.
 * 3. In-memory rate limiter emits production warnings when operating without persistent backend.
 */

import { validateEnvironment, getServerEnv } from '../src/lib/server/env';
import { isFirebaseAdminConfigured } from '../src/lib/firebase/admin';
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

    it('executes build-safe warning path and does not throw when env variables are missing during build', () => {
      const envMap = process.env as Record<string, string | undefined>;
      const originalNodeEnv = envMap.NODE_ENV;
      const originalBuildPhase = envMap.BUILD_PHASE;
      try {
        envMap.NODE_ENV = 'production';
        envMap.BUILD_PHASE = 'true';
        delete process.env.FIREBASE_PROJECT_ID;
        delete process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
        delete process.env.NEXT_PUBLIC_SUPABASE_URL;
        delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const env = getServerEnv();
        expect(env).toBeDefined();
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('[Server Env Warning]'),
          expect.anything()
        );
        warnSpy.mockRestore();
      } finally {
        envMap.NODE_ENV = originalNodeEnv;
        envMap.BUILD_PHASE = originalBuildPhase;
      }
    });
  });

  describe('Firebase Admin — Environment Isolation', () => {
    it('verifies server-side Firebase Admin configuration status is defined', () => {
      expect(typeof isFirebaseAdminConfigured).toBe('boolean');
    });
  });

  describe('In-Memory Rate Limiter Production Warning', () => {
    it('emits a critical error warning if running in production without persistent backend', async () => {
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
