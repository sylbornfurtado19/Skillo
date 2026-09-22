import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Guard against accidental client-side bundling/execution
if (typeof window !== 'undefined') {
  throw new Error('[Security Violation] src/lib/server/supabaseAdmin cannot be imported or executed in browser environments.');
}

let cachedAdmin: SupabaseClient | null = null;

/**
 * Returns a Supabase client configured with the service-role key for backend operations.
 * Bypasses RLS strictly for server-side operations (e.g. background Reflexion updates).
 *
 * Throws in production if credentials are not configured.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (cachedAdmin) return cachedAdmin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    const errorMsg =
      '[Supabase Admin Error] SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL must be configured for server-side admin access.';
    if (process.env.NODE_ENV === 'production') {
      throw new Error(errorMsg);
    }
    // In dev/test, if anon key is available, fallback to anon key with a clear warning
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && anonKey) {
      console.warn(
        '[Supabase Admin Warning] SUPABASE_SERVICE_ROLE_KEY not configured. Falling back to anon key for development/testing.'
      );
      cachedAdmin = createClient(url, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      return cachedAdmin;
    }
    throw new Error(errorMsg);
  }

  cachedAdmin = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return cachedAdmin;
}

/**
 * Lazy proxy export for backward compatibility with existing server code.
 */
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseAdmin();
    const val = (client as any)[prop];
    if (typeof val === 'function') {
      return val.bind(client);
    }
    return val;
  },
});
