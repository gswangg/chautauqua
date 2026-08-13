// Pure, dependency-free Markdown renderer for wiki-kind portal resources
// (DEC-696): organizer-authored resource bodies (e.g. "## Travel") today
// render as escaped paragraphs (src/server/repo/portal.ts), showing literal
// "##" to every speaker. This module renders a CLOSED allow-list of
// Markdown constructs safely.
//
// Security model: the input is HTML-escaped FIRST (so no raw HTML can ever
// reach the output), and only THEN do allow-listed patterns get re-expanded
// into safe tags. Anything outside the allow-list — including raw <script>,
// event-handler attributes like onerror=, javascript: URLs, and <img> tags —
// stays inert escaped text forever, because the escaping already happened
// before any markup was recognized.
//
// Web APIs only (DEC-002) — no node:/cloudflare: imports (pure-core rule).

function escapeHtml(src: string): string {
  return src
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Allow-listed link schemes: only http/https — javascript:, data:, and every
 * other scheme are rejected and rendered as plain (escaped) text instead of
 * a link. */
function isAllowedHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

/** Inline-level allow-list applied to an ALREADY-ESCAPED string: bold
 * (**text**), italic (*text*), and links ([text](href)) whose href passes
 * the http/https allow-list. Runs on escaped text, so any markup characters
 * that came from the original raw input (e.g. a literal "<" typed by the
 * organizer) are already entities and cannot be reinterpreted as tags. */
function renderInline(escaped: string): string {
  // Links: [text](href) — href re-escaped for attribute-safety is not
  // needed since escapeHtml already ran on the whole source, including the
  // href text; we only gate on the scheme.
  let out = escaped.replace(
    /\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/gi,
    (whole, text: string, href: string) => {
      if (!isAllowedHref(href)) return whole;
      return `<a href="${href}" rel="noopener noreferrer nofollow" target="_blank">${text}</a>`;
    },
  );
  // Bold: **text**
  out = out.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  // Italic: *text* (single asterisk, not already consumed by bold above)
  out = out.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  return out;
}

/** Renders a CLOSED allow-list of block-level Markdown: ATX h2 (##) and h3
 * (###) headings, unordered lists (- item / * item), and paragraphs
 * separated by a blank line. Every other line of raw text — including any
 * HTML the organizer typed — is escaped first and never re-interpreted as
 * markup, so renderMarkdown is safe to run on untrusted resource bodies. */
export function renderMarkdown(src: string): string {
  const escaped = escapeHtml(src);
  const blocks = escaped.split(/\n{2,}/);
  const html: string[] = [];
  for (const block of blocks) {
    const trimmed = block.trim();
    if (trimmed.length === 0) continue;
    const h3 = /^###\s+(.*)$/.exec(trimmed);
    if (h3) {
      html.push(`<h3>${renderInline(h3[1] ?? "")}</h3>`);
      continue;
    }
    const h2 = /^##\s+(.*)$/.exec(trimmed);
    if (h2) {
      html.push(`<h2>${renderInline(h2[1] ?? "")}</h2>`);
      continue;
    }
    const lines = trimmed.split("\n");
    const isList = lines.every((line) => /^[-*]\s+/.test(line.trim()));
    if (isList) {
      const items = lines.map((line) => {
        const item = line.trim().replace(/^[-*]\s+/, "");
        return `<li>${renderInline(item)}</li>`;
      });
      html.push(`<ul>${items.join("")}</ul>`);
      continue;
    }
    html.push(`<p>${renderInline(lines.join(" "))}</p>`);
  }
  return html.join("");
}
