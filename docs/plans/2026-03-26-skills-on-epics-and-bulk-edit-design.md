# Skills on Epics & Bulk Edit Work Items

**Date:** 2026-03-26
**Status:** Approved

## Problem

Skills (`requiredSkillIds`) currently only exist on `PlannerItem` — they are set after a work item is scheduled into the Scenario Planner. There is no way to assign skills at the Epic/work-item level, and no bulk editing capability for work item metadata.

## Goals

1. Assign required skills at the Epic/work-item level so they flow through to the Scenario Planner.
2. Provide bulk update capability for skills and other key fields across multiple work items.
3. Preserve app-only fields (like skills) when re-syncing from Jira.

## Design

### 1. Data Model

**Extend `JiraWorkItem`** with `requiredSkillIds: string[]` (default `null`).

- Stored in the `jira_work_items` Supabase table as a new `required_skill_ids jsonb` column.
- App-only field — Jira sync never reads or writes it.
- Included in scenario JSONB snapshots so scenario-level edits don't affect baseline.

**Skill Inheritance** — resolved at read time, not stored:

- `getEffectiveSkills(item, allItems)` utility walks up the hierarchy via `parentKey`.
- Returns the item's own `requiredSkillIds` if explicitly set (non-null).
- Otherwise inherits from the nearest ancestor with skills.
- `null` = "inherit from parent", `[]` = "explicitly no skills".

**Flow to Planner:**

- When scheduling a work item into the Scenario Planner (creating a `PlannerItem`), `requiredSkillIds` is auto-populated from `getEffectiveSkills()` of the source work item.
- After scheduling, planner-item skills are independent — edits in the planner don't affect the work item, and vice versa.

### 2. UI — Skills Assignment

**Jira/Epics page (`Jira.tsx`):**

- Each item row shows skill chips (colored badges).
- Clicking opens `SkillMultiSelect` for inline editing.
- Epics show direct skills in full color; children show inherited skills dimmed with an "inherited" indicator, overrides in full color.

**Planner Backlog sidebar (`PlannerBacklog.tsx`):**

- Read-only skill badges on items for visibility when scheduling.
- No editing — edit skills on the Jira/Epics page or via bulk edit.

**Planner Detail Panel (`PlannerDetailPanel.tsx`):**

- Existing `SkillMultiSelect` for `PlannerItem.requiredSkillIds` stays as-is.
- Add a subtle note showing source when auto-populated from the work item.

### 3. Bulk Edit

**Selection mechanisms** (on Jira/Epics page and Scenario Planner):

1. Checkbox multi-select on item rows/cards → floating toolbar with count + "Bulk Edit" button.
2. Filter-then-assign: after filtering, "Select all filtered" selects visible items, same toolbar appears.

**Bulk Edit Modal** — single reusable `BulkEditWorkItemsModal` with toggle-to-edit sections:

| Field | Control | Behavior |
|---|---|---|
| Required Skills | `SkillMultiSelect` | Add to existing or replace all |
| Priority | Dropdown | Replace |
| Confidence | Dropdown | Replace |
| Assignees | Team member multi-select | Add to existing or replace all |
| Estimates | Number input | Replace |
| BIZ Assignees | Business contact multi-select | Add to existing or replace all |

Each section collapsed by default — user toggles on only the fields to change. Confirmation shows "Update N items — changing: [fields]".

**Scenario Planner bulk edit:**

- Same multi-select + modal pattern on `PlannerItem`s in the board/timeline view.
- Operates on planner-level copies of the fields.

**Store action:**

- `bulkUpdateWorkItems(ids, updates, arrayMode?)` — mirrors existing `bulkUpdateTeamMembers` pattern.
- Updates baseline `jira_work_items` and active scenario snapshot if applicable.

### 4. Jira Sync Protection

When re-syncing from Jira:

- `requiredSkillIds` is never included in the sync upsert.
- Sync updates only Jira-sourced fields (summary, status, assignee, estimates, sprint, etc.).
- App-only fields are preserved intact through any number of re-syncs.

## Decisions

- **Approach A: Unified Bulk Edit Modal** — chosen over inline quick-edit (too complex for card-based UI) and context-menu drawers (too many interactions for multi-field updates).
- **Inheritance at read time** — avoids cascading update complexity when parent skills change.
- **App-only storage** — no Jira write-back; skills are a planning concern, not a Jira concern.
- **Auto-copy to planner** — skills copied on scheduling then independent; no live link that would create confusing sync behavior.
