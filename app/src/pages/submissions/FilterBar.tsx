import type { ColumnDef } from './columns';
import { ColumnPicker } from './ColumnPicker';
import { SORT_ORDERS, STATUS_LABELS, SUBMISSION_STATUSES, type SortOrder, type SubmissionsFilterState, type SubmissionStatus, type Track } from './types';

interface FilterBarSearchSortProps {
  filters: SubmissionsFilterState;
  onChange: (next: SubmissionsFilterState) => void;
}

/** Row 1 of the mock (docs/design/Chautauqua Submissions.dc.html:59-64):
 * search + sort, pushed right by the caller alongside the ViewTabs row. */
export function FilterBarSearchSort({ filters, onChange }: FilterBarSearchSortProps) {
  return (
    <div className="chq-submissions-filterbar-searchsort">
      <input
        type="search"
        className="chq-input chq-submissions-filterbar-search"
        aria-label="Search submissions"
        placeholder="Search title or speaker…"
        value={filters.q}
        onChange={(e) => onChange({ ...filters, q: e.target.value, page: 1 })}
      />

      <select
        className="chq-select chq-submissions-filterbar-select"
        aria-label="Sort"
        value={filters.sort}
        onChange={(e) => onChange({ ...filters, sort: e.target.value as SortOrder, page: 1 })}
      >
        {SORT_ORDERS.map((sort) => (
          <option key={sort} value={sort}>
            {sortLabel(sort)}
          </option>
        ))}
      </select>
    </div>
  );
}

interface FilterBarProps {
  filters: SubmissionsFilterState;
  tracks: Track[];
  columns: ColumnDef[];
  visibleFieldIds: ReadonlySet<string>;
  onChange: (next: SubmissionsFilterState) => void;
  onToggleColumn: (fieldId: string) => void;
}

/** Row 2 of the mock (docs/design/Chautauqua Submissions.dc.html:75-83): a
 * STATUS caption + status pills + a hairline divider + the track select + the
 * column picker on the same row. */
export function FilterBar({ filters, tracks, columns, visibleFieldIds, onChange, onToggleColumn }: FilterBarProps) {
  function toggleStatus(status: SubmissionStatus) {
    const has = filters.status.includes(status);
    const nextStatus = has ? filters.status.filter((s) => s !== status) : [...filters.status, status];
    onChange({ ...filters, status: nextStatus, page: 1 });
  }

  return (
    <div className="chq-submissions-filterbar">
      <span className="chq-submissions-status-label">Status</span>

      <div className="chq-status-pills" role="group" aria-label="Filter by status">
        {SUBMISSION_STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            className={filters.status.includes(status) ? 'chq-pill is-active' : 'chq-pill'}
            aria-pressed={filters.status.includes(status)}
            onClick={() => toggleStatus(status)}
          >
            {STATUS_LABELS[status]}
          </button>
        ))}
      </div>

      <span className="chq-submissions-filterbar-divider" aria-hidden="true" />

      <select
        className="chq-select chq-submissions-filterbar-select"
        aria-label="Filter by track"
        value={filters.trackId ?? ''}
        onChange={(e) => onChange({ ...filters, trackId: e.target.value === '' ? null : e.target.value, page: 1 })}
      >
        <option value="">All tracks</option>
        {tracks.map((track) => (
          <option key={track.id} value={track.id}>
            {track.name}
          </option>
        ))}
      </select>

      <ColumnPicker columns={columns} visibleFieldIds={visibleFieldIds} onToggle={onToggleColumn} />
    </div>
  );
}

export function sortLabel(sort: SortOrder): string {
  switch (sort) {
    case 'newest':
      return 'Newest first';
    case 'oldest':
      return 'Oldest first';
    case 'title':
      return 'Title A-Z';
    case 'ref':
      return 'Reference #';
  }
}
