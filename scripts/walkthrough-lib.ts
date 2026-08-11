// Pure helpers for scripts/walkthrough.ts, extracted for plain-vitest
// testing (dependency-free, no node:child_process/filesystem access — same
// pattern as scripts/perf-smoke-lib.ts / scripts/bundle-check-lib.ts).
// DEC-062.

/**
 * Fixed sequential order of the DEC-060 walkthrough modules. producer must
 * run first (it seeds the event other personas depend on), then review,
 * speaker, public, data, scale — in that order. The orchestrator
 * (DEC-062) is the sole place this order is defined; module files must not
 * reorder themselves. "scale" (DEC-089) runs last: it exercises >100-id
 * volume paths (bulk accept, chunking, purge refresh) against the same
 * seeded event the earlier areas already populated.
 */
export const WALKTHROUGH_AREAS = ["producer", "review", "speaker", "public", "data", "scale"] as const;

export type WalkthroughArea = (typeof WALKTHROUGH_AREAS)[number];

/** scripts/walkthrough/<area>.ts, relative to the repo root. */
export function modulePath(area: WalkthroughArea): string {
  return `scripts/walkthrough/${area}.ts`;
}

/**
 * Build the argv for `npx tsx scripts/walkthrough/<area>.ts --url <url>`,
 * as an array suitable for node:child_process spawn (no shell quoting
 * concerns).
 */
export function buildSpawnArgs(area: WalkthroughArea, url: string): string[] {
  return ["tsx", modulePath(area), "--url", url];
}

/** Parse `--url <value>` out of argv (process.argv.slice(2)); falls back
 * to defaultUrl if absent. Throws if `--url` is given with no value. */
export function parseUrlArg(argv: readonly string[], defaultUrl: string): string {
  const idx = argv.indexOf("--url");
  if (idx === -1) return defaultUrl;
  const value = argv[idx + 1];
  if (value === undefined) {
    throw new Error("walkthrough: --url flag given with no value");
  }
  return value;
}

export function formatAreaPass(area: WalkthroughArea): string {
  return `PASS ${area}`;
}

export function formatFailureMessage(area: WalkthroughArea): string {
  return `WALKTHROUGH FAILED at ${area}`;
}

export function formatMissingModulesMessage(missing: readonly string[]): string {
  return `walkthrough: missing module file(s): ${missing.join(", ")}`;
}

// ---------------------------------------------------------------------------
// Task w2-e: findings-closure reusable steps (additive, dependency-free pure
// helpers per the same pattern as above — request/body construction and
// response-shape validators, callable from a driver script or a future
// scripts/walkthrough/*.ts module without pulling in node:/fetch here).
// ---------------------------------------------------------------------------

/** B1: POST /api/v1/plans/:id/reviewers body — assigns a reviewer either by
 * track or by a single submission (mutually exclusive per the API). */
export function buildReviewerAssignmentBody(
  userId: string,
  scope: { trackId: string } | { submissionId: string },
): Record<string, string> {
  return "trackId" in scope
    ? { userId, trackId: scope.trackId }
    : { userId, submissionId: scope.submissionId };
}

/** B1: does a GET /api/v1/users?role=reviewer item carry an `id` usable as
 * the userId in buildReviewerAssignmentBody? */
export function userListItemHasId(item: unknown): item is { id: string } {
  return (
    typeof item === "object" &&
    item !== null &&
    "id" in item &&
    typeof (item as { id: unknown }).id === "string" &&
    (item as { id: string }).id.length > 0
  );
}

/** B2 (DEC-239): does a GET /api/v1/review/plans/:id/queue item expose
 * `submissionId` (the SPA-contract key), as opposed to a raw `id`? */
export function queueItemHasSubmissionId(item: unknown): item is { submissionId: string } {
  return (
    typeof item === "object" &&
    item !== null &&
    "submissionId" in item &&
    typeof (item as { submissionId: unknown }).submissionId === "string" &&
    (item as { submissionId: string }).submissionId.length > 0
  );
}

/** B3: POST /api/v1/contacts/merge body. */
export function buildContactsMergeBody(keepId: string, mergeId: string): { keepId: string; mergeId: string } {
  return { keepId, mergeId };
}

/** B3: is the (idA, idB) pair still reported as a duplicate group by GET
 * /api/v1/contacts/duplicates after a merge? Order-independent. */
export function duplicatePairStillOpen(
  duplicateGroups: readonly { contactIds: readonly string[] }[],
  idA: string,
  idB: string,
): boolean {
  return duplicateGroups.some((g) => g.contactIds.includes(idA) && g.contactIds.includes(idB));
}

/** CNT-07: does GET /api/v1/events/:id/files include a deliverable chain
 * whose latest file id matches the just-uploaded file, for the given
 * submission? */
export function eventFilesContainsUpload(
  files: readonly { submissionId: string; latestFileId: string }[],
  submissionId: string,
  uploadedFileId: string,
): boolean {
  return files.some((f) => f.submissionId === submissionId && f.latestFileId === uploadedFileId);
}

/** CFP-06 / DEC-243: resolve a submission's trackIds to display names via
 * the event's track list, mirroring app/src/pages/submissions/
 * SubmissionsTable.tsx's trackNames() for the purpose of an independent
 * server-side check (no shared import — app/ is a separate build target). */
export function resolveTrackNames(trackIds: readonly string[], tracks: readonly { id: string; name: string }[]): string[] {
  const byId = new Map(tracks.map((t) => [t.id, t.name] as const));
  return trackIds.map((id) => byId.get(id) ?? id);
}

/** CFP-06 / DEC-243: does this form's field list contain a dropdown field
 * whose label is exactly (case-insensitively) "Format"? Independent
 * reimplementation of app/src/pages/submissions/columns.ts's
 * findFormatField, for a server-side/API-only check (no app/ import from
 * scripts/, separate build target). */
export function hasExactFormatDropdownField(
  fields: readonly { kind: string; label: string }[],
): boolean {
  return fields.some((f) => f.kind === "dropdown" && f.label.trim().toLowerCase() === "format");
}

/** ABS-10 / DEC-241: a results row's dropdown criterion id must appear only
 * under perDropdown, never as a key in perCriterion (which feeds the
 * rating-only `average`). */
export function dropdownCriterionExcludedFromAverage(
  row: { perCriterion: Record<string, unknown>; perDropdown: Record<string, unknown> },
  dropdownCriterionId: string,
): boolean {
  return dropdownCriterionId in row.perDropdown && !(dropdownCriterionId in row.perCriterion);
}
