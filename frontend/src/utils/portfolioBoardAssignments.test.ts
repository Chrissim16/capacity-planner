import { describe, expect, it } from 'vitest';
import type { EpicPhaseAssignment, JiraWorkItem } from '../types';
import { filterAssignmentsToBoardEpics } from './portfolioBoardAssignments';

function makeEpic(overrides: Partial<JiraWorkItem> = {}): JiraWorkItem {
  return {
    id: 'jira-1',
    connectionId: 'jira-conn',
    jiraKey: 'EPIC-1',
    jiraId: '10001',
    summary: 'Epic 1',
    description: '',
    type: 'epic',
    typeName: 'Epic',
    status: 'To Do',
    statusCategory: 'todo',
    labels: [],
    components: [],
    created: '2026-01-01T00:00:00.000Z',
    updated: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeAssignment(overrides: Partial<EpicPhaseAssignment> = {}): EpicPhaseAssignment {
  return {
    id: 'assign-1',
    epicKey: 'EPIC-1',
    phase: 'design',
    phaseInstanceId: 'design',
    memberId: 'member-1',
    track: 'IT',
    days: 5,
    allocationMode: 'flat',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('filterAssignmentsToBoardEpics', () => {
  it('keeps only assignments for epics currently on the board', () => {
    const boardEpics = [makeEpic({ jiraKey: 'EPIC-1' }), makeEpic({ id: 'jira-2', jiraKey: 'EPIC-2', jiraId: '10002', summary: 'Epic 2' })];
    const assignments = [
      makeAssignment({ id: 'assign-1', epicKey: 'EPIC-1', days: 10 }),
      makeAssignment({ id: 'assign-2', epicKey: 'EPIC-2', phase: 'build', phaseInstanceId: 'build', days: 7 }),
      makeAssignment({ id: 'assign-3', epicKey: 'EPIC-OLD', phase: 'test', phaseInstanceId: 'test', days: 60 }),
    ];

    expect(filterAssignmentsToBoardEpics(assignments, boardEpics)).toEqual([
      assignments[0],
      assignments[1],
    ]);
  });
});
