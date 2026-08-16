import { DEFAULT_FILTER_STATE, SORT_ORDERS, SUBMISSION_STATUSES, type SortOrder, type SubmissionStatus, type SubmissionsFilterState } from './types';

/**
 * Build the query string for GET /api/v1/events/:eventId/submissions per the
 * DEC-016 list contract + DEC-013 pagination envelope. Omits params that are
 * at their default value so URLs stay short and shareable.
 */
export function buildSubmissionsQuery(filters: SubmissionsFilterState): string {
  const params = new URLSearchParams();

  if (filters.page !== DEFAULT_FILTER_STATE.page) {
    params.set('page', String(filters.page));
  }
  if (filters.perPage !== DEFAULT_FILTER_STATE.perPage) {
    params.set('perPage', String(filters.perPage));
  }
  if (filters.q.trim().length > 0) {
    params.set('q', filters.q.trim());
  }
  if (filters.status.length > 0) {
    params.set('status', filters.status.join(','));
  }
  if (filters.trackId) {
    params.set('trackId', filters.trackId);
  }
  if (filters.sort !== DEFAULT_FILTER_STATE.sort) {
    params.set('sort', filters.sort);
  }
  if (filters.includeAnswers) {
    params.set('includeAnswers', '1');
  }

  const qs = params.toString();
  return qs.length > 0 ? `?${qs}` : '';
}

function parseStatus(raw: string | null): SubmissionStatus[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((token) => token.trim())
    .filter((token): token is SubmissionStatus => (SUBMISSION_STATUSES as readonly string[]).includes(token));
}

// Client-side URL restore: an unknown/absent token quietly falls back to the
// default sort — this is deliberately different from the server's
// readSortToken (src/server/repo/submissions/query.ts), which THROWS on an
// unrecognised token (DEC-843). A malformed/stale URL should never break the
// page; a malformed API request must never be silently widened. Not a drift.
function parseSort(raw: string | null): SortOrder {
  if (raw && (SORT_ORDERS as readonly string[]).includes(raw)) {
    return raw as SortOrder;
  }
  return DEFAULT_FILTER_STATE.sort;
}

/** Inverse of buildSubmissionsQuery, for restoring filter state from the URL. */
export function parseSubmissionsQuery(search: string): SubmissionsFilterState {
  const params = new URLSearchParams(search);
  const page = Number(params.get('page'));
  const perPage = Number(params.get('perPage'));

  return {
    page: Number.isInteger(page) && page > 0 ? page : DEFAULT_FILTER_STATE.page,
    perPage: Number.isInteger(perPage) && perPage > 0 ? Math.min(perPage, 200) : DEFAULT_FILTER_STATE.perPage,
    q: params.get('q') ?? DEFAULT_FILTER_STATE.q,
    status: parseStatus(params.get('status')),
    trackId: params.get('trackId'),
    sort: parseSort(params.get('sort')),
    includeAnswers: params.get('includeAnswers') === '1',
  };
}
