import { describe, expect, it } from 'vitest';
import { activeFacet } from './narrowing';
import { DEFAULT_GRID_FILTERS, type GridFilterState } from './types';

function filters(overrides: Partial<GridFilterState>): GridFilterState {
  return { ...DEFAULT_GRID_FILTERS, ...overrides };
}

describe('activeFacet', () => {
  it('returns null when zero facets are active', () => {
    expect(activeFacet(filters({}))).toBeNull();
  });

  it('returns null when two-plus facets are active (never guesses)', () => {
    expect(activeFacet(filters({ q: 'okafor', overdueOnly: true }))).toBeNull();
  });

  it('resolves the search facet, echoing the typed string verbatim', () => {
    const facet = activeFacet(filters({ q: '  Marcus Okafor  ' }));
    expect(facet).not.toBeNull();
    expect(facet!.key).toBe('q');
    expect(facet!.reason('Marcus Okafor')).toBe('No speakers match "Marcus Okafor".');
    expect(facet!.escapeLabel).toBe('Clear the search filter ›');
    expect(facet!.clear(filters({ q: 'Marcus Okafor', overdueOnly: true }))).toEqual(
      filters({ q: '', overdueOnly: true }),
    );
  });

  it('resolves the taskId facet', () => {
    const facet = activeFacet(filters({ taskId: 'task-1' }));
    expect(facet).not.toBeNull();
    expect(facet!.key).toBe('taskId');
    expect(facet!.reason(null)).toBe('No speakers are assigned the selected task.');
    expect(facet!.escapeLabel).toBe('Clear the task filter ›');
    expect(facet!.clear(filters({ taskId: 'task-1' }))).toEqual(filters({ taskId: null }));
  });

  it('resolves the status facet', () => {
    const facet = activeFacet(filters({ status: 'complete' }));
    expect(facet).not.toBeNull();
    expect(facet!.key).toBe('status');
    expect(facet!.reason(null)).toBe('No speakers have a task in the selected status.');
    expect(facet!.escapeLabel).toBe('Clear the status filter ›');
    expect(facet!.clear(filters({ status: 'complete' }))).toEqual(filters({ status: null }));
  });

  it('resolves the overdueOnly facet -- matches the frame\'s escape copy', () => {
    const facet = activeFacet(filters({ overdueOnly: true }));
    expect(facet).not.toBeNull();
    expect(facet!.key).toBe('overdueOnly');
    expect(facet!.reason(null)).toBe(
      'No speakers have anything overdue. Clearing "Overdue only" finds the rest.',
    );
    expect(facet!.escapeLabel).toBe('Clear the overdue filter ›');
    expect(facet!.clear(filters({ overdueOnly: true }))).toEqual(filters({ overdueOnly: false }));
  });

  it('resolves the inviteStatus facet, reading the shared label vocabulary', () => {
    const facet = activeFacet(filters({ inviteStatus: 'invited' }));
    expect(facet).not.toBeNull();
    expect(facet!.key).toBe('inviteStatus');
    expect(facet!.reason(null)).toContain('invited');
    expect(facet!.escapeLabel).toBe('Clear the participation filter ›');
    expect(facet!.clear(filters({ inviteStatus: 'invited' }))).toEqual(filters({ inviteStatus: null }));
  });
});
