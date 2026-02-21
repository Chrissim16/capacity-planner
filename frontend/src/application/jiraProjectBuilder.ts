/**
 * Jira-led import: automatically build Projects, Phases and Assignments
 * from synced JiraWorkItems so users never have to create structure by hand.
 *
 * The three public entry-points are:
 *  - buildProjectsFromJira()   — creates / updates Projects and Phases
 *  - buildAssignmentsFromJira() — creates Assignment suggestions per phase
 *  - detectHierarchyMode()     — resolves 'auto' to a concrete mode
 */

import type {
  JiraWorkItem,
  JiraConnection,
  JiraHierarchyMode,
  Project,
  Phase,
  Assignment,
  TeamMember,
  Sprint,
  JiraSettings,
} from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/** Return a "Q1 2026" string for the given sprint name by scanning app sprints. */
function sprintNameToQuarter(sprintName: string | undefined, sprints: Sprint[]): string | null {
  if (!sprintName) return null;
  const lower = sprintName.toLowerCase();
  const match = sprints.find(s => lower.includes(s.name.toLowerCase()));
  return match ? match.quarter : null;
}

/** Derive a quarter from a date string (YYYY-MM-DD). */
function dateToQuarter(dateStr: string): string {
  const d = new Date(dateStr);
  const q = Math.ceil((d.getMonth() + 1) / 3);
  return `Q${q} ${d.getFullYear()}`;
}

/** Current quarter as "Q1 2026" fallback. */
function currentQuarter(): string {
  return dateToQuarter(new Date().toISOString());
}

// ─────────────────────────────────────────────────────────────────────────────
// HIERARCHY DETECTION
// ─────────────────────────────────────────────────────────────────────────────

export type ResolvedHierarchyMode = 'epic_as_project' | 'feature_as_project' | 'flat';

export function detectHierarchyMode(
  workItems: JiraWorkItem[],
  connection: JiraConnection
): ResolvedHierarchyMode {
  if (connection.hierarchyMode !== 'auto') return connection.hierarchyMode;
  if (workItems.some(i => i.type === 'epic')) return 'epic_as_project';
  if (workItems.some(i => i.type === 'feature')) return 'feature_as_project';
  return 'flat';
}

// ─────────────────────────────────────────────────────────────────────────────
// PROJECT + PHASE BUILDER
// ─────────────────────────────────────────────────────────────────────────────

export interface ProjectBuildResult {
  /** Full updated project list (new + existing, no duplicates). */
  projects: Project[];
  /** Work items with mappedProjectId / mappedPhaseId auto-populated. */
  workItems: JiraWorkItem[];
  projectsCreated: number;
  projectsUpdated: number;
}

export function buildProjectsFromJira(
  workItems: JiraWorkItem[],
  connection: JiraConnection,
  existingProjects: Project[],
  sprints: Sprint[]
): ProjectBuildResult {
  const mode = detectHierarchyMode(workItems, connection);

  // Index existing jira-sourced projects/phases by their Jira key for fast lookup
  const existingByKey = new Map<string, Project>();
  for (const p of existingProjects) {
    if (p.jiraSourceKey) existingByKey.set(p.jiraSourceKey, p);
  }

  let projectsCreated = 0;
  let projectsUpdated = 0;

  // We'll rebuild the project list, keeping non-Jira projects untouched
  const manualProjects = existingProjects.filter(p => !p.syncedFromJira);
  const jiraProjects = existingProjects.filter(p => p.syncedFromJira);
  // Track which jira-sourced projects were touched so we can keep un-touched ones
  const touchedJiraKeys = new Set<string>();

  const resultProjects: Project[] = [...manualProjects];
  const updatedWorkItems: JiraWorkItem[] = workItems.map(i => ({ ...i }));

  // Helper: find or create a Project from a Jira item
  const upsertProject = (item: JiraWorkItem): Project => {
    const existing = existingByKey.get(item.jiraKey)
      ?? jiraProjects.find(p => p.jiraSourceKey === item.jiraKey);

    if (existing) {
      touchedJiraKeys.add(item.jiraKey);
      const nameChanged = existing.name !== item.summary;
      if (nameChanged) {
        projectsUpdated++;
        return { ...existing, name: item.summary };
      }
      return existing;
    }

    projectsCreated++;
    touchedJiraKeys.add(item.jiraKey);
    return {
      id: generateId('project'),
      name: item.summary,
      priority: 'Medium',
      status: 'Active',
      systemIds: [],
      phases: [],
      jiraSourceKey: item.jiraKey,
      syncedFromJira: true,
    };
  };

  // Helper: find or create a Phase within a project
  const upsertPhase = (project: Project, item: JiraWorkItem): { project: Project; phase: Phase } => {
    const existing = project.phases.find(ph => ph.jiraSourceKey === item.jiraKey);
    const quarter = sprintNameToQuarter(item.sprintName, sprints) ?? currentQuarter();

    if (existing) {
      const updated: Phase = existing.name !== item.summary
        ? { ...existing, name: item.summary }
        : existing;
      const phases = project.phases.map(ph => ph.id === updated.id ? updated : ph);
      return { project: { ...project, phases }, phase: updated };
    }

    const newPhase: Phase = {
      id: generateId('phase'),
      name: item.summary,
      startQuarter: quarter,
      endQuarter: quarter,
      requiredSkillIds: [],
      predecessorPhaseId: null,
      assignments: [],
      jiraSourceKey: item.jiraKey,
    };
    return {
      project: { ...project, phases: [...project.phases, newPhase] },
      phase: newPhase,
    };
  };

  // Build a key→project map for in-progress assembly
  const projectMap = new Map<string, Project>();

  if (mode === 'epic_as_project') {
    const epics = workItems.filter(i => i.type === 'epic');
    const features = workItems.filter(i => i.type === 'feature');
    const epicKeys = new Set(epics.map(e => e.jiraKey));

    // 1. Upsert projects for each epic
    for (const epic of epics) {
      projectMap.set(epic.jiraKey, upsertProject(epic));
    }

    // 2. Map epics in work items
    for (const wi of updatedWorkItems) {
      if (wi.type === 'epic' && projectMap.has(wi.jiraKey)) {
        wi.mappedProjectId = projectMap.get(wi.jiraKey)!.id;
      }
    }

    // 3. Upsert phases for features that have an epic parent
    for (const feature of features) {
      const parentKey = feature.parentKey;
      if (parentKey && epicKeys.has(parentKey)) {
        let project = projectMap.get(parentKey)!;
        const { project: updatedProject, phase } = upsertPhase(project, feature);
        projectMap.set(parentKey, updatedProject);

        // Set mappings on work item
        const wi = updatedWorkItems.find(i => i.id === feature.id);
        if (wi) { wi.mappedProjectId = updatedProject.id; wi.mappedPhaseId = phase.id; }
      } else {
        // Feature has no epic parent → becomes its own project
        const featureProject = upsertProject(feature);
        projectMap.set(feature.jiraKey, featureProject);
        const wi = updatedWorkItems.find(i => i.id === feature.id);
        if (wi) wi.mappedProjectId = featureProject.id;
      }
    }

    // 4. Set mappings on stories/bugs/tasks
    for (const wi of updatedWorkItems) {
      if (wi.type === 'story' || wi.type === 'task' || wi.type === 'bug') {
        // Try grandparent (parent is a feature, grandparent is an epic)
        const parentFeature = features.find(f => f.jiraKey === wi.parentKey);
        if (parentFeature) {
          const grandparentKey = parentFeature.parentKey;
          if (grandparentKey && projectMap.has(grandparentKey)) {
            const proj = projectMap.get(grandparentKey)!;
            const phase = proj.phases.find(ph => ph.jiraSourceKey === parentFeature.jiraKey);
            wi.mappedProjectId = proj.id;
            if (phase) wi.mappedPhaseId = phase.id;
          } else {
            // Parent feature is its own project
            const proj = projectMap.get(parentFeature.jiraKey);
            if (proj) wi.mappedProjectId = proj.id;
          }
        } else if (wi.parentKey && epicKeys.has(wi.parentKey)) {
          // Direct child of epic (no feature in between)
          wi.mappedProjectId = projectMap.get(wi.parentKey)?.id;
        }
      }
    }

  } else if (mode === 'feature_as_project') {
    const features = workItems.filter(i => i.type === 'feature');

    for (const feature of features) {
      projectMap.set(feature.jiraKey, upsertProject(feature));
    }

    for (const wi of updatedWorkItems) {
      if (wi.type === 'feature' && projectMap.has(wi.jiraKey)) {
        wi.mappedProjectId = projectMap.get(wi.jiraKey)!.id;
      } else if (wi.parentKey && projectMap.has(wi.parentKey)) {
        wi.mappedProjectId = projectMap.get(wi.parentKey)!.id;
      }
    }

  } else {
    // flat: one project per connection
    const flatProjectKey = `flat-${connection.id}`;
    const flatItem: JiraWorkItem = {
      id: flatProjectKey,
      connectionId: connection.id,
      jiraKey: flatProjectKey,
      jiraId: flatProjectKey,
      summary: connection.jiraProjectName || connection.jiraProjectKey,
      type: 'epic',
      typeName: 'Epic',
      status: 'Active',
      statusCategory: 'in_progress',
      labels: [],
      components: [],
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    };
    const flatProject = upsertProject(flatItem);
    projectMap.set(flatProjectKey, flatProject);
    for (const wi of updatedWorkItems) {
      wi.mappedProjectId = flatProject.id;
    }
  }

  // Collect assembled projects
  for (const project of projectMap.values()) {
    resultProjects.push(project);
  }
  // Keep Jira-sourced projects that weren't part of this sync (different connection, etc.)
  for (const jp of jiraProjects) {
    if (jp.jiraSourceKey && !touchedJiraKeys.has(jp.jiraSourceKey)) {
      resultProjects.push(jp);
    }
  }

  return { projects: resultProjects, workItems: updatedWorkItems, projectsCreated, projectsUpdated };
}

// ─────────────────────────────────────────────────────────────────────────────
// ASSIGNMENT BUILDER
// ─────────────────────────────────────────────────────────────────────────────

export interface AssignmentBuildResult {
  /** Projects with updated phase assignments. */
  projects: Project[];
  assignmentsCreated: number;
}

export function buildAssignmentsFromJira(
  workItems: JiraWorkItem[],
  teamMembers: TeamMember[],
  projects: Project[],
  sprints: Sprint[],
  jiraSettings: JiraSettings
): AssignmentBuildResult {
  const memberByEmail = new Map(
    teamMembers
      .filter(m => m.email)
      .map(m => [m.email!.toLowerCase(), m])
  );
  const memberByJiraId = new Map(
    teamMembers
      .filter(m => m.jiraAccountId)
      .map(m => [m.jiraAccountId!, m])
  );

  // Build a mutable copy of projects (only touching phases)
  const projectMap = new Map<string, Project>(projects.map(p => [p.id, { ...p, phases: p.phases.map(ph => ({ ...ph, assignments: [...ph.assignments] })) }]));

  let assignmentsCreated = 0;
  const storyPointsToDays = jiraSettings.storyPointsToDays || 0.5;

  for (const item of workItems) {
    // Must have assignee, sprint, and a phase to attach to
    if (!item.assigneeEmail && !item.sprintName) continue;
    if (!item.mappedProjectId || !item.mappedPhaseId) continue;

    // Resolve team member
    const member = item.assigneeEmail
      ? (memberByEmail.get(item.assigneeEmail.toLowerCase()) ?? memberByJiraId.get(item.assigneeEmail))
      : undefined;
    if (!member) continue;

    // Resolve quarter
    const quarter = sprintNameToQuarter(item.sprintName, sprints);
    if (!quarter) continue;

    // Convert story points → days
    const days = item.storyPoints
      ? Math.round(item.storyPoints * storyPointsToDays * 10) / 10
      : 0; // no fallback days for individual items — accumulate story-pointed ones only
    if (days <= 0) continue;

    // Find phase
    const project = projectMap.get(item.mappedProjectId);
    if (!project) continue;
    const phaseIdx = project.phases.findIndex(ph => ph.id === item.mappedPhaseId);
    if (phaseIdx === -1) continue;
    const phase = project.phases[phaseIdx];

    // Find existing assignment for this member+quarter in this phase
    const existingIdx = phase.assignments.findIndex(
      a => a.memberId === member.id && a.quarter === quarter
    );

    if (existingIdx >= 0) {
      const existing = phase.assignments[existingIdx];
      // Never overwrite manually-set assignments
      if (existing.jiraSynced === false) continue;
      // Accumulate days from multiple items in the same phase+member+quarter
      phase.assignments[existingIdx] = {
        ...existing,
        days: Math.round((existing.days + days) * 10) / 10,
        jiraSynced: true,
      };
    } else {
      phase.assignments.push({ memberId: member.id, quarter, days, jiraSynced: true });
      assignmentsCreated++;
    }
  }

  return {
    projects: [...projectMap.values()],
    assignmentsCreated,
  };
}
