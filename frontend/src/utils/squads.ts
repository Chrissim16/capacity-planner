import type { Squad } from '../types';

/**
 * Default Value Stream Finance squads — IDs align with `004_squads_and_process_teams.sql`.
 * Kept in app state and synced so team members can set `squadId` even when the DB
 * `squads` table was previously empty or pruned.
 */
export const DEFAULT_VS_FINANCE_SQUADS: readonly Squad[] = [
  { id: 'squad-erp', name: 'ERP' },
  { id: 'squad-epm', name: 'EPM' },
];

/**
 * Ensures default ERP/EPM rows exist; app-defined squads override defaults by id.
 */
export function mergeSquadsWithDefaults(squads: Squad[]): Squad[] {
  const byId = new Map<string, Squad>();
  for (const d of DEFAULT_VS_FINANCE_SQUADS) {
    byId.set(d.id, { ...d });
  }
  for (const s of squads) {
    byId.set(s.id, s);
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Map squad display name → portfolio report bucket (word-boundary match). */
export function matchVsFinanceSquadBucket(squadName: string): 'erp' | 'epm' | null {
  const n = squadName.trim().toLowerCase();
  if (/\berp\b/.test(n)) return 'erp';
  if (/\bepm\b/.test(n)) return 'epm';
  return null;
}
