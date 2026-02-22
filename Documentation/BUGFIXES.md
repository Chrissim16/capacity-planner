# Capacity Planner - Bug Fixes Log

This document tracks bugs found and fixed during development and testing.

---

## Bug #001: Country not saved when adding new team member
**Date:** 2026-02-10  
**Severity:** Medium  
**Found by:** User testing  

### Description
When adding a new team member, the selected country was not being saved. The country would only persist after editing the team member and saving again.

### Root Cause
In the `Data.addTeamMember()` function (js/app.js), the `countryId` field was missing from the member object creation:

```javascript
// BEFORE (buggy)
const member = {
    id: this.generateId('member'),
    name: memberData.name,
    role: memberData.role,
    skillIds: memberData.skillIds || [],
    maxConcurrentProjects: memberData.maxConcurrentProjects || 2
    // countryId was MISSING
};
```

### Fix
Added the `countryId` field to the member object:

```javascript
// AFTER (fixed)
const member = {
    id: this.generateId('member'),
    name: memberData.name,
    role: memberData.role,
    countryId: memberData.countryId || st.settings.defaultCountryId || 'country-nl',
    skillIds: memberData.skillIds || [],
    maxConcurrentProjects: memberData.maxConcurrentProjects || 2
};
```

### File Changed
- `js/app.js` - Line ~1576

---

## Bug #002: Weekly calculator uses calendar weeks instead of work weeks
**Date:** 2026-02-10  
**Severity:** High  
**Found by:** User testing  

### Description
When entering days per week in the assignment weekly calculator, the system calculated total days using **calendar weeks** (~13-14 weeks per quarter) instead of **work weeks** (~12.6 weeks based on actual workdays). This caused assignments to exceed available capacity.

**Example:** For Q1 2026 with 63 workdays:
- User enters: 5 days/week (expecting 100% capacity)
- **Bug result:** 5 × 14 calendar weeks = 70 days (111% - over by 7 days!)
- **Correct result:** 5 × 12.6 work weeks = 63 days (100%)

### Root Cause
The `getQuarterWeeks()` function calculated weeks from calendar days:

```javascript
// BEFORE (buggy) - used calendar days
const getQuarterWeeks = () => {
    const range = Calendar.parseQuarter(quarter);
    const days = Math.floor((range.end - range.start) / (1000 * 60 * 60 * 24)) + 1;
    return Math.round(days / 7);  // ~13-14 calendar weeks
};
```

### Fix
Changed to calculate **work weeks** from actual workdays:

```javascript
// AFTER (fixed) - uses workdays
const getWorkWeeks = () => {
    const quarterWorkdays = getQuarterWorkdays();
    return quarterWorkdays / 5;  // 63 workdays / 5 = 12.6 work weeks
};
```

Now 5 days/week × 12.6 work weeks = 63 days = exactly 100% capacity.

### Files Changed
- `js/app.js` - Lines ~4183-4244 (weekly calculator functions)

---

## Bug #003: Jira proxy returning HTML instead of JSON
**Date:** 2026-02-21  
**Severity:** High  
**Found by:** User testing (Jira connection test)

### Symptom
Testing the Jira connection in Settings produced:
> `Unexpected token '<', "<!doctype "... is not valid JSON`

Navigating directly to `/api/jira` in the browser showed the app's own HTML page instead of a JSON response.

### Investigation Path (what we tried and why it didn't work)

| Attempt | Change | Result | Why it failed |
|---|---|---|---|
| 1 | Simplified `vercel.json` rewrites to `/(.*) → /index.html` | Still HTML | Routing wasn't the issue |
| 2 | Removed `functions` block from `vercel.json` | Still HTML | Made things worse |
| 3 | Converted `api/jira.ts` → `api/jira.js` | Still HTML | Function was still invisible to Vercel |
| 4 | Added `routes` with `{ "handle": "filesystem" }` | Still HTML | Legacy `routes` overrides function-first routing |
| 5 | Removed `framework: vite` from `vercel.json` | Still HTML + builds in 0ms | Caused pure static deployment — no functions at all |
| 6 | Restored `framework: vite`, changed `export default` → `module.exports` | 500 crash | Wrong export syntax for the module context |

### Root Causes (three compounding issues)

**Root Cause 1 — Wrong directory (the main culprit)**  
The Vercel project's "Root Directory" is set to `frontend/` in the Vercel dashboard. This means Vercel only sees files inside `frontend/`. The `api/` folder at the project root was **completely invisible** to Vercel. Every routing fix we tried was irrelevant because no function was ever deployed.

Evidence: `npx vercel inspect` showed:
```
Builds
  ╶ .        [0ms]    ← pure static, no functions
```
After moving the file into `frontend/api/`, it showed:
```
Builds
  ┌ .        [0ms]
  └── λ api/jira (2.69KB)    ← serverless function deployed ✓
```

**Root Cause 2 — Wrong export syntax (caused the 500 crash)**  
`frontend/package.json` has `"type": "module"`, making all `.js` files inside `frontend/` ES modules. Using `module.exports` (CommonJS) inside an ES module context causes a runtime crash. The correct syntax is `export default`.

**Root Cause 3 — Having both `.ts` and `.js` simultaneously**  
At one point both `api/jira.ts` and `api/jira.js` existed. Vercel sees two handlers for the same route, the TypeScript one fails to compile silently, and no function gets deployed.

### Fix

1. **Moved** `api/jira.js` → `frontend/api/jira.js` (inside the Vercel root)
2. **Used** `export default` (ES module syntax, consistent with `"type": "module"` in `frontend/package.json`)
3. **Deleted** `api/jira.ts` to eliminate the conflicting duplicate
4. **Kept** `frontend/vercel.json` with standard `rewrites` (not legacy `routes`) so Vercel's default routing order applies: functions are always served before rewrites

### Files Changed
- `frontend/api/jira.js` — created (moved from root `api/`, fixed export syntax)
- `api/jira.ts` — deleted
- `api/jira.js` — deleted (superseded by `frontend/api/jira.js`)
- `vercel.json` — cleaned up (removed legacy `routes`, removed unused `functions` block)

### Key Lessons
- Always check the Vercel project's "Root Directory" setting first — it controls which files Vercel can see
- `npx vercel inspect <url>` shows the `Builds` section; a `λ` symbol means a function is deployed; `[0ms]` with no `λ` means pure static (no functions)
- `"type": "module"` in the nearest `package.json` controls whether `.js` files are ES modules or CommonJS — the export syntax must match
- Standard `rewrites` respect function-first routing; legacy `routes` (the array format) overrides it
- Use `npx vercel logs <url>` to stream live function logs from the CLI when the Vercel dashboard Logs tab is not available

---

## Bug #004: Jira sync returning "Error-gone" (410) from Atlassian API deprecation
**Date:** 2026-02-21  
**Severity:** High  
**Found by:** User testing (Jira sync button)

### Symptom
Clicking "Sync Jira" produced `Error-gone` in the app. The Jira proxy function itself was healthy (returning correct 400 for missing headers when tested directly).

### Root Cause
Atlassian deprecated the `/rest/api/3/search` endpoint and replaced it with `/rest/api/3/search/jql`. The deprecated endpoint now returns HTTP 410 Gone with the message:
> "The requested API has been removed. Please migrate to the /rest/api/3/search/jql API."

See: https://developer.atlassian.com/changelog/#CHANGE-2046

### Diagnosis
Used `npx vercel logs capacity-planner-mw.vercel.app` (CLI) while triggering the sync to stream live function logs, which revealed:
```
[Jira Proxy] GET https://mileway.atlassian.net/rest/api/3/search?jql=... → 410 Gone
[Jira Proxy] Error response body: {"errorMessages":["The requested API has been removed..."]}
```

### Fix
One-line change in `frontend/src/services/jira.ts`:
```typescript
// Before (deprecated)
const path = '/rest/api/3/search?jql=' + ...

// After
const path = '/rest/api/3/search/jql?jql=' + ...
```

### File Changed
- `frontend/src/services/jira.ts` — updated search endpoint path

---

## Bug #005: Holiday API import returning 404 (country.id sent instead of country.code)
**Date:** 2026-02-22  
**Severity:** Medium  
**Found by:** User testing (Settings > Holidays > Import from Nager.Date API)

### Description
Clicking "Preview" in the new holiday import UI immediately returned a 404 error from the Nager.Date API regardless of which country was selected.

### Root Cause
The Nager.Date API URL is `https://date.nager.at/api/v3/PublicHolidays/{year}/{countryCode}` and expects an ISO 3166-1 alpha-2 country code such as `NL` or `DE`.

Each country record in the app has two separate fields:
- `id` — an internal generated key (e.g. `country-abc123`), used as the foreign key to link holidays, team members, etc.
- `code` — the ISO alpha-2 string (e.g. `NL`, `DE`, `CZ`)

The `handleFetchPreview` function in `HolidaysSection.tsx` was passing `country.id` to `fetchNagerHolidays()` instead of `country.code`, producing URLs like:
```
GET https://date.nager.at/api/v3/PublicHolidays/2026/country-abc123  →  404
```

### Fix
One-character change in `frontend/src/pages/settings/HolidaysSection.tsx`:
```typescript
// Before (buggy)
const holidays = await fetchNagerHolidays(country.id, Number(importYear));

// After
const holidays = await fetchNagerHolidays(country.code, Number(importYear));
```

### File Changed
- `frontend/src/pages/settings/HolidaysSection.tsx` — use `country.code` (ISO alpha-2) for the Nager.Date API call

---

## Bug #006: Holiday API import returns 404 for United Kingdom (UK vs GB)
**Date:** 2026-02-22  
**Severity:** Low  
**Found by:** User testing

### Description
The holiday import preview worked for all countries except the United Kingdom. Selecting "UK" produced a 404 from the Nager.Date API.

### Root Cause
The Nager.Date API strictly follows the ISO 3166-1 alpha-2 standard, where the United Kingdom's official code is `GB`, not `UK`. `UK` is a commonly used informal alias that is not a valid ISO code. If the country was stored in the app with code `UK`, the API call would generate:
```
GET https://date.nager.at/api/v3/PublicHolidays/2026/UK  →  404
```

### Fix
Added a `CODE_ALIASES` map and `normaliseCode()` helper in `nagerHolidays.ts` that transparently converts known informal codes to their ISO standard equivalents before the API call:

```typescript
const CODE_ALIASES: Record<string, string> = {
  UK: 'GB',
  EN: 'GB',
  ENG: 'GB',
};

function normaliseCode(code: string): string {
  const upper = code.toUpperCase();
  return CODE_ALIASES[upper] ?? upper;
}
```

The app-side country code (`UK`) is preserved unchanged — only the value sent to the external API is normalised.

### File Changed
- `frontend/src/services/nagerHolidays.ts` — added `CODE_ALIASES` map and `normaliseCode()` function

---

## Bug #007: Imported holidays not saved (multiple `updateData` calls in loop)
**Date:** 2026-02-22  
**Severity:** High  
**Found by:** User testing (Settings > Holidays > Import from Nager.Date API)

### Description
Clicking "Import all" showed a success message (e.g. "13 holidays imported") but the holidays did not reliably appear in the list or persist after refresh.

### Root Cause
`handleImportAll` called `addHoliday()` once per entry in a `for` loop. Each `addHoliday` call:
1. Reads the current `publicHolidays` array from the Zustand store
2. Appends one new entry
3. Calls `updateData({ publicHolidays })` which writes to the store, `localStorage`, and schedules a Supabase sync

Calling `updateData` N times in rapid succession means N separate `localStorage.setItem()` writes and N `scheduleSyncToSupabase()` calls that each reset a debounce timer. If a sync is already in-flight from a prior action when `handleImportAll` runs, the in-flight sync captures an intermediate state that does not include the newly imported holidays. When `upsertAndPrune` runs for that in-flight sync, it prunes entries whose IDs are not in its snapshot — deleting the just-imported rows from Supabase.

### Fix
Replaced the N-call loop with a single batch action `addHolidaysBatch` that:
1. Reads `publicHolidays` once
2. Builds all new entries at once
3. Calls `updateData` a **single time** with the complete updated array

```typescript
// actions.ts — new action
export function addHolidaysBatch(
  entries: Array<{ countryId: string; date: string; name: string }>
): void {
  if (entries.length === 0) return;
  const state = useAppStore.getState();
  const existing = state.getCurrentState().publicHolidays;
  const newEntries = entries.map(e => ({
    id: generateId('holiday'),
    countryId: e.countryId,
    date: e.date,
    name: e.name,
  }));
  state.updateData({ publicHolidays: [...existing, ...newEntries] });
}
```

### Files Changed
- `frontend/src/stores/actions.ts` — added `addHolidaysBatch` action
- `frontend/src/pages/settings/HolidaysSection.tsx` — `handleImportAll` now uses `addHolidaysBatch` with a single `updateData` call

---

*End of log*
