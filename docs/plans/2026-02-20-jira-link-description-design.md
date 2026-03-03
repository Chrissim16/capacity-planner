# Jira Link + Description in Timeline SlidePanel

**Date:** 2026-02-20  
**Status:** Approved — ready to implement  
**Scope:** 2 files changed, no DB migration, no new dependencies

---

## Problem

When a user clicks a Jira item (epic / feature / story / task / bug) in the Timeline Gantt view, the `SlidePanel` shows assignees, status, sprint, and dates — but two pieces of information are missing:

1. A clear, prominent way to open the ticket in Jira
2. The ticket's description / content body

The `jiraKey` link in the header exists but is tiny (10px monospace) and easy to miss.  
The `description` field is already fetched from the Jira API and has a column in `jira_work_items`, but is silently dropped because the mapper only handles plain strings — Jira Cloud returns Atlassian Document Format (ADF) objects.

---

## Decisions

| Question | Answer |
|----------|--------|
| Jira link style | Prominent full-width "Open {key} in Jira" button in the panel body |
| Description format | Plain text (ADF stripped to text nodes) — evaluate if rich rendering is needed after rollout |
| Description storage | Existing `description text` column — no new column or migration |
| Description fetch strategy | Fix the mapper to extract plain text from ADF at sync time |
| Back-fill of existing items | Not automated — users re-sync to populate description on old items |

---

## Approaches considered

| Approach | Description | Chosen? |
|----------|-------------|---------|
| A — Custom ADF-to-HTML at sync time | Convert ADF to HTML, store rendered HTML | No — plain text is sufficient first |
| B — On-demand `renderedFields` fetch | Extra API call per panel open | No — adds latency; try plain text first |
| C — Store ADF JSON, render with npm library | New column + third-party library | No — unnecessary complexity |
| **D — Extract plain text from ADF at mapper** | Walk ADF tree, join text nodes | **Yes** |

---

## Data flow

```
Jira REST API /rest/api/3/search
  └─ fields.description (ADF object on Cloud, plain string on Data Center)
       │
       ▼
  mapJiraIssueToWorkItem()  [frontend/src/services/jira.ts]
       └─ extractPlainTextFromAdf(f.description)
            └─ plain string → JiraWorkItem.description
                    │
                    ▼
              Zustand store / jira_work_items DB column
                    │
                    ▼
              SlidePanel  [frontend/src/components/JiraGantt.tsx]
                    ├─ "Open ERP-42 in Jira ↗" button
                    └─ Description section (collapsible, 400 char preview)
```

---

## File changes

### 1. `frontend/src/services/jira.ts`

**Add helper function** (before `mapJiraIssueToWorkItem`):

```typescript
/**
 * Recursively extract plain text from an Atlassian Document Format (ADF) node.
 * Jira Cloud API v3 returns description as ADF; this strips all formatting
 * and returns the raw text content, with paragraph/heading breaks as newlines.
 */
function extractPlainTextFromAdf(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  const n = node as { type?: string; text?: string; content?: unknown[] };
  if (typeof n.text === 'string') return n.text;
  if (!Array.isArray(n.content)) return '';
  const sep = (n.type === 'paragraph' || n.type === 'heading') ? '\n' : '';
  return n.content.map(child => extractPlainTextFromAdf(child)).join('') + sep;
}
```

**Update `mapJiraIssueToWorkItem`** — replace line ~985:

Before:
```typescript
description: typeof f.description === 'string' ? f.description : undefined,
```

After:
```typescript
description:
  typeof f.description === 'string'
    ? f.description || undefined
    : f.description
      ? extractPlainTextFromAdf(f.description).trim() || undefined
      : undefined,
```

---

### 2. `frontend/src/components/JiraGantt.tsx` (`SlidePanel`)

#### Header change — remove the tiny `jiraKey` link

Remove lines 207–215 (the `<a>` tag wrapping `item.jiraKey`):

```tsx
{/* DELETE THIS BLOCK */}
{item.jiraKey && jiraBaseUrl && (
  <a href={...} className="font-mono text-[10px] ...">
    {item.jiraKey}<ExternalLink size={9} />
  </a>
)}
```

The `TypeChip` remains in the header row. The summary `<p>` is unchanged.

#### Body change — add "Open in Jira" button

Add as the **first element** in the body `<div>` (before the "Assignees" section):

```tsx
{item.jiraKey && jiraBaseUrl && (
  <a
    href={`${jiraBaseUrl}/browse/${item.jiraKey}`}
    target="_blank"
    rel="noopener noreferrer"
    className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg
               border border-mw-grey-light bg-mw-grey-lighter text-mw-dark text-sm font-semibold
               hover:bg-mw-primary-light hover:border-mw-primary hover:text-mw-primary
               dark:bg-mw-muted-dark dark:border-mw-muted-border-dark dark:text-mw-muted-text-dark
               dark:hover:bg-mw-primary/10 dark:hover:border-mw-primary dark:hover:text-mw-accent-text-dark
               transition-colors"
  >
    <ExternalLink size={14} />
    Open {item.jiraKey} in Jira
  </a>
)}
```

#### Body change — add Description section

Add as the **last section** inside the body, after "Details", only when `item.description` is non-empty:

```tsx
{item.description && <DescriptionSection text={item.description} />}
```

Extract as a small local component inside `JiraGantt.tsx`:

```tsx
const DESCRIPTION_PREVIEW_CHARS = 400;

function DescriptionSection({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const truncated = text.length > DESCRIPTION_PREVIEW_CHARS;
  const display = expanded || !truncated
    ? text
    : text.slice(0, DESCRIPTION_PREVIEW_CHARS).replace(/\s+\S*$/, '') + '…';

  return (
    <div>
      <p className="text-[10.5px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2.5">
        Description
      </p>
      <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
        {display}
      </p>
      {truncated && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="mt-2 text-xs font-medium text-mw-primary hover:underline"
        >
          {expanded ? 'Show less ▲' : 'Show more ▼'}
        </button>
      )}
    </div>
  );
}
```

---

## Panel layout (after)

```
┌─────────────────────────────────────────────┐
│ [Epic]  Issue title summary text here   [×] │
│ ─────────────────────────────────────────── │
│                                             │
│  [ Open ERP-42 in Jira ↗ ]                 │
│                                             │
│  ASSIGNEES                                  │
│  ┌──────────────┐  ┌──────────────┐        │
│  │ IT           │  │ Business     │        │
│  │ [AV] Name    │  │ [AV] Name    │        │
│  └──────────────┘  └──────────────┘        │
│                                             │
│  DETAILS                                    │
│  ┌────────┐ ┌────────┐                     │
│  │ Status │ │ Sprint │                     │
│  └────────┘ └────────┘                     │
│  ┌────────────────────────┐                 │
│  │ Dates                  │                 │
│  └────────────────────────┘                 │
│                                             │
│  DESCRIPTION                                │
│  Lorem ipsum dolor sit amet, consectetur   │
│  adipiscing elit. Sed do eiusmod…           │
│                              [Show more ▼] │
└─────────────────────────────────────────────┘
```

---

## Re-sync note

Items already stored in the database were synced before this fix and will have `description = null`. Users must click **"Sync Jira"** in Settings to refresh them. No automated back-fill is planned.

---

## Implementation tasks

1. Add `extractPlainTextFromAdf` to `frontend/src/services/jira.ts`
2. Update `mapJiraIssueToWorkItem` description line in `frontend/src/services/jira.ts`
3. Remove tiny `jiraKey` link from `SlidePanel` header in `frontend/src/components/JiraGantt.tsx`
4. Add `DescriptionSection` local component in `frontend/src/components/JiraGantt.tsx`
5. Add "Open in Jira" button as first body element in `SlidePanel`
6. Add `{item.description && <DescriptionSection text={item.description} />}` at end of body
7. Build, lint-check, deploy
