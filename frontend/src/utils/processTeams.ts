import type { ProcessTeam } from '../types';

/**
 * Default process teams — IDs align with `004_squads_and_process_teams.sql`.
 * `pt-fpa` is the primary key for FP&A; the display name is "FP&A".
 */
export const DEFAULT_PROCESS_TEAMS: readonly ProcessTeam[] = [
  { id: 'pt-r2r', name: 'R2R' },
  { id: 'pt-l2c', name: 'L2C' },
  { id: 'pt-p2p', name: 'P2P' },
  { id: 'pt-planning', name: 'Planning' },
  { id: 'pt-treasury', name: 'Treasury' },
  { id: 'pt-fpa', name: 'FP&A' },
];

export function mergeProcessTeamsWithDefaults(teams: ProcessTeam[]): ProcessTeam[] {
  const byId = new Map<string, ProcessTeam>();
  for (const d of DEFAULT_PROCESS_TEAMS) {
    byId.set(d.id, { ...d });
  }
  for (const t of teams) {
    byId.set(t.id, t);
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}
