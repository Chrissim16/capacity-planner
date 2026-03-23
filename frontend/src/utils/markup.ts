/**
 * Strip Jira wiki markup from a string and return plain text.
 *
 * Safe for use as textContent — no DOMParser, no innerHTML, no browser API.
 * The returned string is never passed to dangerouslySetInnerHTML.
 *
 * Patterns handled:
 *   h1. – h6.            headings
 *   [label|url]          named links → label
 *   [url]                bare links → url
 *   *text*               bold
 *   _text_               italic
 *   +text+               underline
 *   ??text??             citation
 *   {code}...{code}      code blocks → "[code block]"
 *   {noformat}...        noformat blocks → "[code block]"
 *   {color:x}text{color} colour macro → text
 *   {macro}              any remaining macro → stripped
 */
export function stripJiraMarkup(text: string): string {
  return text
    // Headings: h1. through h6. at line start
    .replace(/^h[1-6]\.\s*/gm, '')
    // Named links: [label|url] → label
    .replace(/\[([^\]|]+)\|[^\]]+\]/g, '$1')
    // Bare links / anchors: [url] or [^attachment] → url/attachment
    .replace(/\[([^\]]+)\]/g, '$1')
    // Bold: *text*
    .replace(/\*([^*\n]+)\*/g, '$1')
    // Italic: _text_
    .replace(/_([^_\n]+)_/g, '$1')
    // Underline: +text+
    .replace(/\+([^+\n]+)\+/g, '$1')
    // Citation: ??text??
    .replace(/\?\?([^?\n]+)\?\?/g, '$1')
    // Code blocks (multiline): {code}...{code} or {code:*}...{code}
    .replace(/\{code(?::[^}]*)?\}[\s\S]*?\{code\}/g, '[code block]')
    // Noformat blocks: {noformat}...{noformat}
    .replace(/\{noformat(?::[^}]*)?\}[\s\S]*?\{noformat\}/g, '[code block]')
    // Colour macros: {color:x}text{color} → text
    .replace(/\{color:[^}]+\}([^{]*)\{color\}/g, '$1')
    // Any remaining macros: {anything}
    .replace(/\{[^}]+\}/g, '')
    // Collapse 3+ newlines to 2
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
