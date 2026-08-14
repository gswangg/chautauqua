// DEC-900 (wave 25 amendment, ruling 8): bulk-deleting submissions is
// unrecoverable and has no eval need -- single-row delete on the detail
// page (its own quiet footer link) is enough, so the bulk bar's
// "Delete..." control is dropped rather than kept alongside it.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { BulkActionBar } from './BulkActionBar';

afterEach(() => {
  cleanup();
});

describe('BulkActionBar', () => {
  it('renders the status-move buttons and Clear, but no Delete control', () => {
    render(
      <BulkActionBar
        selectedCount={3}
        pending={false}
        statusFilter={null}
        onApply={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    expect(screen.getByRole('toolbar', { name: 'Bulk actions' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Move to accept queue' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument();

    // No "Delete" control of any kind exists in the bulk bar.
    expect(screen.queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Delete/)).not.toBeInTheDocument();
  });
});
