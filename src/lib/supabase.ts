import { createClient, SupabaseClient } from '@supabase/supabase-js';

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const rawAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const isValidUrl = Boolean(
  rawUrl &&
  (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) &&
  !rawUrl.includes('your-project') &&
  !rawUrl.includes('example.supabase.co')
);

const isValidKey = Boolean(
  rawAnonKey &&
  rawAnonKey.trim().length > 20 &&
  !rawAnonKey.includes('your-anon-key')
);

export const isSupabaseConfigured: boolean = Boolean(isValidUrl && isValidKey);

/**
 * Creates an unconfigured client proxy that throws an actionable error when any operation is attempted.
 * Prevents silent data dropping while allowing static client bundle imports without crashes.
 */
function createUnconfiguredClient(errorMessage: string): SupabaseClient {
  const handler: ProxyHandler<any> = {
    get(_target, prop) {
      if (prop === 'then') return undefined; // Avoid treating proxy as a thenable/Promise
      if (prop === 'isConfigured') return false;
      return new Proxy(() => {}, {
        apply() {
          throw new Error(errorMessage);
        },
        get(_t, subProp) {
          if (subProp === 'then') return undefined;
          return () => {
            throw new Error(errorMessage);
          };
        },
      });
    },
  };
  return new Proxy({}, handler) as SupabaseClient;
}

let clientInstance: SupabaseClient;

if (isSupabaseConfigured) {
  clientInstance = createClient(rawUrl!, rawAnonKey!, {
    auth: {
      persistSession: typeof window !== 'undefined',
      autoRefreshToken: typeof window !== 'undefined',
    },
  });
} else {
  const unconfiguredMessage =
    '[Supabase Configuration Notice] Supabase is not configured. ' +
    'Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file. ' +
    'Database and authentication operations cannot proceed without valid credentials.';

  clientInstance = createUnconfiguredClient(unconfiguredMessage);
}

export const supabase = clientInstance;
