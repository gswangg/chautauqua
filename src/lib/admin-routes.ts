// DEC-154 (amendment, wave 53): the ONE route manifest for the admin SPA,
// consulted by BOTH sides of the /admin boundary -- the Worker's
// src/routes/root.tsx (to answer a real 404 for an unmatched path instead
// of the shell at 200) and app/src/App.tsx (which renders its <Route>
// elements FROM this tuple via a Record so a missing/extra element is a
// compile error, not just a comparable list). Pure module: no node:/
// cloudflare/drizzle imports, so it can be imported from both src/ (Worker)
// and app/ (browser bundle) without dragging server-only code into the SPA.
//
// Patterns are React-Router-style, relative to the /admin basename (i.e.
// what BrowserRouter's basename="/admin" already strips). A `:param`
// segment matches exactly one non-empty path segment; a trailing `*`
// segment matches any (possibly empty) suffix, mirroring how
// app/src/App.tsx's own NavLink stripping already treats '/review/*'.
export const ADMIN_ROUTE_PATTERNS = [
  "/",
  "/overview",
  "/submissions",
  "/review/*",
  "/speakers",
  "/content",
  "/agenda",
  "/comms",
  "/contacts",
  "/settings",
  "/contacts/merge",
  "/submissions/forms",
  "/submissions/delete",
  "/submissions/:id",
  "/speakers/:contactId",
  // Design pack v12's task view ("One task, every speaker"), reached from a
  // grid column head. THREE segments, so it can never be confused with the
  // two-segment "/speakers/:contactId" above -- a contact id is not
  // swallowed by the literal "tasks" segment and vice versa, in this
  // matcher and in React Router alike.
  "/speakers/tasks/:taskId",
  "/content/:submissionId",
] as const;

/** Splits a path into non-empty segments, treating "/" (and "") as zero
 * segments -- the shared normalisation both the pattern and the candidate
 * pathname go through before comparison. */
function segmentsOf(path: string): string[] {
  const trimmed = path.replace(/^\/+/, "");
  return trimmed === "" ? [] : trimmed.split("/");
}

function segmentMatches(patternSegment: string, pathSegment: string): boolean {
  if (patternSegment.startsWith(":")) return pathSegment.length > 0;
  return patternSegment === pathSegment;
}

function matchesPattern(pattern: string, pathSegments: string[]): boolean {
  const patternSegments = segmentsOf(pattern);
  const last = patternSegments[patternSegments.length - 1];
  if (last === "*") {
    const prefix = patternSegments.slice(0, -1);
    if (pathSegments.length < prefix.length) return false;
    return prefix.every((seg, i) => segmentMatches(seg, pathSegments[i] as string));
  }
  if (patternSegments.length !== pathSegments.length) return false;
  return patternSegments.every((seg, i) => segmentMatches(seg, pathSegments[i] as string));
}

/** True when `pathname` (relative to the /admin basename, e.g. "/overview"
 * or "/" for the bare admin root) resolves to some declared admin route. */
export function matchesAdminRoute(pathname: string): boolean {
  const pathSegments = segmentsOf(pathname);
  return ADMIN_ROUTE_PATTERNS.some((pattern) => matchesPattern(pattern, pathSegments));
}
