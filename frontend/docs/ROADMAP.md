# Roadmap

## Completed Features

### February 2026

#### Jira Integration (Feb 12-19)
- ✅ Connection setup with test functionality
- ✅ Sync trigger with progress feedback
- ✅ Smart sync preserving local mappings
- ✅ Jira mapping page with filtering and grouping
- ✅ Auto-map by name similarity

#### Scenarios System (Feb 19)
- ✅ Scenario selector in header
- ✅ Create/duplicate/delete scenarios
- ✅ Scenario banner when viewing
- ✅ Refresh scenario from Jira baseline

#### Sprint Management (Earlier)
- ✅ Sprint CRUD in Settings
- ✅ Auto-generate sprints for year
- ✅ Sprint-level assignments
- ✅ Bye weeks configuration

#### Core Application
- ✅ React/TypeScript migration from vanilla JS
- ✅ Dashboard with capacity overview
- ✅ Timeline visualization
- ✅ Project and Phase management
- ✅ Team member management
- ✅ Time off tracking
- ✅ Country and holiday management
- ✅ Import/Export (JSON + Excel)
- ✅ Dark mode support

---

## Planned Features

### High Priority

#### Scenario Data Integration
**Status**: Partially implemented  
**Effort**: Medium

The `getCurrentState()` function needs to properly return scenario data when a scenario is active, so that all views (Dashboard, Timeline, etc.) reflect the scenario's modified data.

```typescript
// TODO: Update getCurrentState() to merge scenario data
getCurrentState: () => {
  if (activeScenarioId) {
    const scenario = scenarios.find(s => s.id === activeScenarioId);
    if (scenario) {
      return { ...data, ...scenarioData };
    }
  }
  return data;
}
```

#### Jira CORS Proxy
**Status**: Not started  
**Effort**: Small

Browser-based Jira API calls may be blocked by CORS. Need Vercel serverless function to proxy requests.

```
/api/jira-proxy.ts
- Accept Jira API requests
- Add authentication
- Forward to Jira Cloud
- Return response
```

#### Part-Time Team Members
**Status**: Not started  
**Effort**: Small

Add FTE percentage to team members for accurate capacity calculation.

```typescript
interface TeamMember {
  // ...existing
  ftePercent: number;  // 100 = full-time, 50 = half-time
}
```

### Medium Priority

#### Scenario Comparison View
Side-by-side comparison of capacity between scenarios.

#### Jira Sprint Sync
Import sprints from Jira boards instead of manual creation.

#### User Auto-Mapping
Automatically match Jira assignees to team members by email.

#### Time Tracking Integration
Show Jira time logged vs estimated in capacity views.

### Lower Priority

#### Multi-User Support
- User authentication
- Shared data storage (Supabase)
- Permissions and roles

#### Historical Reporting
- Capacity over time charts
- Utilization trends
- Sprint velocity tracking

#### Mobile Responsive
- Responsive layout improvements
- Touch-friendly interactions

#### Notifications
- Email alerts for overallocation
- Slack integration

---

## Technical Debt

### Code Quality
- [ ] Add unit tests for capacity calculations
- [ ] Add integration tests for Jira sync
- [ ] Set up Storybook for component documentation
- [ ] Add error boundary components

### Performance
- [ ] Memoize capacity calculations
- [ ] Virtualize long lists (team members, Jira items)
- [ ] Lazy load scenario data

### Security
- [ ] Encrypt Jira API tokens in localStorage
- [ ] Add rate limiting for Jira API calls
- [ ] Implement CSP headers

---

## Feature Requests (Backlog)

From `Capacity-Planner-Backlog.md`:

### Technical Improvements
1. Database persistence (Supabase)
2. Real-time sync
3. Undo/redo functionality
4. Keyboard shortcuts
5. Audit logging

### Functional Improvements
1. Resource allocation optimizer
2. Skill matrix view
3. Capacity forecasting
4. What-if templates
5. Calendar integration

### UI/UX Improvements
1. Drag-and-drop assignments
2. Gantt chart view
3. Resource heatmap
4. Custom dashboards
5. Bulk edit mode

---

## Release Notes Format

When completing features, add an entry:

```markdown
### [Date] - [Version]

#### Added
- Feature description

#### Changed
- Modification description

#### Fixed
- Bug fix description

#### Technical
- Infrastructure/code change
```

---

## Contributing

When picking up a feature:
1. Check this roadmap for status
2. Read relevant feature doc in `docs/features/`
3. Update status to "In Progress"
4. Implement with tests
5. Update docs if needed
6. Update status to "Completed" with date
