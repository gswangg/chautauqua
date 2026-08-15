// DEC-506: ONE home for SQL LIKE escaping. Escapes `\`, `%`, `_` (each
// prefixed with a backslash) and wraps the result in `%...%` for substring
// containment. ONE case-insensitive idiom for every call site: the raw
// (unfolded) escaped needle, compared with plain `LIKE ... ESCAPE '\\'`
// and NO `COLLATE NOCASE` and NO `lower(...)` on either operand. SQLite's
// LIKE already case-folds ASCII by itself, so `COLLATE NOCASE` beside it is
// inert; SQLite's `lower()` only folds ASCII while a caller's JS
// `.toLowerCase()` is Unicode-aware, so pairing SQL `lower(column)` with a
// JS-lowercased needle silently drops rows whose case differs only in a
// non-ASCII letter (e.g. "École" doesn't match "école" once the column side
// has been folded by a narrower alphabet than the needle side). Do not
// reintroduce either idiom at a call site.
// Pure module: no node:/cloudflare imports.

export function likeContains(raw: string): string {
  const escaped = raw.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
  return `%${escaped}%`;
}
