/**
 * Data action functions for the Capacity Planner
 * These functions modify the state and sync to localStorage
 */

import { useAppStore } from './appStore';
import type { Project, Phase, TeamMember, TimeOff, Assignment } from '../types';

// ═══════════════════════════════════════════════════════════════════════════════
// ID GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROJECT ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════════
// ASSIGNMENT ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export function setAssignment(
  projectId: string,
  phaseId: string,
  memberId: string,
  quarter: string,
  days: number
): void {
  const state = useAppStore.getState();
  const projects = state.getCurrentState().projects.map(project => {
    if (project.id !== projectId) return project;
    return {
      ...project,
      phases: project.phases.map(phase => {
        if (phase.id !== phaseId) return phase;
        
        // Find or create assignment
        const existingIndex = phase.assignments.findIndex(
          a => a.memberId === memberId && a.quarter === quarter
        );
        
        let newAssignments: Assignment[];
        if (days === 0) {
          // Remove assignment if days is 0
          newAssignments = phase.assignments.filter(
            a => !(a.memberId === memberId && a.quarter === quarter)
          );
        } else if (existingIndex >= 0) {
          // Update existing
          newAssignments = [...phase.assignments];
          newAssignments[existingIndex] = { memberId, quarter, days };
        } else {
          // Add new
          newAssignments = [...phase.assignments, { memberId, quarter, days }];
        }
        
        return { ...phase, assignments: newAssignments };
      }),
    };
  });
  state.updateData({ projects });
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEAM MEMBER ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

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
  const teamMembers = state.getCurrentState().teamMembers.map(m =>
    m.id === memberId ? { ...m, ...updates } : m
  );
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

// ═══════════════════════════════════════════════════════════════════════════════
// TIME OFF ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

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

export function deleteSystem(systemId: string): void {
  const state = useAppStore.getState();
  const systems = state.getCurrentState().systems.filter(s => s.id !== systemId);
  state.updateData({ systems });
}

// ═══════════════════════════════════════════════════════════════════════════════
// COUNTRY ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════════
// HOLIDAY ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

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
