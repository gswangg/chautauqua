// task-w51-e item 2 (falsifiability batch B, DEC-358 wave-51): the History
// pager (HistoryTab.tsx:42-160). HistoryTab.render.test.tsx's existing
// pagination test only asserts the OUTGOING request URL after a click
// (`page=2`); it never asserts what actually lands on screen. This file
// closes that gap: it mounts the real component, drives Next/Previous, and
// asserts (a) the rendered batch row content actually changes to the new
// page's data, (b) the pagination summary text updates to match, and (c)
// the Previous/Next disabled states track the CURRENT page, not just the
// first render.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { HistoryTab } from './HistoryTab';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';
import type { EmailBatchRow } from './types';

const EVENT_ID = 'evt-history-pager';

function batch(overrides: Partial<EmailBatchRow> = {}): EmailBatchRow {
  return {
    batchKey: 'batch-1',
    subject: 'Page one send',
    sentAt: 1700000000000,
    statusCounts: { sent: 1 },
    templateId: null,
    ...overrides,
  };
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    throw new Error(`console.error called during render: ${args.map(String).join(' ')}`);
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  consoleErrorSpy.mockRestore();
});

describe('HistoryTab pager (task-w51-e item 2)', () => {
  it('renders page 2 data and an updated summary after Next, then returns to page 1 data + disabled Previous after Previous', async () => {
    // mockApi's route handlers don't see the request URL, only the path --
    // the pager sends its page= as a query param, so this test needs a
    // fetch stub that actually reads it (a call-count-based handler would
    // serve stale data once the organizer navigates BACKWARD, which is
    // exactly the bug this test wants to catch).
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(typeof input === 'string' ? input : input.toString(), 'http://x');
      const page = url.searchParams.get('page');
      const body =
        page === '2'
          ? listEnvelope([batch({ batchKey: 'batch-p2', subject: 'Page two send' })], { total: 120 })
          : listEnvelope([batch({ batchKey: 'batch-p1', subject: 'Page one send' })], { total: 120 });
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter>
        <HistoryTab eventId={EVENT_ID} templatesById={{}} />
      </MemoryRouter>,
    );

    await screen.findByText('Page one send');
    expect(screen.getByText('Showing 1–50 of 120')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    // The page-2 row actually replaces the page-1 row on screen (not just
    // requested) and the summary line moves to the second window.
    await waitFor(() => {
      expect(screen.getByText('Page two send')).toBeInTheDocument();
    });
    expect(screen.queryByText('Page one send')).not.toBeInTheDocument();
    expect(screen.getByText('Showing 51–100 of 120')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).not.toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));

    await waitFor(() => {
      expect(screen.getByText('Page one send')).toBeInTheDocument();
    });
    expect(screen.queryByText('Page two send')).not.toBeInTheDocument();
    expect(screen.getByText('Showing 1–50 of 120')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  });

  it('disables Next once the last page is showing every remaining row', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/email-log`]: listEnvelope(
        [batch({ batchKey: 'batch-only', subject: 'Only send' })],
        { total: 1 },
      ),
    });

    render(
      <MemoryRouter>
        <HistoryTab eventId={EVENT_ID} templatesById={{}} />
      </MemoryRouter>,
    );

    await screen.findByText('Only send');
    expect(screen.getByText('Showing 1–1 of 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  });
});
