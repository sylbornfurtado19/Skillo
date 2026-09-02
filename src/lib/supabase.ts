import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _supabaseInstance: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (_supabaseInstance) {
    return _supabaseInstance;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || supabaseUrl.trim() === '') {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL environment variable. Ensure NEXT_PUBLIC_SUPABASE_URL is configured in your environment or .env file.'
    );
  }

  if (!supabaseUrl.startsWith('http://') && !supabaseUrl.startsWith('https://')) {
    throw new Error(
      `Malformed NEXT_PUBLIC_SUPABASE_URL environment variable: "${supabaseUrl}". URL must start with http:// or https://.`
    );
  }

  if (!supabaseAnonKey || supabaseAnonKey.trim() === '') {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable. Ensure NEXT_PUBLIC_SUPABASE_ANON_KEY is configured in your environment or .env file.'
    );
  }

  _supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  return _supabaseInstance;
}

/**
 * Lazy Supabase client proxy.
 * Allows Next.js build-time static analysis and route data collection to succeed
 * without requiring live production credentials during the build step, while
 * throwing a strict hard error at runtime if credentials are missing or malformed.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseClient();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});
