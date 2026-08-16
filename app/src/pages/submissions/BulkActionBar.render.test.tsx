// DEC-900 (wave 25 amendment, ruling 8): bulk-deleting submissions is
// unrecoverable and has no eval need -- single-row delete on the detail
// page (its own quiet footer link) is enough, so the bulk bar's
// "Delete..." control is dropped rather than kept alongside it.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { BulkActionBar } from './BulkActionBar';
import { MAX_COMPOSE_RECIPIENTS } from '../../lib/merge-fields';

afterEach(() => {
  cleanup();
});

describe('BulkActionBar', () => {
  it('renders the status-move buttons and Clear, but no Delete control', () => {
    render(
      <MemoryRouter>
        <BulkActionBar
          selectedCount={3}
          pending={false}
          statusFilter={null}
          onApply={vi.fn()}
          onClear={vi.fn()}
          selectedIds={['a', 'b', 'c']}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('toolbar', { name: 'Bulk actions' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Move to accept queue' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument();

    // No "Delete" control of any kind exists in the bulk bar.
    expect(screen.queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Delete/)).not.toBeInTheDocument();
  });

  // w8-b: DECIDE -> NOTIFY handoff. The bar's "Email these N submissions"
  // link carries the decided selection straight into Comms rather than
  // asking the organizer to re-select the same rows.
  it('links "Email these N submissions" to /comms?tab=compose&ids=<selection>', () => {
    render(
      <MemoryRouter>
        <BulkActionBar
          selectedCount={2}
          pending={false}
          statusFilter={null}
          onApply={vi.fn()}
          onClear={vi.fn()}
          selectedIds={['id-1', 'id-2']}
        />
      </MemoryRouter>,
    );

    const link = screen.getByRole('link', { name: 'Email these 2 submissions' });
    expect(link).toHaveAttribute('href', '/comms?tab=compose&ids=id-1,id-2');
  });

  it('caps the link at MAX_COMPOSE_RECIPIENTS ids and states the overage, never truncating silently', () => {
    const ids = Array.from({ length: MAX_COMPOSE_RECIPIENTS + 5 }, (_, i) => `id-${i}`);
    render(
      <MemoryRouter>
        <BulkActionBar
          selectedCount={ids.length}
          pending={false}
          statusFilter={null}
          onApply={vi.fn()}
          onClear={vi.fn()}
          selectedIds={ids}
        />
      </MemoryRouter>,
    );

    const link = screen.getByRole('link', { name: `Email these ${MAX_COMPOSE_RECIPIENTS} submissions` });
    const expectedIds = ids.slice(0, MAX_COMPOSE_RECIPIENTS).join(',');
    expect(link).toHaveAttribute('href', `/comms?tab=compose&ids=${expectedIds}`);
    expect(
      screen.getByText(`first ${MAX_COMPOSE_RECIPIENTS} of ${ids.length} · a send is capped at ${MAX_COMPOSE_RECIPIENTS}`),
    ).toBeInTheDocument();
  });

  // USER RULING 2026-08-16: idle is a real quiet state — the bar stays in
  // the accessibility tree (no aria-hidden) and renders one muted hint
  // line naming what selection unlocks, instead of the armed controls.
  it('idle (nothing selected) renders the capability hint and none of the armed controls', () => {
    render(
      <MemoryRouter>
        <BulkActionBar
          selectedCount={0}
          pending={false}
          statusFilter={null}
          onApply={vi.fn()}
          onClear={vi.fn()}
          selectedIds={[]}
        />
      </MemoryRouter>,
    );

    const bar = screen.getByRole('toolbar', { name: 'Bulk actions' });
    expect(bar).not.toHaveAttribute('aria-hidden');
    expect(bar.classList.contains('chq-bulkbar-idle')).toBe(true);
    expect(screen.getByText('Tick rows to change status or email speakers.')).toHaveClass('chq-bulkbar-hint');
    expect(screen.queryByRole('link', { name: /Email these/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
  });
});
