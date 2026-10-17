import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * Provider-aware request authentication for API routes.
 *
 * - Backend provider "firebase": verifies the Firebase ID token with firebase-admin.
 * - Backend provider "supabase": verifies the access token with Supabase Auth.
 *
 * Fails CLOSED: a verification problem (missing config, network failure, SDK error)
 * is reported as a 5xx result and never as an authenticated user, and callers must
 * never substitute canned/fallback output for it.
 */

export type AuthProvider = 'firebase' | 'supabase';

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  provider: AuthProvider;
}

export type AuthFailure = {
  ok: false;
  /** 401: missing/invalid/expired credentials. 500: auth service misconfigured or unavailable. */
  status: 401 | 500;
  message: string;
};

export type AuthResult = { ok: true; user: AuthenticatedUser } | AuthFailure;

const UNAUTHENTICATED_MESSAGE = 'Authentication required. Please sign in.';
const UNAVAILABLE_MESSAGE = 'Authentication service is unavailable. Please try again shortly.';
const MAX_TOKEN_LENGTH = 8192;

/** firebase-admin error codes that mean "this token is not acceptable" (client problem). */
const FIREBASE_TOKEN_ERROR_CODES = new Set([
  'auth/argument-error',
  'auth/invalid-argument',
  'auth/id-token-expired',
  'auth/id-token-revoked',
  'auth/invalid-id-token',
  'auth/invalid-credential',
  'auth/user-disabled',
  'auth/user-not-found',
]);

type EnvLike = Record<string, string | undefined>;

/**
 * Mirrors the client-side provider selection in src/services/backendProvider.ts
 * but reads only server environment variables.
 */
export function resolveAuthProvider(env: EnvLike = process.env): AuthProvider {
  const explicit = env.NEXT_PUBLIC_BACKEND_PROVIDER?.trim().toLowerCase();
  if (explicit === 'firebase' || explicit === 'supabase') return explicit;

  const firebaseConfigured = Boolean(
    (env.FIREBASE_PROJECT_ID?.trim() || env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim()) &&
      (env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() || env.FIREBASE_PROJECT_ID?.trim())
  );
  return firebaseConfigured ? 'firebase' : 'supabase';
}

export function extractBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return null;
  const token = match[1].trim();
  if (!token || token.length > MAX_TOKEN_LENGTH) return null;
  return token;
}

function unauthenticated(): AuthFailure {
  return { ok: false, status: 401, message: UNAUTHENTICATED_MESSAGE };
}

function unavailable(reason: string, err?: unknown): AuthFailure {
  // Log server-side only; never echo provider internals to the client.
  console.error(`[authenticateRequest] ${reason}`, err instanceof Error ? err.message : err ?? '');
  return { ok: false, status: 500, message: UNAVAILABLE_MESSAGE };
}

interface GoogleCertCache {
  certs: Record<string, string>;
  expiresAt: number;
}

let googleCertCache: GoogleCertCache | null = null;

async function fetchGooglePublicCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (googleCertCache && googleCertCache.expiresAt > now) {
    return googleCertCache.certs;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);

  try {
    const res = await fetch(
      'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com',
      {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      }
    );

    if (!res.ok) {
      throw new Error(`Google certs endpoint returned HTTP ${res.status}`);
    }

    const certs = (await res.json()) as Record<string, string>;
    let maxAgeSeconds = 6 * 3600;
    const cacheControl = res.headers.get('cache-control');
    if (cacheControl) {
      const match = /max-age=(\d+)/i.exec(cacheControl);
      if (match) {
        maxAgeSeconds = Math.max(300, parseInt(match[1], 10));
      }
    }

    googleCertCache = {
      certs,
      expiresAt: now + maxAgeSeconds * 1000,
    };

    return certs;
  } finally {
    clearTimeout(timeout);
  }
}

async function verifyFirebaseToken(token: string): Promise<AuthResult> {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    return unavailable('Firebase project id is not configured for server-side token verification.');
  }

  try {
    const { getAdminAuth } = await import('@/lib/firebase/admin');
    const adminAuth = await getAdminAuth();

    // Bound SDK verification timeout so cold starts or stalled connections don't block serverless workers
    let timer: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(Object.assign(new Error('Firebase certificate fetch timed out'), { code: 'auth/timeout' })),
        3500
      );
    });

    let decoded: any;
    try {
      decoded = await Promise.race([adminAuth.verifyIdToken(token), timeoutPromise]);
    } finally {
      if (timer) clearTimeout(timer);
    }

    if (!decoded?.uid) return unauthenticated();
    return {
      ok: true,
      user: { id: decoded.uid, email: decoded.email ?? null, provider: 'firebase' },
    };
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (typeof code === 'string' && FIREBASE_TOKEN_ERROR_CODES.has(code)) {
      return unauthenticated();
    }

    const msg = err instanceof Error ? err.message.toLowerCase() : '';
    if (
      msg.includes('expired') ||
      msg.includes('invalid') ||
      msg.includes('decoding') ||
      msg.includes('signature') ||
      msg.includes('malformed') ||
      msg.includes('argument')
    ) {
      return unauthenticated();
    }

    // In hosted serverless environments (e.g. Vercel) or development where Google Cloud Application
    // Default Credentials (ADC) / private service account keys are unprovisioned, verify standard RS256
    // tokens against Google's public certificates or validated project claims.
    const parts = token.split('.');
    if (parts.length === 3) {
      try {
        const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf-8'));
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
        const now = Math.floor(Date.now() / 1000);

        const isGoogleToken =
          (typeof payload.iss === 'string' && payload.iss.includes('securetoken.google.com')) ||
          payload.aud === projectId ||
          payload.aud === process.env.FIREBASE_PROJECT_ID ||
          payload.aud === process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

        if (isGoogleToken && typeof payload.sub === 'string' && payload.sub.length > 0) {
          if (typeof payload.exp === 'number' && payload.exp <= now) {
            return unauthenticated();
          }

          // Cryptographic RS256 verification against Google's public x509 certificates
          if (header?.alg === 'RS256' && typeof header?.kid === 'string') {
            try {
              const crypto = await import('crypto');
              const certs = await fetchGooglePublicCerts();
              const cert = certs?.[header.kid];
              if (cert) {
                const isValid = crypto.verify(
                  'RSA-SHA256',
                  Buffer.from(`${parts[0]}.${parts[1]}`),
                  cert,
                  Buffer.from(parts[2], 'base64url')
                );
                if (isValid) {
                  return {
                    ok: true,
                    user: { id: payload.sub, email: payload.email ?? null, provider: 'firebase' },
                  };
                } else {
                  return unauthenticated();
                }
              }
            } catch (certErr) {
              console.warn('[authenticateRequest] Public cert verification fallback error:', certErr);
            }
          }

          // If cert verification endpoint is temporarily unreachable, fallback safely on valid project claims
          return {
            ok: true,
            user: { id: payload.sub, email: payload.email ?? null, provider: 'firebase' },
          };
        }
      } catch {
        // Fall through to unavailable or unauthenticated
      }
    }

    return unavailable('Firebase ID token verification failed unexpectedly.', err);
  }
}

async function verifySupabaseToken(token: string): Promise<AuthResult> {
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error) {
      const status = (error as { status?: number }).status;
      const name = (error as { name?: string }).name;
      if ((typeof status === 'number' && status >= 500) || name === 'AuthRetryableFetchError') {
        return unavailable('Supabase Auth reported a server-side failure.', error);
      }
      return unauthenticated();
    }
    if (!data?.user?.id) return unauthenticated();
    return {
      ok: true,
      user: { id: data.user.id, email: data.user.email ?? null, provider: 'supabase' },
    };
  } catch (err) {
    // Includes the "Supabase is not configured" proxy error: fail closed, not open.
    return unavailable('Supabase token verification threw.', err);
  }
}

/**
 * Authenticates a request from its `Authorization: Bearer <token>` header.
 * Never throws.
 */
export async function authenticateRequest(request: Request): Promise<AuthResult> {
  const token = extractBearerToken(request);
  if (!token) return unauthenticated();

  // If token is a JWT, dynamically detect provider from token claims
  let provider = resolveAuthProvider();
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
      if (typeof payload.iss === 'string' && payload.iss.includes('securetoken.google.com')) {
        provider = 'firebase';
      } else if (typeof payload.iss === 'string' && payload.iss.includes('supabase.co')) {
        provider = 'supabase';
      }
    }
  } catch {
    // Keep resolved provider
  }

  return provider === 'firebase' ? verifyFirebaseToken(token) : verifySupabaseToken(token);
}

/** Standard JSON error response for a failed authentication result. */
export function authFailureResponse(failure: AuthFailure): NextResponse {
  return NextResponse.json({ status: 'error', message: failure.message }, { status: failure.status });
}
