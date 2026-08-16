// Submissions repo: pure param parsing (no I/O) — unit-tested directly.
// Split out of repo/submissions.ts (contention decomposition, no behavior
// change). See repo/submissions.ts for the module-level contract notes.

import { SUBMISSION_STATUSES, type SubmissionStatus } from "../../../domain/status";
import { CONTENT_STATUSES, type ContentStatus } from "../files-content-status";
import { DEC_078, DEC_843, DEC_417 } from "../../../decisions";
import { clampPage, clampPerPage } from "../../../lib/pagination";
import { boundedQueryString, MAX_SEARCH_QUERY_LENGTH, MAX_FILTER_ID_LENGTH } from "../../../lib/query-bounds";
import { type SortOrder, SORT_ORDERS } from "../../../domain/submission-sort";

void DEC_417; // wave-31 amendment: read-side q/trackId bounded, not just write-side field lengths

void DEC_843; // one shared status-token reader for the list and its export

void DEC_078; // canonical chunk helper, re-exported here for existing importers

// Canonical chunking helper (DEC-078) — re-exported so list.ts/submissions.ts
// importers are untouched. The size (90) leaves headroom for the extra
// eventId/status binds list.ts's filtered chunk queries add alongside each
// chunk of ids.
export { chunkIds, ID_CHUNK_SIZE } from "../../../lib/chunk";

// Re-exported from the pure domain vocabulary (DEC-613 wave-68 amendment)
// so every existing importer (list.ts, views.ts, submissions.ts barrel,
// exports.ts) is untouched.
export type { SortOrder };
export { SORT_ORDERS };

export interface ParsedListQuery {
  page: number;
  perPage: number;
  q: string | null;
  status: SubmissionStatus[];
  contentStatus: ContentStatus[];
  trackId: string | null;
  sort: SortOrder;
  includeAnswers: boolean;
  // DEC-881: null = no reuploaded filter applied; true/false narrows to the
  // exact predicate submissionListConditions expresses in SQL.
  reuploaded: boolean | null;
}

/**
 * Reads status filter tokens per DEC-843. Accepts a repeated query param
 * (`string[]`, as Hono's `c.req.queries('status')` returns) OR a single
 * comma-separated string (or both — a caller may pass either shape), trims
 * each token, drops empties, and dedupes preserving first-seen order. Any
 * token outside SUBMISSION_STATUSES THROWS a plain Error naming the token —
 * this is the loud counterpart to isValidStatusLiteral below, and it is the
 * ONE reader both the submissions list route and its export call, so the
 * two surfaces can never parse the same query string into different row
 * sets.
 */
export function readStatusTokens(raw: string | string[] | undefined): SubmissionStatus[] {
  const parts = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];
  const tokens = parts
    .flatMap((part) => part.split(","))
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const seen = new Set<string>();
  const result: SubmissionStatus[] = [];
  for (const token of tokens) {
    if (!(SUBMISSION_STATUSES as readonly string[]).includes(token)) {
      throw new Error(`Unknown status '${token}'`);
    }
    if (seen.has(token)) continue;
    seen.add(token);
    result.push(token as SubmissionStatus);
  }
  return result;
}

/**
 * Parses GET .../submissions query params per DEC-013 (page/perPage/q) +
 * DEC-016 (status/trackId/sort/includeAnswers). Per DEC-843, status tokens
 * are read through readStatusTokens above: repeated params AND
 * comma-separated tokens are both accepted, and an unknown token THROWS
 * (loud) rather than being dropped — the list and its export share this
 * exact reader so ?status=accepted&status=declined can never resolve to
 * different row sets between the two, and a typo can never silently widen
 * the filter to "every status". contentStatus tokens go through
 * readContentStatusTokens below with the same loud-on-unknown-token
 * contract (DEC-843 amendment, w38). `sort` goes through readSortToken
 * below with the same loud-on-unknown-token contract (DEC-843 amendment,
 * w62) — an unrecognised sort token throws rather than silently falling
 * back to 'newest', since the list and its CSV export share this exact
 * reader and a silent fallback would let the export's row order silently
 * diverge from what its query string asked for. Clamp rule per DEC-480
 * delegated to clampPage/clampPerPage -- no local copy.
 */
export interface ListQueryInput {
  page?: string;
  perPage?: string;
  q?: string;
  status?: string | string[];
  contentStatus?: string;
  trackId?: string;
  sort?: string;
  includeAnswers?: string;
  reuploaded?: string;
}

/** DEC-881: parses the `reuploaded` filter token — absent/empty means "no
 * filter" (null), `1` means "filter to re-uploaded", `0` means "filter to
 * not re-uploaded". Any other token THROWS (loud), same as readStatusTokens
 * above — a typo must never silently widen the filter away. */
export function readReuploadedToken(raw: string | undefined): boolean | null {
  if (raw === undefined || raw.trim().length === 0) return null;
  const token = raw.trim();
  if (token === "1") return true;
  if (token === "0") return false;
  throw new Error(`Unknown reuploaded '${token}'`);
}

/**
 * Reads contentStatus filter tokens per the DEC-843 amendment (w38): modelled
 * exactly on readStatusTokens above (trim, drop empties, dedupe preserving
 * first-seen order). Any token outside CONTENT_STATUSES THROWS a plain Error
 * naming the token — the list and its export share this reader through
 * parseListQuery, so a typo (e.g. `?contentStatus=aproved`) can never
 * silently widen the filter to "every content status" on either surface.
 */
/**
 * Reads the `sort` query token per the DEC-843 amendment (w62): modelled
 * exactly on readStatusTokens above. Absent or empty resolves to the
 * documented default 'newest'; any token outside SORT_ORDERS THROWS a plain
 * Error naming the token — this is the ONE reader parseListQuery uses, so
 * the list route and its CSV export (exports.ts) can never silently
 * reorder a token neither of them recognised into the default order.
 */
export function readSortToken(raw: string | undefined): SortOrder {
  if (raw === undefined || raw.trim().length === 0) return "newest";
  const token = raw.trim();
  if (!(SORT_ORDERS as readonly string[]).includes(token)) {
    throw new Error(`Unknown sort '${token}'`);
  }
  return token as SortOrder;
}

export function readContentStatusTokens(raw: string | undefined): ContentStatus[] {
  const tokens = (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const seen = new Set<string>();
  const result: ContentStatus[] = [];
  for (const token of tokens) {
    if (!(CONTENT_STATUSES as readonly string[]).includes(token)) {
      throw new Error(`Unknown contentStatus '${token}'`);
    }
    if (seen.has(token)) continue;
    seen.add(token);
    result.push(token as ContentStatus);
  }
  return result;
}

export function parseListQuery(raw: ListQueryInput): ParsedListQuery {
  const page = clampPage(raw.page);
  const perPage = clampPerPage(raw.perPage);

  const q = boundedQueryString(raw.q, "q", MAX_SEARCH_QUERY_LENGTH);

  const status = readStatusTokens(raw.status);

  const contentStatus = readContentStatusTokens(raw.contentStatus);

  const trackId = boundedQueryString(raw.trackId, "trackId", MAX_FILTER_ID_LENGTH);

  const sort = readSortToken(raw.sort);

  const includeAnswers = raw.includeAnswers === "1";

  const reuploaded = readReuploadedToken(raw.reuploaded);

  return { page, perPage, q, status, contentStatus, trackId, sort, includeAnswers, reuploaded };
}

/** Validates a single status literal against the DEC-003 set. Fails loudly
 * (throws) — callers wrap this into an ApiError('invalid', ...) at the route
 * boundary since it's a write-path validation, not a filter. */
export function isValidStatusLiteral(value: unknown): value is SubmissionStatus {
  return typeof value === "string" && (SUBMISSION_STATUSES as readonly string[]).includes(value);
}
