import { describe, it, expect } from 'vitest';
import { getEpicStaffingRisks } from './reportRisks';
import type { PlannerItem, JiraWorkItem } from '../types';

function makeEpic(overrides: Partial<PlannerItem> = {}): PlannerItem {
  return {
    id: 'item-1',
    sourceId: '',
    name: 'Alpha Launch',
    type: 'epic',
    jiraKey: 'PROJ-1',
    startSprint: 1,
    spanSprints: 3,
    assignees: [],
    isManual: false,
    labels: [],
    jiraAssignees: [],
    ...overrides,
  };
}

function makeJiraItem(overrides: Partial<JiraWorkItem> = {}): JiraWorkItem {
  return {
    id: 'wi-1',
    connectionId: 'c1',
    jiraKey: 'PROJ-1',
    jiraId: '1',
    summary: 'Alpha Launch',
    type: 'epic',
    typeName: 'Epic',
    status: 'In Progress',
    statusCategory: 'in_progress',
    storyPoints: 21,
    labels: [],
    components: [],
    created: '2026-01-01',
    updated: '2026-01-01',
    ...overrides,
  };
}

describe('getEpicStaffingRisks', () => {
  it('returns empty array for empty plannerItems', () => {
    expect(getEpicStaffingRisks([], [])).toEqual([]);
  });

  it('skips non-epic items', () => {
    const story = makeEpic({ type: 'story', id: 'story-1' });
    expect(getEpicStaffingRisks([story], [])).toEqual([]);
  });

  it('flags no-staff when assignees is empty', () => {
    const epic = makeEpic({ assignees: [] });
    const jira = makeJiraItem();
    const risks = getEpicStaffingRisks([epic], [jira]);
    expect(risks).toHaveLength(1);
    expect(risks[0].type).toBe('no-staff');
    expect(risks[0].epicKey).toBe('PROJ-1');
    expect(risks[0].assignedDays).toBe(0);
    expect(risks[0].storyPoints).toBe(21);
  });

  it('flags understaffed when assignedDays < storyPoints', () => {
    // 1 assignee, 1 day/sprint × 3 sprints = 3 days < 21 story points
    const epic = makeEpic({
      spanSprints: 3,
      assignees: [{ memberId: 'm1', track: 'IT', daysPerSprint: 1 }],
    });
    const jira = makeJiraItem({ storyPoints: 21 });
    const risks = getEpicStaffingRisks([epic], [jira]);
    expect(risks).toHaveLength(1);
    expect(risks[0].type).toBe('understaffed');
    expect(risks[0].assignedDays).toBe(3);
    expect(risks[0].storyPoints).toBe(21);
  });

  it('does not flag when assignedDays >= storyPoints', () => {
    // 2 assignees, 4 daysPerSprint × 3 sprints = 12 days each → 24 total >= 21 story points
    const epic = makeEpic({
      spanSprints: 3,
      assignees: [
        { memberId: 'm1', track: 'IT', daysPerSprint: 4 },
        { memberId: 'm2', track: 'BIZ', daysPerSprint: 4 },
      ],
    });
    const jira = makeJiraItem({ storyPoints: 21 });
    expect(getEpicStaffingRisks([epic], [jira])).toEqual([]);
  });

  it('does not flag understaffed when storyPoints is null/undefined', () => {
    const epic = makeEpic({
      assignees: [{ memberId: 'm1', track: 'IT', daysPerSprint: 1 }],
    });
    const jira = makeJiraItem({ storyPoints: undefined });
    expect(getEpicStaffingRisks([epic], [jira])).toEqual([]);
  });

  it('returns no-staff with storyPoints null when jira item has no storyPoints', () => {
    const epic = makeEpic({ assignees: [] });
    const jira = makeJiraItem({ storyPoints: undefined });
    const risks = getEpicStaffingRisks([epic], [jira]);
    expect(risks[0].type).toBe('no-staff');
    expect(risks[0].storyPoints).toBeNull();
  });

  it('uses item.id as epicKey when jiraKey is missing', () => {
    const epic = makeEpic({ jiraKey: undefined, assignees: [] });
    const risks = getEpicStaffingRisks([epic], []);
    expect(risks[0].epicKey).toBe('item-1');
  });

  it('sums both IT and BIZ assignees for assigned days', () => {
    // IT: 2 daysPerSprint, BIZ: 3 daysPerSprint, 2 sprints → 10 days
    const epic = makeEpic({
      spanSprints: 2,
      assignees: [
        { memberId: 'm1', track: 'IT', daysPerSprint: 2 },
        { memberId: 'm2', track: 'BIZ', daysPerSprint: 3 },
      ],
    });
    const jira = makeJiraItem({ storyPoints: 12 });
    const risks = getEpicStaffingRisks([epic], [jira]);
    expect(risks[0].assignedDays).toBe(10);
  });
});
