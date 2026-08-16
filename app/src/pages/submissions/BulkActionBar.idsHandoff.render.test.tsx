// task-w51-e item 1 (falsifiability batch B, DEC-358 wave-51): the
// Submissions -> Comms handoff link (BulkActionBar.tsx:77) must carry the
// selection's own STABLE order into the query string, never re-sort it --
// a caller (ComposeWizard) trusts the order it receives. This file is
// new/co-located coverage focused specifically on order preservation and
// exactness of the produced href, which the existing
// BulkActionBar.render.test.tsx does not assert (its fixtures happen to
// already be in ascending order, so a silent `.sort()` regression would not
// fail it).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { BulkActionBar } from './BulkActionBar';

afterEach(() => {
  cleanup();
});

describe('BulkActionBar ids handoff (task-w51-e item 1)', () => {
  it('carries the selection in its OWN order (not sorted) into the ?ids= query string', () => {
    // Deliberately out-of-alphabetical, out-of-numeric order -- if the
    // component ever sorted or otherwise reordered selectedIds before
    // joining, this href would come out different from the input order.
    const outOfOrderIds = ['zeta-3', 'alpha-1', 'mu-2'];

    render(
      <MemoryRouter>
        <BulkActionBar
          selectedCount={outOfOrderIds.length}
          pending={false}
          statusFilter={null}
          onApply={vi.fn()}
          onClear={vi.fn()}
          selectedIds={outOfOrderIds}
        />
      </MemoryRouter>,
    );

    const link = screen.getByRole('link', { name: /Email these 3 submissions/ });
    expect(link).toHaveAttribute('href', '/comms?tab=compose&ids=zeta-3,alpha-1,mu-2');
  });

  it('reflects a changed selection (different ids, different order) on re-render, never a stale first-render href', () => {
    const { rerender } = render(
      <MemoryRouter>
        <BulkActionBar
          selectedCount={2}
          pending={false}
          statusFilter={null}
          onApply={vi.fn()}
          onClear={vi.fn()}
          selectedIds={['a', 'b']}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /Email these 2 submissions/ })).toHaveAttribute(
      'href',
      '/comms?tab=compose&ids=a,b',
    );

    rerender(
      <MemoryRouter>
        <BulkActionBar
          selectedCount={3}
          pending={false}
          statusFilter="accept_queue"
          onApply={vi.fn()}
          onClear={vi.fn()}
          selectedIds={['c', 'b', 'd']}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /Email these 3 submissions/ })).toHaveAttribute(
      'href',
      '/comms?tab=compose&ids=c,b,d',
    );
  });
});
