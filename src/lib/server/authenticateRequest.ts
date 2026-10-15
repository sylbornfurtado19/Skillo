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
    env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() &&
      (env.FIREBASE_PROJECT_ID?.trim() || env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim())
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

async function verifyFirebaseToken(token: string): Promise<AuthResult> {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    return unavailable('Firebase project id is not configured for server-side token verification.');
  }

  try {
    const { getAdminAuth } = await import('@/lib/firebase/admin');
    const adminAuth = await getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);
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

  const provider = resolveAuthProvider();
  return provider === 'firebase' ? verifyFirebaseToken(token) : verifySupabaseToken(token);
}

/** Standard JSON error response for a failed authentication result. */
export function authFailureResponse(failure: AuthFailure): NextResponse {
  return NextResponse.json({ status: 'error', message: failure.message }, { status: failure.status });
}
