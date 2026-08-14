// DEC-037 (wave 24 amendment): the single owner of HTML-entity escaping for
// the whole repo. Every path that feeds dangerouslySetInnerHTML or a raw
// HTML string (mail rendering, markdown rendering, the HTML error page)
// escapes through THIS function. Any future escaping rule (a new entity, a
// changed order, a different edge case) lands here once -- not copied into a
// second definition.
//
// Pure core (no node:/cloudflare:/drizzle imports) -- DEC-002.

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
