/**
 * Supabase client configuration.
 *
 * All database reads and writes go through supabaseSync.ts.
 * This file only exports the shared client and the isSupabaseConfigured guard.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// createClient validates the URL with `new URL(supabaseUrl)` and throws if it
// is empty or malformed — which crashes the entire JS bundle before React mounts
// (white screen, no error boundary). Use a syntactically valid placeholder so
// the SDK initialises safely; actual network calls are guarded by isSupabaseConfigured().
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);

/**
 * Returns true only when real Supabase credentials have been provided via
 * environment variables. Guards all network calls so the app works offline
 * (localStorage only) when credentials are absent.
 */
export function isSupabaseConfigured(): boolean {
  return !!(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl !== 'YOUR_SUPABASE_URL' &&
    supabaseUrl !== 'https://placeholder.supabase.co' &&
    supabaseAnonKey !== 'placeholder-anon-key'
  );
}
