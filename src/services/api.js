// Base API configurations and utilities for Skillo

// Placeholder for future Supabase client initialization
// import { createClient } from '@supabase/supabase-js';
// export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Simulates network latency for mock workflows.
 * @param {number} ms - The millisecond delay duration.
 * @returns {Promise<void>}
 */
export const simulateDelay = (ms = 1000) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

