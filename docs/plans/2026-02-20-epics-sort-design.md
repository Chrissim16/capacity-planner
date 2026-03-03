# Epics View — Sort Epic Cards

**Date:** 2026-02-20  
**Status:** Approved — ready to implement  
**Scope:** 2 files changed (`Projects.tsx`, `appStore.ts`), no DB migration

---

## Problem

The Epics view renders project/epic cards in Supabase insertion order with no way for the user to reorder them. Users cannot quickly surface Active epics, High-priority epics, or epics starting soonest.

---

## Decisions

| Question | Answer |
|----------|--------|
| What to sort | Epic/project cards (accordion headers), not items within cards |
| Sort control | Dropdown in the existing filter bar |
| Sort options | Default · Name A–Z · Status · Priority · Start date |
| Direction toggle | Re-selecting the active option toggles asc/desc |
| Persistence | Zustand `ui` slice (survives navigation) |
| Timeline / Gantt | Not touched in this phase |

---

## Sort options

| Label | Key | Sort logic |
|-------|-----|-----------|
| Default | `null` | Store-insertion order (current behaviour) |
| Name A–Z | `name` | `project.name` case-insensitive alphabetical |
| Status | `status` | Fixed order: Active → Planning → On Hold → Completed → Cancelled |
| Priority | `priority` | High → Medium → Low → (none last) |
| Start date | `startDate` | ISO string lexicographic ascending; nulls sort last |

---

## Architecture

### State — `appStore.ts`

Add to the `ui` slice (persisted):

```typescript
epicsSortField: 'name' | 'status' | 'priority' | 'startDate' | null;
epicsSortDir:   'asc' | 'desc';
```

Defaults: `null` / `'asc'`.

Add action:
```typescript
setEpicsSort: (field: AppState['ui']['epicsSortField'], dir: 'asc' | 'desc') => void;
```

### Sort logic — `Projects.tsx`

Local utility:

```typescript
const STATUS_ORDER = ['Active','Planning','On Hold','Completed','Cancelled'];
const PRIORITY_ORDER = ['High','Medium','Low'];

function sortProjects(
  projects: Project[],
  field: 'name' | 'status' | 'priority' | 'startDate',
  dir: 'asc' | 'desc',
): Project[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...projects].sort((a, b) => {
    switch (field) {
      case 'name':
        return sign * a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      case 'status': {
        const ai = STATUS_ORDER.indexOf(a.status ?? '');
        const bi = STATUS_ORDER.indexOf(b.status ?? '');
        return sign * ((ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi));
      }
      case 'priority': {
        const ai = PRIORITY_ORDER.indexOf(a.priority ?? '');
        const bi = PRIORITY_ORDER.indexOf(b.priority ?? '');
        return sign * ((ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi));
      }
      case 'startDate': {
        const ad = a.startDate ?? 'z';
        const bd = b.startDate ?? 'z';
        return sign * ad.localeCompare(bd);
      }
      default: return 0;
    }
  });
}
```

Applied after filtering:

```typescript
const sortedProjects = useMemo(() => {
  if (!epicsSortField) return filteredProjects;
  return sortProjects(filteredProjects, epicsSortField, epicsSortDir);
}, [filteredProjects, epicsSortField, epicsSortDir]);
```

### UI — filter bar in `Projects.tsx`

New `<select>` added next to the existing Status/Priority/System dropdowns:

```tsx
<select
  value={epicsSortField ? `${epicsSortField}:${epicsSortDir}` : ''}
  onChange={e => {
    const [field, dir] = e.target.value.split(':');
    setEpicsSort(
      (field as AppState['ui']['epicsSortField']) || null,
      (dir as 'asc' | 'desc') || 'asc',
    );
  }}
  className="... (same styling as existing selects)"
>
  <option value="">Sort: Default</option>
  <option value="name:asc">Name A–Z</option>
  <option value="name:desc">Name Z–A</option>
  <option value="status:asc">Status</option>
  <option value="priority:asc">Priority</option>
  <option value="startDate:asc">Start date ↑</option>
  <option value="startDate:desc">Start date ↓</option>
</select>
```

---

## Files touched

| File | Change |
|------|--------|
| `frontend/src/stores/appStore.ts` | Add `epicsSortField`, `epicsSortDir` to `ui` slice; add `setEpicsSort` action |
| `frontend/src/pages/Projects.tsx` | Add `sortProjects()` utility, `sortedProjects` memo, sort `<select>` in filter bar |

---

## Out of scope (future)

- Sorting items within each epic card
- Sorting in the Timeline / Gantt view
- Multi-key / secondary sort
