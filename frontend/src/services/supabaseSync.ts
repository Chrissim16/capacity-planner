/**
 * Supabase cloud sync service (US-001)
 *
 * Stores the entire AppState as a single JSONB blob in the `app_sync` table.
 * This is the pragmatic P0 approach: one row, one column, zero data loss.
 *
 * Strategy:
 *  - On app startup: load from Supabase, fall back to localStorage if offline
 *  - On every data mutation: debounced write to Supabase (1.5 s)
 *  - localStorage is kept as an offline cache / instant-load layer
 */

import { supabase, isSupabaseConfigured } from './supabase';
import type { AppState } from '../types';

const SYNC_ROW_ID = 'main';

// ─────────────────────────────────────────────────────────────────────────────
// LOAD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Loads the AppState from Supabase.
 * Returns null if Supabase is not configured, offline, or has no data yet.
 */
export async function loadFromSupabase(): Promise<AppState | null> {
  if (!isSupabaseConfigured()) {
    console.info('[Sync] Supabase not configured — using localStorage only.');
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('app_sync')
      .select('data, updated_at')
      .eq('id', SYNC_ROW_ID)
      .maybeSingle();

    if (error) {
      console.error('[Sync] Failed to load from Supabase:', error.message);
      return null;
    }

    if (!data || !data.data || Object.keys(data.data).length === 0) {
      console.info('[Sync] No data found in Supabase — will use localStorage.');
      return null;
    }

    console.info('[Sync] Loaded from Supabase (updated:', data.updated_at, ')');
    return data.data as AppState;
  } catch (err) {
    console.error('[Sync] Unexpected error loading from Supabase:', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SAVE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Saves the AppState to Supabase.
 * Throws on error so the caller can update sync status accordingly.
 */
export async function saveToSupabase(state: AppState): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const { error } = await supabase
    .from('app_sync')
    .upsert(
      { id: SYNC_ROW_ID, data: state },
      { onConflict: 'id' }
    );

  if (error) {
    throw new Error(error.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DEBOUNCED SYNC SCHEDULER
// ─────────────────────────────────────────────────────────────────────────────

type SyncCallback = (status: 'saving' | 'saved' | 'error', error?: string) => void;

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let pendingState: AppState | null = null;

/**
 * Schedule a debounced save to Supabase.
 * Multiple rapid calls coalesce into a single save 1.5 s after the last call.
 *
 * @param state   The latest AppState to persist.
 * @param onStatus  Callback to update sync status in the store.
 */
export function scheduleSyncToSupabase(state: AppState, onStatus: SyncCallback): void {
  if (!isSupabaseConfigured()) return;

  // Keep track of the very latest state to save when the timer fires
  pendingState = state;

  // Signal "saving" immediately so the UI indicator updates right away
  onStatus('saving');

  if (syncTimer) clearTimeout(syncTimer);

  syncTimer = setTimeout(async () => {
    if (!pendingState) return;
    const stateToSave = pendingState;
    pendingState = null;

    try {
      await saveToSupabase(stateToSave);
      onStatus('saved');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Sync] Save failed:', msg);
      onStatus('error', msg);
    }
  }, 1500);
}
