import { INVITE_STATUSES, INVITE_STATUS_LABELS, type AssignmentStatus, type GridFilterState, type OnboardingTask } from './types';

interface GridFiltersProps {
  tasks: OnboardingTask[];
  filters: GridFilterState;
  onChange: (next: GridFilterState) => void;
}

const STATUS_OPTIONS: AssignmentStatus[] = ['pending', 'complete'];

export function GridFilters({ tasks, filters, onChange }: GridFiltersProps) {
  return (
    <div className="chq-speakers-filters">
      <input
        type="text"
        className="chq-input chq-speakers-filters-search"
        aria-label="Search speakers"
        placeholder="Search speaker or company…"
        value={filters.q}
        onChange={(e) => onChange({ ...filters, q: e.target.value })}
      />

      <select
        className="chq-select"
        aria-label="Filter by task"
        value={filters.taskId ?? ''}
        onChange={(e) => onChange({ ...filters, taskId: e.target.value === '' ? null : e.target.value })}
      >
        <option value="">All tasks</option>
        {tasks.map((task) => (
          <option key={task.id} value={task.id}>
            {task.title}
          </option>
        ))}
      </select>

      {/* Two status axes now share this screen (DEC-830 adds a participation
          menu beside these task cells), so an unqualified "status" is
          ambiguous -- this select scopes itself to task status. */}
      <select
        className="chq-select"
        aria-label="Any task status"
        value={filters.status ?? ''}
        onChange={(e) =>
          onChange({ ...filters, status: e.target.value === '' ? null : (e.target.value as AssignmentStatus) })
        }
      >
        <option value="">Any task status</option>
        {STATUS_OPTIONS.map((status) => (
          <option key={status} value={status}>
            {status === 'complete' ? 'Complete' : 'Pending'}
          </option>
        ))}
      </select>

      <button
        type="button"
        className={`chq-pill${filters.overdueOnly ? ' is-active' : ''}`}
        aria-pressed={filters.overdueOnly}
        onClick={() => onChange({ ...filters, overdueOnly: !filters.overdueOnly })}
      >
        Overdue only
      </button>

      {/* DEC-789: a set, joining the Overdue only pill above -- a click
          composes the invite-status predicate, never replaces the other
          active pills. Clicking the already-active pill clears it. */}
      {INVITE_STATUSES.map((status) => (
        <button
          key={status}
          type="button"
          className={`chq-pill${filters.inviteStatus === status ? ' is-active' : ''}`}
          aria-pressed={filters.inviteStatus === status}
          onClick={() => onChange({ ...filters, inviteStatus: filters.inviteStatus === status ? null : status })}
        >
          {INVITE_STATUS_LABELS[status]}
        </button>
      ))}
    </div>
  );
}
