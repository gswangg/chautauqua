// Submissions repo: pure param parsing (no I/O) — unit-tested directly.
// Split out of repo/submissions.ts (contention decomposition, no behavior
// change). See repo/submissions.ts for the module-level contract notes.

import { SUBMISSION_STATUSES, type SubmissionStatus } from "../../../domain/status";
import { DEC_078 } from "../../../decisions";

void DEC_078; // canonical chunk helper, re-exported here for existing importers

// Canonical chunking helper (DEC-078) — re-exported so list.ts/submissions.ts
// importers are untouched. The size (90) leaves headroom for the extra
// eventId/status binds list.ts's filtered chunk queries add alongside each
// chunk of ids.
export { chunkIds, ID_CHUNK_SIZE } from "../../../lib/chunk";

export type SortOrder = "newest" | "oldest" | "title" | "ref";

export const SORT_ORDERS: readonly SortOrder[] = ["newest", "oldest", "title", "ref"];

const DEFAULT_PER_PAGE = 50;
const MAX_PER_PAGE = 200;

export interface ParsedListQuery {
  page: number;
  perPage: number;
  q: string | null;
  status: SubmissionStatus[];
  trackId: string | null;
  sort: SortOrder;
  includeAnswers: boolean;
}

/**
 * Parses GET .../submissions query params per DEC-013 (page/perPage/q) +
 * DEC-016 (status/trackId/sort/includeAnswers). Unknown status tokens are
 * dropped silently (filters degrade gracefully; they don't reject a
 * request) — validation of status literals on WRITE happens in
 * parseStatusLiteral below, which fails loudly.
 */
export function parseListQuery(raw: Record<string, string | undefined>): ParsedListQuery {
  const pageNum = Number(raw.page);
  const perPageNum = Number(raw.perPage);
  const page = Number.isInteger(pageNum) && pageNum > 0 ? pageNum : 1;
  const perPage =
    Number.isInteger(perPageNum) && perPageNum > 0
      ? Math.min(perPageNum, MAX_PER_PAGE)
      : DEFAULT_PER_PAGE;

  const q = raw.q && raw.q.trim().length > 0 ? raw.q.trim() : null;

  const status = (raw.status ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is SubmissionStatus =>
      (SUBMISSION_STATUSES as readonly string[]).includes(s),
    );

  const trackId = raw.trackId && raw.trackId.trim().length > 0 ? raw.trackId.trim() : null;

  const sort: SortOrder =
    raw.sort && (SORT_ORDERS as readonly string[]).includes(raw.sort)
      ? (raw.sort as SortOrder)
      : "newest";

  const includeAnswers = raw.includeAnswers === "1";

  return { page, perPage, q, status, trackId, sort, includeAnswers };
}

/** Validates a single status literal against the DEC-003 set. Fails loudly
 * (throws) — callers wrap this into an ApiError('invalid', ...) at the route
 * boundary since it's a write-path validation, not a filter. */
export function isValidStatusLiteral(value: unknown): value is SubmissionStatus {
  return typeof value === "string" && (SUBMISSION_STATUSES as readonly string[]).includes(value);
}

/** Lowercases and escapes backslash/%/_ for a SQL LIKE bind (ESCAPE '\'),
 * wrapping in %...% for substring matching (DEC-333/335). A near-identical
 * helper is deliberately duplicated in the contacts repo lane — pure, tiny,
 * not worth a shared module across independently-owned files. */
export function likeContains(raw: string): string {
  const escaped = raw.toLowerCase().replace(/[\\%_]/g, (ch) => `\\${ch}`);
  return `%${escaped}%`;
}
