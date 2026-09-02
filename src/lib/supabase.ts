import { createClient } from '@supabase/supabase-js';

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

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
