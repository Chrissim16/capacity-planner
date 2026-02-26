# Estimation Confidence Levels — Functional & Technical Specification
**VS Finance Capacity Planner · Mileway BV**
_Version 1.0 · February 2026_

_Addendum to: Capacity Planner — Functional & Technical Specifications v1.0_

---

## Overview

Estimated days on a phase are always uncertain. A well-scoped delivery phase with a known team might be a near-exact estimate. An early-stage integration phase where requirements are still fluid might have a 50% margin of error. The confidence level system makes that uncertainty **explicit and plannable** rather than hidden.

When you mark a phase as Medium or Low confidence, the tool automatically inflates the allocated days by a configurable buffer percentage. This means the capacity plan accounts for the risk — not just the best-case scenario — and overallocation alerts fire before you've already committed.

**The principle:** Enter your best estimate as raw days. Then honestly assess your confidence. The tool handles the buffer arithmetic.

---

## How It Works — End to End

```
Settings defines the buffer rules:
  Medium confidence buffer: 20%   ← configurable
  Low confidence buffer:    50%   ← configurable

Phase has a confidence level:
  "Yardi upgrade delivery"         → No adjustment (default)
  "OneStream integration"          → Medium confidence
  "New bank connectivity (scoping)"→ Low confidence

Effective days used in capacity planning:
  Yardi upgrade: 10 raw days × 1.00 =  10 effective days
  OneStream:     10 raw days × 1.20 =  12 effective days
  Bank connect:  10 raw days × 1.50 =  15 effective days

Display in timeline:
  Yardi:    "10d"
  OneStream "10d → 12d (×1.2)"   with amber confidence badge
  Bank:     "10d → 15d (×1.5)"   with red confidence badge
```

---

## Part 1 — Settings Configuration

### 1.1 Confidence Level Definitions

**Location:** Settings → Planning → Estimation Confidence

The IT Manager configures what Medium and Low confidence mean as buffer percentages. High confidence is always 0% — it means the estimate is used as-is with no inflation.

| Level | Buffer | Configurable? | Description shown in UI |
|---|---|---|---|
| No adjustment | 0% | No — always 0 | "Use raw estimate as-is. No buffer applied." |
| Medium | 20% (default) | Yes | "Estimate is directional. Some scope or complexity uncertainty." |
| Low | 50% (default) | Yes | "Estimate is rough. Requirements or approach not yet confirmed." |

**Functional Specifications:**
- Medium buffer: configurable 5–100% in whole number steps. Default: 20%.
- Low buffer: configurable 10–200% in whole number steps. Default: 50%.
- Low buffer must always be ≥ Medium buffer. If the user tries to set Low below Medium, show a validation error: "Low confidence buffer must be at least as high as Medium."
- Changes to these settings apply immediately to all existing phases using that confidence level. The effective days recalculate automatically across the entire plan.
- No separate "High confidence" setting — High is always 0% and cannot be changed. This is intentional: if you're confident, there's no buffer to configure.

**Settings UI:**

```
┌──────────────────────────────────────────────────────────────────┐
│  Estimation Confidence                                           │
│  Define how much buffer is added to raw day estimates when a     │
│  phase is marked as Medium or Low confidence.                    │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  No adjustment          0%    (fixed — no buffer)               │
│                                                                  │
│  Medium confidence    [20]%   ← editable number input            │
│  "Estimate is directional. Some uncertainty in scope."          │
│                                                                  │
│  Low confidence       [50]%   ← editable number input            │
│  "Estimate is rough. Requirements not confirmed."               │
│                                                                  │
│  Example: a 10-day raw estimate becomes:                         │
│    No adjustment    →  10 days                                   │
│    Medium (20%)     →  12 days                                   │
│    Low (50%)        →  15 days                                   │
│                                                                  │
│  [Save changes]                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Technical Specification:**

```ts
// frontend/src/types.ts — add to Settings interface:

interface ConfidenceLevelSettings {
  mediumBufferPct: number;   // default: 20 (meaning 20%)
  lowBufferPct: number;      // default: 50 (meaning 50%)
}

interface Settings {
  // ... existing fields ...
  confidenceLevels: ConfidenceLevelSettings;
}

// Default value in defaultAppState:
settings: {
  // ...
  confidenceLevels: {
    mediumBufferPct: 20,
    lowBufferPct: 50,
  }
}
```

```ts
// Validation function:
function validateConfidenceLevels(medium: number, low: number): string | null {
  if (medium < 5 || medium > 100)  return 'Medium buffer must be between 5% and 100%.';
  if (low < 10 || low > 200)       return 'Low buffer must be between 10% and 200%.';
  if (low < medium)                return 'Low confidence buffer must be at least as high as Medium.';
  return null;
}
```

---

## Part 2 — Phase-Level Confidence Assignment

### 2.1 Data Model

**Location:** `frontend/src/types.ts` — `Phase` interface

```ts
type ConfidenceLevel = 'none' | 'medium' | 'low';

interface Phase {
  // ... existing fields ...
  confidenceLevel?: ConfidenceLevel;  // default: 'none' (no adjustment)
}
```

- `'none'` (or absent): No buffer applied. The raw estimate is used as-is.
- `'medium'`: Apply `settings.confidenceLevels.mediumBufferPct` to all assignments on this phase.
- `'low'`: Apply `settings.confidenceLevels.lowBufferPct` to all assignments on this phase.

**The default is `'none'`.** New phases created manually or imported from Jira start with no adjustment. Buffer is only added when the Team Lead explicitly acknowledges uncertainty.

### 2.2 Effective Days Calculation

The confidence buffer is applied at the **phase level** and flows down to affect all assignments within that phase.

```ts
// frontend/src/utils/capacity.ts — add helper:

export function getConfidenceMultiplier(
  level: ConfidenceLevel | undefined,
  settings: Settings
): number {
  switch (level) {
    case 'medium': return 1 + (settings.confidenceLevels.mediumBufferPct / 100);
    case 'low':    return 1 + (settings.confidenceLevels.lowBufferPct / 100);
    default:       return 1.0;   // 'none' or undefined → no adjustment
  }
}

export function getEffectiveDays(
  rawDays: number,
  phase: Phase,
  settings: Settings
): number {
  const multiplier = getConfidenceMultiplier(phase.confidenceLevel, settings);
  return Math.ceil(rawDays * multiplier);
  // Math.ceil: always round up — never inflate then round down, 
  // which would defeat the purpose of the buffer.
}
```

**Rounding rule:** Always round **up** (Math.ceil). A 10-day estimate at 20% buffer = 12.0 days exactly. A 7-day estimate at 20% buffer = 8.4 → rounds to **9 days**. The buffer should never be lost to rounding.

### 2.3 Impact on Capacity Calculations

**`calculateCapacity` in `capacity.ts` must use effective days, not raw days.**

```ts
// Before (current):
const assignmentDays = assignment.days;  // raw days

// After:
const phase = getPhaseById(state, assignment.phaseId);
const effectiveDays = getEffectiveDays(assignment.days, phase, state.settings);
// Use effectiveDays everywhere raw days were used previously
```

This means:
- Utilisation % shown in the timeline is based on effective days
- Overallocation alerts fire based on effective days
- Capacity Bank card numbers are based on effective days
- The 12-week forecast uses effective days for demand
- Reports show effective days as the planning number

**Raw days are preserved.** The `assignment.days` field always stores the raw estimate entered by the user. The effective days are always computed — never stored — so that changing the confidence level or the buffer % in Settings immediately recalculates everything.

### 2.4 Assignment-Level Confidence (Optional Override)

In most cases, confidence is set at the phase level and applies uniformly to all assignments on that phase. However, individual assignments may optionally override the phase-level confidence if needed.

```ts
interface Assignment {
  // ... existing fields ...
  confidenceLevelOverride?: ConfidenceLevel;  // if set, takes precedence over phase.confidenceLevel
}

// In getEffectiveDays, check assignment override first:
export function getEffectiveDays(
  rawDays: number,
  phase: Phase,
  assignment: Assignment,
  settings: Settings
): number {
  const level = assignment.confidenceLevelOverride ?? phase.confidenceLevel;
  const multiplier = getConfidenceMultiplier(level, settings);
  return Math.ceil(rawDays * multiplier);
}
```

Assignment-level overrides are not surfaced in the primary UI — they are an advanced option accessible only via the assignment detail edit modal, not the main phase editor. Most users will only ever set confidence at the phase level.

---

## Part 3 — User Interface

### 3.1 Phase Edit Form — Confidence Selector

The confidence selector appears in the phase edit form (the form used when creating or editing a project phase). It sits below the days/duration fields.

```
Phase: OneStream Integration
─────────────────────────────────────────────────────────────

  Name        [OneStream Integration                        ]
  Start date  [01 Apr 2026    ]   End date  [30 Jun 2026   ]
  Phase type  [Delivery ▾              ]

  ─────────────────────────────────────────────────────────
  Estimation

  Raw estimate    [10] days

  Confidence      ○ No adjustment    10 days (no buffer)
                  ○ Medium           12 days (+2 days, 20% buffer)
                  ● Low              15 days (+5 days, 50% buffer)

  ⓘ Effective estimate: 15 days — used in all capacity calculations.
     Buffer percentages configured in Settings → Estimation Confidence.
  ─────────────────────────────────────────────────────────

  Required skills  [+ Add skill]
```

**Behaviour:**
- Radio button group: `No adjustment` | `Medium` | `Low`
- Default selection for new phases: `No adjustment`
- Each option dynamically shows the resulting effective days as the user types in the raw estimate, or as they toggle between options
- The "effective estimate" info line updates live as the raw estimate changes or confidence level changes
- The buffer % shown next to each option comes from Settings (live, not hardcoded labels)
- If the user hasn't entered a raw estimate yet, the effective days calculation shows a dash

**Component:**

```tsx
// frontend/src/components/ConfidenceSelector.tsx

interface ConfidenceSelectorProps {
  value: ConfidenceLevel;
  onChange: (level: ConfidenceLevel) => void;
  rawDays: number;
  settings: Settings;
}

const ConfidenceSelector = ({ value, onChange, rawDays, settings }: ConfidenceSelectorProps) => {
  const { mediumBufferPct, lowBufferPct } = settings.confidenceLevels;

  const options: { level: ConfidenceLevel; label: string; bufferPct: number }[] = [
    { level: 'none',   label: 'No adjustment', bufferPct: 0 },
    { level: 'medium', label: 'Medium',         bufferPct: mediumBufferPct },
    { level: 'low',    label: 'Low',            bufferPct: lowBufferPct },
  ];

  return (
    <div className="confidence-selector">
      <label className="form-label">Confidence</label>
      {options.map(opt => {
        const effectiveDays = Math.ceil(rawDays * (1 + opt.bufferPct / 100));
        const addedDays = effectiveDays - rawDays;
        return (
          <label key={opt.level} className="confidence-option">
            <input
              type="radio"
              name="confidenceLevel"
              value={opt.level}
              checked={value === opt.level}
              onChange={() => onChange(opt.level)}
            />
            <span className="confidence-label">{opt.label}</span>
            <span className="confidence-result">
              {rawDays > 0 ? (
                <>
                  {effectiveDays} days
                  {addedDays > 0 && (
                    <span className="confidence-added"> (+{addedDays}d, {opt.bufferPct}% buffer)</span>
                  )}
                </>
              ) : (
                <span className="confidence-na">— enter raw estimate first</span>
              )}
            </span>
          </label>
        );
      })}
      {rawDays > 0 && value !== 'none' && (
        <p className="confidence-summary">
          ⓘ Effective estimate: {Math.ceil(rawDays * (1 + (value === 'medium' ? mediumBufferPct : lowBufferPct) / 100))} days
          — used in all capacity calculations.
        </p>
      )}
    </div>
  );
};
```

### 3.2 Timeline — Confidence Indicators on Phase Bars

Phase bars on the Timeline show a subtle indicator when a confidence buffer is active.

**Visual rules:**

| Confidence | Bar appearance | Days label | Badge |
|---|---|---|---|
| None (no adjustment) | Normal — no change | "10d" | None |
| Medium | Thin amber dotted left border | "10d → 12d" | Amber "M" badge |
| Low | Thin red dotted left border | "10d → 15d" | Red "L" badge |

```css
/* Phase bar with confidence level */

.phase-bar--medium-confidence {
  border-left: 3px dotted var(--color-warning);
}

.phase-bar--low-confidence {
  border-left: 3px dotted var(--color-danger);
}

/* Confidence badge in the bar */
.confidence-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  font-size: 9px;
  font-weight: 800;
  line-height: 1;
  margin-left: 4px;
  flex-shrink: 0;
}

.confidence-badge--medium {
  background: var(--color-warning);
  color: #FFFFFF;
}

.confidence-badge--low {
  background: var(--color-danger);
  color: #FFFFFF;
}

/* Days label when confidence buffer is active */
.phase-bar-days--buffered {
  display: flex;
  align-items: center;
  gap: 3px;
}

.phase-bar-days-raw {
  text-decoration: line-through;
  opacity: 0.6;
  font-size: 9px;
}

.phase-bar-days-effective {
  font-weight: 700;
}
```

**Hover tooltip on a buffered phase bar:**

```
┌─────────────────────────────────────────┐
│  OneStream Integration                  │
│  ─────────────────────────────────────  │
│  Raw estimate:        10 days           │
│  Confidence level:    Low (50% buffer)  │
│  Buffer added:         +5 days          │
│  Effective estimate:  15 days           │
│  ─────────────────────────────────────  │
│  [Click to change confidence]           │
└─────────────────────────────────────────┘
```

### 3.3 Assignment Quick Edit — Confidence Shortcut

When editing an assignment inline on the timeline (right-click context menu), include a quick confidence toggle without needing to open the full phase form.

```
Context menu on phase bar:
  ─────────────────────
  Confidence level
  ● No adjustment
  ○ Medium  (+20%)
  ○ Low     (+50%)
  ─────────────────────
  Edit full phase...
  Delete phase
```

### 3.4 Member Row — Capacity Display with Buffered Days

In the Timeline member rows, the capacity breakdown must make it clear when utilisation includes confidence buffers.

**Current display:** `87% · 10 days used / 65 available`

**Updated display when buffers are active:**
```
87% · 10 raw days (12 effective) / 65 available
```
Or in the stacked capacity bar tooltip:
```
Committed (raw):       10 days
Confidence buffer:      +2 days
Committed (effective): 12 days  ← used for utilisation %
Available:             65 days
Utilisation:           18%
```

**In the quarterly capacity cell, show effective days by default.** An "i" icon on the cell opens the tooltip showing the raw vs effective breakdown. This keeps the primary view clean while the detail is accessible.

### 3.5 Project Detail Panel — Confidence Summary

In the project detail panel (opened by clicking a project in the portfolio view), add a confidence summary section:

```
Estimation Summary
────────────────────────────────────────
Phase                   Raw    Confidence  Effective
Scoping & Design        5d     No adj.     5d
Build & Integration     10d    Low (+50%)  15d
Testing                 6d     Medium (20%)  8d (rounded up from 7.2)
Go-live & Hypercare     3d     No adj.     3d
────────────────────────────────────────
Total (raw):            24d
Total (effective):      31d
Buffer added:           +7d  (+29%)
```

This gives IT Manager a full picture of where uncertainty has been acknowledged and how much total buffer is in the plan.

---

## Part 4 — Impact on Existing Features

### 4.1 Capacity Bank (NEW-C)

The Capacity Bank committed days number must use **effective days**:

```
Committed to projects = sum of getEffectiveDays(a.days, phase, a, settings)
                        for all confirmed (non-tentative) assignments
```

The breakdown tooltip on the Capacity Bank card should add:
```
Committed (raw):       38 days
Confidence buffer:      +9 days
Committed (effective): 47 days
```

### 4.2 Rolling 12-Week Forecast (CP-2.4)

The demand series in the forecast chart uses effective days. If a phase has a confidence buffer, the demand line will be higher than it would appear from raw estimates alone — which is the correct and intentional behaviour.

Add an annotation option: "Show buffer breakdown" toggle that splits the demand line into raw demand (solid) and buffer demand (hatched overlay of the same colour). This lets IT Manager see how much of the forecast demand is "real" vs buffer.

### 4.3 Capacity vs. Demand Gap Report (RS-5.2)

The gap report uses effective days. Report footer includes:
```
Note: Demand figures include confidence buffers where applied.
Total buffer included in demand: +9 days across 3 phases.
To see raw demand, toggle off confidence buffers in Settings.
```

### 4.4 Sprint Capacity Calculator (CP-2.3)

Sprint allocations also use effective days. In the sprint detail view, when a phase has a confidence buffer, its sprint allocation shows:
```
OneStream Integration  15d effective (10d raw)  [L]
```
The `[L]` badge indicates Low confidence. Sprint story point comparison continues to use the raw estimate for velocity comparison (since velocity is measured against what was planned, not the buffered estimate).

### 4.5 New Change Intake Modeller (SP-3.1)

The intake form includes a confidence selector per role/phase:

```
Required roles:
  ERP Consultant  10 hrs/week  for 6 weeks  [Confidence: Medium ▾]
  TMS Analyst      5 hrs/week  for 4 weeks  [Confidence: Low    ▾]
```

The feasibility calculation uses effective hours derived from the confidence selection. This means a Low-confidence intake estimate triggers an earlier "insufficient capacity" warning, which is correct — a low-confidence request should require more headroom.

### 4.6 Scenarios (SP-3.2)

Scenarios inherit the confidence levels of the phases they contain. When comparing scenarios in SP-3.3:
- Scenario comparison metrics use effective days for both
- A separate column shows "Total buffer in plan" — useful for comparing an optimistic scenario (all phases No adjustment) vs a conservative one (some phases at Medium/Low)

### 4.7 Auto-Assign Algorithm (SK-4.5)

The `suggestAssignees` function uses effective days when calculating projected utilisation:
```ts
const projectedUtilisationPct = (currentUsedDays + getEffectiveDays(estimatedDays, phase, assignment, settings))
                                  / totalWorkdays;
```
This prevents the auto-assign from suggesting someone who appears available on raw days but would be overallocated when the confidence buffer is included.

### 4.8 Overallocation Alerts (CP-2.5)

Overallocation is checked against effective days. If a phase moves from No adjustment to Low confidence and that tips a member over threshold, an overallocation alert fires immediately — even though no raw assignment days changed. This is correct behaviour.

The alert email and in-app notification should specify whether the overallocation is driven by a confidence buffer:
```
⚠ Jan de Vries is overallocated in Q2 2026.
Allocated: 72 effective days (62 raw + 10 confidence buffer)
Available: 65 days
Over by: 7 days

The overallocation is partly due to confidence buffers on:
  OneStream Integration (Low confidence, +10 days buffer)
To resolve: reduce other allocations, adjust the confidence level, or
            extend the phase into Q3.
```

---

## Part 5 — Settings Page — Full Section Spec

### 5.1 Settings → Planning → Estimation Confidence

**Complete settings section spec including validation and persistence:**

```ts
// Settings page component for confidence levels

interface ConfidenceSettingsState {
  medium: string;  // string to allow partial input during editing
  low: string;
  error: string | null;
  saved: boolean;
}

// On save:
function saveConfidenceLevels(medium: number, low: number): void {
  const error = validateConfidenceLevels(medium, low);
  if (error) { setError(error); return; }
  
  updateSettings({
    confidenceLevels: {
      mediumBufferPct: medium,
      lowBufferPct: low,
    }
  });
  
  // scheduleSyncToSupabase is called by updateSettings
  // Show "Saved" toast
  // Show "Plan updated: effective days recalculated for X phases" toast
}

// On change, recalculate preview example:
const exampleRawDays = 10;
const exampleMediumEffective = Math.ceil(exampleRawDays * (1 + mediumPct/100));
const exampleLowEffective    = Math.ceil(exampleRawDays * (1 + lowPct/100));
```

**"Plan updated" notification:** When buffer percentages are changed and saved, the app should show a summary of how many phases were affected:
```
Settings saved.
Confidence buffers updated: 4 phases recalculated.
  Medium confidence phases: 2 (Basware Implementation, Virtual Accounts)
  Low confidence phases:    2 (New ERP scoping, Bank connectivity)
Total effective days added to plan: +18 days (was +14 days).
```

---

## Part 6 — Data Model Summary

### 6.1 Types (changes to frontend/src/types.ts)

```ts
// New type
type ConfidenceLevel = 'none' | 'medium' | 'low';

// Updated Settings interface
interface ConfidenceLevelSettings {
  mediumBufferPct: number;  // 5–100, default 20
  lowBufferPct: number;     // 10–200, default 50
}

interface Settings {
  // ... existing fields ...
  confidenceLevels: ConfidenceLevelSettings;
}

// Updated Phase interface
interface Phase {
  // ... existing fields ...
  confidenceLevel?: ConfidenceLevel;  // default: undefined = 'none'
}

// Updated Assignment interface (optional per-assignment override)
interface Assignment {
  // ... existing fields ...
  confidenceLevelOverride?: ConfidenceLevel;  // rarely used; phase level is primary
}
```

### 6.2 Database (no migration required for Phase)

Phase data is currently stored in the `projects.phases` JSONB column. The `confidenceLevel` field is added inline to the phase JSON objects — no schema change required. It's automatically included when the next Supabase sync runs.

Settings are stored in the `settings` key-value table. The existing `confidenceLevels` key is upserted with the JSON value:
```json
{
  "mediumBufferPct": 20,
  "lowBufferPct": 50
}
```

After the assignments table is created (migration 011 from the main spec), the `confidence_level_override` column can be added:
```sql
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS confidence_level_override text
  CHECK (confidence_level_override IN ('none', 'medium', 'low'));
```

### 6.3 Utility Functions (frontend/src/utils/capacity.ts)

```ts
// All new exports:

export type ConfidenceLevel = 'none' | 'medium' | 'low';

export function getConfidenceMultiplier(
  level: ConfidenceLevel | undefined,
  settings: Settings
): number

export function getEffectiveDays(
  rawDays: number,
  phase: Phase,
  assignment: Assignment,
  settings: Settings
): number

export function getConfidenceBufferDays(
  rawDays: number,
  phase: Phase,
  assignment: Assignment,
  settings: Settings
): number
// Returns the absolute days added by the buffer (effectiveDays - rawDays)

export function getConfidenceLevelLabel(level: ConfidenceLevel | undefined): string
// 'none' → 'No adjustment', 'medium' → 'Medium', 'low' → 'Low'

export function getConfidenceLevelColor(level: ConfidenceLevel | undefined): string
// 'none' → 'transparent', 'medium' → '--color-warning', 'low' → '--color-danger'
```

---

## Part 7 — Acceptance Criteria

### Settings

- [ ] Medium and Low buffer percentages are configurable in Settings → Planning → Estimation Confidence
- [ ] Validation prevents Low buffer being set below Medium buffer
- [ ] Changing buffer % in Settings immediately recalculates all effective days in the open plan
- [ ] A "plan updated" notification shows how many phases were affected after saving
- [ ] Default values are Medium = 20%, Low = 50% on first load

### Phase-level assignment

- [ ] Every phase edit form shows the Confidence selector (No adjustment / Medium / Low)
- [ ] Default for new phases is "No adjustment"
- [ ] Jira-imported phases default to "No adjustment"
- [ ] Selecting a confidence level shows the effective days live (before saving)
- [ ] Changing confidence level on a phase re-triggers overallocation check immediately

### Calculations

- [ ] `calculateCapacity` uses effective days (not raw days) for utilisation %
- [ ] Overallocation alert fires correctly when effective days (not raw) push over threshold
- [ ] Auto-assign projected utilisation uses effective days
- [ ] Capacity Bank committed days reflect effective days
- [ ] Forecast demand uses effective days
- [ ] Math.ceil is used for rounding (never round down a buffer)

### Display

- [ ] Phase bars with Medium confidence show amber dotted left border + "M" badge
- [ ] Phase bars with Low confidence show red dotted left border + "L" badge
- [ ] Phase bars with No adjustment show no change
- [ ] Phase bar tooltip shows raw → effective days breakdown when buffer is active
- [ ] Member row capacity tooltip shows raw days, buffer days, and effective days separately
- [ ] Project detail panel shows per-phase confidence summary table
- [ ] Timeline capacity bars are based on effective days

### Edge cases

- [ ] Phase with 0 raw days and any confidence level → effective days = 0 (no buffer on zero)
- [ ] Confidence level changes don't affect tentative assignments differently from confirmed ones
- [ ] Scenario comparison shows total buffer in plan for each scenario side-by-side
- [ ] Planned vs actual report (RS-5.3) compares Jira actual hours against raw planned days, not effective days (effective days are a planning buffer, not a delivery target)

---

## Part 8 — Cursor Implementation Prompt

**References:** `@frontend/src/types.ts` `@frontend/src/utils/capacity.ts` `@frontend/src/pages/Settings.tsx` `@frontend/src/pages/Timeline.tsx`

```
Implement the Estimation Confidence Level feature for the VS Finance Capacity Planner.

The feature adds configurable buffer percentages to phase estimates to account for uncertainty
in early-stage or poorly-scoped work. Here is the full spec:

─────────────────────────────────────────────────────────────────

DATA MODEL (frontend/src/types.ts):

1. Add type:
   type ConfidenceLevel = 'none' | 'medium' | 'low';

2. Add to Settings interface:
   confidenceLevels: {
     mediumBufferPct: number;  // default 20
     lowBufferPct: number;     // default 50
   }

3. Add to Phase interface:
   confidenceLevel?: ConfidenceLevel;  // default: undefined (treated as 'none')

4. Add to Assignment interface:
   confidenceLevelOverride?: ConfidenceLevel;  // rarely used, optional

─────────────────────────────────────────────────────────────────

UTILITY FUNCTIONS (frontend/src/utils/capacity.ts):

Add these exported functions:

getConfidenceMultiplier(level: ConfidenceLevel | undefined, settings: Settings): number
  Returns 1.0 for 'none'/undefined, 1+mediumPct/100 for 'medium', 1+lowPct/100 for 'low'

getEffectiveDays(rawDays: number, phase: Phase, assignment: Assignment, settings: Settings): number
  - Resolves the effective confidence level: assignment.confidenceLevelOverride ?? phase.confidenceLevel
  - Returns Math.ceil(rawDays * getConfidenceMultiplier(effectiveLevel, settings))
  - If rawDays is 0, always return 0

Update calculateCapacity() to call getEffectiveDays() for every assignment instead of
using assignment.days directly. The assignment.days field stores the raw estimate and
must NOT be modified.

─────────────────────────────────────────────────────────────────

SETTINGS PAGE (frontend/src/pages/Settings.tsx):

Add a section "Estimation Confidence" under Planning settings:
  - Two number inputs: "Medium confidence buffer (%)" and "Low confidence buffer (%)"
  - Validation on save: low must be ≥ medium; medium must be 5–100; low must be 10–200
  - Live preview example: show what a 10-day raw estimate becomes at each level
  - On successful save: show toast "Confidence buffers updated — X phases recalculated"
  - The count of affected phases: phases where confidenceLevel is 'medium' or 'low'

─────────────────────────────────────────────────────────────────

PHASE EDIT FORM (wherever phase editing happens):

Add a ConfidenceSelector component:
  Radio buttons: No adjustment | Medium | Low
  Default: 'none' for new phases
  Each option shows the resulting effective days live as the raw estimate is typed
  Below the selector: "Effective estimate: X days — used in all capacity calculations."

─────────────────────────────────────────────────────────────────

TIMELINE (frontend/src/pages/Timeline.tsx):

On phase bars with confidenceLevel 'medium' or 'low':
  Add amber ('medium') or red ('low') dotted left border: 3px dotted
  Add a small circular badge: "M" in amber or "L" in red (14×14px, 9px bold font)
  In the days label: show "10d → 12d" instead of just "12d" when buffered

Hover tooltip on buffered phase bar, add:
  Raw estimate:       10 days
  Confidence level:   Medium (20% buffer)
  Buffer added:       +2 days
  Effective estimate: 12 days

─────────────────────────────────────────────────────────────────

CONSTRAINTS:
- assignment.days always stores the RAW estimate — never modify it
- Effective days are always COMPUTED from raw days + confidence level + settings
- Always use Math.ceil for rounding (never round down a buffer)
- Phase confidence is the primary setting; assignment override is secondary
- Default for all existing and new phases is 'none' (no buffer)
- Show all changes, don't skip any of the above files.
```

---

## Part 9 — Where This Fits in the Existing Spec

This specification is an addendum to the main Functional & Technical Specifications document. It adds a new feature not previously covered. The following sections of the main spec are **affected and should be updated** to reference confidence levels:

| Main Spec Section | Update Required |
|---|---|
| 0.5 Flatten Assignment Structure | Add `confidenceLevelOverride?` to the new Assignment table definition |
| CP-2.1 Drag-and-drop | Capacity guard check should use effective days |
| CP-2.3 Sprint capacity calculator | Sprint progress bars use effective days |
| CP-2.4 Rolling 12-week forecast | Demand series uses effective days; add buffer toggle |
| CP-2.5 Overallocation alerts | Alert message references buffer when applicable |
| SP-3.1 Intake modeller | Intake form includes confidence selector per role |
| RS-5.2 Gap report | Footer note on buffer inclusion |
| RS-5.3 Planned vs actual | Compare Jira actuals against raw planned days (not effective) |
| SK-4.5 Auto-assign | Projected utilisation uses effective days |
| NEW-C Capacity Bank | Committed days shown as raw + buffer breakdown |
| Appendix A — Data Model | Add ConfidenceLevel type, Phase.confidenceLevel, Assignment.confidenceLevelOverride, Settings.confidenceLevels |
