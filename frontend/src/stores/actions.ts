/**
 * Data action functions for the Capacity Planner
 * These functions modify the state and sync to localStorage
 */

import { useAppStore } from './appStore';
import type { Project, Phase, TeamMember, TimeOff, Assignment, Sprint } from '../types';

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ID GENERATION
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// PROJECT ACTIONS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export function addProject(projectData: Omit<Project, 'id'>): Project {
  const state = useAppStore.getState();
  const newProject: Project = {
    ...projectData,
    id: generateId('project'),
  };
  
  const updatedProjects = [...state.getCurrentState().projects, newProject];
  state.updateData({ projects: updatedProjects });
  
  return newProject;
}

export function updateProject(projectId: string, updates: Partial<Project>): void {
  const state = useAppStore.getState();
  const projects = state.getCurrentState().projects.map(p =>
    p.id === projectId ? { ...p, ...updates } : p
  );
  state.updateData({ projects });
}

export function deleteProject(projectId: string): void {
  const state = useAppStore.getState();
  const projects = state.getCurrentState().projects.filter(p => p.id !== projectId);
  state.updateData({ projects });
}

export function duplicateProject(projectId: string): Project | null {
  const state = useAppStore.getState();
  const original = state.getCurrentState().projects.find(p => p.id === projectId);
  if (!original) return null;
  
  const newProject: Project = {
    ...original,
    id: generateId('project'),
    name: `${original.name} (Copy)`,
    phases: original.phases.map(phase => ({
      ...phase,
      id: generateId('phase'),
      assignments: [], // Clear assignments for the copy
    })),
  };
  
  const updatedProjects = [...state.getCurrentState().projects, newProject];
  state.updateData({ projects: updatedProjects });
  
  return newProject;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// PHASE ACTIONS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export function addPhase(projectId: string, phaseData: Omit<Phase, 'id'>): Phase | null {
  const state = useAppStore.getState();
  const projects = state.getCurrentState().projects;
  const projectIndex = projects.findIndex(p => p.id === projectId);
  if (projectIndex === -1) return null;
  
  const newPhase: Phase = {
    ...phaseData,
    id: generateId('phase'),
  };
  
  const updatedProjects = [...projects];
  updatedProjects[projectIndex] = {
    ...updatedProjects[projectIndex],
    phases: [...updatedProjects[projectIndex].phases, newPhase],
  };
  
  state.updateData({ projects: updatedProjects });
  return newPhase;
}

export function updatePhase(projectId: string, phaseId: string, updates: Partial<Phase>): void {
  const state = useAppStore.getState();
  const projects = state.getCurrentState().projects.map(project => {
    if (project.id !== projectId) return project;
    return {
      ...project,
      phases: project.phases.map(phase =>
        phase.id === phaseId ? { ...phase, ...updates } : phase
      ),
    };
  });
  state.updateData({ projects });
}

export function deletePhase(projectId: string, phaseId: string): void {
  const state = useAppStore.getState();
  const projects = state.getCurrentState().projects.map(project => {
    if (project.id !== projectId) return project;
    return {
      ...project,
      phases: project.phases.filter(phase => phase.id !== phaseId),
    };
  });
  state.updateData({ projects });
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ASSIGNMENT ACTIONS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export function setAssignment(
  projectId: string,
  phaseId: string,
  memberId: string,
  quarter: string,
  days: number,
  sprint?: string // Optional sprint for sprint-level assignments
): void {
  const state = useAppStore.getState();
  const projects = state.getCurrentState().projects.map(project => {
    if (project.id !== projectId) return project;
    return {
      ...project,
      phases: project.phases.map(phase => {
        if (phase.id !== phaseId) return phase;
        
        // For sprint-level assignments, match on sprint too
        const matchAssignment = (a: Assignment) => {
          if (sprint) {
            return a.memberId === memberId && a.quarter === quarter && a.sprint === sprint;
          }
          // For quarter-level, only match quarter assignments (no sprint)
          return a.memberId === memberId && a.quarter === quarter && !a.sprint;
        };
        
        const existingIndex = phase.assignments.findIndex(matchAssignment);
        
        let newAssignments: Assignment[];
        if (days === 0) {
          // Remove assignment if days is 0
          newAssignments = phase.assignments.filter(a => !matchAssignment(a));
        } else if (existingIndex >= 0) {
          // Update existing
          newAssignments = [...phase.assignments];
          newAssignments[existingIndex] = { memberId, quarter, days, sprint };
        } else {
          // Add new
          newAssignments = [...phase.assignments, { memberId, quarter, days, sprint }];
        }
        
        return { ...phase, assignments: newAssignments };
      }),
    };
  });
  state.updateData({ projects });
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TEAM MEMBER ACTIONS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export function addTeamMember(memberData: Omit<TeamMember, 'id'>): TeamMember {
  const state = useAppStore.getState();
  const newMember: TeamMember = {
    ...memberData,
    id: generateId('member'),
  };
  
  const updatedMembers = [...state.getCurrentState().teamMembers, newMember];
  state.updateData({ teamMembers: updatedMembers });
  
  return newMember;
}

export function updateTeamMember(memberId: string, updates: Partial<TeamMember>): void {
  const state = useAppStore.getState();
  const teamMembers = state.getCurrentState().teamMembers.map(m => {
    if (m.id !== memberId) return m;
    const updated = { ...m, ...updates };
    // Clear needsEnrichment once the user has set both role and country
    if (updated.role && updated.countryId) updated.needsEnrichment = false;
    return updated;
  });
  state.updateData({ teamMembers });
}

export function deleteTeamMember(memberId: string): void {
  const state = useAppStore.getState();
  const teamMembers = state.getCurrentState().teamMembers.filter(m => m.id !== memberId);
  // Also remove all assignments for this member
  const projects = state.getCurrentState().projects.map(project => ({
    ...project,
    phases: project.phases.map(phase => ({
      ...phase,
      assignments: phase.assignments.filter(a => a.memberId !== memberId),
    })),
  }));
  state.updateData({ teamMembers, projects });
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
  
  // Extract unique assignees from Jira work items
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
  
  // Process each unique assignee
  const updatedMembers: TeamMember[] = [];
  const processedEmails = new Set<string>();
  
  for (const [emailKey, assignee] of assigneeMap) {
    // Check if member already exists (by email)
    const existingMember = existingMembers.find(
      m => m.email?.toLowerCase() === emailKey
    );
    
    if (existingMember) {
      // Update name if it changed in Jira (only for Jira-sourced members)
      if (existingMember.name !== assignee.name && existingMember.syncedFromJira) {
        updatedMembers.push({
          ...existingMember,
          name: assignee.name,
        });
        result.updated++;
      } else {
        updatedMembers.push(existingMember);
        result.unchanged++;
      }
      processedEmails.add(emailKey);
    } else {
      // Create new team member from Jira
      const newMember: TeamMember = {
        id: generateId('member'),
        name: assignee.name,
        email: assignee.email,
        role: '', // Needs enrichment
        countryId: '', // Needs enrichment
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
  
  // Keep existing members that weren't in Jira
  for (const member of existingMembers) {
    const emailKey = member.email?.toLowerCase();
    if (!emailKey || !processedEmails.has(emailKey)) {
      updatedMembers.push(member);
    }
  }
  
  // Update state
  state.updateData({ teamMembers: updatedMembers });
  
  return result;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TIME OFF ACTIONS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export function setTimeOff(memberId: string, quarter: string, days: number, reason?: string): void {
  const state = useAppStore.getState();
  const timeOff = state.getCurrentState().timeOff;
  
  const existingIndex = timeOff.findIndex(
    t => t.memberId === memberId && t.quarter === quarter
  );
  
  let newTimeOff: TimeOff[];
  if (days === 0) {
    // Remove if days is 0
    newTimeOff = timeOff.filter(
      t => !(t.memberId === memberId && t.quarter === quarter)
    );
  } else if (existingIndex >= 0) {
    // Update existing
    newTimeOff = [...timeOff];
    newTimeOff[existingIndex] = { memberId, quarter, days, reason };
  } else {
    // Add new
    newTimeOff = [...timeOff, { memberId, quarter, days, reason }];
  }
  
  state.updateData({ timeOff: newTimeOff });
}

export function deleteTimeOff(memberId: string, quarter: string): void {
  const state = useAppStore.getState();
  const timeOff = state.getCurrentState().timeOff.filter(
    t => !(t.memberId === memberId && t.quarter === quarter)
  );
  state.updateData({ timeOff });
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SETTINGS ACTIONS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export function updateSettings(updates: Record<string, unknown>): void {
  const state = useAppStore.getState();
  state.updateData({
    settings: { ...state.getCurrentState().settings, ...updates },
  });
}

export function addRole(name: string): void {
  const state = useAppStore.getState();
  const roles = [...state.getCurrentState().roles, { id: generateId('role'), name }];
  state.updateData({ roles });
}

export function deleteRole(roleId: string): void {
  const state = useAppStore.getState();
  const roles = state.getCurrentState().roles.filter(r => r.id !== roleId);
  state.updateData({ roles });
}

export function addSkill(name: string, category: 'System' | 'Process' | 'Technical'): void {
  const state = useAppStore.getState();
  const skills = [...state.getCurrentState().skills, { id: generateId('skill'), name, category }];
  state.updateData({ skills });
}

export function deleteSkill(skillId: string): void {
  const state = useAppStore.getState();
  const skills = state.getCurrentState().skills.filter(s => s.id !== skillId);
  state.updateData({ skills });
}

export function addSystem(name: string, description?: string): void {
  const state = useAppStore.getState();
  const systems = [...state.getCurrentState().systems, { id: generateId('sys'), name, description }];
  state.updateData({ systems });
}

export function updateSystem(systemId: string, updates: { name?: string; description?: string }): void {
  const state = useAppStore.getState();
  const systems = state.getCurrentState().systems.map(s =>
    s.id === systemId ? { ...s, ...updates } : s
  );
  state.updateData({ systems });
}

export function deleteSystem(systemId: string): void {
  const state = useAppStore.getState();
  const systems = state.getCurrentState().systems.filter(s => s.id !== systemId);
  state.updateData({ systems });
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// COUNTRY ACTIONS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export function addCountry(code: string, name: string, flag?: string): void {
  const state = useAppStore.getState();
  const countries = [...state.getCurrentState().countries, { 
    id: generateId('country'), 
    code: code.toUpperCase(), 
    name,
    flag 
  }];
  state.updateData({ countries });
}

export function updateCountry(countryId: string, updates: { code?: string; name?: string; flag?: string }): void {
  const state = useAppStore.getState();
  const countries = state.getCurrentState().countries.map(c =>
    c.id === countryId ? { ...c, ...updates } : c
  );
  state.updateData({ countries });
}

export function deleteCountry(countryId: string): void {
  const state = useAppStore.getState();
  const countries = state.getCurrentState().countries.filter(c => c.id !== countryId);
  // Also remove holidays for this country
  const publicHolidays = state.getCurrentState().publicHolidays.filter(h => h.countryId !== countryId);
  state.updateData({ countries, publicHolidays });
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// HOLIDAY ACTIONS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export function addHoliday(countryId: string, date: string, name: string): void {
  const state = useAppStore.getState();
  const publicHolidays = [...state.getCurrentState().publicHolidays, {
    id: generateId('holiday'),
    countryId,
    date,
    name,
  }];
  state.updateData({ publicHolidays });
}

export function updateHoliday(holidayId: string, updates: { date?: string; name?: string }): void {
  const state = useAppStore.getState();
  const publicHolidays = state.getCurrentState().publicHolidays.map(h =>
    h.id === holidayId ? { ...h, ...updates } : h
  );
  state.updateData({ publicHolidays });
}

export function deleteHoliday(holidayId: string): void {
  const state = useAppStore.getState();
  const publicHolidays = state.getCurrentState().publicHolidays.filter(h => h.id !== holidayId);
  state.updateData({ publicHolidays });
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SPRINT ACTIONS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export function addSprint(sprintData: Omit<Sprint, 'id'>): Sprint {
  const state = useAppStore.getState();
  const newSprint: Sprint = {
    ...sprintData,
    id: generateId('sprint'),
  };
  
  const sprints = [...state.getCurrentState().sprints, newSprint];
  // Sort by startDate
  sprints.sort((a, b) => a.startDate.localeCompare(b.startDate));
  state.updateData({ sprints });
  
  return newSprint;
}

export function updateSprint(sprintId: string, updates: Partial<Sprint>): void {
  const state = useAppStore.getState();
  const sprints = state.getCurrentState().sprints.map(s =>
    s.id === sprintId ? { ...s, ...updates } : s
  );
  // Re-sort by startDate in case dates changed
  sprints.sort((a, b) => a.startDate.localeCompare(b.startDate));
  state.updateData({ sprints });
}

export function deleteSprint(sprintId: string): void {
  const state = useAppStore.getState();
  const sprints = state.getCurrentState().sprints.filter(s => s.id !== sprintId);
  // Also remove any sprint-level assignments for this sprint
  const projects = state.getCurrentState().projects.map(project => ({
    ...project,
    phases: project.phases.map(phase => ({
      ...phase,
      assignments: phase.assignments.filter(a => a.sprint !== sprintId),
    })),
  }));
  state.updateData({ sprints, projects });
}

/**
 * Generate sprints for a given year based on settings
 * @param year - The year to generate sprints for
 * @param startDate - Optional start date (defaults to first Monday of the year)
 */
export function generateSprintsForYear(year: number, startDate?: string): Sprint[] {
  const state = useAppStore.getState();
  const settings = state.getCurrentState().settings;
  const existingSprints = state.getCurrentState().sprints;
  
  const sprintsPerYear = settings.sprintsPerYear || 16;
  const durationWeeks = settings.sprintDurationWeeks || 3;
  const byeWeeksAfter = settings.byeWeeksAfter || [];
  
  // Default to first Monday of the year
  let currentDate: Date;
  if (startDate) {
    currentDate = new Date(startDate);
  } else {
    currentDate = new Date(year, 0, 1); // Jan 1
    // Find first Monday
    while (currentDate.getDay() !== 1) {
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }
  
  const newSprints: Sprint[] = [];
  
  for (let i = 1; i <= sprintsPerYear; i++) {
    const sprintStart = new Date(currentDate);
    const sprintEnd = new Date(currentDate);
    sprintEnd.setDate(sprintEnd.getDate() + (durationWeeks * 7) - 1);
    
    // Determine quarter
    const month = sprintStart.getMonth();
    let quarterNum: number;
    if (month <= 2) quarterNum = 1;
    else if (month <= 5) quarterNum = 2;
    else if (month <= 8) quarterNum = 3;
    else quarterNum = 4;
    
    const sprint: Sprint = {
      id: generateId('sprint'),
      name: `Sprint ${i}`,
      number: i,
      year: year,
      startDate: sprintStart.toISOString().split('T')[0],
      endDate: sprintEnd.toISOString().split('T')[0],
      quarter: `Q${quarterNum} ${year}`,
      isByeWeek: byeWeeksAfter.includes(i),
    };
    
    newSprints.push(sprint);
    
    // Move to next sprint start
    currentDate.setDate(currentDate.getDate() + (durationWeeks * 7));
  }
  
  // Combine with existing sprints (remove duplicates for the same year)
  const filteredExisting = existingSprints.filter(s => s.year !== year);
  const allSprints = [...filteredExisting, ...newSprints];
  allSprints.sort((a, b) => a.startDate.localeCompare(b.startDate));
  
  state.updateData({ sprints: allSprints });
  
  return newSprints;
}

/**
 * Clear all sprints for a specific year
 */
export function clearSprintsForYear(year: number): void {
  const state = useAppStore.getState();
  const sprints = state.getCurrentState().sprints.filter(s => s.year !== year);
  state.updateData({ sprints });
}

// JIRA ACTIONS

import type { JiraConnection, JiraSettings, JiraWorkItem, Scenario, JiraSyncResult } from '../types';

export function generateJiraId(prefix: string): string {
  return prefix + '-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

export function addJiraConnection(connectionData: Omit<JiraConnection, 'id' | 'createdAt' | 'updatedAt'>): JiraConnection {
  const state = useAppStore.getState();
  const now = new Date().toISOString();
  const newConnection: JiraConnection = {
    ...connectionData,
    // Ensure import behaviour defaults if the caller omitted them
    hierarchyMode: connectionData.hierarchyMode ?? 'auto',
    autoCreateProjects: connectionData.autoCreateProjects ?? true,
    autoCreateAssignments: connectionData.autoCreateAssignments ?? true,
    defaultDaysPerItem: connectionData.defaultDaysPerItem ?? 1,
    id: generateJiraId('jira-conn'),
    createdAt: now,
    updatedAt: now,
  };
  const jiraConnections = [...state.getCurrentState().jiraConnections, newConnection];
  state.updateData({ jiraConnections });
  return newConnection;
}

export function updateJiraConnection(connectionId: string, updates: Partial<JiraConnection>): void {
  const state = useAppStore.getState();
  const jiraConnections = state.getCurrentState().jiraConnections.map(c =>
    c.id === connectionId ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
  );
  state.updateData({ jiraConnections });
}

export function deleteJiraConnection(connectionId: string): void {
  const state = useAppStore.getState();
  const jiraConnections = state.getCurrentState().jiraConnections.filter(c => c.id !== connectionId);
  const jiraWorkItems = state.getCurrentState().jiraWorkItems.filter(w => w.connectionId !== connectionId);
  state.updateData({ jiraConnections, jiraWorkItems });
}

export function toggleJiraConnectionActive(connectionId: string): void {
  const state = useAppStore.getState();
  const jiraConnections = state.getCurrentState().jiraConnections.map(c =>
    c.id === connectionId ? { ...c, isActive: !c.isActive, updatedAt: new Date().toISOString() } : c
  );
  state.updateData({ jiraConnections });
}

export function setJiraConnectionSyncStatus(
  connectionId: string,
  status: 'idle' | 'syncing' | 'success' | 'error',
  error?: string,
  historyEntry?: import('../types').JiraSyncHistoryEntry
): void {
  const state = useAppStore.getState();
  const now = new Date().toISOString();
  const jiraConnections = state.getCurrentState().jiraConnections.map(c => {
    if (c.id !== connectionId) return c;
    const updated = {
      ...c,
      lastSyncStatus: status,
      lastSyncError: error,
      lastSyncAt: status === 'success' ? now : c.lastSyncAt,
      updatedAt: now,
    };
    // US-011: append to sync history (keep last 10)
    if (historyEntry && (status === 'success' || status === 'error')) {
      const existing = c.syncHistory || [];
      updated.syncHistory = [historyEntry, ...existing].slice(0, 10);
    }
    return updated;
  });
  state.updateData({ jiraConnections });
}

export function updateJiraSettings(updates: Partial<JiraSettings>): void {
  const state = useAppStore.getState();
  const jiraSettings = { ...state.getCurrentState().jiraSettings, ...updates };
  state.updateData({ jiraSettings });
}

/**
 * US-007: Compute the diff between Jira-fetched items and what's currently stored.
 * Does NOT apply changes — call syncJiraWorkItems to apply after user confirms.
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
  const mappingsToPreserve = existingConnectionItems.filter(
    i => newJiraIds.has(i.jiraId) && (i.mappedProjectId || i.mappedPhaseId || i.mappedMemberId)
  ).length;

  return { connectionId, toAdd, toUpdate, toRemove, mappingsToPreserve, fetchedItems: newItems };
}

/**
 * US-008: Smart merge — updates Jira fields but always preserves local mappings.
 * Returns a result including how many mappings were preserved.
 */
export function syncJiraWorkItems(connectionId: string, newItems: JiraWorkItem[]): JiraSyncResult {
  const state = useAppStore.getState();
  const existingItems = state.getCurrentState().jiraWorkItems;
  
  const otherConnectionItems = existingItems.filter(item => item.connectionId !== connectionId);
  const existingConnectionItems = existingItems.filter(item => item.connectionId === connectionId);
  const existingByJiraId = new Map(existingConnectionItems.map(item => [item.jiraId, item]));
  
  let itemsCreated = 0;
  let itemsUpdated = 0;
  let mappingsPreserved = 0;
  
  const mergedItems = newItems.map(newItem => {
    const existing = existingByJiraId.get(newItem.jiraId);
    if (existing) {
      itemsUpdated++;
      const hasMappings = !!(existing.mappedProjectId || existing.mappedPhaseId || existing.mappedMemberId);
      if (hasMappings) mappingsPreserved++;
      // US-008: Preserve all local-only fields (mappings survive the sync)
      return {
        ...newItem,
        id: existing.id,
        mappedProjectId: existing.mappedProjectId,
        mappedPhaseId: existing.mappedPhaseId,
        mappedMemberId: existing.mappedMemberId,
      };
    } else {
      itemsCreated++;
      return { ...newItem, id: generateJiraId('jira-item') };
    }
  });
  
  const newJiraIds = new Set(newItems.map(item => item.jiraId));
  const removedItems = existingConnectionItems.filter(item => !newJiraIds.has(item.jiraId));
  
  state.updateData({ jiraWorkItems: [...otherConnectionItems, ...mergedItems] });
  
  return {
    success: true,
    itemsSynced: mergedItems.length,
    itemsCreated,
    itemsUpdated,
    itemsRemoved: removedItems.length,
    mappingsPreserved,
    projectsCreated: 0,
    projectsUpdated: 0,
    assignmentsCreated: 0,
    errors: [],
    timestamp: new Date().toISOString(),
  };
}

export function updateJiraWorkItemMapping(
  workItemId: string,
  mapping: { mappedProjectId?: string; mappedPhaseId?: string; mappedMemberId?: string }
): void {
  const state = useAppStore.getState();
  const jiraWorkItems = state.getCurrentState().jiraWorkItems.map(item =>
    item.id === workItemId ? { ...item, ...mapping } : item
  );
  state.updateData({ jiraWorkItems });
}

export function clearJiraWorkItemMappings(workItemIds: string[]): void {
  const state = useAppStore.getState();
  const idSet = new Set(workItemIds);
  const jiraWorkItems = state.getCurrentState().jiraWorkItems.map(item =>
    idSet.has(item.id) 
      ? { ...item, mappedProjectId: undefined, mappedPhaseId: undefined, mappedMemberId: undefined }
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
  
  // Create a new scenario as a copy of current baseline data
  const newScenario: Scenario = {
    id: generateId('scenario'),
    name,
    description,
    createdAt: now,
    updatedAt: now,
    basedOnSyncAt: currentState.jiraConnections.find(c => c.lastSyncAt)?.lastSyncAt,
    isBaseline: false,
    projects: JSON.parse(JSON.stringify(currentState.projects)),
    teamMembers: JSON.parse(JSON.stringify(currentState.teamMembers)),
    assignments: [], // Will be populated from project phases
    timeOff: JSON.parse(JSON.stringify(currentState.timeOff)),
    jiraWorkItems: JSON.parse(JSON.stringify(currentState.jiraWorkItems)),
  };
  
  // Extract assignments from project phases
  currentState.projects.forEach(project => {
    project.phases.forEach(phase => {
      phase.assignments.forEach(assignment => {
        newScenario.assignments.push({
          ...assignment,
        });
      });
    });
  });
  
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
  
  const scenarios = [...currentState.scenarios, newScenario];
  state.updateData({ scenarios });
  
  return newScenario;
}

export function updateScenario(scenarioId: string, updates: Partial<Pick<Scenario, 'name' | 'description'>>): void {
  const state = useAppStore.getState();
  const scenarios = state.getCurrentState().scenarios.map(s =>
    s.id === scenarioId ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s
  );
  state.updateData({ scenarios });
}

export function deleteScenario(scenarioId: string): void {
  const state = useAppStore.getState();
  const currentState = state.getCurrentState();
  const scenarios = currentState.scenarios.filter(s => s.id !== scenarioId);
  
  // If we deleted the active scenario, switch back to baseline
  const activeScenarioId = currentState.activeScenarioId === scenarioId ? null : currentState.activeScenarioId;
  
  state.updateData({ scenarios, activeScenarioId });
}

export function switchScenario(scenarioId: string | null): void {
  const state = useAppStore.getState();
  state.updateData({ activeScenarioId: scenarioId });
}

export function refreshScenarioFromJira(scenarioId: string): void {
  const state = useAppStore.getState();
  const currentState = state.getCurrentState();
  const scenario = currentState.scenarios.find(s => s.id === scenarioId);
  
  if (!scenario) return;
  
  // Update scenario with latest Jira data while preserving manual changes
  const updatedScenario: Scenario = {
    ...scenario,
    updatedAt: new Date().toISOString(),
    basedOnSyncAt: currentState.jiraConnections.find(c => c.lastSyncAt)?.lastSyncAt,
    jiraWorkItems: JSON.parse(JSON.stringify(currentState.jiraWorkItems)),
  };
  
  const scenarios = currentState.scenarios.map(s =>
    s.id === scenarioId ? updatedScenario : s
  );
  state.updateData({ scenarios });
}
