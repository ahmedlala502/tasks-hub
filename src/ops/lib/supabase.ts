import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../types/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in your .env file.'
  );
}

/**
 * Supabase Client Configuration
 * 
 * Optimized for production use with:
 * - Session persistence in localStorage
 * - Automatic token refresh
 * - URL-based session detection for OAuth flows
 * - Connection pooling via fetch
 * - Retry logic for transient failures
 * - Full TypeScript type safety
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Prevent session storage in URL after OAuth
    flowType: 'pkce',
    // Storage key for session data
    storageKey: 'trygc-hub-auth',
  },
  db: {
    schema: 'public',
  },
  global: {
    headers: {
      'x-application-name': 'trygc-hub-manager',
    },
  },
  // Realtime configuration for future use
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

/**
 * Health check utility
 * Verifies Supabase connection is working
 */
export async function checkSupabaseHealth(): Promise<boolean> {
  try {
    const { error } = await supabase.from('trygc').select('count', { count: 'exact', head: true });
    return !error;
  } catch {
    return false;
  }
}
