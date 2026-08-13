import { findCallEnd, lineNumberAt } from "./scan-utils";

/**
 * DEC-480 envelope-site detection: finds `c.json({ items ...` call sites
 * and holds the named exception allowlist for check (a). Extracted
 * verbatim (no behavior change) from test/list-envelope-enumeration.test.ts
 * -- see that file's header comment for why each allowlist entry exists.
 */

export interface EnvelopeSite {
  file: string;
  line: number;
  body: string;
}

export function findItemsEnvelopeSites(source: string, file: string): EnvelopeSite[] {
  const sites: EnvelopeSite[] = [];
  const re = /c\.json\(\s*\{\s*items\b/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    const openParenIndex = match.index + "c.json".length;
    const callEnd = findCallEnd(source, openParenIndex);
    const body = source.slice(openParenIndex + 1, callEnd - 1);
    sites.push({ file, line: lineNumberAt(source, match.index), body });
  }
  return sites;
}

// DEC-480: named, individually-read exceptions to the (a) envelope-shape
// check. Format `${relativePath}:${line}`. Adding an entry here is a
// deliberate reviewed act -- see test/list-envelope-enumeration.test.ts's
// file-header comment above for why each one is exempt.
export const ENVELOPE_ALLOWLIST = new Set<string>([
  "src/routes/comms.ts:511",
  "src/routes/api/contacts/bulk-email.ts:194",
  // NOTE (DEC-840): GET .../assignments/distribute/preview used to be
  // allowlisted here (it was previously `c.json({ items, perReviewer,
  // total, shortfall })`, matching the scanner's `{ items` pattern). The
  // DEC-840 wire contract reorders the envelope to `{ cap, totalAssigned,
  // items, perReviewer, shortfall }` (cap echoed first), so the site no
  // longer matches `c.json({ items` at all and needs no allowlist entry --
  // removing rather than updating the stale line-numbered entry.
  // DEC-788: GET /contacts/duplicates/check is a bounded (cap 5),
  // deterministically-ordered lookup for a not-yet-created candidate, not a
  // paginated list -- same shape-exception class as the bulk-email preview
  // above.
  "src/routes/api/contacts/duplicates.ts:32",
  // DEC-924: POST /plans/:id/reviewers's array form answers the set of rows
  // it just wrote (bounded by the request's own parseBoundedIdArray cap),
  // never a paginated read -- same shape-exception class as the compose
  // preview above (comms.ts:511).
  "src/routes/review/plans-reviewers.ts:70",
]);
