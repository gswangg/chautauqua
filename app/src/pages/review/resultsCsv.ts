// DEC-018: GET /api/v1/plans/:id/results?format=csv streams CSV. This is a
// plain browser download link, not a fetch through lib/api.ts's JSON
// wrapper, so it's built here rather than routed through apiGet.
export function buildResultsCsvHref(planId: string): string {
  return `/api/v1/plans/${encodeURIComponent(planId)}/results?format=csv`;
}
