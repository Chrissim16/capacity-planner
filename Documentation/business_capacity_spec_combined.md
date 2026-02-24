# Business Contact Capacity — Combined Implementation Specification
**VS Finance Capacity Planner · Mileway BV**  
_Version 1.0 · February 2026_

_Combines: Business Capacity Heatmap Extension v1.0 + Phase-Level Commitment Addendum v1.0_  
_Grounded against codebase as of commit `368e013`_

---

## Overview

Business contacts (Finance Controllers, UAT leads, process owners, etc.) are upgraded from reference-only entities to **capacity-aware participants**. They can be assigned days to project phases, have time-off recorded, and appear in the capacity heatmap.

**IT capacity calculations are completely unchanged.** Business contacts are a parallel track. They never appear in `calculateCapacity()`, overallocation alerts, auto-assign scoring, or IT reports.

Phase-level linking is the **primary model**: a business contact commits days to a specific Feature (Phase), not to a quarter in the abstract. Quarter is derived automatically from the phase's date range.

---

## Part 1 — Data Model

### 1.1 BusinessContact — Add Capacity Fields

`BusinessContact` does not yet exist in `frontend/src/types/index.ts`. Add it alongside the existing types:

```ts
// frontend/src/types/index.ts

export interface BusinessContact {
  id: string;
  name: string;
  title?: string;
  department?: string;
  email?: string;
  countryId: string;            // references Country.id — same pattern as TeamMember.countryId
                                // drives public holiday calendar via getHolidaysByCountry()
  workingDaysPerWeek?: number;  // default: 5
  workingHoursPerDay?: number;  // default: 8
  notes?: string;
  archived?: boolean;
  // Project linkage — which projects this contact is associated with
  projectIds?: string[];        // used to filter the contact dropdown in phase forms
}
```

**Note on `countryId` vs `countryCode`:** The existing app uses `countryId` (e.g. `"country-nl"`) throughout — `TeamMember.countryId`, `PublicHoliday.countryId`, `getHolidaysByCountry(countryId, holidays)`. `BusinessContact` follows this same pattern. The `countryCode` field on `MemberCapacitySummary` is unrelated — it is a display field only.

### 1.2 BusinessTimeOff

Manual time-off for business contacts. Separate from IT `TimeOff` to keep data clean. Same concept, parallel table.

```ts
export interface BusinessTimeOff {
  id: string;
  contactId: string;            // references BusinessContact.id
  startDate: string;            // ISO date "YYYY-MM-DD"
  endDate: string;              // ISO date "YYYY-MM-DD"
  type: 'holiday' | 'other';
  notes?: string;
}
```

### 1.3 BusinessAssignment

How many days a business contact is committed to a project phase. Phase-level is primary.

```ts
export interface BusinessAssignment {
  id: string;
  contactId: string;            // references BusinessContact.id
  projectId: string;            // references Project.id
  phaseId?: string;             // references Phase.id — primary use case
                                // absent only for project-level commitments (no phases)
  quarter?: string;             // "Q2 2026" format — derived from phase.startDate when phaseId set
                                // required when phaseId is absent
  days: number;                 // committed days — no maximum, decimals allowed (0.5 = half day)
  notes?: string;               // "UAT execution", "sign-off meeting", "data validation"
}
```

**Quarter derivation rule:** when `phaseId` is present, `quarter` is derived at save time from `phase.startDate` (or `phase.startQuarter` if ISO dates not set) and stored for grouping. The IT Manager never types a quarter manually for phase-level entries.

**Duplicate prevention:** one `BusinessAssignment` per `(contactId, phaseId)`. When phaseId is absent, one per `(contactId, projectId, quarter)`.

### 1.4 AppState Additions

```ts
// frontend/src/types/index.ts — AppState interface

export interface AppState {
  // ... existing fields unchanged ...

  // Business contact capacity (new)
  businessContacts: BusinessContact[];
  businessTimeOff: BusinessTimeOff[];
  businessAssignments: BusinessAssignment[];
}
```

### 1.5 Default State

```ts
// frontend/src/stores/appStore.ts — defaultAppState

const defaultAppState: AppState = {
  // ... existing fields ...
  businessContacts: [],
  businessTimeOff: [],
  businessAssignments: [],
};
```

Add `businessContacts: []`, `businessTimeOff: []`, `businessAssignments: []` to `migrate()` defaults (same pattern as `squads`, `processTeams`).

---

## Part 2 — New Utility Functions

### 2.1 `prorateDaysToWeek` — New Function in `utils/calendar.ts`

Distributes a block of days across a date range, returning the fraction that falls within a specific week. Used by business capacity heatmap calculation.

```ts
// frontend/src/utils/calendar.ts

/**
 * Prorates a number of committed days into a specific week window.
 *
 * Algorithm: workdays-proportional distribution.
 *   fraction = workdays(weekStart..weekEnd ∩ rangeStart..rangeEnd) 
 *              / workdays(rangeStart..rangeEnd)
 *   result   = days × fraction
 *
 * Returns 0 when the week does not overlap the range, or when the
 * range has zero workdays (avoids division by zero).
 */
export function prorateDaysToWeek(
  days: number,
  rangeStart: string,    // ISO date — phase.startDate or quarter start
  rangeEnd: string,      // ISO date — phase.endDate or quarter end
  weekStart: string,     // ISO date — Monday of the heatmap week
  weekEnd: string,       // ISO date — Friday of the heatmap week
  holidays: PublicHoliday[] = []
): number {
  const totalWorkdays = getWorkdaysInDateRange(rangeStart, rangeEnd, holidays);
  if (totalWorkdays === 0) return 0;

  const overlap = getWorkdaysInDateRange(rangeStart, rangeEnd, holidays,
    new Date(weekStart + 'T00:00:00'),
    new Date(weekEnd   + 'T00:00:00')
  );

  return days * (overlap / totalWorkdays);
}
```

**Edge case — phase with no ISO dates:** Some phases only have `startQuarter`/`endQuarter`. Helper:

```ts
// frontend/src/utils/calendar.ts

export function getPhaseRange(phase: Phase): { start: string; end: string } | null {
  if (phase.startDate && phase.endDate) {
    return { start: phase.startDate, end: phase.endDate };
  }
  if (phase.startQuarter && phase.endQuarter) {
    const s = parseQuarter(phase.startQuarter);
    const e = parseQuarter(phase.endQuarter);
    if (s && e) {
      return {
        start: s.start.toISOString().slice(0, 10),
        end:   e.end.toISOString().slice(0, 10),
      };
    }
  }
  return null;
}
```

### 2.2 `calculateBusinessCapacity` — New Function in `utils/capacity.ts`

```ts
// frontend/src/utils/capacity.ts

export interface BusinessCellData {
  allocatedDays: number;
  availableDays: number;
  utilisationPct: number;    // can exceed 1.0 (overallocation)
  isTimeOff: boolean;
  isPublicHoliday: boolean;
}

export function calculateBusinessCapacity(
  contact: BusinessContact,
  weekStart: string,            // ISO date — Monday
  weekEnd: string,              // ISO date — Friday
  businessAssignments: BusinessAssignment[],
  businessTimeOff: BusinessTimeOff[],
  publicHolidays: PublicHoliday[],
  projects: Project[]           // needed to resolve phase date ranges
): BusinessCellData {
  const contactHolidays = getHolidaysByCountry(contact.countryId, publicHolidays);

  // Available workdays in this week for this contact's country
  const workdays = getWorkdaysInDateRange(weekStart, weekEnd, contactHolidays);

  // Time off days that overlap this week
  const timeOffDays = (businessTimeOff
    .filter(t => t.contactId === contact.id))
    .reduce((sum, t) => sum + getWorkdaysInDateRange(
      t.startDate, t.endDate, contactHolidays,
      new Date(weekStart + 'T00:00:00'),
      new Date(weekEnd   + 'T00:00:00')
    ), 0);

  const availableDays = Math.max(0, workdays - timeOffDays);

  // Allocated days: prorate each assignment into this week
  const allocated = businessAssignments
    .filter(a => a.contactId === contact.id)
    .reduce((sum, a) => {
      let rangeStart: string;
      let rangeEnd: string;

      if (a.phaseId) {
        // Phase-level: find phase and use its date range
        let phase: Phase | undefined;
        for (const project of projects) {
          phase = project.phases.find(ph => ph.id === a.phaseId);
          if (phase) break;
        }
        const range = phase ? getPhaseRange(phase) : null;
        if (!range) return sum;
        rangeStart = range.start;
        rangeEnd   = range.end;
      } else {
        // Project-level fallback: use quarter boundaries
        if (!a.quarter) return sum;
        const q = parseQuarter(a.quarter);
        if (!q) return sum;
        rangeStart = q.start.toISOString().slice(0, 10);
        rangeEnd   = q.end.toISOString().slice(0, 10);
      }

      return sum + prorateDaysToWeek(
        a.days, rangeStart, rangeEnd,
        weekStart, weekEnd, contactHolidays
      );
    }, 0);

  return {
    allocatedDays: allocated,
    availableDays,
    utilisationPct: availableDays > 0 ? allocated / availableDays : 0,
    isTimeOff: timeOffDays >= workdays && workdays > 0,
    isPublicHoliday: workdays === 0,
  };
}
```

---

## Part 3 — Store Actions

Add to `frontend/src/stores/actions.ts`:

```ts
// ─── BUSINESS CONTACTS ────────────────────────────────────────────────────────

export function addBusinessContact(
  data: Omit<BusinessContact, 'id'>
): BusinessContact {
  const state = useAppStore.getState();
  const contact: BusinessContact = { ...data, id: generateId('biz-contact') };
  state.updateData({
    businessContacts: [...state.getCurrentState().businessContacts, contact]
  });
  return contact;
}

export function updateBusinessContact(
  id: string, updates: Partial<BusinessContact>
): void {
  const state = useAppStore.getState();
  state.updateData({
    businessContacts: state.getCurrentState().businessContacts.map(c =>
      c.id === id ? { ...c, ...updates } : c
    )
  });
}

export function deleteBusinessContact(id: string): void {
  const state = useAppStore.getState();
  state.updateData({
    businessContacts: state.getCurrentState().businessContacts.filter(c => c.id !== id),
    businessTimeOff:  state.getCurrentState().businessTimeOff.filter(t => t.contactId !== id),
    businessAssignments: state.getCurrentState().businessAssignments.filter(a => a.contactId !== id),
  });
}

// ─── BUSINESS TIME OFF ────────────────────────────────────────────────────────

export function addBusinessTimeOff(
  data: Omit<BusinessTimeOff, 'id'>
): void {
  const state = useAppStore.getState();
  state.updateData({
    businessTimeOff: [
      ...state.getCurrentState().businessTimeOff,
      { ...data, id: generateId('biz-to') }
    ]
  });
}

export function removeBusinessTimeOff(id: string): void {
  const state = useAppStore.getState();
  state.updateData({
    businessTimeOff: state.getCurrentState().businessTimeOff.filter(t => t.id !== id)
  });
}

// ─── BUSINESS ASSIGNMENTS ─────────────────────────────────────────────────────

export function upsertBusinessAssignment(
  data: Omit<BusinessAssignment, 'id'> & { id?: string }
): void {
  const state = useAppStore.getState();
  const existing = state.getCurrentState().businessAssignments;

  // Duplicate guard: one per (contactId, phaseId) or (contactId, projectId, quarter)
  const duplicate = existing.find(a =>
    a.contactId === data.contactId &&
    (data.phaseId ? a.phaseId === data.phaseId
                  : a.projectId === data.projectId && a.quarter === data.quarter)
  );

  const record: BusinessAssignment = {
    ...data,
    id: data.id ?? duplicate?.id ?? generateId('biz-assign'),
  };

  state.updateData({
    businessAssignments: duplicate
      ? existing.map(a => a.id === duplicate.id ? record : a)
      : [...existing, record],
  });
}

export function removeBusinessAssignment(id: string): void {
  const state = useAppStore.getState();
  state.updateData({
    businessAssignments: state.getCurrentState().businessAssignments.filter(a => a.id !== id)
  });
}
```

---

## Part 4 — UI: Phase Edit Form (Primary Entry Point)

### 4.1 Changes to `ProjectForm.tsx`

The phase expanded section (`isPhaseExpanded`) in `frontend/src/components/forms/ProjectForm.tsx` gains a "Business commitment" section below the existing date/confidence/notes fields.

The section:
1. Lists existing `BusinessAssignment` records for this phase (read from store on open)
2. Provides an inline "Add contact commitment" form
3. Saves/deletes assignments when the phase is saved

**State additions in `ProjectForm`:**

```ts
// Per-phase business commitments, keyed by phase.id
const [bizCommitments, setBizCommitments] = useState<
  Record<string, BusinessAssignment[]>
>({});
```

**On form open** (`useEffect` for `project`/`isOpen`): populate `bizCommitments` from `state.businessAssignments` filtered to this project's phases.

**On save** (`handleSubmit`): after `updateProject()`/`addProject()`, call `upsertBusinessAssignment` for each new/edited commitment and `removeBusinessAssignment` for deleted ones.

**UI inside the expanded phase section:**

```tsx
{/* Business commitment section */}
<div className="border-t border-slate-200 dark:border-slate-700 pt-3">
  <div className="flex items-center justify-between mb-2">
    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
      Business commitment
    </label>
    <button type="button" onClick={() => openAddCommitment(phase.id)}
      className="text-xs text-blue-600 hover:underline">
      + Add contact
    </button>
  </div>

  {/* Existing commitments list */}
  {(bizCommitments[phase.id] ?? []).map(bc => (
    <div key={bc.id} className="flex items-center justify-between gap-2 py-1 text-xs">
      <span className="font-medium text-slate-700 dark:text-slate-300">
        {getContactName(bc.contactId)}
      </span>
      <span className="text-slate-500">{bc.days}d</span>
      <span className="text-slate-400 truncate max-w-[120px]">{bc.notes}</span>
      <button onClick={() => removeLocalCommitment(phase.id, bc.id)}
        className="text-slate-400 hover:text-red-500">✕</button>
    </div>
  ))}

  {/* Inline add form (shown when addingFor === phase.id) */}
  {addingFor === phase.id && (
    <BusinessCommitmentInlineForm
      contactOptions={contactsForProject(project.id)}
      onAdd={(contactId, days, notes) => addLocalCommitment(phase.id, contactId, days, notes)}
      onCancel={() => setAddingFor(null)}
    />
  )}

  {(bizCommitments[phase.id]?.length ?? 0) > 0 && (
    <p className="text-xs text-slate-400 mt-1">
      Total: {(bizCommitments[phase.id] ?? []).reduce((s, b) => s + b.days, 0)}d
      across {bizCommitments[phase.id]?.length} contact(s)
    </p>
  )}
</div>
```

**Contact dropdown** shows only contacts whose `projectIds` includes this project. If empty, show a link: "Add business contacts in Settings → Business".

---

## Part 5 — UI: Heatmap Extension

### 5.1 People Filter

Add a filter control to the heatmap toolbar in `Dashboard.tsx`:

```tsx
type PeopleFilter = 'it_only' | 'business_only' | 'both';

// Default: 'it_only' — preserves existing behaviour
const [peopleFilter, setPeopleFilter] = useState<PeopleFilter>('it_only');
```

```tsx
<select value={peopleFilter} onChange={e => setPeopleFilter(e.target.value as PeopleFilter)}
  className="...">
  <option value="it_only">IT team only</option>
  <option value="business_only">Business only</option>
  <option value="both">Both</option>
</select>
```

### 5.2 Heatmap Grid Rows

When `peopleFilter !== 'it_only'`, append business contact rows after a divider:

```tsx
{/* Existing IT rows — rendered when peopleFilter !== 'business_only' */}
{peopleFilter !== 'business_only' && teamMembers.map(member => (
  <HeatmapRow key={member.id} ... />
))}

{/* Divider */}
{peopleFilter === 'both' && (
  <div className="h-5 flex items-center px-3 bg-slate-50 dark:bg-slate-800/50
                  border-t-2 border-slate-300 dark:border-slate-600
                  text-xs font-bold tracking-wider uppercase text-slate-400">
    Business
  </div>
)}

{/* Business rows */}
{peopleFilter !== 'it_only' && businessContacts
  .filter(c => !c.archived)
  .map(contact => (
    <BusinessHeatmapRow
      key={contact.id}
      contact={contact}
      weeks={weeks}
      businessAssignments={businessAssignments}
      businessTimeOff={businessTimeOff}
      publicHolidays={publicHolidays}
      projects={projects}
    />
  ))
}
```

### 5.3 `BusinessHeatmapRow` Component

Mirrors the existing IT `HeatmapRow` component. Key differences:
- Uses `calculateBusinessCapacity()` instead of `calculateCapacity()`
- Row label styled lighter (smaller, secondary colour, `BIZ` tag)
- Overallocated cells (>100%) show red — same colour scale — but tooltip adds `(Informational only)`

```tsx
function BusinessHeatmapRow({ contact, weeks, ... }) {
  return (
    <div className="flex">
      {/* Row label */}
      <div className="shrink-0 px-3 py-2 text-sm text-slate-500 dark:text-slate-400
                      font-normal flex items-center gap-1.5" style={{ width: 'var(--lw)' }}>
        {contact.name}
        <span className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">BIZ</span>
      </div>

      {/* Week cells */}
      {weeks.map(({ weekStart, weekEnd }) => {
        const cell = calculateBusinessCapacity(
          contact, weekStart, weekEnd,
          businessAssignments, businessTimeOff, publicHolidays, projects
        );
        return (
          <BusinessHeatmapCell
            key={weekStart}
            cell={cell}
            contact={contact}
            weekStart={weekStart}
            projects={projects}
            businessAssignments={businessAssignments}
          />
        );
      })}
    </div>
  );
}
```

### 5.4 Business Cell Tooltip

Same structure as IT cell tooltip. Add "(Informational only — does not affect IT planning)" when `utilisationPct > 1.0`:

```
Sarah van den Berg  ·  W12  ·  17–21 Mar 2026
────────────────────────────────────────────────
Available:   4 days  (1 public holiday: Good Friday NL)
Allocated:   5 days
  OneStream EPM — Testing & UAT    3d  (UAT sign-off)
  Yardi Upgrade — Testing & UAT    2d  (Data validation)
────────────────────────────────────────────────
Utilisation: 125%  ⚠ Over-committed
(Informational only — does not affect IT planning)
```

---

## Part 6 — UI: Timeline Phase Bar Tooltip

In `Timeline.tsx`, when rendering the phase bar tooltip, check for `businessAssignments` on this phase and append a section:

```tsx
const phaseBizAssignments = state.businessAssignments.filter(
  a => a.phaseId === phase.id
);

{phaseBizAssignments.length > 0 && (
  <div className="border-t border-slate-200 dark:border-slate-700 mt-2 pt-2">
    <p className="text-xs font-semibold text-slate-500 mb-1">Business commitment</p>
    {phaseBizAssignments.map(a => {
      const contact = state.businessContacts.find(c => c.id === a.contactId);
      return (
        <div key={a.id} className="flex items-center gap-2 text-xs">
          <span className="text-slate-700 dark:text-slate-300">{contact?.name}</span>
          <span className="font-medium">{a.days}d</span>
          {a.notes && <span className="text-slate-400">{a.notes}</span>}
        </div>
      );
    })}
  </div>
)}
```

---

## Part 7 — Settings: Business Contacts Page

A new section in `Settings.tsx` → "Business" group (or add to the existing Reference Data group):

- **List view**: table of contacts with name, title, department, country, archived toggle
- **Add / Edit form**: name, title, department, email, `countryId` (select from `countries`), working days/week, working hours/day, notes
- **Time Off sub-section** per contact: date range list with add/remove (same pattern as `TimeOffForm` for IT members)
- **Assignments sub-section** per contact: grouped by `projectId → phase`, showing days and notes — read-only summary, edit via phase form or project Business tab

---

## Part 8 — Database Migrations

Next migration number is `011`. Create three files in sequence:

### `011_business_contacts.sql`

```sql
CREATE TABLE IF NOT EXISTS public.business_contacts (
  id                   text PRIMARY KEY,
  name                 text NOT NULL,
  title                text,
  department           text,
  email                text,
  country_id           text NOT NULL,            -- references countries(id) logic-level
  working_days_per_week integer DEFAULT 5,
  working_hours_per_day integer DEFAULT 8,
  project_ids          text[] DEFAULT '{}',
  notes                text,
  archived             boolean DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.business_time_off (
  id           text PRIMARY KEY,
  contact_id   text NOT NULL,
  start_date   date NOT NULL,
  end_date     date NOT NULL,
  type         text NOT NULL DEFAULT 'holiday' CHECK (type IN ('holiday', 'other')),
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_bto_contact ON business_time_off (contact_id);
CREATE INDEX idx_bto_dates   ON business_time_off (start_date, end_date);

CREATE TABLE IF NOT EXISTS public.business_assignments (
  id           text PRIMARY KEY,
  contact_id   text NOT NULL,
  project_id   text NOT NULL,
  phase_id     text,
  quarter      text,            -- "Q2 2026" format; required when phase_id is NULL
  days         numeric NOT NULL CHECK (days >= 0),
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ba_contact ON business_assignments (contact_id);
CREATE INDEX idx_ba_project ON business_assignments (project_id);
CREATE INDEX idx_ba_phase   ON business_assignments (phase_id) WHERE phase_id IS NOT NULL;

-- Row Level Security
ALTER TABLE public.business_contacts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_time_off     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_assignments  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users" ON public.business_contacts
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users" ON public.business_time_off
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users" ON public.business_assignments
  FOR ALL USING (auth.role() = 'authenticated');
```

### Supabase Sync (`supabaseSync.ts`)

Add to `saveToSupabase()` and `loadFromSupabase()` following the exact same pattern as `timeOff` / `assignments`:
- Load: `supabase.from('business_contacts').select('*')`, etc.
- Save: `upsertAndPrune('business_contacts', ...)`, etc.
- Map snake_case ↔ camelCase in both directions.

---

## Part 9 — What Deliberately Does Not Change

- `calculateCapacity()` for IT members — untouched
- Overallocation alerts, banners, and reports — IT only
- Auto-assign scoring — IT only
- Confidence level calculations — business assignments have no confidence, they are committed days
- The 12-week forecast and Capacity Bank — IT only
- Jira sync — no relationship to business contacts

---

## Part 10 — Acceptance Criteria

### Data & Actions
- [ ] `BusinessContact`, `BusinessTimeOff`, `BusinessAssignment` types exist in `types/index.ts`
- [ ] All three arrays present in `AppState` and `defaultAppState`
- [ ] Store actions: `addBusinessContact`, `updateBusinessContact`, `deleteBusinessContact`, `addBusinessTimeOff`, `removeBusinessTimeOff`, `upsertBusinessAssignment`, `removeBusinessAssignment`
- [ ] Deleting a contact cascades and removes their time-off and assignments
- [ ] Duplicate prevention: one assignment per `(contactId, phaseId)` enforced in `upsertBusinessAssignment`

### Utilities
- [ ] `prorateDaysToWeek()` returns 0 for non-overlapping weeks
- [ ] `prorateDaysToWeek()` distributes correctly when phase spans two quarters (days split proportionally)
- [ ] `getPhaseRange()` falls back to quarter boundaries when phase has no ISO dates
- [ ] `calculateBusinessCapacity()` returns `utilisationPct > 1.0` for overallocated contacts

### Phase Form
- [ ] Business commitment section visible in expanded phase form
- [ ] Dropdown shows only contacts linked to the project
- [ ] Can add, edit, and remove commitment inline
- [ ] Saving the project saves business commitments in the same flow
- [ ] No duplicate commitment per contact per phase

### Heatmap
- [ ] People filter shows three options; default is "IT team only"
- [ ] "IT team only" produces identical output to before this feature (no regression)
- [ ] "Both" shows IT rows, then divider, then business rows
- [ ] Business row labels are visually lighter; include BIZ tag
- [ ] Business cells use same colour scale as IT cells
- [ ] Overallocated business cells show "(Informational only)" in tooltip
- [ ] Business contacts with no assignments appear as all-white rows when shown
- [ ] Cell tooltip shows available days, allocated days per project/phase, utilisation %

### Timeline
- [ ] Phase bar tooltip shows "Business commitment" section when commitments exist
- [ ] Section is absent when no commitments on the phase

### Settings
- [ ] Business contacts page: list, add, edit, archive, delete
- [ ] Time-off entries manageable per contact
- [ ] No IT capacity function references `BusinessAssignment` or `BusinessTimeOff`
- [ ] Business contacts do not appear in overallocation alerts, auto-assign, or IT reports

### Database
- [ ] Migration `011_business_contacts.sql` applies cleanly
- [ ] RLS policies restrict access to authenticated users
- [ ] `loadFromSupabase` / `saveToSupabase` round-trip all three new tables correctly
