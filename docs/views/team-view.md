# Team Capacity View — Planned Spec

> **Status: NOT YET BUILT**
>
> This document is a placeholder specification for the upcoming Team Capacity view. Nothing in this file has been implemented. Do not reference this as existing functionality.

---

## Purpose

The Team Capacity view gives the Project Manager a sprint-level snapshot of **who is overloaded and who has spare capacity** across the entire organisation.

Unlike the Timeline view's Team sub-mode (which shows quarter-level capacity bars for IT members only), this dedicated view will:

1. Show **both IT and BIZ tracks** side by side in a unified capacity grid
2. Use **sprint-level granularity** as the default (not quarter-level)
3. Flag **overloaded people** visually with a red indicator
4. Allow the PM to identify bottlenecks before a quarter starts and rebalance assignments

---

## Definition of "Overloaded"

A person is **overloaded** in a sprint when:

```
allocatedDays > availableDays
```

Where:
- `availableDays` = workdays in sprint − public holidays − time off − BAU reserve
- `allocatedDays` = sum of all `Assignment.days` (IT) or `JiraItemBizAssignment.days` (BIZ) in that sprint

This is a hard threshold at 100% utilisation. There is no configurable "warning threshold" for overloaded status — that is "warning" (>90%), which is a separate state. See `docs/data-model.md#capacity-calculation-model`.

---

## Planned Layout

```
[PageHeader: "Team Capacity" | subtitle: "Q1–Q4 2026 · VS Finance"]

[Toolbar]
  - IT / BIZ / All tabs
  - Quarter range selector (From / To)
  - Sprint granularity toggle (Quarter | Sprint)
  - Group by: Role / Process Team / Squad / Country

[Capacity Grid]
  [Label column — resizable]  |  [Sprint columns — scrollable]

  Row per person:
    [Avatar + Name + Track badge]  |  [capacity cell per sprint]

  Capacity cell:
    - Progress bar (used / available)
    - X% utilisation
    - Visual: green (normal) / amber (warning >90%) / red (overloaded >100%)
    - Hover tooltip: breakdown (project names + days)
```

---

## Data Requirements

To build this view, the following data must be available per person per sprint:

### IT Members

- Available workdays per sprint (from `getWorkdaysInSprint()` + public holidays + time off)
- Allocated days per sprint (from `Assignment[]` where `sprint` field is set, OR spread evenly if only `quarter` is set)
- BAU reserve (from `Settings.bauReserveDays` — currently a global setting; could be per-member in future)

### Business Contacts

- Available workdays per sprint (from `BusinessContact.workingDaysPerWeek` + public holidays for `countryId` + `BusinessTimeOff`)
- Allocated days per sprint (from `JiraItemBizAssignment.days` linked to items in that sprint, via `JiraWorkItem.sprintName`)
- BAU reserve (from `BusinessContact.bauReserveDays`)

---

## Planned Interactions

| Action | Result |
|---|---|
| Click a capacity cell | Opens a breakdown panel: which projects/items are consuming days |
| Click a person's name | Opens full calendar view (same as existing `MemberCalendarModal`) |
| Hover a cell | Tooltip with allocation breakdown |
| Click overloaded badge | Filters grid to show only overloaded people in that sprint |

---

## Design Constraints

Carry over all constraints from `.cursorrules`:

- Dual-track (IT + BIZ) must be shown together or separately, never only one
- Sprint fraction system is the positional basis — no pixel-absolute column widths
- Quarter-first: default view shows current quarter (6 sprints); full year is a secondary toggle
- No decorative elements — overloaded state is indicated by colour only (red progress bar + percentage)
- Bars/cells use percentage-based sizing

---

## Open Questions (for PM review)

1. **Allocation model for BIZ** ~~(resolved)~~: `calculateBusinessCapacity()` in `utils/capacity.ts` already computes BIZ availability per week (workdays − time off − BAU reserve, prorated). Extending this to sprint-level is straightforward — a sprint is just a date range, same as a week. The proration model is already built; no data model change is needed.
2. **BAU granularity**: BAU reserve is currently a per-quarter value for IT members and a per-quarter flat value for BIZ contacts. Sprint-level prorating divides the quarterly BAU by the number of active sprints in the quarter. This is already done for IT in the Timeline Team sub-mode.
3. **Cross-quarter display**: Should overloaded sprints be flagged in the quarter navigator of the Timeline view as well?
4. **Filter integration**: Should process team filtering carry over from the Team page, or be independent in this view?
