import type { AssignmentStatus, GridFilterState, OnboardingTask } from './types';

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

      <select
        className="chq-select"
        aria-label="Filter by status"
        value={filters.status ?? ''}
        onChange={(e) =>
          onChange({ ...filters, status: e.target.value === '' ? null : (e.target.value as AssignmentStatus) })
        }
      >
        <option value="">Any status</option>
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
    </div>
  );
}
