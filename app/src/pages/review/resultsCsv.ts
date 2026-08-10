// DEC-018: GET /api/v1/plans/:id/results?format=csv streams CSV. This is a
// plain browser download link, not a fetch through lib/api.ts's JSON
// wrapper, so it's built here rather than routed through apiGet.
// DEC-082: an optional round narrows the export to a single round, mirroring
// the JSON endpoint's ?round= query param.
export function buildResultsCsvHref(planId: string, round?: number): string {
  const base = `/api/v1/plans/${encodeURIComponent(planId)}/results?format=csv`;
  return round === undefined ? base : `${base}&round=${round}`;
}
