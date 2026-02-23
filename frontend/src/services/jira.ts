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

interface JiraSprintObject {
  id: number;
  name: string;
  state: string;
  startDate?: string;
  endDate?: string;
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
  duedate?: string;
  // Epic Link — classic/company-managed projects
  // API v2: plain string key. API v3: sometimes object {key,id,self,...} or plain string.
  // customfield_10008 is an alternate Epic Link field used on some Jira instances.
  customfield_10014?: string | { key?: string; id?: string };
  customfield_10008?: string | { key?: string; id?: string };
  customfield_10015?: string;  // Start date (Jira Cloud)
  customfield_10016?: number;  // Story points (classic projects)
  customfield_10020?: JiraSprintObject[] | number; // Sprint (Jira Cloud) — also used for SP in some instances
  customfield_10026?: number;  // Story points (some instances)
  customfield_10028?: number;  // Story points (newer Jira Cloud)
  timeoriginalestimate?: number;
  timespent?: number;
  timeestimate?: number;
  // Dynamic index for user-configured story points field
  [key: string]: unknown;
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

function getStoryPoints(fields: JiraIssueFields, discoveredSpField?: string): number | undefined {
  // Try the instance-specific field discovered via /rest/api/3/field first
  if (discoveredSpField) {
    const val = fields[discoveredSpField];
    if (typeof val === 'number' && val > 0) return val;
  }
  // customfield_10020 can be sprint objects (array) or story points (number) depending on instance
  const cf10020 = typeof fields.customfield_10020 === 'number' ? fields.customfield_10020 : undefined;
  return fields.customfield_10016 || fields.customfield_10028 || cf10020 || fields.customfield_10026 || undefined;
}

/** Calls /rest/api/3/field to find the custom field ID whose name is
 *  "Story Points" or "Story point estimate" on this specific Jira instance.
 *  Returns undefined when the field cannot be determined (non-fatal). */
async function discoverStoryPointsField(
  baseUrl: string,
  authHeader: string
): Promise<string | undefined> {
  try {
    const resp = await jiraFetch(baseUrl, '/rest/api/3/field', authHeader, { method: 'GET' });
    if (!resp.ok) return undefined;
    const fields = await resp.json() as Array<{ id: string; name: string; custom: boolean }>;
    const match = fields.find(f =>
      f.custom &&
      /^story\s*point(s| estimate)?$/i.test(f.name.trim())
    );
    return match?.id;
  } catch {
    return undefined;
  }
}

function getSprint(fields: JiraIssueFields): JiraSprintObject | undefined {
  // customfield_10020 is the sprint field in Jira Cloud (array of sprint objects)
  if (Array.isArray(fields.customfield_10020) && fields.customfield_10020.length > 0) {
    // Return the active sprint if present, otherwise the last one
    const active = fields.customfield_10020.find(s => s.state === 'active');
    return active ?? fields.customfield_10020[fields.customfield_10020.length - 1];
  }
  return undefined;
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

export interface JiraKeyDiagnostic {
  key: string;
  summary: string;
  typeName: string;
  statusName: string;
  statusCategory: string;
  /** direct parent field (next-gen / Advanced Roadmaps) */
  parentKey?: string;
  /** Epic Link custom field 10014 */
  cf10014?: string;
  /** Epic Link custom field 10008 */
  cf10008?: string;
  /** resolved parentKey that our sync would store */
  resolvedParentKey?: string;
  /** the exact JQL the sync would use for this connection */
  jqlUsed?: string;
  /** local analysis: is this item's type enabled in sync settings? */
  typeEnabled?: boolean;
  /** local analysis: does this item's status pass the configured filter? */
  statusPasses?: boolean;
  /** which status filter applies to this item's type */
  statusFilterUsed?: string;
  /** reason why the item would be excluded, or null if it passes */
  exclusionReason?: string | null;
}

/**
 * Fetch a single Jira issue by key and return the raw parent-linking fields
 * used by the sync engine. Use this to diagnose why an item isn't appearing
 * under its expected parent.
 */
export async function diagnoseJiraKey(
  connection: JiraConnection,
  key: string,
  settings?: JiraSettings
): Promise<{ success: boolean; data?: JiraKeyDiagnostic; error?: string }> {
  try {
    const authHeader = createAuthHeader(connection.userEmail, connection.apiToken);
    const fields = ['summary', 'issuetype', 'status', 'parent', 'customfield_10014', 'customfield_10008'].join(',');

    // Fetch the single issue
    const response = await jiraFetch(
      connection.jiraBaseUrl,
      `/rest/api/3/issue/${encodeURIComponent(key.trim())}?fields=${encodeURIComponent(fields)}`,
      authHeader,
      { method: 'GET' }
    );
    if (response.status === 404) return { success: false, error: `${key} not found in Jira` };
    if (!response.ok) return { success: false, error: 'Jira returned ' + response.status };
    const issue = await response.json() as JiraIssue;
    const f = issue.fields;

    function extractKey(field: string | { key?: string } | undefined): string | undefined {
      if (!field) return undefined;
      if (typeof field === 'string') return field || undefined;
      return (field as { key?: string }).key || undefined;
    }

    const cf10014 = extractKey(f.customfield_10014);
    const cf10008 = extractKey(f.customfield_10008);
    const resolvedParentKey = f.parent?.key ?? cf10014 ?? cf10008;

    // Evaluate JQL match locally — no extra API calls needed.
    // We already have type, status and parent from the direct issue fetch above.
    let jqlUsed: string | undefined;
    let typeEnabled: boolean | undefined;
    let statusPasses: boolean | undefined;
    let statusFilterUsed: string | undefined;
    let exclusionReason: string | null | undefined;

    if (settings) {
      const syncJql = buildJQL(connection, settings);
      if (syncJql) jqlUsed = syncJql;

      const typeName = f.issuetype.name;
      const catKey = f.status.statusCategory?.key ?? '';

      // Determine which filter applies to this type
      const typeFilterMap: Record<string, { enabled: boolean; filter: string }> = {
        'Epic':    { enabled: settings.syncEpics    ?? false, filter: settings.statusFilterEpics    ?? 'all' },
        'Feature': { enabled: settings.syncFeatures ?? false, filter: settings.statusFilterFeatures ?? 'all' },
        'Story':   { enabled: settings.syncStories  ?? false, filter: settings.statusFilterStories  ?? 'all' },
        'Task':    { enabled: settings.syncTasks    ?? false, filter: settings.statusFilterTasks    ?? 'all' },
        'Bug':     { enabled: settings.syncBugs     ?? false, filter: settings.statusFilterBugs     ?? 'all' },
      };

      // Match by include() so "User Story" → story, "Sub-bug" → bug, etc.
      const lowerType = typeName.toLowerCase();
      const matchedEntry = Object.entries(typeFilterMap).find(([k]) => lowerType.includes(k.toLowerCase()));

      if (!matchedEntry) {
        typeEnabled = false;
        statusPasses = undefined;
        statusFilterUsed = undefined;
        exclusionReason = `Type "${typeName}" is not one of the 5 supported types (Epic, Feature, Story, Task, Bug)`;
      } else {
        const [, { enabled, filter }] = matchedEntry;
        typeEnabled = enabled;
        statusFilterUsed = filter;

        if (!enabled) {
          statusPasses = undefined;
          exclusionReason = `Type "${typeName}" is disabled in Sync Settings`;
        } else {
          // Check status category against filter
          // catKey: 'new' = To Do, 'indeterminate' = In Progress, 'done' = Done
          switch (filter) {
            case 'exclude_done':
              statusPasses = catKey !== 'done';
              exclusionReason = catKey === 'done' ? `Status "${f.status.name}" is "Done" — excluded by "Exclude Done" filter` : null;
              break;
            case 'active_only':
              statusPasses = catKey === 'new' || catKey === 'indeterminate';
              exclusionReason = statusPasses ? null : `Status "${f.status.name}" is not "To Do" or "In Progress" — excluded by "Active only" filter`;
              break;
            case 'todo_only':
              statusPasses = catKey === 'new';
              exclusionReason = statusPasses ? null : `Status "${f.status.name}" is not "To Do" — excluded by "To Do only" filter`;
              break;
            default: // 'all'
              statusPasses = true;
              exclusionReason = null;
          }
        }
      }
    }

    return {
      success: true,
      data: {
        key: issue.key,
        summary: f.summary,
        typeName: f.issuetype.name,
        statusName: f.status.name,
        statusCategory: f.status.statusCategory?.key ?? '',
        parentKey: f.parent?.key,
        cf10014,
        cf10008,
        resolvedParentKey,
        jqlUsed,
        typeEnabled,
        statusPasses,
        statusFilterUsed,
        exclusionReason,
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export interface JiraIssueType {
  id: string;
  name: string;
  subtask: boolean;
  description?: string;
}

/**
 * Fetches the issue types defined in a specific Jira project.
 * Used to diagnose mismatches between the hardcoded sync type names and the
 * actual type names used by the project.
 */
export async function getJiraIssueTypes(
  connection: JiraConnection
): Promise<{ success: boolean; issueTypes?: JiraIssueType[]; error?: string }> {
  try {
    const authHeader = createAuthHeader(connection.userEmail, connection.apiToken);
    const response = await jiraFetch(
      connection.jiraBaseUrl,
      `/rest/api/3/project/${encodeURIComponent(connection.jiraProjectKey)}/statuses`,
      authHeader,
      { method: 'GET' }
    );
    if (!response.ok) return { success: false, error: 'Failed: ' + response.statusText };
    const data = await response.json() as { id: string; name: string; subtask: boolean; statuses: unknown[] }[];
    const issueTypes: JiraIssueType[] = (data ?? []).map(t => ({
      id: t.id,
      name: t.name,
      subtask: t.subtask ?? false,
    }));
    return { success: true, issueTypes };
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
    const extra = connection.jqlFilter?.trim();
    const base = `${project} AND issuetype IN (${typeList})${statusClause(filter)} ORDER BY created DESC`;
    return extra ? `${project} AND issuetype IN (${typeList})${statusClause(filter)} AND (${extra}) ORDER BY created DESC` : base;
  }

  // Types have different filters — build a compound OR inside parentheses
  const clauses = [...groups.entries()].map(([filter, types]) => {
    const typeExpr = types.length === 1
      ? `issuetype = "${types[0]}"`
      : `issuetype IN (${types.join(', ')})`;
    return `(${typeExpr}${statusClause(filter)})`;
  });

  const base = `${project} AND (${clauses.join(' OR ')}) ORDER BY created DESC`;
  const extra = connection.jqlFilter?.trim();
  return extra ? `${project} AND (${clauses.join(' OR ')}) AND (${extra}) ORDER BY created DESC` : base;
}

// Fetch only the fields we actually use — drastically reduces response size
// and avoids Vercel's 4.5 MB function response limit on large projects.
const BASE_JIRA_FIELDS = [
  'summary', 'description', 'issuetype', 'status', 'priority',
  'assignee', 'reporter', 'parent', 'labels', 'components',
  'created', 'updated', 'duedate',
  'timeoriginalestimate', 'timespent', 'timeestimate',
  // Story-point custom fields (various Jira Cloud versions)
  'customfield_10016',  // SP classic
  'customfield_10026',  // SP alternative
  'customfield_10028',  // SP newer Cloud
  // customfield_10020 = Sprint (Jira Cloud) — also used for SP in some instances
  'customfield_10020',
  // Start date
  'customfield_10015',
  // Epic Link — classic/company-managed projects store the parent epic key here
  'customfield_10014',
  // Alternative Epic Link field used on some Jira instances
  'customfield_10008',
];

function buildJiraFields(customSpField?: string): string {
  if (customSpField && !BASE_JIRA_FIELDS.includes(customSpField)) {
    return [...BASE_JIRA_FIELDS, customSpField].join(',');
  }
  return BASE_JIRA_FIELDS.join(',');
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

    // Auto-discover the story points custom field for this Jira instance (non-fatal)
    onProgress?.('Detecting story points field…');
    const customSpField = await discoverStoryPointsField(connection.jiraBaseUrl, authHeader);
    const jiraFields = buildJiraFields(customSpField);

    const workItems: JiraWorkItem[] = [];
    const maxResults = 100;
    // GET /rest/api/3/search/jql uses cursor-based pagination (nextPageToken).
    // It does NOT reliably return `total`, so offset-based pagination (startAt)
    // exits after the first page. We use nextPageToken and fall back to startAt
    // only when the response includes a `total` but no token (older Jira instances).
    let nextPageToken: string | undefined;
    let startAt = 0;
    let knownTotal: number | undefined;
    let page = 0;

    do {
      page++;
      const pagesEstimate = knownTotal != null ? Math.ceil(knownTotal / maxResults) : '?';
      onProgress?.(`Fetching page ${page} of ${pagesEstimate}…`);

      let path = '/rest/api/3/search/jql'
        + '?jql=' + encodeURIComponent(jql)
        + '&maxResults=' + maxResults
        + '&fields=' + encodeURIComponent(jiraFields);

      if (nextPageToken) {
        path += '&nextPageToken=' + encodeURIComponent(nextPageToken);
      } else if (startAt > 0) {
        // Fallback: offset pagination for instances that return `total` but no token
        path += '&startAt=' + startAt;
      }

      const response = await jiraFetch(connection.jiraBaseUrl, path, authHeader, { method: 'GET' });
      if (!response.ok) { result.errors.push('Failed: ' + response.statusText); return result; }

      const data = await response.json() as {
        startAt?: number;
        maxResults?: number;
        total?: number;
        nextPageToken?: string;
        issues: JiraIssue[];
      };

      if (!data.issues || data.issues.length === 0) break;

      for (const issue of data.issues) {
        workItems.push(mapJiraIssueToWorkItem(issue, connection.id, customSpField));
      }

      if (data.total != null) knownTotal = data.total;
      nextPageToken = data.nextPageToken;

      // Fallback offset advance — only used when there is no nextPageToken
      startAt += data.issues.length;

      onProgress?.(`Fetched ${workItems.length}${knownTotal != null ? ' of ' + knownTotal : ''} items…`);

      // Safety valve: stop when nextPageToken is absent and we have all known items
      if (!nextPageToken && knownTotal != null && workItems.length >= knownTotal) break;
    } while (nextPageToken || (knownTotal != null && workItems.length < knownTotal));

    const fetchedKeys = new Set(workItems.map(i => i.jiraKey));
    const CHUNK = 50;

    // ── Second pass: fetch missing parent epics ───────────────────────────────
    // A parent epic may not appear in the main results if its status was filtered
    // out (e.g. "Exclude Done"), yet its children are still active.  We always
    // fetch the structural parents so the hierarchy tree connects correctly.
    // This is intentionally exempt from status filtering — it only fetches the
    // exact keys that child items already reference as their parent.
    const missingParentKeys = [
      ...new Set(
        workItems
          .map(i => i.parentKey)
          .filter((k): k is string => !!k && !fetchedKeys.has(k))
      ),
    ];
    if (missingParentKeys.length > 0) {
      onProgress?.(`Fetching ${missingParentKeys.length} missing parent epic(s)…`);
      for (let o = 0; o < missingParentKeys.length; o += CHUNK) {
        const keyList = missingParentKeys
          .slice(o, o + CHUNK)
          .map(k => `"${k}"`)
          .join(', ');
        const path = '/rest/api/3/search/jql'
          + '?jql=' + encodeURIComponent(`key IN (${keyList})`)
          + '&maxResults=' + CHUNK
          + '&fields=' + encodeURIComponent(jiraFields);
        try {
          const resp = await jiraFetch(connection.jiraBaseUrl, path, authHeader, { method: 'GET' });
          if (resp.ok) {
            const data = await resp.json() as { issues: JiraIssue[] };
            for (const issue of (data.issues ?? [])) {
              if (!fetchedKeys.has(issue.key)) {
                workItems.push(mapJiraIssueToWorkItem(issue, connection.id, customSpField));
                fetchedKeys.add(issue.key);
              }
            }
          }
        } catch { /* non-fatal */ }
      }
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

/**
 * Extract an epic key from any of the Epic Link custom fields Jira uses.
 * - API v3 may return a plain string key OR an object {key, id, self, ...}
 * - customfield_10014 is the standard Epic Link; 10008 is used on some instances.
 */
function extractEpicLinkKey(
  field: string | { key?: string; id?: string } | undefined
): string | undefined {
  if (!field) return undefined;
  if (typeof field === 'string') return field || undefined;
  return field.key || undefined;
}

function mapJiraIssueToWorkItem(issue: JiraIssue, connectionId: string, customSpField?: string): JiraWorkItem {
  const f = issue.fields;
  const sprint = getSprint(f);

  // Resolve parent key: try direct parent (next-gen), then both Epic Link fields (classic)
  const epicLinkKey =
    extractEpicLinkKey(f.customfield_10014) ??
    extractEpicLinkKey(f.customfield_10008);
  const parentKey = f.parent?.key ?? epicLinkKey;

  return {
    id: 'jira-' + issue.id, connectionId, jiraKey: issue.key, jiraId: issue.id, summary: f.summary,
    description: typeof f.description === 'string' ? f.description : undefined,
    type: mapJiraTypeToItemType(f.issuetype.name), typeName: f.issuetype.name,
    status: f.status.name, statusCategory: mapStatusCategory(f.status.statusCategory.key),
    priority: f.priority?.name, storyPoints: getStoryPoints(f, customSpField),
    originalEstimate: convertSecondsToHours(f.timeoriginalestimate),
    timeSpent: convertSecondsToHours(f.timespent),
    remainingEstimate: convertSecondsToHours(f.timeestimate),
    assigneeEmail: f.assignee?.emailAddress, assigneeName: f.assignee?.displayName,
    reporterEmail: f.reporter?.emailAddress, reporterName: f.reporter?.displayName,
    parentKey, parentId: f.parent?.id,
    sprintId: sprint?.id?.toString(), sprintName: sprint?.name,
    labels: f.labels || [], components: f.components?.map(c => c.name) || [],
    created: f.created, updated: f.updated,
    startDate: f.customfield_10015 ?? undefined,
    dueDate: f.duedate ?? undefined,
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
