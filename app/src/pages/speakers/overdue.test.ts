import { describe, expect, it } from 'vitest';
import { isCellOverdue } from './overdue';
import type { OnboardingTask } from './types';

const NOW = Date.UTC(2024, 0, 20, 12, 0, 0);
const DAY = 24 * 60 * 60 * 1000;
const UTC = 'UTC';

function task(overrides: Partial<OnboardingTask> = {}): OnboardingTask {
  return { id: 't1', kind: 'general', title: 'W-9', dueDate: null, required: true, ...overrides };
}

describe('isCellOverdue', () => {
  it('is false when the task has no due date', () => {
    expect(
      isCellOverdue(
        { taskId: 't1', assignmentId: 'a1', status: 'pending', completedAt: null, fileId: null, fileName: null, assignedAt: 0 },
        task({ dueDate: null }),
        NOW,
        UTC,
      ),
    ).toBe(false);
  });

  it('is false when the assignment is complete, even if past due', () => {
    expect(
      isCellOverdue(
        { taskId: 't1', assignmentId: 'a1', status: 'complete', completedAt: NOW - 1, fileId: null, fileName: null, assignedAt: 0 },
        task({ dueDate: NOW - 100 }),
        NOW,
        UTC,
      ),
    ).toBe(false);
  });

  it('is true when pending and the due day has fully elapsed', () => {
    expect(
      isCellOverdue(
        { taskId: 't1', assignmentId: 'a1', status: 'pending', completedAt: null, fileId: null, fileName: null, assignedAt: 0 },
        task({ dueDate: Date.UTC(2024, 0, 15) }),
        NOW,
        UTC,
      ),
    ).toBe(true);
  });

  it('is false when pending but due date is in the future', () => {
    expect(
      isCellOverdue(
        { taskId: 't1', assignmentId: 'a1', status: 'pending', completedAt: null, fileId: null, fileName: null, assignedAt: 0 },
        task({ dueDate: NOW + 100 }),
        NOW,
        UTC,
      ),
    ).toBe(false);
  });

  it('is false for an unknown task', () => {
    expect(
      isCellOverdue(
        { taskId: 'missing', assignmentId: 'a1', status: 'pending', completedAt: null, fileId: null, fileName: null, assignedAt: 0 },
        undefined,
        NOW,
        UTC,
      ),
    ).toBe(false);
  });

  // DEC-801: a task cannot be late before it was assigned -- the assignment
  // was created AFTER the task's own due date, so the effective due date
  // shifts to assignedAt + the 7-day grace window.
  it('is false when the task due date predates assignment, within the grace window', () => {
    const assignedAt = NOW - DAY;
    expect(
      isCellOverdue(
        { taskId: 't1', assignmentId: 'a1', status: 'pending', completedAt: null, fileId: null, fileName: null, assignedAt },
        task({ dueDate: assignedAt - 5 * DAY }),
        NOW,
        UTC,
      ),
    ).toBe(false);
  });

  it('is true once the grace window from assignment has elapsed', () => {
    const assignedAt = NOW - 8 * DAY;
    expect(
      isCellOverdue(
        { taskId: 't1', assignmentId: 'a1', status: 'pending', completedAt: null, fileId: null, fileName: null, assignedAt },
        task({ dueDate: assignedAt - 5 * DAY }),
        NOW,
        UTC,
      ),
    ).toBe(true);
  });

  // DEC-801 (wave 58 amendment): task.dueDate is a UTC-midnight day label,
  // not an instant. A raw `dueDate < now` compare flags a task overdue as
  // soon as UTC midnight of the due day passes, hours before that calendar
  // day has actually elapsed in the event's own (non-UTC) timezone. Here the
  // due day is 16 Jan (day label = Jan 16 00:00 UTC); `now` is later that
  // same UTC day (Jan 16 18:00 UTC) -- the old raw compare already says
  // overdue (dueDate < now), but for a Los Angeles event the calendar day
  // 16 Jan doesn't end locally until Jan 17 08:00 UTC (PST, UTC-8), so the
  // correct rule says not yet.
  it('is false in a non-UTC event timezone before the due day has locally elapsed, even though the raw UTC compare already flags overdue', () => {
    const dueDate = Date.UTC(2024, 0, 16); // day label for "16 Jan"
    const assignedAt = Date.UTC(2024, 0, 1);
    const laterSameUtcDay = Date.UTC(2024, 0, 16, 18, 0, 0);
    expect(dueDate < laterSameUtcDay).toBe(true); // the old raw compare's verdict
    expect(
      isCellOverdue(
        { taskId: 't1', assignmentId: 'a1', status: 'pending', completedAt: null, fileId: null, fileName: null, assignedAt },
        task({ dueDate }),
        laterSameUtcDay,
        'America/Los_Angeles',
      ),
    ).toBe(false);
  });

  it('is true in the same non-UTC event timezone once the due day has locally elapsed', () => {
    const dueDate = Date.UTC(2024, 0, 16);
    const assignedAt = Date.UTC(2024, 0, 1);
    const afterLocalDayEnds = Date.UTC(2024, 0, 17, 9, 0, 0); // past 08:00 UTC PST rollover
    expect(
      isCellOverdue(
        { taskId: 't1', assignmentId: 'a1', status: 'pending', completedAt: null, fileId: null, fileName: null, assignedAt },
        task({ dueDate }),
        afterLocalDayEnds,
        'America/Los_Angeles',
      ),
    ).toBe(true);
  });
});
