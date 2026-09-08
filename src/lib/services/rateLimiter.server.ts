import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * ARCHITECTURAL NOTE:
 * Rate limiting across serverless runtime instances (such as Vercel or AWS Lambda)
 * requires a centralized persistent store.
 *
 * This implementation primarily queries the Supabase `request_logs` table.
 * If the table has not yet been migrated in Supabase, it falls back gracefully
 * to an in-memory sliding-window store with a logged advisory.
 *
 * Recommendation for high-throughput enterprise scale:
 * Integrate Upstash Redis via `@upstash/ratelimit` for sub-millisecond atomic checks.
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
  store: 'supabase' | 'in-memory-fallback';
}

// In-memory sliding window fallback map: key is `${userId}:${action}` -> array of epoch timestamps (ms)
const inMemoryStore = new Map<string, number[]>();
let hasLoggedInMemoryWarning = false;

export async function checkRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const { userId, action, maxRequests, windowSeconds = 60 } = options;
  const nowMs = Date.now();
  const windowMs = windowSeconds * 1000;
  const cutoffTime = new Date(nowMs - windowMs).toISOString();

  // 1. Try Supabase request_logs table first (persistent across serverless instances)
  try {
    const { count, error } = await supabase
      .from('request_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('action', action)
      .gte('created_at', cutoffTime);

    if (!error && typeof count === 'number') {
      if (count >= maxRequests) {
        return {
          allowed: false,
          limit: maxRequests,
          remaining: 0,
          resetSeconds: windowSeconds,
          retryAfterSeconds: windowSeconds,
          store: 'supabase',
        };
      }

      // Log the incoming request asynchronously
      void supabase.from('request_logs').insert({
        user_id: userId,
        action,
        created_at: new Date(nowMs).toISOString(),
      });

      return {
        allowed: true,
        limit: maxRequests,
        remaining: Math.max(0, maxRequests - (count + 1)),
        resetSeconds: windowSeconds,
        store: 'supabase',
      };
    }
  } catch (err) {
    // Supabase unavailable or table not created; proceed to in-memory fallback below
  }

  // 2. In-memory sliding window fallback
  if (!hasLoggedInMemoryWarning) {
    console.warn(
      '[RateLimiter] Notice: Using in-memory rate limiting fallback. In-memory state does not synchronize across distributed serverless instances. To enable cross-instance synchronization, create the `request_logs` table in Supabase or connect Upstash Redis.'
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
