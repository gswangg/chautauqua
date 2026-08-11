import type { AssignmentStatus, GridFilterState, OnboardingTask } from './types';

interface GridFiltersProps {
  tasks: OnboardingTask[];
  filters: GridFilterState;
  onChange: (next: GridFilterState) => void;
}

const STATUS_OPTIONS: AssignmentStatus[] = ['pending', 'complete'];

export function GridFilters({ tasks, filters, onChange }: GridFiltersProps) {
  return (
    <div className="chq-onboarding-filters">
      <label>
        Search
        <input
          type="text"
          aria-label="Search speakers"
          placeholder="Name or email"
          value={filters.q}
          onChange={(e) => onChange({ ...filters, q: e.target.value })}
        />
      </label>

      <label>
        Task
        <select
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
      </label>

      <label>
        Status
        <select
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
      </label>

      <label className="chq-checkbox-label">
        <input
          type="checkbox"
          checked={filters.overdueOnly}
          onChange={(e) => onChange({ ...filters, overdueOnly: e.target.checked })}
        />
        Overdue only
      </label>
    </div>
  );
}
