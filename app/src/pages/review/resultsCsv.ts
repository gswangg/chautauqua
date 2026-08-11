// DEC-018/DEC-345: GET /api/v1/plans/:id/results?format=csv streams CSV.
// This is a plain browser download link, not a fetch through lib/api.ts's
// JSON wrapper, so it's built here rather than routed through apiGet.
// DEC-082: an optional round narrows the export to a single round, mirroring
// the JSON endpoint's ?round= query param.
// DEC-345: the active header-sort (sort/dir) travels with the export too --
// ?format=csv ignores page/perPage server-side but still honours sort/dir,
// so the download matches whatever order the table is currently showing.
export function buildResultsCsvHref(
  planId: string,
  round?: number,
  sort?: { column: string; criterionId?: string; direction: string },
): string {
  const params = new URLSearchParams();
  params.set("format", "csv");
  if (round !== undefined) params.set("round", String(round));
  if (sort) {
    params.set("sort", sort.column);
    if (sort.criterionId !== undefined) params.set("criterionId", sort.criterionId);
    params.set("dir", sort.direction);
  }
  return `/api/v1/plans/${encodeURIComponent(planId)}/results?${params.toString()}`;
}
