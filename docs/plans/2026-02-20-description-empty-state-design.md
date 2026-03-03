# Description Section — Always-Visible Empty State

**Date:** 2026-02-20  
**Status:** Approved — ready to implement  
**Scope:** 1 file, 2 lines changed

---

## Problem

The `DescriptionSection` component in `SlidePanel` (`JiraGantt.tsx`) is only rendered when `item.description` is truthy. When a Jira ticket has no description (or was synced before the ADF fix), the section header and body are both hidden — giving no feedback to the user that a description field exists.

---

## Decision

Always render the `Description` section header. Show a single generic placeholder — "No description available." — when the text is absent. No re-sync hint, no distinction between "never written" and "needs re-sync".

---

## Design

### `DescriptionSection` — change prop type and add empty branch

`text` changes from `string` to `string | undefined`. When absent, render an italic muted placeholder instead of the content area.

```tsx
function DescriptionSection({ text }: { text?: string }) {
  const [expanded, setExpanded] = useState(false);
  const truncated = !!text && text.length > DESCRIPTION_PREVIEW_CHARS;
  const display = !text
    ? null
    : expanded || !truncated
      ? text
      : text.slice(0, DESCRIPTION_PREVIEW_CHARS).replace(/\s+\S*$/, '') + '…';

  return (
    <div>
      <p className="text-[10.5px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2.5">
        Description
      </p>
      {display ? (
        <>
          <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
            {display}
          </p>
          {truncated && (
            <button onClick={() => setExpanded(e => !e)}
              className="mt-2 text-xs font-medium text-mw-primary hover:underline">
              {expanded ? 'Show less ▲' : 'Show more ▼'}
            </button>
          )}
        </>
      ) : (
        <p className="text-sm text-slate-400 dark:text-slate-500 italic">
          No description available.
        </p>
      )}
    </div>
  );
}
```

### Call site — remove the `&&` guard

```tsx
// before
{item.description && <DescriptionSection text={item.description} />}

// after
<DescriptionSection text={item.description} />
```

---

## Files touched

| File | Change |
|------|--------|
| `frontend/src/components/JiraGantt.tsx` | `DescriptionSection` prop `text: string` → `text?: string`; add empty-state branch; remove `&&` guard at call site |
