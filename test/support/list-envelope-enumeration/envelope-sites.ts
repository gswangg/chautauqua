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
  /** `${METHOD} ${routePath}` of the nearest preceding `.get(`/`.post(`/etc
   * route registration -- the stable identity of the handler this site sits
   * inside of. Used (instead of file:line) to key the allowlist, so a
   * handler's exemption survives unrelated line shifts above it. */
  route: string;
}

// Matches `xxxRoutes.get("/path", ...)` etc -- route registrations, as
// opposed to unrelated `.get(...)` calls (e.g. Map#get) that happen to take
// a string/template-literal argument.
const ROUTE_REGISTRATION_RE = /\b\w*Routes\.(get|post|put|patch|delete)\(\s*(["'`])([^"'`]+)\2/g;

/** Finds the `${METHOD} ${path}` of the nearest route registration
 * (`someRoutes.get("/path", ...)` etc) that starts before `beforeIndex` in
 * `source`. This is the stable identity of the handler a given site sits
 * inside of -- unlike a line number, it does not shift when unrelated code
 * is added above the site. */
function nearestRoutePath(source: string, beforeIndex: number): string {
  const re = new RegExp(ROUTE_REGISTRATION_RE.source, "g");
  let best: { method: string; path: string } | null = null;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    if (match.index >= beforeIndex) break;
    const method = match[1];
    const path = match[3];
    if (!method || !path) throw new Error("route-registration regex matched without expected capture groups");
    best = { method: method.toUpperCase(), path };
  }
  if (!best) {
    throw new Error(`no preceding route registration found before source index ${beforeIndex}`);
  }
  return `${best.method} ${best.path}`;
}

export function findItemsEnvelopeSites(source: string, file: string): EnvelopeSite[] {
  const sites: EnvelopeSite[] = [];
  const re = /c\.json\(\s*\{\s*items\b/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    const openParenIndex = match.index + "c.json".length;
    const callEnd = findCallEnd(source, openParenIndex);
    const body = source.slice(openParenIndex + 1, callEnd - 1);
    sites.push({
      file,
      line: lineNumberAt(source, match.index),
      body,
      route: nearestRoutePath(source, match.index),
    });
  }
  return sites;
}

// DEC-480 (wave-17 amendment): named, individually-read exceptions to the
// (a) envelope-shape check. Format `${relativePath}#${METHOD} ${routePath}`
// -- keyed on the handler's route registration rather than a line number,
// because a line number is not a handler's identity and drifts every time
// unrelated code is added above a site. Adding an entry here is a
// deliberate reviewed act -- see test/list-envelope-enumeration.test.ts's
// file-header comment above for why each one is exempt.
export const ENVELOPE_ALLOWLIST = new Set<string>([
  // POST .../compose/preview returns a compose-preview render, one row per
  // selected submission, bounded by the 100-recipient send cap (DEC checked
  // elsewhere in comms/) -- a preview payload, not a list GET.
  "src/routes/comms/preview.ts#POST /api/v1/events/:eventId/compose/preview",
  // POST /contacts/bulk-email/preview (CRM-11/DEC-150) slices to
  // `previewContacts = contacts.slice(0, BULK_EMAIL_PREVIEW_LIMIT)` (5)
  // before rendering, so it is bounded by that constant rather than by a
  // page/perPage query param -- a preview payload, not a list GET.
  "src/routes/api/contacts/bulk-email.ts#POST /contacts/bulk-email/preview",
  // GET /contacts/duplicates/check (DEC-788) is a bounded (cap 5),
  // deterministically-ordered lookup for a not-yet-created candidate, not a
  // paginated list -- same shape-exception class as the bulk-email preview
  // above.
  "src/routes/api/contacts/duplicates.ts#GET /contacts/duplicates/check",
  // POST /plans/:id/reviewers's array form answers the set of rows it just
  // wrote (bounded by the request's own parseBoundedIdArray cap), never a
  // paginated read -- same shape-exception class as the compose preview
  // above.
  "src/routes/review/plans-reviewers.ts#POST /api/v1/plans/:id/reviewers",
]);
