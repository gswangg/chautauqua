// DEC-945 (wave-6 amendment): the ONE route manifest for /portal/*,
// consulted by speakerGate (src/routes/portal/shared.tsx) so an unknown
// path can be answered with a real 404 BEFORE the non-speaker role redirect
// fires -- mirrors src/lib/admin-routes.ts's matchesAdminRoute, which the
// /admin/* handler already consults the same way. Portal is served as four
// separately-mounted SSR Hono sub-apps (portalRoutes, portalProfileRoutes,
// portalTasksRoutes + its nested portalResourcesRoutes, portalEditRoutes --
// all app.route("/portal", ...) in src/index.ts), so this manifest is the
// union of every GET/POST path declared across all four rather than a
// single sub-app's own route table.
//
// Patterns are relative to the /portal prefix (i.e. what a caller strips
// before calling matchesPortalRoute). A `:param` segment matches exactly
// one non-empty path segment; there is no portal `*` suffix pattern today.
export const PORTAL_ROUTE_PATTERNS = [
  "/",
  "/submissions",
  "/submissions/:id",
  "/submissions/:id/edit",
  "/submissions/:id/participants",
  "/invitations/:participantId",
  "/profile",
  "/tasks",
  "/tasks/:assignmentId/form",
  "/tasks/:assignmentId/complete",
  "/tasks/:assignmentId/upload",
  "/tasks/:assignmentId/comments",
  "/tasks/:assignmentId/file",
  "/tasks/:assignmentId/file/:fileId",
  "/resources",
  "/resources/:resourceId/download",
] as const;

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
  if (patternSegments.length !== pathSegments.length) return false;
  return patternSegments.every((seg, i) => segmentMatches(seg, pathSegments[i] as string));
}

/** True when `pathname` (relative to the /portal prefix, e.g. "/tasks" or
 * "/" for the bare portal root) resolves to some declared portal route. */
export function matchesPortalRoute(pathname: string): boolean {
  const pathSegments = segmentsOf(pathname);
  return PORTAL_ROUTE_PATTERNS.some((pattern) => matchesPattern(pattern, pathSegments));
}
