import { describe, expect, it } from 'vitest';
import { filterByContentStatus, sortForWorklist } from './worklist';
import type { ContentSubmissionListItem } from './types';

function item(overrides: Partial<ContentSubmissionListItem> = {}): ContentSubmissionListItem {
  return {
    id: 's1',
    ref: 'S-1',
    title: 'A talk',
    contentStatus: 'pending',
    speakers: [],
    ...overrides,
  };
}

describe('sortForWorklist', () => {
  it('surfaces changes_requested first, then pending, then approved', () => {
    const items = [
      item({ id: 'a', title: 'Approved talk', contentStatus: 'approved' }),
      item({ id: 'p', title: 'Pending talk', contentStatus: 'pending' }),
      item({ id: 'c', title: 'Changes talk', contentStatus: 'changes_requested' }),
    ];
    expect(sortForWorklist(items).map((i) => i.id)).toEqual(['c', 'p', 'a']);
  });

  it('breaks ties alphabetically by title', () => {
    const items = [
      item({ id: 'b', title: 'Bravo', contentStatus: 'pending' }),
      item({ id: 'a', title: 'Alpha', contentStatus: 'pending' }),
    ];
    expect(sortForWorklist(items).map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('does not mutate the input array', () => {
    const items = [item({ id: 'a', contentStatus: 'approved' }), item({ id: 'b', contentStatus: 'pending' })];
    const copy = [...items];
    sortForWorklist(items);
    expect(items).toEqual(copy);
  });
});

describe('filterByContentStatus', () => {
  const items = [
    item({ id: 'a', contentStatus: 'approved' }),
    item({ id: 'p', contentStatus: 'pending' }),
    item({ id: 'c', contentStatus: 'changes_requested' }),
  ];

  it('returns everything for the all tab', () => {
    expect(filterByContentStatus(items, 'all')).toHaveLength(3);
  });

  it('filters to a single content status', () => {
    expect(filterByContentStatus(items, 'pending').map((i) => i.id)).toEqual(['p']);
  });
});
