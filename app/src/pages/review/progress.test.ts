import { describe, expect, it } from 'vitest';
import { overallCompletion, progressTotals, queueDoneCounts, reviewerDisplayLabel, reviewersNotStarted, reviewersWithIncompleteQueues } from './progress';
import type { ProgressRow } from './types';

const rows: ProgressRow[] = [
  { userId: 'u1', email: 'a@example.com', name: 'Alice A', assigned: 10, completed: 10, recused: 0, trackName: 'AI Engineering' },
  { userId: 'u2', email: 'b@example.com', name: null, assigned: 8, completed: 3, recused: 1, trackName: null },
  { userId: 'u3', email: 'c@example.com', name: null, assigned: 0, completed: 0, recused: 0, trackName: null },
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
    expect(reviewersNotStarted([...rows, { userId: 'u4', email: 'd@example.com', name: null, assigned: 5, completed: 0, recused: 0, trackName: null }]).map((r) => r.userId)).toEqual(['u4']);
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
    expect(overallCompletion([{ userId: 'u3', email: 'c@example.com', name: null, assigned: 0, completed: 0, recused: 0, trackName: null }])).toBe(0);
  });
});

describe('progressTotals', () => {
  it('sums completed and assigned across all reviewers (never a plan count)', () => {
    expect(progressTotals(rows)).toEqual({ completed: 13, assigned: 18 });
  });

  it('is {0, 0} for an empty reviewer list', () => {
    expect(progressTotals([])).toEqual({ completed: 0, assigned: 0 });
  });

  // w5-f: the '37 of 34 evaluations in' regression -- PlanList's inline
  // "N of M evaluations in" caption sums completed/assigned straight off
  // the SAME per-row fields the server's /plans/:id/progress route already
  // clamps to completed <= assigned per reviewer (never a raw per-plan
  // evaluation count against a plan-wide assigned total). A reviewer whose
  // evaluations reach outside their own assigned set for this plan/round
  // (server-side, never counted into `completed` -- see
  // test/review-progress-counts.test.ts) must never push the aggregate
  // numerator past the aggregate denominator.
  it('never lets the aggregate completed exceed the aggregate assigned, even when a reviewer has evaluations outside the plan/round scope', () => {
    // rev-1's server-reported row already excludes the out-of-scope/recused
    // evaluations (that clamp happens server-side); the SPA-level invariant
    // this test pins is that summing those already-honest per-row numbers
    // can never itself introduce completed > assigned.
    const rowsWithOutOfScopeReviewer: ProgressRow[] = [
      ...rows,
      // A reviewer whose raw evaluation count (including evaluations on a
      // recused submission and one outside this plan's filtered scope)
      // would be 3, but whose honest assigned/completed pair is 2/1.
      { userId: 'u5', email: 'e@example.com', name: null, assigned: 2, completed: 1, recused: 1, trackName: 'Platform & Infra' },
    ];
    const totals = progressTotals(rowsWithOutOfScopeReviewer);
    expect(totals.completed).toBeLessThanOrEqual(totals.assigned);
    expect(totals).toEqual({ completed: 14, assigned: 20 });
  });
});

describe('queueDoneCounts', () => {
  // w40-b: the scorecard header's counter must reflect the envelope's own
  // total/unscoredTotal (computed server-side over the FULL scope before
  // any page slice), never items.length/filter -- a reviewer with more
  // assignments than the queue endpoint's perPage cap would otherwise see a
  // shrunken "N of N" derived from whatever page happened to load.
  it('derives completed/total from the envelope, not the loaded page of items', () => {
    expect(queueDoneCounts({ total: 250, unscoredTotal: 3 })).toEqual({ completed: 247, total: 250 });
  });

  it('is {0, 0} for an empty envelope', () => {
    expect(queueDoneCounts({ total: 0, unscoredTotal: 0 })).toEqual({ completed: 0, total: 0 });
  });
});
