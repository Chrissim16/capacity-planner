# Jira Integration

## Overview

The Jira integration allows syncing work items from Jira Cloud into the Capacity Planner. Items can then be mapped to projects and phases for capacity tracking.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Jira Cloud    │────>│  Jira Service   │────>│    App Store    │
│   REST API      │fetch│   (jira.ts)     │sync │ (jiraWorkItems) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        v
                                               ┌─────────────────┐
                                               │   Jira Page     │
                                               │   (mapping UI)  │
                                               └─────────────────┘
```

## Data Flow

### Sync Direction
**One-way: Jira → Capacity Planner**

- ✅ READ from Jira (issues, projects)
- ❌ CREATE in Jira (not supported)
- ❌ DELETE in Jira (not supported)
- ❌ UPDATE in Jira (not currently supported)

### Entity Mapping

| Jira Entity | Capacity Planner Entity |
|-------------|------------------------|
| Epic | Project |
| Feature | Phase |
| Story | Work Item (for tracking) |
| Task | Work Item (for tracking) |
| Bug | Work Item (for tracking) |

## Components

### Connection Management (Settings)
**Location**: `src/pages/Settings.tsx` → Jira Integration section

Features:
- Add/edit/delete Jira connections
- Test connection validity
- Toggle connections active/inactive
- View sync status and errors

### Sync Settings (Settings)
**Location**: `src/pages/Settings.tsx` → Sync Settings card

Configurable options:
- Issue types to sync (Epics, Features, Stories, Tasks, Bugs)
- Story Points to Days conversion rate
- Default team velocity
- Auto-map by name setting

### Jira Service
**Location**: `src/services/jira.ts`

Functions:
```typescript
testJiraConnection(baseUrl, email, apiToken)
getJiraProjects(baseUrl, email, apiToken)
fetchJiraIssues(connection, settings, onProgress?)
validateJiraUrl(url)
getJiraIssue(connection, issueKey)
```

### Mapping Interface
**Location**: `src/pages/Jira.tsx`

Features:
- View all synced Jira items
- Filter by type, status, mapped/unmapped
- Group by type or status
- Map items to projects/phases/members
- Bulk actions (clear mappings)
- Auto-map by name similarity

## API Integration

### Authentication
Uses Jira Cloud Basic Auth:
```
Authorization: Basic base64(email:apiToken)
```

### Endpoints Used
```
GET /rest/api/3/myself                    # Test connection
GET /rest/api/3/project/search            # List projects
GET /rest/api/3/search?jql=...            # Search issues
GET /rest/api/3/issue/{issueKey}          # Get single issue
```

### JQL Query
```sql
project = "{projectKey}" 
AND issuetype IN (Epic, Feature, Story, Task, Bug)
ORDER BY created DESC
```

### Fields Retrieved
```
summary, description, issuetype, status, priority,
assignee, reporter, parent, sprint, labels, components,
timeoriginalestimate, timespent, timeestimate,
customfield_* (for story points)
```

## Smart Sync

When re-syncing, the system preserves local mappings:

```typescript
function syncJiraWorkItems(connectionId, newItems) {
  // Get existing items for this connection
  const existing = state.jiraWorkItems.filter(i => i.connectionId === connectionId);
  
  // Create lookup by Jira ID
  const existingByJiraId = new Map(existing.map(i => [i.jiraId, i]));
  
  // Merge new items, preserving mappings
  const merged = newItems.map(newItem => {
    const old = existingByJiraId.get(newItem.jiraId);
    if (old) {
      return {
        ...newItem,
        id: old.id,  // Keep internal ID
        mappedProjectId: old.mappedProjectId,   // Preserve
        mappedPhaseId: old.mappedPhaseId,       // Preserve
        mappedMemberId: old.mappedMemberId,     // Preserve
      };
    }
    return { ...newItem, id: generateId('jira-item') };
  });
  
  state.updateData({ jiraWorkItems: merged });
}
```

## Configuration

### JiraConnection
```typescript
{
  id: 'jira-conn-123',
  name: 'Mileway Jira',
  jiraBaseUrl: 'https://mileway.atlassian.net',
  jiraProjectKey: 'MW',
  apiToken: '***',
  userEmail: 'user@mileway.com',
  isActive: true,
  lastSyncAt: '2026-02-19T10:00:00Z',
  lastSyncStatus: 'success'
}
```

### JiraSettings
```typescript
{
  storyPointsToDays: 0.5,    // 1 SP = 0.5 days
  defaultVelocity: 30,       // SP per sprint
  syncFrequency: 'manual',   // Only manual sync
  autoMapByName: true,       // Enable auto-mapping
  syncEpics: true,
  syncFeatures: true,
  syncStories: true,
  syncTasks: false,
  syncBugs: false,
  includeSubtasks: false
}
```

## User Flow

### Initial Setup
1. Go to Settings → Jira Integration
2. Click "Add Connection"
3. Enter Jira URL, email, API token
4. Test connection
5. Select Jira project
6. Save connection

### Syncing Data
1. Go to Settings → Jira Integration
2. Click "Sync" button on connection
3. Wait for sync to complete
4. View results in toast notification

### Mapping Items
1. Go to Jira page (nav item 5)
2. Filter to unmapped items
3. For each Epic: select matching Project
4. For each Feature: select Project → Phase
5. For Stories: select Project and/or Team Member

### Using Mapped Data
Once mapped, Jira data contributes to:
- Capacity calculations (via story points)
- Timeline visualization
- Team member workload tracking

## Error Handling

### Connection Errors
- Invalid URL format
- Authentication failed (wrong email/token)
- Project not found
- Network errors

### Sync Errors
- API rate limiting
- Timeout on large projects
- Invalid response format

All errors are:
1. Stored in `lastSyncError`
2. Displayed in connection status
3. Shown in toast notification

## Security Considerations

### API Token Storage
- Currently stored in localStorage (plain text)
- Acceptable for single-user desktop use
- For multi-user: encrypt tokens, use server-side storage

### CORS
- Jira Cloud may block direct browser requests
- Production solution: Vercel serverless proxy function

## Future Enhancements

1. **Two-way sync**: Write story point estimates back to Jira
2. **Webhooks**: Real-time updates instead of manual sync
3. **Sprint sync**: Import Jira sprints automatically
4. **User mapping**: Auto-match Jira users to team members
5. **Time tracking**: Sync logged work hours
6. **Multiple projects**: Sync from multiple Jira projects simultaneously
