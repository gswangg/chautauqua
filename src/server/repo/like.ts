// DEC-506: ONE home for SQL LIKE escaping. Escapes `\`, `%`, `_` (each
// prefixed with a backslash) and wraps the result in `%...%` for substring
// containment. Deliberately does NOT lowercase — case-folding is a
// collation concern for the call site (pair with `COLLATE NOCASE`, or
// `lower(column)` + an already-lowercased input) not this module's job.
// Pure module: no node:/cloudflare imports.

export function likeContains(raw: string): string {
  const escaped = raw.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
  return `%${escaped}%`;
}
