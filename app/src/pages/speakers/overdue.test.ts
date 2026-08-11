import { describe, expect, it } from 'vitest';
import { isCellOverdue } from './overdue';
import type { OnboardingTask } from './types';

const NOW = 1_000_000;

function task(overrides: Partial<OnboardingTask> = {}): OnboardingTask {
  return { id: 't1', kind: 'general', title: 'W-9', dueDate: null, required: true, ...overrides };
}

describe('isCellOverdue', () => {
  it('is false when the task has no due date', () => {
    expect(isCellOverdue({ taskId: 't1', assignmentId: 'a1', status: 'pending', completedAt: null, fileId: null, lastRemindedAt: null }, task({ dueDate: null }), NOW)).toBe(false);
  });

  it('is false when the assignment is complete, even if past due', () => {
    expect(
      isCellOverdue(
        { taskId: 't1', assignmentId: 'a1', status: 'complete', completedAt: NOW - 1, fileId: null, lastRemindedAt: null },
        task({ dueDate: NOW - 100 }),
        NOW,
      ),
    ).toBe(false);
  });

  it('is true when pending and due date is past', () => {
    expect(
      isCellOverdue(
        { taskId: 't1', assignmentId: 'a1', status: 'pending', completedAt: null, fileId: null, lastRemindedAt: null },
        task({ dueDate: NOW - 100 }),
        NOW,
      ),
    ).toBe(true);
  });

  it('is false when pending but due date is in the future', () => {
    expect(
      isCellOverdue(
        { taskId: 't1', assignmentId: 'a1', status: 'pending', completedAt: null, fileId: null, lastRemindedAt: null },
        task({ dueDate: NOW + 100 }),
        NOW,
      ),
    ).toBe(false);
  });

  it('is false for an unknown task', () => {
    expect(
      isCellOverdue({ taskId: 'missing', assignmentId: 'a1', status: 'pending', completedAt: null, fileId: null, lastRemindedAt: null }, undefined, NOW),
    ).toBe(false);
  });
});
