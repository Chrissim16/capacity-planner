import type { 
  JiraConnection, 
  JiraWorkItem, 
  JiraItemType, 
  JiraSettings,
  JiraSyncResult 
} from '../types';

interface JiraProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey: string;
}

interface JiraUser {
  accountId: string;
  emailAddress?: string;
  displayName: string;
}

interface JiraStatus {
  name: string;
  statusCategory: { key: string; name: string; };
}

interface JiraIssueFields {
  summary: string;
  description?: string | { content?: unknown[] };
  issuetype: { id: string; name: string; subtask: boolean; };
  status: JiraStatus;
  priority?: { name: string; };
  assignee?: JiraUser;
  reporter?: JiraUser;
  parent?: { key: string; id: string };
  labels?: string[];
  components?: { name: string }[];
  created: string;
  updated: string;
  customfield_10016?: number;
  customfield_10020?: number;
  customfield_10026?: number;
  timeoriginalestimate?: number;
  timespent?: number;
  timeestimate?: number;
  sprint?: { id: number; name: string; state: string; }[];
}

interface JiraIssue {
  id: string;
  key: string;
  fields: JiraIssueFields;
}

function createAuthHeader(email: string, apiToken: string): string {
  return 'Basic ' + btoa(email + ':' + apiToken);
}

function mapJiraTypeToItemType(typeName: string): JiraItemType {
  const lowerName = typeName.toLowerCase();
  if (lowerName.includes('epic')) return 'epic';
  if (lowerName.includes('feature')) return 'feature';
  if (lowerName.includes('story')) return 'story';
  if (lowerName.includes('bug')) return 'bug';
  return 'task';
}

function mapStatusCategory(categoryKey: string): 'todo' | 'in_progress' | 'done' {
  if (categoryKey === 'done') return 'done';
  if (categoryKey === 'indeterminate') return 'in_progress';
  return 'todo';
}

function getStoryPoints(fields: JiraIssueFields): number | undefined {
  return fields.customfield_10016 || fields.customfield_10020 || fields.customfield_10026 || undefined;
}

function convertSecondsToHours(seconds?: number): number | undefined {
  if (seconds === undefined || seconds === null) return undefined;
  return Math.round((seconds / 3600) * 10) / 10;
}

export async function testJiraConnection(
  baseUrl: string,
  email: string,
  apiToken: string
): Promise<{ success: boolean; error?: string; user?: { displayName: string; email: string } }> {
  try {
    const cleanUrl = baseUrl.replace(/\/+$/, '');
    const response = await fetch(cleanUrl + '/rest/api/3/myself', {
      method: 'GET',
      headers: { 'Authorization': createAuthHeader(email, apiToken), 'Accept': 'application/json' },
    });
    if (!response.ok) {
      if (response.status === 401) return { success: false, error: 'Invalid credentials' };
      if (response.status === 403) return { success: false, error: 'Access forbidden' };
      if (response.status === 404) return { success: false, error: 'Jira not found' };
      return { success: false, error: 'Error: ' + response.status };
    }
    const user = await response.json() as JiraUser;
    return { success: true, user: { displayName: user.displayName, email: user.emailAddress || email } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function getJiraProjects(
  baseUrl: string,
  email: string,
  apiToken: string
): Promise<{ success: boolean; projects?: JiraProject[]; error?: string }> {
  try {
    const cleanUrl = baseUrl.replace(/\/+$/, '');
    const response = await fetch(cleanUrl + '/rest/api/3/project/search?maxResults=100&orderBy=name', {
      method: 'GET',
      headers: { 'Authorization': createAuthHeader(email, apiToken), 'Accept': 'application/json' },
    });
    if (!response.ok) return { success: false, error: 'Failed: ' + response.statusText };
    const data = await response.json() as { values: JiraProject[]; total: number };
    return { success: true, projects: data.values };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function fetchJiraIssues(
  connection: JiraConnection,
  settings: JiraSettings,
  onProgress?: (message: string) => void
): Promise<JiraSyncResult> {
  const result: JiraSyncResult = { success: false, itemsSynced: 0, itemsCreated: 0, itemsUpdated: 0, itemsRemoved: 0, errors: [], timestamp: new Date().toISOString() };
  try {
    const cleanUrl = connection.jiraBaseUrl.replace(/\/+$/, '');
    const authHeader = createAuthHeader(connection.userEmail, connection.apiToken);
    const issueTypes: string[] = [];
    if (settings.syncEpics) issueTypes.push('Epic');
    if (settings.syncFeatures) issueTypes.push('Feature');
    if (settings.syncStories) issueTypes.push('Story');
    if (settings.syncTasks) issueTypes.push('Task');
    if (settings.syncBugs) issueTypes.push('Bug');
    if (issueTypes.length === 0) { result.errors.push('No issue types selected'); return result; }
    const jql = 'project = "' + connection.jiraProjectKey + '" AND issuetype IN (' + issueTypes.join(', ') + ') ORDER BY created DESC';
    onProgress?.('Fetching issues...');
    const workItems: JiraWorkItem[] = [];
    let startAt = 0;
    const maxResults = 100;
    let hasMore = true;
    while (hasMore) {
      const response = await fetch(cleanUrl + '/rest/api/3/search?jql=' + encodeURIComponent(jql) + '&startAt=' + startAt + '&maxResults=' + maxResults + '&fields=*all', {
        method: 'GET',
        headers: { 'Authorization': authHeader, 'Accept': 'application/json' },
      });
      if (!response.ok) { result.errors.push('Failed: ' + response.statusText); return result; }
      const data = await response.json() as { startAt: number; maxResults: number; total: number; issues: JiraIssue[] };
      for (const issue of data.issues) {
        workItems.push(mapJiraIssueToWorkItem(issue, connection.id));
      }
      onProgress?.('Fetched ' + workItems.length + ' of ' + data.total);
      startAt += maxResults;
      hasMore = startAt < data.total;
    }
    result.success = true;
    result.itemsSynced = workItems.length;
    return result;
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    return result;
  }
}

function mapJiraIssueToWorkItem(issue: JiraIssue, connectionId: string): JiraWorkItem {
  const f = issue.fields;
  return {
    id: 'jira-' + issue.id, connectionId, jiraKey: issue.key, jiraId: issue.id, summary: f.summary,
    description: typeof f.description === 'string' ? f.description : undefined,
    type: mapJiraTypeToItemType(f.issuetype.name), typeName: f.issuetype.name,
    status: f.status.name, statusCategory: mapStatusCategory(f.status.statusCategory.key),
    priority: f.priority?.name, storyPoints: getStoryPoints(f),
    originalEstimate: convertSecondsToHours(f.timeoriginalestimate),
    timeSpent: convertSecondsToHours(f.timespent),
    remainingEstimate: convertSecondsToHours(f.timeestimate),
    assigneeEmail: f.assignee?.emailAddress, assigneeName: f.assignee?.displayName,
    reporterEmail: f.reporter?.emailAddress, reporterName: f.reporter?.displayName,
    parentKey: f.parent?.key, parentId: f.parent?.id,
    sprintId: f.sprint?.[0]?.id?.toString(), sprintName: f.sprint?.[0]?.name,
    labels: f.labels || [], components: f.components?.map(c => c.name) || [],
    created: f.created, updated: f.updated,
  };
}

export function validateJiraUrl(url: string): { valid: boolean; error?: string } {
  if (!url) return { valid: false, error: 'URL is required' };
  try {
    const parsed = new URL(url);
    if (!parsed.protocol.startsWith('http')) return { valid: false, error: 'Must start with http' };
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}
