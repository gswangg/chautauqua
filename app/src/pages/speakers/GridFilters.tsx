import {
  INVITE_STATUSES,
  INVITE_STATUS_LABELS,
  type AssignmentStatus,
  type GridFilterState,
  type InviteStatus,
  type OnboardingTask,
} from './types';

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

      {/* DEC-861: filters.inviteStatus is a single nullable value -- it has
          always been a mutually-exclusive choice, never a composable set,
          so it renders as one select (like "Any task status" above it),
          not four independently-pressable pills. */}
      <select
        className="chq-select"
        aria-label="Any participation"
        value={filters.inviteStatus ?? ''}
        onChange={(e) =>
          onChange({ ...filters, inviteStatus: e.target.value === '' ? null : (e.target.value as InviteStatus) })
        }
      >
        <option value="">Any participation</option>
        {INVITE_STATUSES.map((status) => (
          <option key={status} value={status}>
            {INVITE_STATUS_LABELS[status]}
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
    </div>
  );
}
