import type { 
  JiraConnection, 
  JiraWorkItem, 
  JiraItemType, 
  JiraSettings,
  JiraSyncResult,
  JiraStatusFilter,
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

// Use proxy in production (Vercel), direct calls in development
const USE_PROXY = import.meta.env.PROD;

async function jiraFetch(
  baseUrl: string,
  path: string,
  authHeader: string,
  options: RequestInit = {}
): Promise<Response> {
  const cleanUrl = baseUrl.replace(/\/+$/, '');
  
  if (USE_PROXY) {
    // Use the Vercel serverless proxy to avoid CORS
    const proxyUrl = `/api/jira?path=${encodeURIComponent(path)}`;
    return fetch(proxyUrl, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': authHeader,
        'X-Jira-Base-Url': cleanUrl,
        'Accept': 'application/json',
      },
    });
  } else {
    // Direct call in development (may have CORS issues)
    return fetch(cleanUrl + path, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': authHeader,
        'Accept': 'application/json',
      },
    });
  }
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
    const authHeader = createAuthHeader(email, apiToken);
    const response = await jiraFetch(baseUrl, '/rest/api/3/myself', authHeader, { method: 'GET' });
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
    const authHeader = createAuthHeader(email, apiToken);
    const response = await jiraFetch(baseUrl, '/rest/api/3/project/search?maxResults=100&orderBy=name', authHeader, { method: 'GET' });
    if (!response.ok) return { success: false, error: 'Failed: ' + response.statusText };
    const data = await response.json() as { values: JiraProject[]; total: number };
    return { success: true, projects: data.values };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Translates a JiraStatusFilter value into a JQL status clause fragment.
 * Returns an empty string when no filtering is needed.
 */
function statusClause(filter: JiraStatusFilter): string {
  switch (filter) {
    case 'exclude_done':  return ' AND statusCategory != "Done"';
    case 'active_only':   return ' AND statusCategory in ("To Do", "In Progress")';
    case 'todo_only':     return ' AND statusCategory = "To Do"';
    default:              return ''; // 'all' — no filter
  }
}

/**
 * Builds an optimal JQL query for the connection + settings combination.
 *
 * When all enabled types share the same status filter, a simple flat query is used.
 * When types differ, a compound OR query is built so each type gets its own filter.
 * Returns null when no issue types are enabled.
 */
export function buildJQL(connection: JiraConnection, settings: JiraSettings): string | null {
  const enabled: { name: string; filter: JiraStatusFilter }[] = [];
  if (settings.syncEpics)    enabled.push({ name: 'Epic',    filter: settings.statusFilterEpics    ?? 'all' });
  if (settings.syncFeatures) enabled.push({ name: 'Feature', filter: settings.statusFilterFeatures ?? 'all' });
  if (settings.syncStories)  enabled.push({ name: 'Story',   filter: settings.statusFilterStories  ?? 'all' });
  if (settings.syncTasks)    enabled.push({ name: 'Task',    filter: settings.statusFilterTasks    ?? 'all' });
  if (settings.syncBugs)     enabled.push({ name: 'Bug',     filter: settings.statusFilterBugs     ?? 'all' });

  if (enabled.length === 0) return null;

  const project = `project = "${connection.jiraProjectKey}"`;

  // Group types by their filter so we can emit compact clauses
  const groups = new Map<JiraStatusFilter, string[]>();
  for (const { name, filter } of enabled) {
    if (!groups.has(filter)) groups.set(filter, []);
    groups.get(filter)!.push(name);
  }

  if (groups.size === 1) {
    // All enabled types share the same filter — simple flat query
    const [filter, types] = [...groups.entries()][0];
    const typeList = types.join(', ');
    return `${project} AND issuetype IN (${typeList})${statusClause(filter)} ORDER BY created DESC`;
  }

  // Types have different filters — build a compound OR inside parentheses
  const clauses = [...groups.entries()].map(([filter, types]) => {
    const typeExpr = types.length === 1
      ? `issuetype = "${types[0]}"`
      : `issuetype IN (${types.join(', ')})`;
    return `(${typeExpr}${statusClause(filter)})`;
  });

  return `${project} AND (${clauses.join(' OR ')}) ORDER BY created DESC`;
}

export async function fetchJiraIssues(
  connection: JiraConnection,
  settings: JiraSettings,
  onProgress?: (message: string) => void
): Promise<JiraSyncResult> {
  const result: JiraSyncResult = { success: false, itemsSynced: 0, itemsCreated: 0, itemsUpdated: 0, itemsRemoved: 0, mappingsPreserved: 0, projectsCreated: 0, projectsUpdated: 0, assignmentsCreated: 0, errors: [], timestamp: new Date().toISOString() };
  try {
    const authHeader = createAuthHeader(connection.userEmail, connection.apiToken);
    const jql = buildJQL(connection, settings);
    if (!jql) { result.errors.push('No issue types selected'); return result; }
    onProgress?.('Fetching issues…');
    const workItems: JiraWorkItem[] = [];
    let startAt = 0;
    const maxResults = 100;
    let hasMore = true;
    while (hasMore) {
      const path = '/rest/api/3/search/jql?jql=' + encodeURIComponent(jql) + '&startAt=' + startAt + '&maxResults=' + maxResults + '&fields=*all';
      const response = await jiraFetch(connection.jiraBaseUrl, path, authHeader, { method: 'GET' });
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
    result.items = workItems;
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
