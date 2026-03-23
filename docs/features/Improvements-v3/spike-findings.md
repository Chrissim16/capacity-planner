# Phase 0 — Spike Findings
**Date:** 2026-03-20

---

## SPIKE-01 · Jira Discovery Board Issue Type

### Status: ❌ PARTIAL BLOCK — Requires human input before US-SPT-04 can start

### What we found

The codebase uses a flexible per-connection `jiraProjectKey` model. Each connection syncs from **one project** only. There is no multi-project sync and no Discovery-specific field or project key anywhere in the codebase.

**Current sync query** (`frontend/src/services/jira.ts` lines 613–652):
```
project = "${connection.jiraProjectKey}" AND issuetype IN (Epic, Feature, Story, Task, Bug)
```

**Type mapping function** (`jira.ts` lines 158–165): uses case-insensitive substring matching. Any unknown type falls back to `'task'`. No `'idea'` or `'discovery'` case exists.

**`JiraSettings` interface** (`frontend/src/services/supabaseSync.ts` line 69): has `syncEpics`, `syncFeatures`, `syncStories`, `syncTasks`, `syncBugs` — no `syncIdeas` toggle.

### Questions for PO / Jira Admin (must answer before sizing US-SPT-04)

1. Is the Discovery board in the **same Jira project** as other work (e.g. both `ERP`), or a **separate project** (e.g. `DISC` / `IDEAS`)?
2. What is the **exact issue type name** in Jira for Discovery items (e.g. `"Idea"`, `"Initiative"`, `"Discovery"`)?

### If same project: scope is small
Add the type name to the `issuetype IN (...)` list; add `syncIdeas: boolean` to `JiraSettings`; add type mapping case. ~2–3 h.

### If separate project: scope is larger — choose one of:
- **Option B1:** Multi-project sync — `jiraProjectKeys: string[]` on the connection model. ~4–6 h.
- **Option B2:** User manually switches project key to the Discovery project. Poor UX, simplest to ship.
- **Option B3 (recommended):** Optional `discoveryProjectKey?: string` field on `JiraConnection`. Parallel sync query: `(project = "ERP" ...) OR (project = "DISC" AND issuetype = "Idea" ...)`. ~2–3 h.

### Exhaustive list of files to update when `JiraItemType` is extended

| File | Lines | TypeScript enforces? | Action |
|---|---|---|---|
| `frontend/src/types/index.ts` | 298, 471 | ✅ Enforces downstream | Add `\| 'idea'` to both unions |
| `frontend/src/services/jira.ts` | 158–165 | ❌ No check | Add case for new type |
| `frontend/src/services/jira.ts` | 472–478 | ❌ No check | Add typeFilterMap entry |
| `frontend/src/services/jira.ts` | 613–652 | ❌ No check | Add to buildJQL + JiraSettings |
| `frontend/src/components/planner/PlannerTimeline.tsx` | 51–60 (BAR) | ❌ Untyped Record | Add `idea: { bg: '#FFD9B0', border: '#E07A20', borderW: 1, radius: 4 }` |
| `frontend/src/components/planner/PlannerTimeline.tsx` | 62–64 (INDENT) | ✅ Partial Record | Add `idea: 32` |
| `frontend/src/components/planner/AssignPanel.tsx` | 49–69 | ❌ Switch+default | Add `case 'idea'` |
| `frontend/src/components/planner/PlannerDetailPanel.tsx` | 45–54 | ❌ Untyped Record | Add `idea: { bg: '#FFD9B0', text: '#E07A20', label: 'Idea' }` |
| `frontend/src/components/planner/PlannerBacklog.tsx` | 40–45 | ✅ Enforces | Add `idea: { label: 'IDEA', className: 'bg-orange-50 text-orange-600' }` |
| `frontend/src/components/JiraHierarchyTree.tsx` | 21–31 (TYPE_COLORS) | ✅ Enforces | Add `idea: 'bg-orange-100 text-orange-700'` |
| `frontend/src/components/JiraHierarchyTree.tsx` | 54 (TYPE_ORDER) | ✅ Enforces | Add `idea: 3` |
| `frontend/src/pages/Jira.tsx` | 26–32 | ✅ Enforces | Add `idea: 'bg-orange-100 text-orange-700'` |
| `frontend/src/pages/Dashboard.tsx` | 549–554 | ❌ Switch+default | Add `case 'idea'` |

**Strategy:** Add `'idea'` to `JiraItemType` first — TypeScript will auto-flag 5 of the 13 locations above as compile errors. The 8 untyped Records/switches require manual review.

---

## SPIKE-02 · AssignPanel Reusability in Actuals Timeline

### Status: ✅ RESOLVED — AssignPanel is reusable; 2 targeted changes needed

### What we found

**1. No existing assignment UI in `Timeline.tsx`**
The actuals Timeline page (`frontend/src/pages/Timeline.tsx`) has no bar-click handler, no assignment panel, no inline form. Adding the AssignPanel is net-new work with no old UI to remove.

**2. `AssignPanelProps.onPersistDraft` takes the full `PlannerItem`** (line 174)
```ts
onPersistDraft: (draft: PlannerItem) => void
```
Must be changed to:
```ts
onSave: (itemId: string, assignees: PlannerAssignment[]) => void
```
Internal change at line ~430: `onPersistDraft(draft)` → `onSave(draft.id, draft.assignees)`.
Caller in `ScenarioPlanner.tsx` adapts its `handleAssignPanelPersist` callback accordingly.

**3. Capacity calculations are context-aware — no scenario hardcoding**
`useSprintCells()` (lines 188–229) calls `useCurrentState()` which returns scenario-scoped state when a scenario is active, or baseline state when not. **No changes needed inside AssignPanel for this.**

**4. Fit scoring (staffing.ts) is stateless and parameter-driven**
`scoreMember()` and `scoreBusinessContact()` both take `state: AppState` as an argument. When called from AssignPanel, the `state` variable comes from `useCurrentState()`. This is automatically correct in both contexts. **No changes needed.**

**5. `addPlannerAssignment` is scenario-only — a baseline action is needed**
```ts
// actions.ts line 913 — skips entirely if no active scenario:
if (!activeId) return;
```
A new `updateBaselineItemAssignees(itemId: string, assignees: PlannerAssignment[])` action is required. It should write to `state.data.plannerLayout` (the baseline layout, separate from any scenario). This is the **only net-new code** required beyond the callback refactor.

### Decision: ✅ Reusable with 2 targeted changes (estimated 2–3 h total)

| Change | File | Effort |
|---|---|---|
| Rename `onPersistDraft` → `onSave`, narrow signature | `AssignPanel.tsx` line 174, ~430 | 30 min |
| Update caller to use new signature | `ScenarioPlanner.tsx` | 15 min |
| Add `updateBaselineItemAssignees()` action | `actions.ts` | 1–2 h |
| Wire `AssignPanel` into `Timeline.tsx` with new action | `Timeline.tsx` | 1 h |

**US-TL-01 updated complexity: M (was L)** — the panel works as-is in baseline context; only callback + one new action needed.

---

## Updated Sprint 1 Scope

With spikes resolved:

- **SPIKE-02 unblocked:** US-TL-01 moves to **M complexity, ~3 h** — can be pulled into Sprint 2 if capacity allows
- **SPIKE-01 partial block:** US-SPT-04 still cannot start until PO confirms Jira project key and issue type name; remains in Phase 5/Sprint 4
- **13-location exhaustion audit complete** — when US-SPT-04 does start, the checklist above tells developers exactly what to update

**Action required from PO before next sprint planning:**
> Please confirm: (1) Discovery Board Jira project key, (2) exact issue type name in Jira.
