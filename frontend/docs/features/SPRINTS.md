# Sprint Management

## Overview

Sprints provide finer-grained time periods than quarters. The Capacity Planner supports sprint-level assignment tracking alongside quarterly views.

## Sprint Configuration

### Default Settings
```typescript
{
  sprintDurationWeeks: 3,      // 3-week sprints
  sprintStartDate: '2026-01-05', // First sprint start
  sprintsPerYear: 16,          // 16 sprints/year
  byeWeeksAfter: [8, 12],      // Bye weeks after Sprint 8 and 12
  holidayWeeksAtEnd: 2,        // 2 holiday weeks at year end
}
```

### Sprint Structure (Example Year)
```
Q1 2026
├── Sprint 1:  Jan 5 - Jan 24
├── Sprint 2:  Jan 26 - Feb 13
├── Sprint 3:  Feb 15 - Mar 6
└── Sprint 4:  Mar 8 - Mar 27

Q2 2026
├── Sprint 5:  Mar 29 - Apr 17
├── Sprint 6:  Apr 19 - May 8
├── Sprint 7:  May 10 - May 29
└── Sprint 8:  May 31 - Jun 19
    (Bye Week: Jun 21 - Jun 27)

Q3 2026
├── Sprint 9:  Jun 28 - Jul 17
├── Sprint 10: Jul 19 - Aug 7
├── Sprint 11: Aug 9 - Aug 28
└── Sprint 12: Aug 30 - Sep 18
    (Bye Week: Sep 20 - Sep 26)

Q4 2026
├── Sprint 13: Sep 27 - Oct 16
├── Sprint 14: Oct 18 - Nov 6
├── Sprint 15: Nov 8 - Nov 27
└── Sprint 16: Nov 29 - Dec 18
    (Holiday: Dec 19 - Jan 3)
```

## Data Model

### Sprint Interface
```typescript
interface Sprint {
  id: string;           // "sprint-1-2026"
  name: string;         // "Sprint 1"
  number: number;       // 1-16
  year: number;         // 2026
  startDate: string;    // "2026-01-05" (YYYY-MM-DD)
  endDate: string;      // "2026-01-24"
  quarter: string;      // "Q1 2026"
  isByeWeek?: boolean;  // True if bye week (no sprint work)
}
```

### Assignment with Sprint
```typescript
interface Assignment {
  memberId: string;
  quarter: string;      // Always set (for aggregation)
  days: number;
  sprint?: string;      // Optional sprint-level detail
}
```

## Sprint Generation

### Auto-Generate Function
```typescript
function generateSprintsForYear(year: number): void {
  const settings = state.settings;
  const sprints: Sprint[] = [];
  
  let currentDate = new Date(settings.sprintStartDate);
  currentDate.setFullYear(year);
  
  for (let i = 1; i <= settings.sprintsPerYear; i++) {
    const startDate = new Date(currentDate);
    const endDate = new Date(currentDate);
    endDate.setDate(endDate.getDate() + (settings.sprintDurationWeeks * 7) - 1);
    
    sprints.push({
      id: `sprint-${i}-${year}`,
      name: `Sprint ${i}`,
      number: i,
      year,
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      quarter: getQuarterForDate(startDate),
      isByeWeek: false,
    });
    
    // Move to next sprint
    currentDate.setDate(currentDate.getDate() + (settings.sprintDurationWeeks * 7));
    
    // Add bye week if configured
    if (settings.byeWeeksAfter.includes(i)) {
      currentDate.setDate(currentDate.getDate() + 7);
    }
  }
  
  state.updateData({ sprints });
}
```

## User Interface

### Settings → Sprints Section

**Generate Sprints**
```
┌─────────────────────────────────────────────────────────┐
│ Generate Sprints                                         │
│                                                          │
│ Year: [2026    ▼]  [Generate Sprints for 2026]          │
│                                                          │
│ ⚠ This will create 16 sprints. Existing sprints for     │
│   2026 will be replaced.                                 │
└─────────────────────────────────────────────────────────┘
```

**Sprint List by Year**
```
┌─────────────────────────────────────────────────────────┐
│ 2026 Sprints (16)                               [▼]     │
├─────────────────────────────────────────────────────────┤
│ Sprint 1    Jan 5 - Jan 24     Q1 2026    [Edit][Del]  │
│ Sprint 2    Jan 26 - Feb 13    Q1 2026    [Edit][Del]  │
│ Sprint 3    Feb 15 - Mar 6     Q1 2026    [Edit][Del]  │
│ ...                                                      │
└─────────────────────────────────────────────────────────┘
```

**Add/Edit Sprint Modal**
```
┌─────────────────────────────────────────────────────────┐
│ Edit Sprint                                              │
├─────────────────────────────────────────────────────────┤
│ Name:         [Sprint 1                              ]  │
│ Start Date:   [2026-01-05                            ]  │
│ End Date:     [2026-01-24                            ]  │
│ Year:         [2026                                  ]  │
│ Quarter:      [Q1 2026              ▼]                  │
│ [ ] Bye Week (no sprint work)                           │
│                                                          │
│                              [Cancel] [Save Sprint]     │
└─────────────────────────────────────────────────────────┘
```

## Actions

### CRUD Operations
```typescript
addSprint(sprintData: Omit<Sprint, 'id'>): Sprint
updateSprint(sprintId: string, updates: Partial<Sprint>): void
deleteSprint(sprintId: string): void
generateSprintsForYear(year: number): void
```

## Sprint-Quarter Relationship

Each sprint belongs to exactly one quarter. Sprints at quarter boundaries use the start date to determine the quarter.

```typescript
function getSprintsForQuarter(quarter: string): Sprint[] {
  return sprints.filter(s => s.quarter === quarter);
}

function getQuarterForSprint(sprintId: string): string {
  const sprint = sprints.find(s => s.id === sprintId);
  return sprint?.quarter || '';
}
```

## Assignment Roll-Up

Sprint assignments aggregate to quarter totals:

```typescript
function getQuarterAssignedDays(memberId: string, quarter: string): number {
  let total = 0;
  
  // Direct quarter assignments
  total += getAssignmentsByQuarter(memberId, quarter);
  
  // Sprint assignments in this quarter
  const quarterSprints = getSprintsForQuarter(quarter);
  for (const sprint of quarterSprints) {
    total += getAssignmentsBySprint(memberId, sprint.name);
  }
  
  return total;
}
```

## Timeline View Integration

The timeline can show sprints within quarters:

```
Q1 2026                          Q2 2026
├── S1 ──├── S2 ──├── S3 ──├── S4 ──├── S5 ──├── S6 ──├
```

Toggle between:
- Quarter view (default)
- Sprint view (detailed)

## Future Enhancements

1. **Jira Sprint Sync**: Import sprints from Jira boards
2. **Sprint Velocity Tracking**: Track story points per sprint
3. **Sprint Planning View**: Dedicated sprint planning interface
4. **Sprint Retrospective Data**: Track sprint completion metrics
5. **Flexible Sprint Lengths**: Support variable sprint durations
