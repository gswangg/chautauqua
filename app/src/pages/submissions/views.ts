// Saved-view config <-> live filter/column state conversion (DEC-031).
// config_json shape (server-validated, src/server/repo/views.ts):
// { q, status: string[], trackId, sort, columns: string[] } — matches the
// landed w2-f filter/column state shapes (./filters.ts, ./columns.ts)
// exactly, so applying a view is a pure state replacement.

import { DEFAULT_FILTER_STATE, type SortOrder, type SubmissionsFilterState, type SubmissionStatus } from './types';

export interface SavedViewConfig {
  q: string;
  status: string[];
  trackId: string | null;
  sort: string;
  columns: string[];
}

export interface SavedView {
  id: string;
  eventId: string;
  name: string;
  config: SavedViewConfig;
  createdByUserId: string | null;
  shared: boolean;
  createdAt: number;
  updatedAt: number;
}

/** Serializes the live filter state + visible column ids into a DEC-031
 * config_json payload, ready to POST /api/v1/events/:eventId/views. */
export function serializeView(filters: SubmissionsFilterState, visibleFieldIds: ReadonlySet<string>): SavedViewConfig {
  return {
    q: filters.q,
    status: filters.status,
    trackId: filters.trackId,
    sort: filters.sort,
    columns: [...visibleFieldIds],
  };
}

/** Applies a saved view's config to produce a fresh filter state (page reset
 * to 1) + visible column id set — the inverse of serializeView. */
export function applyViewConfig(config: SavedViewConfig): { filters: SubmissionsFilterState; visibleFieldIds: Set<string> } {
  // sort is validated server-side against SORT_ORDERS on save
  // (isValidSavedViewConfig); trusted here.
  const filters: SubmissionsFilterState = {
    ...DEFAULT_FILTER_STATE,
    page: 1,
    q: config.q,
    status: config.status as SubmissionStatus[],
    trackId: config.trackId,
    sort: config.sort as SortOrder,
    includeAnswers: true,
  };

  return { filters, visibleFieldIds: new Set(config.columns) };
}
