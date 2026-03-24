# Design: Sortable Column Headers — Team Page

**Date:** 2026-03-24  
**Status:** Approved  
**Scope:** `frontend/src/pages/Team.tsx`

---

## Overview

Add sortable column headers to the list view of the Team page. Clicking a column header cycles through ascending → descending → unsorted. Small sort arrows appear on hover for inactive columns, and remain visible (in blue) for the active sort column. Sorting works within each existing group — the grouping layout is fully preserved.

---

## Behaviour

- Applies to **all three tabs** (IT Members, Business Contacts, All) in **list view only** (card view unaffected).
- Sort state is **independent per tab** and resets when switching tabs.
- Clicking an inactive column header → sort that column **ascending**.
- Clicking the active column header → toggle **ascending ↔ descending**.
- Default state: **no sort** (rows appear in their natural insertion order within each group).

---

## Visual Design

| State | Appearance |
|---|---|
| Inactive column, not hovered | Label only — no arrow visible |
| Inactive column, hovered | Neutral `ChevronsUpDown` icon in `#94A3B8` appears inline after label |
| Active column | `ChevronUp` (asc) or `ChevronDown` (desc) icon in `#0089DD`, always visible |

The header row is already styled with `text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]`. Active column label text changes to `text-[#0089DD]` to reinforce which column is sorted.

---

## Sortable Columns

### IT Members tab

| Column header | Sort value |
|---|---|
| Name | `member.name` (case-insensitive) |
| Role | `member.role` |
| Country | Resolved country `name` (from `countries` lookup) |
| Skills / Squad | Squad `name` if present; otherwise first skill name alphabetically; empty last |

### Business Contacts tab

| Column header | Sort value |
|---|---|
| Name | `contact.name` (case-insensitive) |
| Title / Dept | `contact.title ?? contact.department` |
| Country | Resolved country `name` |
| Process Teams | First process team name alphabetically; empty last |

### All tab

| Column header | Sort value |
|---|---|
| Name | `name` (case-insensitive, IT + Biz rows) |
| Role / Title | `role` (IT) or `title ?? department` (Biz) |
| Country | Resolved country `name` |
| Process Teams | First process team name alphabetically |

---

## Implementation Approach (A — Inline)

### New state

```typescript
const [sortKey, setSortKey] = useState<string | null>(null);
const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
```

Reset on tab change via a `useEffect` watching `activeTab`.

### `handleSort` handler

```typescript
const handleSort = (key: string) => {
  if (sortKey === key) {
    setSortDir(d => d === 'asc' ? 'desc' : 'asc');
  } else {
    setSortKey(key);
    setSortDir('asc');
  }
};
```

### `SortableHeader` component

A small inline component (~15 lines). Wraps the column label in a `<button>` with a `group` class. Uses `ChevronUp`, `ChevronDown`, and `ChevronsUpDown` from lucide-react (already imported in the file).

### `sortItems` utility

A generic sort function applied to the `items` array within each group before rendering:

```typescript
function sortItems<T>(items: T[], getValue: (item: T) => string): T[]
```

Called just before mapping over each group's items — no changes to the grouping logic itself.

---

## Files Changed

| File | Change |
|---|---|
| `frontend/src/pages/Team.tsx` | Add `SortableHeader` component, `handleSort`, sort state, `useEffect` reset, and `sortItems` calls in all 3 tab list views |

No new files. No new dependencies. `ChevronUp`, `ChevronDown`, `ChevronsUpDown` are available in lucide-react.
