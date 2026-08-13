import { describe, expect, it } from 'vitest';
import { daysLate, isCellOverdue } from './overdue';
import type { OnboardingTask } from './types';

const NOW = 1_000_000;
const DAY = 24 * 60 * 60 * 1000;

function task(overrides: Partial<OnboardingTask> = {}): OnboardingTask {
  return { id: 't1', kind: 'general', title: 'W-9', dueDate: null, required: true, ...overrides };
}

describe('isCellOverdue', () => {
  it('is false when the task has no due date', () => {
    expect(isCellOverdue({ taskId: 't1', assignmentId: 'a1', status: 'pending', completedAt: null, fileId: null, fileName: null, fileSizeBytes: null, lastRemindedAt: null, assignedAt: 0 }, task({ dueDate: null }), NOW)).toBe(false);
  });

  it('is false when the assignment is complete, even if past due', () => {
    expect(
      isCellOverdue(
        { taskId: 't1', assignmentId: 'a1', status: 'complete', completedAt: NOW - 1, fileId: null, fileName: null, fileSizeBytes: null, lastRemindedAt: null, assignedAt: 0 },
        task({ dueDate: NOW - 100 }),
        NOW,
      ),
    ).toBe(false);
  });

  it('is true when pending and due date is past', () => {
    expect(
      isCellOverdue(
        { taskId: 't1', assignmentId: 'a1', status: 'pending', completedAt: null, fileId: null, fileName: null, fileSizeBytes: null, lastRemindedAt: null, assignedAt: 0 },
        task({ dueDate: NOW - 100 }),
        NOW,
      ),
    ).toBe(true);
  });

  it('is false when pending but due date is in the future', () => {
    expect(
      isCellOverdue(
        { taskId: 't1', assignmentId: 'a1', status: 'pending', completedAt: null, fileId: null, fileName: null, fileSizeBytes: null, lastRemindedAt: null, assignedAt: 0 },
        task({ dueDate: NOW + 100 }),
        NOW,
      ),
    ).toBe(false);
  });

  it('is false for an unknown task', () => {
    expect(
      isCellOverdue({ taskId: 'missing', assignmentId: 'a1', status: 'pending', completedAt: null, fileId: null, fileName: null, fileSizeBytes: null, lastRemindedAt: null, assignedAt: 0 }, undefined, NOW),
    ).toBe(false);
  });

  // DEC-801: a task cannot be late before it was assigned -- the assignment
  // was created AFTER the task's own due date, so the effective due date
  // shifts to assignedAt + the 7-day grace window.
  it('is false when the task due date predates assignment, within the grace window', () => {
    const assignedAt = NOW - DAY;
    expect(
      isCellOverdue(
        { taskId: 't1', assignmentId: 'a1', status: 'pending', completedAt: null, fileId: null, fileName: null, fileSizeBytes: null, lastRemindedAt: null, assignedAt },
        task({ dueDate: assignedAt - 5 * DAY }),
        NOW,
      ),
    ).toBe(false);
  });

  it('is true once the grace window from assignment has elapsed', () => {
    const assignedAt = NOW - 8 * DAY;
    expect(
      isCellOverdue(
        { taskId: 't1', assignmentId: 'a1', status: 'pending', completedAt: null, fileId: null, fileName: null, fileSizeBytes: null, lastRemindedAt: null, assignedAt },
        task({ dueDate: assignedAt - 5 * DAY }),
        NOW,
      ),
    ).toBe(true);
  });
});

describe('daysLate', () => {
  it('floors at 1 day for anything less than a full day late', () => {
    expect(daysLate(NOW - 1, NOW)).toBe(1);
    expect(daysLate(NOW - DAY + 1, NOW)).toBe(1);
  });

  it('returns whole days late for multi-day lateness', () => {
    expect(daysLate(NOW - 3 * DAY, NOW)).toBe(3);
    expect(daysLate(NOW - 3 * DAY - 1, NOW)).toBe(3);
  });
});
