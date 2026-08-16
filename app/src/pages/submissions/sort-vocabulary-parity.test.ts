import { describe, expect, it } from 'vitest';
import { SORT_ORDERS as DOMAIN_SORT_ORDERS, type SortOrder } from '../../../../src/domain/submission-sort';
import { SORT_ORDERS } from './types';
import { PICKABLE_SORT_ORDERS, sortLabel } from './FilterBar';

describe('submission sort vocabulary parity (DEC-613 wave-68 amendment)', () => {
  it('the app types re-export equals the domain set member-for-member', () => {
    expect([...SORT_ORDERS]).toEqual([...DOMAIN_SORT_ORDERS]);
  });

  it('worklist is a real member of the shared vocabulary', () => {
    expect(SORT_ORDERS).toContain('worklist');
  });

  it('PICKABLE_SORT_ORDERS is a strict subset of the full vocabulary', () => {
    for (const sort of PICKABLE_SORT_ORDERS) {
      expect(SORT_ORDERS).toContain(sort);
    }
    expect(PICKABLE_SORT_ORDERS.length).toBeLessThan(SORT_ORDERS.length);
    // 'worklist' is deliberately excluded from the pickable subset.
    expect(PICKABLE_SORT_ORDERS).not.toContain('worklist');
  });

  it('sortLabel is total over the full SortOrder set, including worklist', () => {
    const labels = new Set<string>();
    for (const sort of SORT_ORDERS as readonly SortOrder[]) {
      const label = sortLabel(sort);
      expect(label.length).toBeGreaterThan(0);
      expect(labels.has(label)).toBe(false);
      labels.add(label);
    }
    expect(sortLabel('worklist')).toBeTruthy();
  });
});
