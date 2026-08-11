import { describe, expect, it } from 'vitest';
import { overallCompletion, reviewersWithIncompleteQueues } from './progress';
import type { ProgressRow } from './types';

const rows: ProgressRow[] = [
  { userId: 'u1', email: 'a@example.com', assigned: 10, completed: 10, recused: 0 },
  { userId: 'u2', email: 'b@example.com', assigned: 8, completed: 3, recused: 1 },
  { userId: 'u3', email: 'c@example.com', assigned: 0, completed: 0, recused: 0 },
];

describe('reviewersWithIncompleteQueues', () => {
  it('returns only reviewers with completed < assigned', () => {
    expect(reviewersWithIncompleteQueues(rows).map((r) => r.userId)).toEqual(['u2']);
  });

  it('returns an empty list when everyone is caught up', () => {
    expect(reviewersWithIncompleteQueues([rows[0]!])).toEqual([]);
  });
});

describe('overallCompletion', () => {
  it('computes completed/assigned across all reviewers', () => {
    expect(overallCompletion(rows)).toBeCloseTo(13 / 18);
  });

  it('is 0 when nobody is assigned', () => {
    expect(overallCompletion([])).toBe(0);
    expect(overallCompletion([{ userId: 'u3', email: 'c@example.com', assigned: 0, completed: 0, recused: 0 }])).toBe(0);
  });
});
