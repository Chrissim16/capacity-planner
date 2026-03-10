/**
 * Data action functions for the Capacity Planner
 */

import { useAppStore } from './appStore';
import type {
  TeamMember,
  TimeOff,
  Sprint,
  Settings,
  BusinessContact,
  BusinessTimeOff,
  JiraItemBizAssignment,
  JiraConnection,
  JiraSettings,
  JiraWorkItem,
  Scenario,
  JiraSyncResult,
} from '../types';

// ═══════════════════════════════════════════════════════════════════════════
// ID GENERATION
// ═══════════════════════════════════════════════════════════════════════════

export function generateId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function generateJiraId(prefix: string): string {
  return prefix + '-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// ═══════════════════════════════════════════════════════════════════════════
// TEAM MEMBER ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

export function addTeamMember(memberData: Omit<TeamMember, 'id'>): TeamMember {
  const state = useAppStore.getState();
  const newMember: TeamMember = { ...memberData, id: generateId('member') };
  state.updateData({ teamMembers: [...state.getCurrentState().teamMembers, newMember] });
  return newMember;
}

export function updateTeamMember(memberId: string, updates: Partial<TeamMember>): void {
  const state = useAppStore.getState();
  const teamMembers = state.getCurrentState().teamMembers.map(m => {
    if (m.id !== memberId) return m;
    const updated = { ...m, ...updates };
    if (updated.role && updated.countryId) updated.needsEnrichment = false;
    if (m.syncedFromJira && updates.name !== undefined && updates.name !== m.name) {
      updated.nameManuallyEdited = true;
    }
    return updated;
  });
  state.updateData({ teamMembers });
}

export function deleteTeamMember(memberId: string): void {
  const state = useAppStore.getState();
  const teamMembers = state.getCurrentState().teamMembers.filter(m => m.id !== memberId);
  state.updateData({ teamMembers });
}

export interface TeamMemberSyncResult {
  created: number;
  updated: number;
  unchanged: number;
  newMembers: TeamMember[];
}

export function syncTeamMembersFromJira(): TeamMemberSyncResult {
  const state = useAppStore.getState();
  const currentState = state.getCurrentState();
  const jiraWorkItems = currentState.jiraWorkItems;
  const existingMembers = [...currentState.teamMembers];

  const result: TeamMemberSyncResult = { created: 0, updated: 0, unchanged: 0, newMembers: [] };

  const assigneeMap = new Map<string, { email: string; name: string }>();
  for (const item of jiraWorkItems) {
    if (item.assigneeEmail) {
      const key = item.assigneeEmail.toLowerCase();
      if (!assigneeMap.has(key)) {
        assigneeMap.set(key, {
          email: item.assigneeEmail,
          name: item.assigneeName || item.assigneeEmail.split('@')[0],
        });
      }
    }
  }

  const updatedMembers: TeamMember[] = [];
  const processedEmails = new Set<string>();

  const businessContactEmails = new Set(
    (currentState.businessContacts ?? [])
      .map(c => c.email?.toLowerCase())
      .filter(Boolean) as string[]
  );

  for (const [emailKey, assignee] of assigneeMap) {
    if (businessContactEmails.has(emailKey)) continue;

    const existingMember = existingMembers.find(m => m.email?.toLowerCase() === emailKey);

    if (existingMember) {
      if (existingMember.name !== assignee.name && existingMember.syncedFromJira && !existingMember.nameManuallyEdited) {
        updatedMembers.push({ ...existingMember, name: assignee.name });
        result.updated++;
      } else {
        updatedMembers.push(existingMember);
        result.unchanged++;
      }
      processedEmails.add(emailKey);
    } else {
      const newMember: TeamMember = {
        id: generateId('member'),
        name: assignee.name,
        email: assignee.email,
        role: '',
        countryId: '',
        skillIds: [],
        maxConcurrentProjects: 3,
        syncedFromJira: true,
        needsEnrichment: true,
      };
      updatedMembers.push(newMember);
      result.newMembers.push(newMember);
      result.created++;
      processedEmails.add(emailKey);
    }
  }

  for (const member of existingMembers) {
    const emailKey = member.email?.toLowerCase();
    if (!emailKey || !processedEmails.has(emailKey)) {
      updatedMembers.push(member);
    }
  }

  state.updateData({ teamMembers: updatedMembers });
  return result;
}

export function bulkUpdateTeamMembers(
  ids: string[],
  updates: Partial<TeamMember>,
  arrayMode: 'replace' | 'add' = 'replace',
): void {
  const state = useAppStore.getState();
  const idSet = new Set(ids);
  const teamMembers = state.getCurrentState().teamMembers.map(m => {
    if (!idSet.has(m.id)) return m;
    const merged: TeamMember = { ...m, ...updates };
    if (arrayMode === 'add' && updates.processTeamIds) {
      merged.processTeamIds = [...new Set([...(m.processTeamIds ?? []), ...updates.processTeamIds])];
    }
    if (merged.role && merged.countryId) merged.needsEnrichment = false;
    return merged;
  });
  state.updateData({ teamMembers });
}

// ═══════════════════════════════════════════════════════════════════════════
// TIME OFF ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

export function addTimeOff(memberId: string, startDate: string, endDate: string, note?: string): void {
  const state = useAppStore.getState();
  const newEntry: TimeOff = { id: generateId('timeoff'), memberId, startDate, endDate, note };
  state.updateData({ timeOff: [...state.getCurrentState().timeOff, newEntry] });
}

export function removeTimeOff(id: string): void {
  const state = useAppStore.getState();
  state.updateData({ timeOff: state.getCurrentState().timeOff.filter(t => t.id !== id) });
}

// ═══════════════════════════════════════════════════════════════════════════
// SETTINGS ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

export function updateSettings(updates: Partial<Settings>): void {
  const state = useAppStore.getState();
  state.updateData({ settings: { ...state.getCurrentState().settings, ...updates } });
}

export function addRole(name: string): void {
  const state = useAppStore.getState();
  state.updateData({ roles: [...state.getCurrentState().roles, { id: generateId('role'), name }] });
}

export function deleteRole(roleId: string): void {
  const state = useAppStore.getState();
  state.updateData({ roles: state.getCurrentState().roles.filter(r => r.id !== roleId) });
}

export function addProcessTeam(name: string): void {
  const state = useAppStore.getState();
  state.updateData({ processTeams: [...state.getCurrentState().processTeams, { id: generateId('pt'), name }] });
}

export function deleteProcessTeam(id: string): void {
  const state = useAppStore.getState();
  state.updateData({ processTeams: state.getCurrentState().processTeams.filter(p => p.id !== id) });
}

export function addSkill(name: string, category: 'System' | 'Process' | 'Technical'): void {
  const state = useAppStore.getState();
  state.updateData({ skills: [...state.getCurrentState().skills, { id: generateId('skill'), name, category }] });
}

export function deleteSkill(skillId: string): void {
  const state = useAppStore.getState();
  state.updateData({ skills: state.getCurrentState().skills.filter(s => s.id !== skillId) });
}

export function addSystem(name: string, description?: string): void {
  const state = useAppStore.getState();
  state.updateData({ systems: [...state.getCurrentState().systems, { id: generateId('sys'), name, description }] });
}

export function updateSystem(systemId: string, updates: { name?: string; description?: string }): void {
  const state = useAppStore.getState();
  state.updateData({
    systems: state.getCurrentState().systems.map(s => s.id === systemId ? { ...s, ...updates } : s),
  });
}

export function deleteSystem(systemId: string): void {
  const state = useAppStore.getState();
  state.updateData({ systems: state.getCurrentState().systems.filter(s => s.id !== systemId) });
}

// ═══════════════════════════════════════════════════════════════════════════
// COUNTRY ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

export function addCountry(code: string, name: string, flag?: string): void {
  const state = useAppStore.getState();
  state.updateData({
    countries: [...state.getCurrentState().countries, { id: generateId('country'), code: code.toUpperCase(), name, flag }],
  });
}

export function updateCountry(countryId: string, updates: { code?: string; name?: string; flag?: string }): void {
  const state = useAppStore.getState();
  state.updateData({
    countries: state.getCurrentState().countries.map(c => c.id === countryId ? { ...c, ...updates } : c),
  });
}

export function deleteCountry(countryId: string): void {
  const state = useAppStore.getState();
  state.updateData({
    countries: state.getCurrentState().countries.filter(c => c.id !== countryId),
    publicHolidays: state.getCurrentState().publicHolidays.filter(h => h.countryId !== countryId),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// HOLIDAY ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

export function addHoliday(countryId: string, date: string, name: string): void {
  const state = useAppStore.getState();
  state.updateData({
    publicHolidays: [...state.getCurrentState().publicHolidays, { id: generateId('holiday'), countryId, date, name }],
  });
}

export function addHolidaysBatch(entries: Array<{ countryId: string; date: string; name: string }>): void {
  if (entries.length === 0) return;
  const state = useAppStore.getState();
  const newEntries = entries.map(e => ({ id: generateId('holiday'), ...e }));
  state.updateData({ publicHolidays: [...state.getCurrentState().publicHolidays, ...newEntries] });
}

export function updateHoliday(holidayId: string, updates: { date?: string; name?: string }): void {
  const state = useAppStore.getState();
  state.updateData({
    publicHolidays: state.getCurrentState().publicHolidays.map(h => h.id === holidayId ? { ...h, ...updates } : h),
  });
}

export function deleteHoliday(holidayId: string): void {
  const state = useAppStore.getState();
  state.updateData({ publicHolidays: state.getCurrentState().publicHolidays.filter(h => h.id !== holidayId) });
}

// ═══════════════════════════════════════════════════════════════════════════
// SPRINT ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

export function addSprint(sprintData: Omit<Sprint, 'id'>): Sprint {
  const state = useAppStore.getState();
  const newSprint: Sprint = { ...sprintData, id: generateId('sprint') };
  const sprints = [...state.getCurrentState().sprints, newSprint]
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  state.updateData({ sprints });
  return newSprint;
}

export function updateSprint(sprintId: string, updates: Partial<Sprint>): void {
  const state = useAppStore.getState();
  const sprints = state.getCurrentState().sprints
    .map(s => s.id === sprintId ? { ...s, ...updates } : s)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  state.updateData({ sprints });
}

export function deleteSprint(sprintId: string): void {
  const state = useAppStore.getState();
  const sprints = state.getCurrentState().sprints.filter(s => s.id !== sprintId);
  state.updateData({ sprints });
}

export function generateSprintsForYear(year: number, startDate?: string): Sprint[] {
  const state = useAppStore.getState();
  const settings = state.getCurrentState().settings;
  const existingSprints = state.getCurrentState().sprints;

  const sprintsPerYear = settings.sprintsPerYear || 16;
  const durationWeeks = settings.sprintDurationWeeks || 3;
  const byeWeeksAfter = settings.byeWeeksAfter || [];

  let currentDate: Date;
  if (startDate) {
    currentDate = new Date(startDate);
  } else {
    currentDate = new Date(year, 0, 1);
    while (currentDate.getDay() !== 1) {
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  const newSprints: Sprint[] = [];
  for (let i = 1; i <= sprintsPerYear; i++) {
    const sprintStart = new Date(currentDate);
    const sprintEnd = new Date(currentDate);
    sprintEnd.setDate(sprintEnd.getDate() + (durationWeeks * 7) - 1);
    const month = sprintStart.getMonth();
    const quarterNum = month <= 2 ? 1 : month <= 5 ? 2 : month <= 8 ? 3 : 4;
    newSprints.push({
      id: generateId('sprint'),
      name: `Sprint ${i}`,
      number: i,
      year,
      startDate: sprintStart.toISOString().split('T')[0],
      endDate: sprintEnd.toISOString().split('T')[0],
      quarter: `Q${quarterNum} ${year}`,
      isByeWeek: byeWeeksAfter.includes(i),
    });
    currentDate.setDate(currentDate.getDate() + (durationWeeks * 7));
  }

  const allSprints = [...existingSprints.filter(s => s.year !== year), ...newSprints]
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  state.updateData({ sprints: allSprints });
  return newSprints;
}

export function clearSprintsForYear(year: number): void {
  const state = useAppStore.getState();
  state.updateData({ sprints: state.getCurrentState().sprints.filter(s => s.year !== year) });
}

// ═══════════════════════════════════════════════════════════════════════════
// JIRA CONNECTION ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

export function addJiraConnection(connectionData: Omit<JiraConnection, 'id' | 'createdAt' | 'updatedAt'>): JiraConnection {
  const state = useAppStore.getState();
  const now = new Date().toISOString();
  const newConnection: JiraConnection = {
    ...connectionData,
    defaultDaysPerItem: connectionData.defaultDaysPerItem ?? 1,
    id: generateJiraId('jira-conn'),
    createdAt: now,
    updatedAt: now,
  };
  state.updateData({ jiraConnections: [...state.getCurrentState().jiraConnections, newConnection] });
  return newConnection;
}

export function updateJiraConnection(connectionId: string, updates: Partial<JiraConnection>): void {
  const state = useAppStore.getState();
  state.updateData({
    jiraConnections: state.getCurrentState().jiraConnections.map(c =>
      c.id === connectionId ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
    ),
  });
}

export function deleteJiraConnection(connectionId: string): void {
  const state = useAppStore.getState();
  state.updateData({
    jiraConnections: state.getCurrentState().jiraConnections.filter(c => c.id !== connectionId),
    jiraWorkItems: state.getCurrentState().jiraWorkItems.filter(w => w.connectionId !== connectionId),
  });
}

export function toggleJiraConnectionActive(connectionId: string): void {
  const state = useAppStore.getState();
  state.updateData({
    jiraConnections: state.getCurrentState().jiraConnections.map(c =>
      c.id === connectionId ? { ...c, isActive: !c.isActive, updatedAt: new Date().toISOString() } : c
    ),
  });
}

export function setJiraConnectionSyncStatus(
  connectionId: string,
  status: 'idle' | 'syncing' | 'success' | 'error',
  error?: string,
  historyEntry?: import('../types').JiraSyncHistoryEntry
): void {
  const state = useAppStore.getState();
  const now = new Date().toISOString();
  state.updateData({
    jiraConnections: state.getCurrentState().jiraConnections.map(c => {
      if (c.id !== connectionId) return c;
      const updated = {
        ...c,
        lastSyncStatus: status,
        lastSyncError: error,
        lastSyncAt: status === 'success' ? now : c.lastSyncAt,
        updatedAt: now,
      };
      if (historyEntry && (status === 'success' || status === 'error')) {
        updated.syncHistory = [historyEntry, ...(c.syncHistory || [])].slice(0, 10);
      }
      return updated;
    }),
  });
}

export function updateJiraSettings(updates: Partial<JiraSettings>): void {
  const state = useAppStore.getState();
  state.updateData({ jiraSettings: { ...state.getCurrentState().jiraSettings, ...updates } });
}

// ═══════════════════════════════════════════════════════════════════════════
// JIRA WORK ITEM ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compute the diff between Jira-fetched items and what is currently stored.
 * Does NOT apply changes — call syncJiraWorkItems after user confirms.
 */
export function computeSyncDiff(
  connectionId: string,
  newItems: JiraWorkItem[]
): import('../types').JiraSyncDiff {
  const state = useAppStore.getState();
  const existingItems = state.getCurrentState().jiraWorkItems;
  const existingConnectionItems = existingItems.filter(i => i.connectionId === connectionId);
  const existingByJiraId = new Map(existingConnectionItems.map(i => [i.jiraId, i]));
  const newJiraIds = new Set(newItems.map(i => i.jiraId));

  const toAdd = newItems.filter(i => !existingByJiraId.has(i.jiraId));
  const toUpdate = newItems.filter(i => existingByJiraId.has(i.jiraId));
  const toRemove = existingConnectionItems.filter(i => !newJiraIds.has(i.jiraId));

  return { connectionId, toAdd, toUpdate, toRemove, fetchedItems: newItems };
}

/**
 * Merge fetched Jira items into the store. Preserves local confidence overrides
 * and stale-sprint dates. Items not in the fetch are removed.
 */
export function syncJiraWorkItems(connectionId: string, newItems: JiraWorkItem[]): JiraSyncResult {
  const state = useAppStore.getState();
  const currentState = state.getCurrentState();
  const existingItems = currentState.jiraWorkItems;

  const otherConnectionItems = existingItems.filter(item => item.connectionId !== connectionId);
  const existingConnectionItems = existingItems.filter(item => item.connectionId === connectionId);
  const existingByJiraId = new Map(existingConnectionItems.map(item => [item.jiraId, item]));

  let itemsCreated = 0;
  let itemsUpdated = 0;

  const mergedItems = newItems.map(newItem => {
    const existing = existingByJiraId.get(newItem.jiraId);
    if (existing) {
      itemsUpdated++;
      return {
        ...newItem,
        id: existing.id,
        confidenceLevel: existing.confidenceLevel,
        sprintStartDate: newItem.sprintStartDate ?? existing.sprintStartDate,
        sprintEndDate: newItem.sprintEndDate ?? existing.sprintEndDate,
      };
    } else {
      itemsCreated++;
      return { ...newItem, id: generateJiraId('jira-item') };
    }
  });

  const newJiraIds = new Set(newItems.map(item => item.jiraId));
  const itemsRemoved = existingConnectionItems.filter(item => !newJiraIds.has(item.jiraId)).length;

  state.updateData({ jiraWorkItems: [...otherConnectionItems, ...mergedItems] });

  return {
    success: true,
    itemsSynced: mergedItems.length,
    itemsCreated,
    itemsUpdated,
    itemsRemoved,
    errors: [],
    timestamp: new Date().toISOString(),
  };
}

export function updateJiraWorkItemConfidence(
  workItemId: string,
  confidenceLevel: 'high' | 'medium' | 'low' | null
): void {
  const state = useAppStore.getState();
  const jiraWorkItems = state.getCurrentState().jiraWorkItems.map(item =>
    item.id === workItemId
      ? { ...item, confidenceLevel: confidenceLevel ?? undefined }
      : item
  );
  state.updateData({ jiraWorkItems });
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

export function createScenario(name: string, description?: string): Scenario {
  const state = useAppStore.getState();
  const currentState = state.getCurrentState();
  const now = new Date().toISOString();

  const newScenario: Scenario = {
    id: generateId('scenario'),
    name,
    description,
    createdAt: now,
    updatedAt: now,
    basedOnSyncAt: currentState.jiraConnections.find(c => c.lastSyncAt)?.lastSyncAt,
    isBaseline: false,
    jiraWorkItems: JSON.parse(JSON.stringify(currentState.jiraWorkItems)),
    jiraItemBizAssignments: JSON.parse(JSON.stringify(currentState.jiraItemBizAssignments)),
    teamMembers: JSON.parse(JSON.stringify(currentState.teamMembers)),
    timeOff: JSON.parse(JSON.stringify(currentState.timeOff)),
  };

  const scenarios = [...currentState.scenarios, newScenario];
  state.updateData({ scenarios, activeScenarioId: newScenario.id });
  return newScenario;
}

export function duplicateScenario(scenarioId: string, newName: string): Scenario | null {
  const state = useAppStore.getState();
  const currentState = state.getCurrentState();
  const sourceScenario = currentState.scenarios.find(s => s.id === scenarioId);
  if (!sourceScenario) return null;

  const now = new Date().toISOString();
  const newScenario: Scenario = {
    ...JSON.parse(JSON.stringify(sourceScenario)),
    id: generateId('scenario'),
    name: newName,
    createdAt: now,
    updatedAt: now,
    isBaseline: false,
  };

  state.updateData({ scenarios: [...currentState.scenarios, newScenario] });
  return newScenario;
}

export function updateScenario(scenarioId: string, updates: Partial<Pick<Scenario, 'name' | 'description' | 'color'>>): void {
  const state = useAppStore.getState();
  state.updateData({
    scenarios: state.getCurrentState().scenarios.map(s =>
      s.id === scenarioId ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s
    ),
  });
}

export function deleteScenario(scenarioId: string): void {
  const state = useAppStore.getState();
  const currentState = state.getCurrentState();
  const scenarios = currentState.scenarios.filter(s => s.id !== scenarioId);
  const activeScenarioId = currentState.activeScenarioId === scenarioId ? null : currentState.activeScenarioId;
  state.updateData({ scenarios, activeScenarioId });
}

export function switchScenario(scenarioId: string | null): void {
  useAppStore.getState().updateData({ activeScenarioId: scenarioId });
}

/**
 * Promote a scenario's data back to the baseline.
 * Overwrites baseline jiraWorkItems, jiraItemBizAssignments, teamMembers, and timeOff,
 * then switches the view back to baseline.
 */
export function promoteScenarioToBaseline(scenarioId: string): void {
  const state = useAppStore.getState();
  const scenario = state.data.scenarios.find(s => s.id === scenarioId);
  if (!scenario) return;

  state.updateData({
    jiraWorkItems: JSON.parse(JSON.stringify(scenario.jiraWorkItems)),
    jiraItemBizAssignments: JSON.parse(JSON.stringify(scenario.jiraItemBizAssignments)),
    teamMembers: JSON.parse(JSON.stringify(scenario.teamMembers)),
    timeOff: JSON.parse(JSON.stringify(scenario.timeOff)),
    activeScenarioId: null,
  });
}

export function refreshScenarioFromJira(scenarioId: string): void {
  const state = useAppStore.getState();
  const currentState = state.getCurrentState();
  const scenario = currentState.scenarios.find(s => s.id === scenarioId);
  if (!scenario) return;

  const updatedScenario: Scenario = {
    ...scenario,
    updatedAt: new Date().toISOString(),
    basedOnSyncAt: currentState.jiraConnections.find(c => c.lastSyncAt)?.lastSyncAt,
    jiraWorkItems: JSON.parse(JSON.stringify(currentState.jiraWorkItems)),
  };

  state.updateData({
    scenarios: currentState.scenarios.map(s => s.id === scenarioId ? updatedScenario : s),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// BUSINESS CONTACT ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

export function addBusinessContact(data: Omit<BusinessContact, 'id'>): BusinessContact {
  const state = useAppStore.getState();
  const contact: BusinessContact = { ...data, id: generateId('biz-contact') };
  state.updateData({ businessContacts: [...state.getCurrentState().businessContacts, contact] });
  return contact;
}

export function updateBusinessContact(id: string, updates: Partial<BusinessContact>): void {
  const state = useAppStore.getState();
  state.updateData({
    businessContacts: state.getCurrentState().businessContacts.map(c =>
      c.id === id ? { ...c, ...updates } : c
    ),
  });
}

export function deleteBusinessContact(id: string): void {
  const state = useAppStore.getState();
  const cs = state.getCurrentState();
  state.updateData({
    businessContacts: cs.businessContacts.filter(c => c.id !== id),
    businessTimeOff: cs.businessTimeOff.filter(t => t.contactId !== id),
    jiraItemBizAssignments: cs.jiraItemBizAssignments.filter(a => a.contactId !== id),
  });
}

export function bulkUpdateBusinessContacts(
  ids: string[],
  updates: Partial<BusinessContact>,
  arrayMode: 'replace' | 'add' = 'replace',
): void {
  const state = useAppStore.getState();
  const idSet = new Set(ids);
  const businessContacts = state.getCurrentState().businessContacts.map(c => {
    if (!idSet.has(c.id)) return c;
    const merged: BusinessContact = { ...c, ...updates };
    if (arrayMode === 'add' && updates.processTeamIds) {
      merged.processTeamIds = [...new Set([...(c.processTeamIds ?? []), ...updates.processTeamIds])];
    }
    return merged;
  });
  state.updateData({ businessContacts });
}

// ═══════════════════════════════════════════════════════════════════════════
// BUSINESS TIME OFF ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

export function addBusinessTimeOff(data: Omit<BusinessTimeOff, 'id'>): void {
  const state = useAppStore.getState();
  state.updateData({
    businessTimeOff: [...state.getCurrentState().businessTimeOff, { ...data, id: generateId('biz-to') }],
  });
}

export function removeBusinessTimeOff(id: string): void {
  const state = useAppStore.getState();
  state.updateData({ businessTimeOff: state.getCurrentState().businessTimeOff.filter(t => t.id !== id) });
}

// ═══════════════════════════════════════════════════════════════════════════
// JIRA ITEM BIZ ASSIGNMENT ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

export function upsertJiraItemBizAssignment(
  data: Omit<JiraItemBizAssignment, 'id'> & { id?: string }
): void {
  const state = useAppStore.getState();
  const existing = state.getCurrentState().jiraItemBizAssignments;
  const id = data.id ?? `jiba-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const record: JiraItemBizAssignment = { ...data, id };

  const duplicate = existing.find(
    a => a.jiraKey === record.jiraKey && a.contactId === record.contactId && a.id !== record.id
  );

  if (duplicate) {
    state.updateData({ jiraItemBizAssignments: existing.map(a => a.id === duplicate.id ? record : a) });
  } else {
    state.updateData({
      jiraItemBizAssignments: data.id
        ? existing.map(a => a.id === data.id ? record : a)
        : [...existing, record],
    });
  }
}

export function removeJiraItemBizAssignment(id: string): void {
  const state = useAppStore.getState();
  state.updateData({
    jiraItemBizAssignments: state.getCurrentState().jiraItemBizAssignments.filter(a => a.id !== id),
  });
}
