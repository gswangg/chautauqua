import { SORT_ORDERS, STATUS_LABELS, SUBMISSION_STATUSES, type SortOrder, type SubmissionsFilterState, type SubmissionStatus, type Track } from './types';

interface FilterBarProps {
  filters: SubmissionsFilterState;
  tracks: Track[];
  onChange: (next: SubmissionsFilterState) => void;
}

export function FilterBar({ filters, tracks, onChange }: FilterBarProps) {
  function toggleStatus(status: SubmissionStatus) {
    const has = filters.status.includes(status);
    const nextStatus = has ? filters.status.filter((s) => s !== status) : [...filters.status, status];
    onChange({ ...filters, status: nextStatus, page: 1 });
  }

  return (
    <div className="chq-submissions-filterbar">
      <input
        type="search"
        aria-label="Search submissions"
        placeholder="Search title or speaker..."
        value={filters.q}
        onChange={(e) => onChange({ ...filters, q: e.target.value, page: 1 })}
      />

      <div className="chq-status-pills" role="group" aria-label="Filter by status">
        {SUBMISSION_STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            className={filters.status.includes(status) ? 'chq-pill active' : 'chq-pill'}
            aria-pressed={filters.status.includes(status)}
            onClick={() => toggleStatus(status)}
          >
            {STATUS_LABELS[status]}
          </button>
        ))}
      </div>

      <select
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

      <select
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

function sortLabel(sort: SortOrder): string {
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
