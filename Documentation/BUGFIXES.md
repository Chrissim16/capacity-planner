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

*End of log*
