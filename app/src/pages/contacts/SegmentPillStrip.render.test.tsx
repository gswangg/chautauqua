// SegmentPillStrip render coverage (task r1-c, src/decisions-data/DEC-919.md): the
// Contacts 390 landing head's second strip -- the saved-segment filter
// re-lined as All / `name · count` pills. Counts are handed in, never
// recomputed (DEC-710); the segment population only asserts absence once
// `segmentsLoaded` settles (DEC-678).
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { SegmentPillStrip } from './SegmentPillStrip';
import type { Segment } from './types';

afterEach(() => {
  cleanup();
});

const SEGMENTS: Segment[] = [
  { id: 'seg1', name: 'Speakers', rules: [{ field: 'role', op: 'eq', value: 'speaker' }], count: 41 },
  { id: 'seg2', name: 'Reviewers', rules: [{ field: 'role', op: 'eq', value: 'reviewer' }], count: 6 },
];

function renderStrip(overrides: Partial<ComponentProps<typeof SegmentPillStrip>> = {}) {
  return render(
    <SegmentPillStrip
      segments={SEGMENTS}
      segmentsLoaded
      segmentId=""
      onApplySegment={vi.fn()}
      {...overrides}
    />,
  );
}

describe('SegmentPillStrip', () => {
  it('before settle, renders only the All pill', () => {
    renderStrip({ segmentsLoaded: false, segments: [] });
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.queryByText('Speakers · 41')).not.toBeInTheDocument();
    expect(screen.queryByText('Reviewers · 6')).not.toBeInTheDocument();
  });

  it('after settle, renders All plus one pill per segment labelled `name · count`', () => {
    renderStrip();
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Speakers · 41')).toBeInTheDocument();
    expect(screen.getByText('Reviewers · 6')).toBeInTheDocument();
  });

  it('All is pressed when segmentId is empty', () => {
    renderStrip({ segmentId: '' });
    expect(screen.getByText('All')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Speakers · 41')).toHaveAttribute('aria-pressed', 'false');
  });

  it('the applied segment pill is pressed, not All', () => {
    renderStrip({ segmentId: 'seg2' });
    expect(screen.getByText('All')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Reviewers · 6')).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking a segment pill calls onApplySegment with that id', () => {
    const onApplySegment = vi.fn();
    renderStrip({ onApplySegment });
    screen.getByText('Speakers · 41').click();
    expect(onApplySegment).toHaveBeenCalledWith('seg1');
  });

  it('clicking All calls onApplySegment with the empty string', () => {
    const onApplySegment = vi.fn();
    renderStrip({ segmentId: 'seg1', onApplySegment });
    screen.getByText('All').click();
    expect(onApplySegment).toHaveBeenCalledWith('');
  });

  // src/decisions-data/DEC-930.md (amendment): the strip is a named group --
  // it draws no caption of its own, so it takes an aria-label -- and its
  // pills remain reachable by their own button roles inside it.
  it('is a named group, with its pills still reachable by their own roles', () => {
    renderStrip();
    const group = screen.getByRole('group', { name: 'Filter by saved segment' });
    expect(group).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: 'All', pressed: true })).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: 'Speakers · 41' })).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: 'Reviewers · 6' })).toBeInTheDocument();
  });
});
