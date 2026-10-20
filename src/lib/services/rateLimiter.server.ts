import { NextResponse } from 'next/server';

/**
 * ARCHITECTURAL NOTE:
 * Rate limiting across serverless runtime instances (such as Vercel or AWS Lambda)
 * requires a centralized persistent store.
 *
 * Uses Firebase Firestore request_logs collection,
 * falling back gracefully to in-memory sliding window when unconfigured.
 */

export interface RateLimitOptions {
  userId: string;
  action: string;
  maxRequests: number;
  windowSeconds?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
  retryAfterSeconds?: number;
  store: 'firebase' | 'in-memory-fallback' | 'supabase';
}

// In-memory sliding window fallback map: key is `${userId}:${action}` -> array of epoch timestamps (ms)
const inMemoryStore = new Map<string, number[]>();
let hasLoggedInMemoryWarning = false;

export async function checkRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const { userId, action, maxRequests, windowSeconds = 60 } = options;
  const nowMs = Date.now();
  const windowMs = windowSeconds * 1000;
  const cutoffTime = new Date(nowMs - windowMs).toISOString();

  // 1. Try Firebase Admin Firestore if configured
  try {
    const { isFirebaseAdminConfigured, getAdminFirestore } = await import('@/lib/firebase/admin');
    if (isFirebaseAdminConfigured) {
      const adminDb = getAdminFirestore();
      const snapshot = await adminDb
        .collection('request_logs')
        .where('user_id', '==', userId)
        .where('action', '==', action)
        .where('created_at', '>=', cutoffTime)
        .get();

      const count = snapshot.size;
      if (count >= maxRequests) {
        return {
          allowed: false,
          limit: maxRequests,
          remaining: 0,
          resetSeconds: windowSeconds,
          retryAfterSeconds: windowSeconds,
          store: 'firebase',
        };
      }

      void adminDb.collection('request_logs').add({
        user_id: userId,
        action,
        created_at: new Date(nowMs).toISOString(),
      }).catch(() => {});

      return {
        allowed: true,
        limit: maxRequests,
        remaining: Math.max(0, maxRequests - (count + 1)),
        resetSeconds: windowSeconds,
        store: 'firebase',
      };
    }
  } catch {
    // Proceed to in-memory fallback
  }

  // 2. In-memory sliding window fallback (strictly for development and unit testing)
  if (process.env.NODE_ENV === 'production' && !hasLoggedInMemoryWarning) {
    console.error(
      '[CRITICAL PRODUCTION WARNING] RateLimiter is running in in-memory fallback mode in PRODUCTION! In-memory rate limits do NOT synchronize across distributed serverless instances. Configure Firebase Admin SDK to prevent abuse.'
    );
    hasLoggedInMemoryWarning = true;
  } else if (!hasLoggedInMemoryWarning) {
    console.warn(
      '[RateLimiter] Notice: Using in-memory rate limiting fallback. In-memory state does not synchronize across distributed serverless instances.'
    );
    hasLoggedInMemoryWarning = true;
  }


  const key = `${userId}:${action}`;
  const existingTimestamps = inMemoryStore.get(key) || [];

  // Prune timestamps older than the sliding window
  const validTimestamps = existingTimestamps.filter(t => t > nowMs - windowMs);

  if (validTimestamps.length >= maxRequests) {
    const oldest = validTimestamps[0];
    const retryAfter = Math.max(1, Math.ceil((oldest + windowMs - nowMs) / 1000));

    return {
      allowed: false,
      limit: maxRequests,
      remaining: 0,
      resetSeconds: retryAfter,
      retryAfterSeconds: retryAfter,
      store: 'in-memory-fallback',
    };
  }

  validTimestamps.push(nowMs);
  inMemoryStore.set(key, validTimestamps);

  return {
    allowed: true,
    limit: maxRequests,
    remaining: Math.max(0, maxRequests - validTimestamps.length),
    resetSeconds: windowSeconds,
    store: 'in-memory-fallback',
  };
}

/**
 * Standardized 429 Too Many Requests response builder with RFC-compliant headers.
 */
export function createRateLimitResponse(result: RateLimitResult, actionName: string = 'this action'): NextResponse {
  const retryAfter = result.retryAfterSeconds ?? 60;
  return NextResponse.json(
    {
      status: 'error',
      message: `Rate limit exceeded for ${actionName}. Allowed: ${result.limit} requests per minute. Please wait ${retryAfter} seconds before trying again.`,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(result.resetSeconds),
      },
    }
  );
}

/**
 * Resets the in-memory fallback state and warning flag (useful for testing).
 */
export function resetRateLimiterMemoryState(): void {
  inMemoryStore.clear();
  hasLoggedInMemoryWarning = false;
}
