import { useMemo } from 'react';
import { useCurrentState } from '../stores/appStore';
import { calculateCapacityByProcessTeam } from '../utils/capacity';
import type { GroupCapacitySummary } from '../utils/capacity';

export interface ProcessTeamCapacitySummary {
  id: string;
  name: string;
  data: GroupCapacitySummary;
}

/**
 * Derives a per-process-team capacity summary for a given quarter.
 * Extracted from the Dashboard's processTeamSummaries useMemo so it can
 * be consumed in the Scenario Planner without duplicating the pattern.
 */
export function useProcessTeamCapacitySummaries(quarter: string): ProcessTeamCapacitySummary[] {
  const state = useCurrentState();
  return useMemo(
    () =>
      state.processTeams.map(pt => ({
        id: pt.id,
        name: pt.name,
        data: calculateCapacityByProcessTeam(pt.id, quarter, state),
      })),
    // Granular deps — avoids re-running on every unrelated store mutation
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      quarter,
      state.processTeams,
      state.teamMembers,
      state.businessContacts,
      state.jiraWorkItems,
      state.jiraItemBizAssignments,
      state.businessTimeOff,
      state.publicHolidays,
    ],
  );
}
