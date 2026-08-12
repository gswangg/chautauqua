// Submissions repo: pure param parsing (no I/O) — unit-tested directly.
// Split out of repo/submissions.ts (contention decomposition, no behavior
// change). See repo/submissions.ts for the module-level contract notes.

import { SUBMISSION_STATUSES, type SubmissionStatus } from "../../../domain/status";
import { CONTENT_STATUSES, type ContentStatus } from "../files-content-status";
import { DEC_078 } from "../../../decisions";
import { clampPage, clampPerPage } from "../../../lib/pagination";

void DEC_078; // canonical chunk helper, re-exported here for existing importers

// Canonical chunking helper (DEC-078) — re-exported so list.ts/submissions.ts
// importers are untouched. The size (90) leaves headroom for the extra
// eventId/status binds list.ts's filtered chunk queries add alongside each
// chunk of ids.
export { chunkIds, ID_CHUNK_SIZE } from "../../../lib/chunk";

export type SortOrder = "newest" | "oldest" | "title" | "ref" | "worklist";

export const SORT_ORDERS: readonly SortOrder[] = ["newest", "oldest", "title", "ref", "worklist"];

export interface ParsedListQuery {
  page: number;
  perPage: number;
  q: string | null;
  status: SubmissionStatus[];
  contentStatus: ContentStatus[];
  trackId: string | null;
  sort: SortOrder;
  includeAnswers: boolean;
}

/**
 * Parses GET .../submissions query params per DEC-013 (page/perPage/q) +
 * DEC-016 (status/trackId/sort/includeAnswers). Unknown status tokens are
 * dropped silently (filters degrade gracefully; they don't reject a
 * request) — validation of status literals on WRITE happens in
 * parseStatusLiteral below, which fails loudly. Clamp rule per DEC-480
 * delegated to clampPage/clampPerPage -- no local copy.
 */
export function parseListQuery(raw: Record<string, string | undefined>): ParsedListQuery {
  const page = clampPage(raw.page);
  const perPage = clampPerPage(raw.perPage);

  const q = raw.q && raw.q.trim().length > 0 ? raw.q.trim() : null;

  const status = (raw.status ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is SubmissionStatus =>
      (SUBMISSION_STATUSES as readonly string[]).includes(s),
    );

  const contentStatus = (raw.contentStatus ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is ContentStatus => (CONTENT_STATUSES as readonly string[]).includes(s));

  const trackId = raw.trackId && raw.trackId.trim().length > 0 ? raw.trackId.trim() : null;

  const sort: SortOrder =
    raw.sort && (SORT_ORDERS as readonly string[]).includes(raw.sort)
      ? (raw.sort as SortOrder)
      : "newest";

  const includeAnswers = raw.includeAnswers === "1";

  return { page, perPage, q, status, contentStatus, trackId, sort, includeAnswers };
}

/** Validates a single status literal against the DEC-003 set. Fails loudly
 * (throws) — callers wrap this into an ApiError('invalid', ...) at the route
 * boundary since it's a write-path validation, not a filter. */
export function isValidStatusLiteral(value: unknown): value is SubmissionStatus {
  return typeof value === "string" && (SUBMISSION_STATUSES as readonly string[]).includes(value);
}
