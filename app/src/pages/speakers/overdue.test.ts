import { describe, expect, it } from 'vitest';
import { computeOnboardingCounts, isCellOverdue, outstandingContactCount } from './overdue';
import type { OnboardingGridResponse, OnboardingTask } from './types';

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

function grid(): OnboardingGridResponse {
  return {
    tasks: [
      { id: 't1', kind: 'general', title: 'W-9', dueDate: NOW - 100, required: true },
      { id: 't2', kind: 'file_request', title: 'Headshot', dueDate: NOW + 100, required: false },
    ],
    rows: [
      {
        contact: { id: 'c1', name: 'Ada', email: 'ada@example.com', company: null, hasAccount: true },
        cells: [
          { taskId: 't1', assignmentId: 'a1', status: 'pending', completedAt: null, fileId: null, lastRemindedAt: null },
          { taskId: 't2', assignmentId: 'a2', status: 'complete', completedAt: NOW - 1, fileId: 'f1', lastRemindedAt: null },
        ],
      },
      {
        contact: { id: 'c2', name: 'Grace', email: 'grace@example.com', company: 'Acme', hasAccount: false },
        cells: [
          { taskId: 't1', assignmentId: 'a3', status: 'complete', completedAt: NOW - 1, fileId: null, lastRemindedAt: null },
          { taskId: 't2', assignmentId: 'a4', status: 'pending', completedAt: null, fileId: null, lastRemindedAt: null },
        ],
      },
    ],
  };
}

describe('computeOnboardingCounts', () => {
  it('counts speakers, outstanding required assignments, and overdue assignments', () => {
    const counts = computeOnboardingCounts(grid(), NOW);
    expect(counts.speakers).toBe(2);
    // Only c1's t1 assignment is required + not complete.
    expect(counts.outstandingRequired).toBe(1);
    // Only c1's t1 assignment is overdue (past due + not complete).
    expect(counts.overdue).toBe(1);
  });
});

describe('outstandingContactCount', () => {
  it('counts distinct contacts with any incomplete assignment', () => {
    // c1 has t1 pending; c2 has t2 pending -> both count.
    expect(outstandingContactCount(grid())).toBe(2);
  });

  it('scopes to the given task ids when provided', () => {
    // Only c1 has an incomplete assignment for t1.
    expect(outstandingContactCount(grid(), ['t1'])).toBe(1);
  });
});
