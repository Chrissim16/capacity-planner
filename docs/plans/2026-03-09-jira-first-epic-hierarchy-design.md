# Jira-First Epic Hierarchy — Design Document

**Date:** 2026-03-09
**Status:** Approved

## How to Start Implementation

1. Branch off `ui-redesign` (not main): `git checkout ui-redesign && git checkout -b refactor/epic-hierarchy`
2. This ensures the Sana Labs UI redesign is the starting point — the structural refactor happens on top of the new styling
3. Follow the implementation plan in `.cursor/plans/epic_import_&_scenarios_fix_5a4e90ce.plan.md` (10 phases, each a separate commit)
4. Start with Phase 1 (Types and State) — this is the foundation everything else depends on
5. Each phase should compile before moving to the next (TypeScript errors are expected mid-phase but must be resolved before committing)
6. Do NOT drop Supabase tables (`projects`, `assignments`, etc.) — leave them for rollback safety
7. The `ui-redesign` branch restyled files like `ProjectForm.tsx` and `AssignmentModal.tsx` that will be deleted in this refactor — that's expected and OK

## Problem

The Capacity Planner was originally built around a manual Project/Phase data model. Jira integration was added later as a data source that feeds into those existing entities via a translation layer (`buildProjectsFromJira`). This creates a confusing experience:

- Users must understand "linking" between Jira items and Projects/Phases
- Auto-creation of Projects sometimes doesn't trigger
- The naming is wrong: Jira Epics become "Projects", Features become "Phases"
- Two parallel data representations (JiraWorkItem + Project) can drift out of sync

## Decision

Eliminate the Project/Phase layer entirely. JiraWorkItem becomes the primary entity. All Epics come from Jira — there is no manual Epic creation.

## Data Model

### Primary entity: JiraWorkItem

The hierarchy lives in `JiraWorkItem` via `parentKey`:

- **Epic**: `type: 'epic'`, no `parentKey` (top level)
- **Feature**: `type: 'feature'`, `parentKey` = Epic's `jiraKey`
- **Story/Task/Bug**: `parentKey` = Feature's `jiraKey` (or Epic's, if no Feature)

### IT effort

Derived automatically from Jira data: `assigneeEmail` + `storyPoints` + `sprintName`. No manual IT assignment layer. Story points are converted to days using the existing confidence buffer system.

### BIZ effort

Manual via `JiraItemBizAssignment`:

```
JiraItemBizAssignment {
  id: string
  jiraKey: string      // Links to any item EXCEPT Epics
  contactId: string    // BusinessContact ID
  days: number
  notes?: string
}
```

Assignable at Feature, Story, Task, and Bug level — not at Epic level.

### Rollup

Full rollup at both IT and BIZ levels:
- Story BIZ days roll up to Feature total
- Feature BIZ days (direct + child) roll up to Epic total
- Same for IT days (story points aggregated up the hierarchy)

### Entities removed

| Entity | Replacement |
|--------|-------------|
| `Project` | Epic-type `JiraWorkItem` |
| `Phase` | Feature-type `JiraWorkItem` |
| `Assignment` (flattened) | IT: derived from Jira SP/assignee. BIZ: `JiraItemBizAssignment` |
| `BusinessAssignment` | `JiraItemBizAssignment` |
| `LocalPhase` (UAT/Hypercare) | Dropped |

### Entities kept

- `JiraWorkItem`, `JiraConnection`, `JiraSettings`
- `JiraItemBizAssignment` (the manual BIZ layer)
- `TeamMember`, `TimeOff`
- `BusinessContact`, `BusinessTimeOff`
- `Scenario` (updated to snapshot the new model)
- `Sprint`, `Settings`
- Reference data: `Country`, `PublicHoliday`, `Role`, `Skill`, `System`, `Squad`, `ProcessTeam`

## Sync Flow

Two steps, fully automatic:

1. User clicks **Sync** on a Jira connection
2. Preview modal shows new/updated/removed items
3. User clicks **Apply**

No "auto-link" step. No "auto-create projects" step. No "build assignments" step. The hierarchy IS the Jira hierarchy via `parentKey`.

What Apply does:
1. Upsert JiraWorkItem records (add new, update changed, mark removed as stale)
2. Create/update TeamMember records from Jira assignees

BIZ assignments are not affected by sync — they link by `jiraKey` which never changes.

### Filtering

- Per-type sync toggles: syncEpics, syncFeatures, syncStories, syncTasks, syncBugs
- Per-type status filters: All, Exclude Done, Active Only, To Do Only
- Custom JQL filter per connection

### Connection form simplification

Removed fields:
- `autoCreateProjects` (no Projects to create)
- `autoCreateAssignments` (IT assignments derived, not created)
- `hierarchyMode` (hierarchy comes from Jira parentKey)

## Epics Page (Renamed from Projects)

### Layout

**Top bar:** Search + filters (Status, Priority, Labels, Squad, Process Team, IT Member, BIZ Contact)

**Epic cards** (collapsible):
- Epic name + Jira key (linked), status badge, priority badge
- Summary stats: feature count, total IT days, total BIZ days, team members
- Labels as pills

**Feature rows** (under expanded Epic):
- Feature name, Jira status, IT assignee(s), BIZ contact(s)
- IT days (story points sum), BIZ days (assignment sum)

**Story rows** (configurable visibility under Features):
- Toggle to show/hide individual Stories
- Name, status, assignee, story points, BIZ contact, sprint

**Inline BIZ assignment:**
- Click BIZ cell on Feature or Story to assign contact + days
- Rollup updates automatically

### Label filter

Labels are imported from Jira on every sync. The Epics page has a label filter to show/hide Epics by label (post-import filtering, not sync-time exclusion).

## Scenarios

### What a scenario snapshots

- `jiraWorkItems[]` — full hierarchy at that point in time
- `jiraItemBizAssignments[]` — BIZ effort assignments
- `teamMembers[]` — team composition
- `timeOff[]` — time off entries

### What's editable in a scenario

- Jira item modifications: story points, assignee, sprint, add/remove items
- BIZ assignments: add/remove/change contacts and days
- Team members: add/remove
- Time off: add/remove

Edits modify the scenario's deep copy, never the baseline. When Jira is synced, the baseline updates but scenarios keep their modifications.

### Scenario diff

Compare scenario to baseline showing:
- Jira item changes (story point overrides, assignee changes, added/removed items)
- BIZ assignment changes
- Team/time off changes
- Net capacity impact

### Promote to baseline

Copies the scenario's modifications back to baseline data.

## Capacity Calculations

- **IT capacity per member per quarter:** Sum of story points (converted to days via confidence buffer) from JiraWorkItems assigned to that member in that quarter's sprints.
- **BIZ capacity per contact per quarter:** Sum of `JiraItemBizAssignment.days` for items whose sprint falls in that quarter.
- **Epic-level rollup:** Aggregate child items' IT and BIZ days up the hierarchy.

## UI Rename

Throughout the entire application:
- "Projects" → "Epics"
- "Phases" → "Features"
- Navigation sidebar, page titles, breadcrumbs, filter labels, form labels, toast messages
