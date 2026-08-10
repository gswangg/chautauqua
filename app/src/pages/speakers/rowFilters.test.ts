import { describe, expect, it } from 'vitest';
import { filterOnboardingRows } from './rowFilters';
import { DEFAULT_GRID_FILTERS } from './types';
import type { OnboardingGridResponse } from './types';

const NOW = 1_000_000;

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

describe('filterOnboardingRows', () => {
  it('returns every row unfiltered by default', () => {
    expect(filterOnboardingRows(grid(), DEFAULT_GRID_FILTERS, NOW)).toHaveLength(2);
  });

  it('filters by task id', () => {
    const rows = filterOnboardingRows(grid(), { ...DEFAULT_GRID_FILTERS, taskId: 't2' }, NOW);
    expect(rows.map((r) => r.contact.id)).toEqual(['c1', 'c2']);
  });

  it('filters by status', () => {
    const rows = filterOnboardingRows(grid(), { ...DEFAULT_GRID_FILTERS, status: 'complete' }, NOW);
    // c1 has a complete cell (t2); c2 has a complete cell (t1).
    expect(rows.map((r) => r.contact.id).sort()).toEqual(['c1', 'c2']);
  });

  it('filters to overdue-only', () => {
    const rows = filterOnboardingRows(grid(), { ...DEFAULT_GRID_FILTERS, overdueOnly: true }, NOW);
    // Only c1's t1 cell is overdue (past due + pending).
    expect(rows.map((r) => r.contact.id)).toEqual(['c1']);
  });

  it('combines task + status filters on the same cell', () => {
    const rows = filterOnboardingRows(grid(), { ...DEFAULT_GRID_FILTERS, taskId: 't1', status: 'complete' }, NOW);
    // Only c2's t1 cell is complete.
    expect(rows.map((r) => r.contact.id)).toEqual(['c2']);
  });

  it('excludes rows with no cells at all', () => {
    const g = grid();
    g.rows.push({ contact: { id: 'c3', name: 'Empty', email: 'e@x.com', company: null, hasAccount: false }, cells: [] });
    const rows = filterOnboardingRows(g, DEFAULT_GRID_FILTERS, NOW);
    expect(rows.map((r) => r.contact.id)).not.toContain('c3');
  });
});
