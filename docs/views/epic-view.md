# Epics View — Spec

**View type:** `projects`
**Sidebar label:** Epics
**Status:** ✅ Built

---

## Purpose

The Epics view is the **primary management interface** for Jira work items. The Project Manager uses it to:

1. Browse the full Epic → Feature → Story hierarchy synced from Jira
2. Assign **Business Contacts (BIZ track)** to items at any level of the hierarchy
3. See effort estimates (story points as days) and confidence-adjusted forecasts
4. Map Jira items to local Projects and Phases
5. Manage confidence levels per item

The secondary user for this view is a PM or architect doing pre-planning — reviewing what's in Jira, tagging business owners, and verifying estimates.

---

## Layout

```
[PageHeader: "Epics" | subtitle: count + filter status | actions: Sync button]

[Toolbar: search | status filter | type filter | confidence toggle | expand all]

[JiraHierarchyTree]
  ├── Epic row (level 0)
  │   ├── Feature row (level 1, collapsed by default)
  │   │   └── Story / Task / Bug row (level 2, collapsed by default)
  │   └── (more features...)
  └── (more epics...)
```

---

## Hierarchy Tree (`JiraHierarchyTree`)

The tree is rendered by the reusable `JiraHierarchyTree` component (`components/JiraHierarchyTree.tsx`), which supports two modes:

- **Read-only**: type chip + key + status + summary (used in Timeline read-only contexts)
- **Edit mode**: adds selection checkbox, mapped project/phase indicators, BIZ assignment dropdowns, and confidence overrides

The Epics view uses **edit mode**.

### Row Structure

Each row contains, from left to right:

| Element | Description |
|---|---|
| Expand chevron | Only on Epic and Feature rows; shows/hides children |
| Checkbox | Multi-select for bulk operations |
| Type chip | Coloured badge: `EPIC` / `FEATURE` / `STORY` / `TASK` / `BUG` |
| Jira key | Monospace, muted; links to Jira in a new tab |
| Summary | Truncated item title; full title in tooltip |
| IT assignee avatar | Initials circle in Mileway blue |
| BIZ assignee | Initials circle in purple; click to open assignment dropdown |
| Status badge | Colour-coded dot + label |
| Story points / Days | `Xd` (raw) + confidence-adjusted `~Yd` if applicable |
| Mapped indicator | Green checkmark if mapped to a local project/phase |

### Expand / Collapse

- Default: all Epics visible, Features and Stories hidden
- Click the chevron on an Epic to show its Features
- Click the chevron on a Feature to show its Stories/Tasks/Bugs
- "Expand All" button in the toolbar reveals the entire tree at once

### Type Chip Colours

| Type | Background | Text |
|---|---|---|
| Epic | `bg-slate-100` | `text-slate-700` |
| Feature | `bg-slate-100` | `text-slate-700` |
| Story | `bg-slate-100` | `text-slate-700` |
| Task | `bg-slate-100` | `text-slate-700` |
| Bug | `bg-red-50` | `text-red-700` |

---

## Column: BIZ Assignee

Business contacts are linked to Jira items via `JiraItemBizAssignment`. The assignment widget on each row shows:

- **If no BIZ contact**: a purple "+ BIZ" button that opens a dropdown of available `BusinessContact` records
- **If a BIZ contact is assigned**: their initials avatar in purple; click to change or remove

Multiple BIZ contacts can be assigned to a single Jira item. The slide-out panel shows them all in the BIZ column.

---

## Column: Status

Status categories map to colours:

| Category | Badge Style |
|---|---|
| `todo` | `bg-slate-100 text-slate-700` |
| `in_progress` | `bg-blue-100 text-blue-700` |
| `done` | `bg-green-100 text-green-700` |

---

## Column: Story Points / Days

Story points from Jira are treated as **days of effort**. If a confidence level is set (either per-item or via `JiraSettings.defaultConfidenceLevel`), the displayed value shows both raw and buffered:

```
5d (raw) → ~5.75d (high confidence, +15%)
```

Rollup rows (Epics, Features) show the sum of all children.

---

## Confidence Level Override

Each row has an inline confidence selector (dropdown or chip set):

| Level | Buffer | Display |
|---|---|---|
| High | +5% | Green chip |
| Medium | +15% | Amber chip |
| Low | +25% | Red chip |

The global default is set in `Settings → Jira → Default Confidence Level`. Per-item overrides are stored in `JiraWorkItem.confidenceLevel`.

---

## BIZ Assignment Days

In addition to assigning a contact, the PM can set **days of effort** for that contact on the specific item. This is stored in `JiraItemBizAssignment.days` and feeds into BIZ capacity calculations.

Days are edited inline via a small number input that appears alongside the BIZ assignee avatar.

---

## Slide-Out Panel

Clicking any row opens the slide-out panel (see `docs/architecture.md#slide-out-panel`). For the Epics view, the panel shows:

- **Type chip** + **Jira key** (with link to Jira)
- **Item summary**
- **Assignees section**: Two-column grid — IT (blue) | Business (purple)
- **Details section**: Status, sprint, dates, story points

---

## Toolbar

| Element | Behaviour |
|---|---|
| Search input | Filters by summary text (debounced) |
| Status filter | Dropdown: All / To Do / In Progress / Done |
| Type filter | Dropdown: All / Epic / Feature / Story / Task / Bug |
| Confidence toggle | Shows/hides confidence-adjusted day estimates |
| Expand All | Expands entire tree; label switches to "Collapse All" |
| Sync button | Triggers Jira sync for the active connection |

---

## Empty State

When no Jira items are synced:

```
[Icon]
No Jira items synced yet.
Sync Jira items from Settings → Jira to see Epics here.
[Go to Settings button]
```

---

## Interactions Summary

| Action | Result |
|---|---|
| Click expand chevron (Epic) | Reveals Feature rows |
| Click expand chevron (Feature) | Reveals Story/Task/Bug rows |
| Click any row | Opens slide-out panel |
| Click "+ BIZ" button | Opens contact picker dropdown |
| Click BIZ avatar | Opens contact edit/remove dropdown |
| Enter days in BIZ days field | Updates `JiraItemBizAssignment.days` |
| Select confidence level chip | Updates `JiraWorkItem.confidenceLevel` |
| Click "Sync" button | Triggers Jira sync flow |

---

## What Is NOT in This View

- Creating new Jira items (use Jira directly)
- Drag-to-reorder (not planned)
- Inline editing of Jira fields (summary, status — read-only from Jira)
- Sprint assignment changes (managed in Jira)
