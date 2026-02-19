# Capacity Calculation

## Overview

The core function of the Capacity Planner is calculating available capacity for team members across time periods. This document explains the calculation logic.

## Formula

```
Available Capacity = Total Workdays - Public Holidays - Time Off - BAU Reserve - Assigned Days
```

## Components

### Total Workdays
Standard working days in the period (excluding weekends).

```typescript
function getWorkdaysInQuarter(quarter: string, year: number): number {
  // Count Monday-Friday in the quarter
  const start = getQuarterStartDate(quarter, year);
  const end = getQuarterEndDate(quarter, year);
  
  let workdays = 0;
  let current = start;
  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) {  // Not weekend
      workdays++;
    }
    current.setDate(current.getDate() + 1);
  }
  return workdays;
}
```

**Typical values**:
- Q1: ~63 workdays
- Q2: ~63 workdays
- Q3: ~65 workdays
- Q4: ~62 workdays

### Public Holidays
Country-specific non-working days.

```typescript
function getHolidaysInQuarter(countryId: string, quarter: string): number {
  return publicHolidays
    .filter(h => h.countryId === countryId && isInQuarter(h.date, quarter))
    .length;
}
```

**Examples**:
- Netherlands Q1: ~4 holidays (New Year, Good Friday, Easter)
- Germany Q1: ~3 holidays
- Belgium Q1: ~3 holidays

### Time Off
Personal time off (vacation, training, etc.) per team member.

```typescript
function getTimeOffDays(memberId: string, quarter: string): number {
  return timeOff
    .filter(t => t.memberId === memberId && t.quarter === quarter)
    .reduce((sum, t) => sum + t.days, 0);
}
```

### BAU Reserve
Days reserved for Business As Usual work (support, maintenance, meetings).

```typescript
// Global setting, applies to all members
const bauReserveDays = settings.bauReserveDays;  // Default: 5 days/quarter
```

### Assigned Days
Sum of all project/phase assignments for the member in the period.

```typescript
function getAssignedDays(memberId: string, quarter: string): number {
  let total = 0;
  for (const project of projects) {
    for (const phase of project.phases) {
      for (const assignment of phase.assignments) {
        if (assignment.memberId === memberId && assignment.quarter === quarter) {
          total += assignment.days;
        }
      }
    }
  }
  return total;
}
```

## Full Calculation

```typescript
function calculateCapacity(
  memberId: string,
  quarter: string
): CapacityResult {
  const member = teamMembers.find(m => m.id === memberId);
  
  // Get total workdays
  const totalWorkdays = getWorkdaysInQuarter(quarter);
  
  // Subtract holidays
  const holidays = getHolidaysInQuarter(member.countryId, quarter);
  
  // Subtract time off
  const timeOff = getTimeOffDays(memberId, quarter);
  
  // Subtract BAU reserve
  const bau = settings.bauReserveDays;
  
  // Get assigned days
  const assigned = getAssignedDays(memberId, quarter);
  
  // Calculate
  const availableGross = totalWorkdays - holidays;
  const availableNet = availableGross - timeOff - bau;
  const usedDays = assigned;
  const availableDays = availableNet - usedDays;
  const usedPercent = (usedDays / availableNet) * 100;
  
  // Determine status
  let status: CapacityStatus = 'normal';
  if (usedPercent > 100) status = 'overallocated';
  else if (usedPercent > 85) status = 'warning';
  
  return {
    totalWorkdays,
    usedDays,
    availableDays: Math.max(0, availableDays),
    availableDaysRaw: availableDays,  // Can be negative
    usedPercent,
    status,
    breakdown: [
      { type: 'bau', days: bau, reason: 'BAU Reserve' },
      { type: 'timeoff', days: timeOff },
      // ... project assignments
    ]
  };
}
```

## Status Thresholds

| Status | Condition | UI Color |
|--------|-----------|----------|
| Normal | < 85% utilized | Green |
| Warning | 85-100% utilized | Amber |
| Overallocated | > 100% utilized | Red |

## Example Calculation

**Team Member**: Alice (Netherlands)  
**Period**: Q1 2026

| Component | Days |
|-----------|------|
| Total Workdays | 63 |
| Public Holidays (NL) | -4 |
| **Gross Available** | **59** |
| Time Off | -5 |
| BAU Reserve | -5 |
| **Net Available** | **49** |
| Project X Assignment | -20 |
| Project Y Assignment | -15 |
| **Remaining** | **14** |

**Utilization**: (35 / 49) × 100 = **71%** → Normal ✅

## Sprint-Level Calculation

When assignments include sprint granularity:

```typescript
function calculateSprintCapacity(
  memberId: string,
  sprint: Sprint
): number {
  // Days in sprint (typically 15 for 3-week sprint)
  const sprintDays = getWorkdaysInRange(sprint.startDate, sprint.endDate);
  
  // Pro-rate holidays and time off
  const holidays = getHolidaysInRange(memberId, sprint.startDate, sprint.endDate);
  
  // Sprint assignments
  const assigned = getAssignedDays(memberId, sprint.name);
  
  return sprintDays - holidays - assigned;
}
```

## Warnings System

The dashboard displays warnings for capacity issues:

### Overallocation Warning
```typescript
interface OverallocationWarning {
  member: TeamMember;
  usedDays: number;
  totalDays: number;
  quarter: string;
}
```
Triggered when `usedPercent > 100`

### High Utilization Warning
```typescript
interface HighUtilizationWarning {
  member: TeamMember;
  usedDays: number;
  totalDays: number;
  usedPercent: number;
  quarter: string;
}
```
Triggered when `usedPercent > 85 && usedPercent <= 100`

### Too Many Projects Warning
```typescript
interface TooManyProjectsWarning {
  member: TeamMember;
  count: number;
  max: number;
}
```
Triggered when concurrent project count exceeds `member.maxConcurrentProjects`

### Skill Mismatch Warning
```typescript
interface SkillMismatchWarning {
  member: TeamMember;
  project: Project;
  phase: Phase;
  missingSkills: string[];
}
```
Triggered when assigned to phase requiring skills member doesn't have

## Jira Integration Impact

When Jira items are mapped:
- Story Points can be converted to days (configurable ratio)
- Time Spent from Jira shows actual vs planned
- Assignee matching enables automatic utilization tracking

```typescript
function getJiraAssignedDays(memberId: string, quarter: string): number {
  const member = teamMembers.find(m => m.id === memberId);
  
  return jiraWorkItems
    .filter(item => 
      item.assigneeEmail === member.email &&
      item.mappedProjectId &&
      isInQuarter(item.sprintName, quarter)
    )
    .reduce((sum, item) => {
      const points = item.storyPoints || 0;
      return sum + (points * jiraSettings.storyPointsToDays);
    }, 0);
}
```

## UI Components

### Capacity Bar
Visual representation of capacity:
```
┌────────────────────────────────────────────────────┐
│████████████████████████░░░░░░░░░░░░░░░│  71%     │
│        Used (35d)        │ Available  │           │
└────────────────────────────────────────────────────┘
```

### Capacity Breakdown Tooltip
Shows composition on hover:
```
Q1 2026 Capacity (Alice)
─────────────────────────
Total Workdays:    63
Public Holidays:   -4
Time Off:          -5
BAU Reserve:       -5
─────────────────────────
Available:         49
─────────────────────────
Project X:         20
Project Y:         15
─────────────────────────
Remaining:         14 (29%)
```

## Edge Cases

### Negative Availability
When someone is overallocated, `availableDays` is 0 but `availableDaysRaw` can be negative.

### No Country Set
If team member has no country, assume 0 public holidays.

### Cross-Quarter Phases
Phases spanning quarters have separate assignments per quarter.

### Part-Time Members
Not currently modeled - all members assumed full-time. Future enhancement: FTE percentage.
