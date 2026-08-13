import { describe, expect, it } from 'vitest';
import { overallCompletion, progressTotals, reviewerDisplayLabel, reviewersNotStarted, reviewersWithIncompleteQueues } from './progress';
import type { ProgressRow } from './types';

const rows: ProgressRow[] = [
  { userId: 'u1', email: 'a@example.com', name: 'Alice A', assigned: 10, completed: 10, recused: 0 },
  { userId: 'u2', email: 'b@example.com', name: null, assigned: 8, completed: 3, recused: 1 },
  { userId: 'u3', email: 'c@example.com', name: null, assigned: 0, completed: 0, recused: 0 },
];

describe('reviewersWithIncompleteQueues', () => {
  it('returns only reviewers with completed < assigned', () => {
    expect(reviewersWithIncompleteQueues(rows).map((r) => r.userId)).toEqual(['u2']);
  });

  it('returns an empty list when everyone is caught up', () => {
    expect(reviewersWithIncompleteQueues([rows[0]!])).toEqual([]);
  });
});

describe('reviewersNotStarted', () => {
  it('returns only reviewers with completed === 0 and something assigned', () => {
    expect(reviewersNotStarted([...rows, { userId: 'u4', email: 'd@example.com', name: null, assigned: 5, completed: 0, recused: 0 }]).map((r) => r.userId)).toEqual(['u4']);
  });

  it('excludes a reviewer with nothing assigned (reads as done, not not-started)', () => {
    expect(reviewersNotStarted([rows[2]!])).toEqual([]);
  });
});

describe('reviewerDisplayLabel', () => {
  it('prefers the resolved name over the email', () => {
    expect(reviewerDisplayLabel(rows[0]!)).toBe('Alice A');
  });

  it('falls back to the bare email when name is null (never a fabricated name)', () => {
    expect(reviewerDisplayLabel(rows[1]!)).toBe('b@example.com');
  });
});

describe('overallCompletion', () => {
  it('computes completed/assigned across all reviewers', () => {
    expect(overallCompletion(rows)).toBeCloseTo(13 / 18);
  });

  it('is 0 when nobody is assigned', () => {
    expect(overallCompletion([])).toBe(0);
    expect(overallCompletion([{ userId: 'u3', email: 'c@example.com', name: null, assigned: 0, completed: 0, recused: 0 }])).toBe(0);
  });
});

describe('progressTotals', () => {
  it('sums completed and assigned across all reviewers (never a plan count)', () => {
    expect(progressTotals(rows)).toEqual({ completed: 13, assigned: 18 });
  });

  it('is {0, 0} for an empty reviewer list', () => {
    expect(progressTotals([])).toEqual({ completed: 0, assigned: 0 });
  });
});
