import { isFirebaseConfigured } from '../lib/firebase/config';
import { isSupabaseConfigured } from '../lib/supabase';

export type BackendProvider = 'firebase' | 'supabase';

export function getActiveBackendProvider(): BackendProvider {
  const explicit = process.env.NEXT_PUBLIC_BACKEND_PROVIDER?.toLowerCase();
  if (explicit === 'firebase') return 'firebase';
  if (explicit === 'supabase') return 'supabase';

  // Auto-detect based on configured credentials
  if (isFirebaseConfigured && !isSupabaseConfigured) return 'firebase';
  if (isSupabaseConfigured && !isFirebaseConfigured) return 'supabase';

  // Default to firebase if configured, otherwise fallback to supabase
  return isFirebaseConfigured ? 'firebase' : 'supabase';
}

export function isFirebaseActive(): boolean {
  return getActiveBackendProvider() === 'firebase';
}
