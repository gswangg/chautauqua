// DEC-505 (wave-55 ledger, wave-13 amendment task-w13-c): proves the three
// mutating call sites in SubmissionsTable.tsx (row triage, bulk status,
// clone) render the server's own message rather than collapsing to a bare
// verb -- each catch already frames `<verb> failed: ${err.message}` so this
// locks that the SERVER text survives, not just the client's frame.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { SubmissionsTable } from './SubmissionsTable';
import { listEnvelope, mockApi, errorEnvelope } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-refusal-1';

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

function baseRoutes(overrides: Record<string, unknown> = {}) {
  return {
    [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
    [`GET /api/v1/events/${EVENT_ID}/forms`]: { id: 'form-1', fields: [] },
    [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([
      {
        id: 'sub-1',
        ref: 'S-001',
        title: 'A Talk About Testing',
        status: 'pending',
        contentStatus: 'pending',
        speakers: [{ contactId: 'c1', name: 'Ada Lovelace' }],
        trackIds: [],
        submittedAt: null,
        createdAt: 1700000000000,
      },
    ]),
    ...overrides,
  };
}

function renderTable() {
  return render(
    <MemoryRouter>
      <SubmissionsTable />
    </MemoryRouter>,
  );
}

describe('SubmissionsTable refusal shapes (DEC-505)', () => {
  it("row triage 409 names the server's own status wording, not a bare 'Status update failed'", async () => {
    mockApi({
      ...baseRoutes(),
      [`POST /api/v1/events/${EVENT_ID}/submissions/status`]: {
        status: 409,
        body: errorEnvelope('conflict', 'status must be one of the DEC-003 submission statuses', {
          status: 'Invalid status',
        }),
      },
    });

    renderTable();
    await waitFor(() => expect(screen.getByText('A Talk About Testing')).toBeInTheDocument());

    const row = screen.getByText('A Talk About Testing').closest('tr')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Accept' }));

    expect(
      await screen.findByText('Status update failed: status must be one of the DEC-003 submission statuses'),
    ).toBeInTheDocument();
  });

  it("bulk status update failure names the server's message and how many batches committed", async () => {
    mockApi({
      ...baseRoutes(),
      [`POST /api/v1/events/${EVENT_ID}/submissions/status`]: {
        status: 500,
        body: errorEnvelope('internal', 'Failed to update submission statuses'),
      },
    });

    renderTable();
    await waitFor(() => expect(screen.getByText('A Talk About Testing')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select S-001' }));
    const bulkbar = within(screen.getByRole('toolbar', { name: 'Bulk actions' }));
    fireEvent.click(bulkbar.getByRole('button', { name: 'Move to accept queue' }));

    const errorEl = await screen.findByText((_, el) => el?.className === 'chq-error' && (el.textContent ?? '').includes('Bulk status update failed'));
    expect(errorEl.textContent).toBe(
      'Bulk status update failed after 0 of 1 batches: Failed to update submission statuses',
    );
  });

  it("clone failure names the server's own message, not a bare 'Clone failed'", async () => {
    mockApi({
      ...baseRoutes(),
      [`POST /api/v1/submissions/sub-1/clone`]: {
        status: 500,
        body: errorEnvelope('internal', 'Failed to clone submission'),
      },
    });

    renderTable();
    await waitFor(() => expect(screen.getByText('A Talk About Testing')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Clone' }));

    expect(await screen.findByText('Clone failed: Failed to clone submission')).toBeInTheDocument();
  });
});
