import { createClient } from '@supabase/supabase-js';

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseUrl =
  rawUrl && (rawUrl.startsWith('http://') || rawUrl.startsWith('https://'))
    ? rawUrl
    : 'https://rszgkhoqniicksgtllqp.supabase.co';

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzemdraG9xbmlpY2tzZ3RsbHFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNTE1ODAsImV4cCI6MjEwMDgyNzU4MH0.xBZNXKP7K9Fn8aFU1N8N6O4VO2yfuLH8qP5hNnihMAM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
