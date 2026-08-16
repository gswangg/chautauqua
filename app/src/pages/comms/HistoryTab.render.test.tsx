// DEC-876: comms history "shows what was sent" per recipient, not just
// batch metadata. These tests mount the real HistoryTab (not RecentSends
// directly) so they exercise the whole wire: batch list -> drill into a
// batch's recipients -> open one recipient's stored send. Confirms the
// per-row Open control issues exactly one GET to the detail endpoint and
// renders THAT row's own bodyText -- never the batch's shared subject as a
// fallback -- and that a second row's Open shows a genuinely different
// body (the seeded 23-recipient batch varies per-recipient rendering).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { HistoryTab } from './HistoryTab';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';
import type { EmailBatchRow, EmailLogRow as EmailLogRowShape, EmailLogDetail, EmailTemplate } from './types';

const EVENT_ID = 'evt-history-render';

function batch(overrides: Partial<EmailBatchRow> = {}): EmailBatchRow {
  return {
    batchKey: 'batch-1',
    subject: 'You are in!',
    sentAt: 1700000000000,
    statusCounts: { sent: 2 },
    templateId: null,
    ...overrides,
  };
}

function logRow(overrides: Partial<EmailLogRowShape> = {}): EmailLogRowShape {
  return {
    id: 'log-1',
    eventName: 'Evt',
    toEmail: 'ada@example.com',
    subject: 'You are in!',
    status: 'sent',
    sentAt: 1700000000000,
    ...overrides,
  };
}

function detail(overrides: Partial<EmailLogDetail> = {}): EmailLogDetail {
  return {
    id: 'log-1',
    eventId: EVENT_ID,
    eventName: 'Evt',
    templateId: 'tpl-1',
    contactId: 'ct-1',
    toEmail: 'ada@example.com',
    subject: 'You are in!',
    bodyText: 'Hi Ada, welcome aboard.',
    bodyHtml: null,
    icsText: null,
    icsFilename: null,
    provider: 'dev',
    status: 'sent',
    sentAt: 1700000000000,
    ...overrides,
  };
}

function template(overrides: Partial<EmailTemplate> = {}): EmailTemplate {
  return {
    id: 'tpl-1',
    eventId: EVENT_ID,
    name: 'Acceptance',
    subject: 'You are in!',
    bodyText: 'Congrats {speaker_name}',
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

describe('HistoryTab', () => {
  // DEC-603 amendment (wave 18, wave-66 amendment): the head mirrors
  // TemplatesTab's -- a breadcrumb, an h1, and a count line built from
  // `total` alone -- plus an Export CSV anchor onto the existing email-log
  // export (src/routes/api/exports.ts, kind=email-log) carrying only q. The
  // rhythm sentence is NOT repeated here (wave 66, gate-11 sweep item 6):
  // Comms.tsx already renders it once in the page head above this tab.
  it('renders the head with a count line built from total alone (no rhythm echo), and an Export CSV anchor scoped to email-log + the live q', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/email-log`]: listEnvelope([batch()], { total: 57 }),
    });

    render(
      <MemoryRouter>
        <HistoryTab
          eventId={EVENT_ID}
          templatesById={{}}
          rhythm={{ sentLast7Days: 4, failedLast7Days: 0, lastSentAt: 1700000000000 }}
        />
      </MemoryRouter>,
    );

    await screen.findByText('You are in!');

    expect(screen.getByRole('heading', { name: 'History' })).toBeInTheDocument();
    const countLine = document.querySelector('.chq-comms-history-titles .chq-comms-head-subtitle')!;
    expect(countLine).toHaveTextContent('57 sends');
    expect(countLine).not.toHaveTextContent('sent in the last 7 days');

    const exportLink = screen.getByRole('link', { name: 'Export CSV' });
    const hrefBefore = new URL(exportLink.getAttribute('href')!, 'http://x');
    expect(hrefBefore.pathname).toBe(`/api/v1/events/${EVENT_ID}/export/email-log`);
    expect(hrefBefore.searchParams.get('q')).toBeNull();

    const searchInput = screen.getByLabelText('Search email history');
    fireEvent.change(searchInput, { target: { value: 'welcome' } });

    await waitFor(() => {
      const hrefAfter = new URL(screen.getByRole('link', { name: 'Export CSV' }).getAttribute('href')!, 'http://x');
      expect(hrefAfter.searchParams.get('q')).toBe('welcome');
    });

    void fetchMock;
  });

  // Zero-state rule (this task's chosen behaviour): the Export CSV anchor
  // stays present even with zero sends -- an export of an empty batch is
  // harmless (the server returns a header-only CSV), and hiding the control
  // would make the head disappear along with the batch table, which the
  // fresh EmptyState's own "Compose" action already covers as the escape.
  it('keeps the Export CSV anchor present (harmless) in the fresh empty state', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/email-log`]: listEnvelope([]),
    });

    render(
      <MemoryRouter>
        <HistoryTab eventId={EVENT_ID} templatesById={{}} />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Nothing has been sent yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Export CSV' })).toBeInTheDocument();
  });

  it('opens a recipient row with exactly one GET to the detail endpoint, and a second row shows its own body', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/email-log`]: (() => {
        // The same route backs both the groupBy=batch list and the
        // batchId= drill-in; mockApi strips the querystring, so branch on
        // call order isn't available -- instead we register once and let
        // the handler inspect nothing, returning batches first render then
        // recipients on the drill-in. Since HistoryTab issues the batch
        // list on mount and RecentSends issues the recipients list lazily
        // on toggle, a call-count-based handler keeps them straight.
        let calls = 0;
        return () => {
          calls += 1;
          return calls === 1
            ? listEnvelope([batch()])
            : listEnvelope([
                logRow({ id: 'log-1', toEmail: 'ada@example.com' }),
                logRow({ id: 'log-2', toEmail: 'bo@example.com' }),
              ]);
        };
      })(),
      [`GET /api/v1/events/${EVENT_ID}/email-log/log-1`]: detail({ id: 'log-1', toEmail: 'ada@example.com', bodyText: 'Hi Ada, welcome aboard.' }),
      [`GET /api/v1/events/${EVENT_ID}/email-log/log-2`]: detail({ id: 'log-2', toEmail: 'bo@example.com', bodyText: 'Hi Bo, welcome aboard.' }),
    });

    // w1-g: templatesById is now the parent's job (Comms.tsx fetches it
    // once) -- HistoryTab receives it as a required prop instead of
    // fetching its own copy.
    const tpl = template();
    render(
      <MemoryRouter>
        <HistoryTab eventId={EVENT_ID} templatesById={{ [tpl.id]: tpl.name }} />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Open' }));
    await waitFor(() => {
      expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    });

    const rows = screen.getAllByText(/@example\.com/).map((el) => el.closest('.chq-comms-recipient-row') as HTMLElement);
    const adaRow = rows.find((r) => within(r).queryByText('ada@example.com'))!;
    const boRow = rows.find((r) => within(r).queryByText('bo@example.com'))!;

    const callsBefore = fetchMock.mock.calls.filter(([u]) => String(u).includes('/email-log/log-1')).length;
    expect(callsBefore).toBe(0);

    fireEvent.click(within(adaRow).getByRole('button', { name: 'Show what was sent' }));
    await waitFor(() => {
      expect(screen.getByText('Hi Ada, welcome aboard.')).toBeInTheDocument();
    });
    const callsAfterOpen = fetchMock.mock.calls.filter(([u]) => String(u).includes('/email-log/log-1')).length;
    expect(callsAfterOpen).toBe(1);

    // Its own template label, resolved from the event's template list.
    expect(within(adaRow).getByText('Template: Acceptance')).toBeInTheDocument();

    // The second row's own Open shows its own body, not Ada's.
    fireEvent.click(within(boRow).getByRole('button', { name: 'Show what was sent' }));
    await waitFor(() => {
      expect(screen.getByText('Hi Bo, welcome aboard.')).toBeInTheDocument();
    });
    expect(screen.getByText('Hi Ada, welcome aboard.')).toBeInTheDocument();

    // Opening ada's row issued exactly one GET for log-1, even after bo's
    // row was opened too.
    const callsFinal = fetchMock.mock.calls.filter(([u]) => String(u).includes('/email-log/log-1')).length;
    expect(callsFinal).toBe(1);
  });

  it('shows the fetch error for a row, never falling back to the batch subject, when the detail fetch fails', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/email-log`]: (() => {
        let calls = 0;
        return () => {
          calls += 1;
          return calls === 1 ? listEnvelope([batch({ statusCounts: { failed: 1 } })]) : listEnvelope([logRow({ status: 'failed' })]);
        };
      })(),
      [`GET /api/v1/events/${EVENT_ID}/email-log/log-1`]: { status: 500, body: { error: { code: 'internal_error', message: 'Failed to load what was sent' } } },
    });

    render(
      <MemoryRouter>
        <HistoryTab eventId={EVENT_ID} templatesById={{}} />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Open' }));
    await waitFor(() => {
      expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Show what was sent' }));
    await waitFor(() => {
      expect(screen.getByText('Failed to load what was sent')).toBeInTheDocument();
    });
    expect(screen.queryByText('You are in!', { selector: '.chq-comms-send-detail-body .chq-comms-history-subject' })).not.toBeInTheDocument();
  });

  // w1-g: a compose-mount "Open" hands off via ?tab=history&batch=<key> --
  // History reads that key and lands already expanded on the matching
  // batch, with no click needed.
  it('lands already expanded on the batch named by ?batch= on arrival', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/email-log`]: (() => {
        let calls = 0;
        return () => {
          calls += 1;
          return calls === 1
            ? listEnvelope([batch(), batch({ batchKey: 'batch-2', subject: 'A different send' })])
            : listEnvelope([logRow({ id: 'log-1', toEmail: 'ada@example.com' })]);
        };
      })(),
    });

    render(
      <MemoryRouter initialEntries={['/comms?tab=history&batch=batch-1']}>
        <HistoryTab eventId={EVENT_ID} templatesById={{}} />
      </MemoryRouter>,
    );

    await screen.findByText('You are in!');
    const closeButton = await screen.findByRole('button', { name: 'Close' });
    expect(closeButton).toHaveAttribute('aria-expanded', 'true');
    await waitFor(() => {
      expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    });

    // The non-named batch stays collapsed.
    const otherRow = screen.getByText('A different send').closest('.chq-comms-batch-row') as HTMLElement;
    expect(within(otherRow).getByRole('button', { name: 'Open' })).toHaveAttribute('aria-expanded', 'false');
  });

  // B7 (DEC-678 amendment): the batch table (RecentSends' own section head +
  // rows) is REPLACED, not sat under, when nothing has ever been sent --
  // the fresh empty state with a Compose action renders instead.
  it('replaces the batch table with a fresh empty state + Compose action when nothing has been sent', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/email-log`]: listEnvelope([]),
    });

    render(
      <MemoryRouter>
        <HistoryTab eventId={EVENT_ID} templatesById={{}} />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Nothing has been sent yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Compose' })).toBeInTheDocument();

    // No batch-table chrome (RecentSends' own "Recent sends" section head)
    // renders over the zero rows.
    expect(screen.queryByText('Recent sends')).not.toBeInTheDocument();
    expect(document.querySelector('.chq-comms-batch-row')).toBeNull();
  });

  // B7 (DEC-678 amendment): a search that excludes every send renders the
  // filtered EmptyState (not the retired `chq-empty` one-line register),
  // keeps the search input above it, and its escape clears the query.
  it('shows the filtered empty state with an escape when a search returns nothing, and the escape clears the query', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/email-log`]: (() => {
        let calls = 0;
        return () => {
          calls += 1;
          return calls === 1 ? listEnvelope([batch()]) : listEnvelope([]);
        };
      })(),
    });

    render(
      <MemoryRouter>
        <HistoryTab eventId={EVENT_ID} templatesById={{}} />
      </MemoryRouter>,
    );

    await screen.findByText('You are in!');

    const searchInput = screen.getByLabelText('Search email history');
    fireEvent.change(searchInput, { target: { value: 'zzz-no-match' } });

    expect(await screen.findByText('No sends match your search.')).toBeInTheDocument();
    expect(screen.getByText('No sends match “zzz-no-match”.')).toBeInTheDocument();
    const escapeButton = screen.getByRole('button', { name: 'Clear the search' });
    expect(escapeButton).toBeInTheDocument();

    // Search chrome (the input) stays visible above the filtered empty state.
    expect(screen.getByLabelText('Search email history')).toBeInTheDocument();
    // No batch table over the filtered zero rows either.
    expect(document.querySelector('.chq-comms-batch-row')).toBeNull();
    // '0 total' never prints under an empty state.
    expect(screen.queryByText(/total$/)).not.toBeInTheDocument();

    fireEvent.click(escapeButton);
    await waitFor(() => {
      expect((searchInput as HTMLInputElement).value).toBe('');
    });

    void fetchMock;
  });

  // DEC-603 amendment (findings wave 8): GET /email-log pages like every
  // other list route -- History must send page/perPage and render the same
  // pager chrome compose step 1 uses, never a bare "{total} total" line the
  // organizer can't reach past 50.
  it('paginates: shows the summary, Previous disabled on page 1, Next fetches page 2, and a new search returns to page 1', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/email-log`]: listEnvelope([batch()], { total: 120 }),
    });

    render(
      <MemoryRouter>
        <HistoryTab eventId={EVENT_ID} templatesById={{}} />
      </MemoryRouter>,
    );

    await screen.findByText('You are in!');

    expect(screen.getByText('Showing 1–50 of 120')).toBeInTheDocument();

    const previousButton = screen.getByRole('button', { name: 'Previous' });
    const nextButton = screen.getByRole('button', { name: 'Next' });
    expect(previousButton).toBeDisabled();
    expect(nextButton).not.toBeDisabled();

    fireEvent.click(nextButton);
    await waitFor(() => {
      const calls = fetchMock.mock.calls;
      const lastCall = calls[calls.length - 1]!;
      expect(String(lastCall[0])).toContain('page=2');
    });

    const searchInput = screen.getByLabelText('Search email history');
    fireEvent.change(searchInput, { target: { value: 'welcome' } });

    await waitFor(() => {
      const calls = fetchMock.mock.calls;
      const lastCall = calls[calls.length - 1]!;
      expect(String(lastCall[0])).toContain('page=1');
      expect(String(lastCall[0])).toContain('q=welcome');
    });
  });

  // DEC-603 (wave-56 amendment, frame :625-631): the chips row -- 'All
  // sends' plus one chip per templatesById entry, sorted by name. Selecting
  // one sets templateId on the request, resets to page 1, and marks the
  // chip active; the facet is carried in ?templateId= so a reload keeps it.
  describe('template chips (DEC-603, wave-56 amendment)', () => {
    it('renders one chip per template sorted by name, "All sends" active by default, and selecting one filters + resets to page 1', async () => {
      const fetchMock = mockApi({
        [`GET /api/v1/events/${EVENT_ID}/email-log`]: listEnvelope([batch()], { total: 120 }),
      });

      render(
        <MemoryRouter>
          <HistoryTab
            eventId={EVENT_ID}
            templatesById={{ 'tpl-b': 'Reminder', 'tpl-a': 'Acceptance' }}
          />
        </MemoryRouter>,
      );

      await screen.findByText('You are in!');

      const allChip = screen.getByRole('button', { name: 'All sends' });
      const acceptanceChip = screen.getByRole('button', { name: 'Acceptance' });
      const reminderChip = screen.getByRole('button', { name: 'Reminder' });
      expect(allChip).toHaveAttribute('aria-pressed', 'true');
      expect(acceptanceChip).toHaveAttribute('aria-pressed', 'false');

      // Sorted by name: Acceptance before Reminder in document order.
      const chipRow = document.querySelector('.chq-comms-history-chips') as HTMLElement;
      const chipLabels = Array.from(chipRow.querySelectorAll('button')).map((b) => b.textContent);
      expect(chipLabels).toEqual(['All sends', 'Acceptance', 'Reminder']);

      // Move off page 1 first, so selecting a chip's page reset is provable.
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      await waitFor(() => {
        const calls = fetchMock.mock.calls;
        expect(String(calls[calls.length - 1]![0])).toContain('page=2');
      });

      fireEvent.click(acceptanceChip);
      await waitFor(() => {
        const calls = fetchMock.mock.calls;
        const last = String(calls[calls.length - 1]![0]);
        expect(last).toContain('templateId=tpl-a');
        expect(last).toContain('page=1');
      });
      expect(acceptanceChip).toHaveAttribute('aria-pressed', 'true');
      expect(allChip).toHaveAttribute('aria-pressed', 'false');
    });

    it('carries templateId in the URL search params so a reload keeps the facet', async () => {
      mockApi({
        [`GET /api/v1/events/${EVENT_ID}/email-log`]: listEnvelope([batch()]),
      });

      render(
        <MemoryRouter initialEntries={['/comms?tab=history&templateId=tpl-a']}>
          <HistoryTab eventId={EVENT_ID} templatesById={{ 'tpl-a': 'Acceptance' }} />
        </MemoryRouter>,
      );

      await screen.findByText('You are in!');
      expect(screen.getByRole('button', { name: 'Acceptance' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('shows the filtered empty state naming the CHIP as the excluding facet when a chip is active with no search text, and the escape clears it', async () => {
      const fetchMock = mockApi({
        [`GET /api/v1/events/${EVENT_ID}/email-log`]: listEnvelope([]),
      });

      render(
        <MemoryRouter initialEntries={['/comms?tab=history&templateId=tpl-a']}>
          <HistoryTab eventId={EVENT_ID} templatesById={{ 'tpl-a': 'Acceptance' }} />
        </MemoryRouter>,
      );

      expect(await screen.findByText('No sends match this template.')).toBeInTheDocument();
      expect(screen.getByText('No sends match “Acceptance”.')).toBeInTheDocument();
      // Not the totally-fresh empty state (a chip filter is active).
      expect(screen.queryByText('Nothing has been sent yet')).not.toBeInTheDocument();

      const escapeButton = screen.getByRole('button', { name: 'Clear the filter' });
      fireEvent.click(escapeButton);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'All sends' })).toHaveAttribute('aria-pressed', 'true');
      });

      void fetchMock;
    });

    it('passes columnHeads to RecentSends so the batch table renders WHEN/SUBJECT/RECIPIENTS/TEMPLATE heads', async () => {
      mockApi({
        [`GET /api/v1/events/${EVENT_ID}/email-log`]: listEnvelope([batch()]),
      });

      render(
        <MemoryRouter>
          <HistoryTab eventId={EVENT_ID} templatesById={{}} />
        </MemoryRouter>,
      );

      await screen.findByText('You are in!');
      const headRow = document.querySelector('.chq-comms-batch-col-heads-row') as HTMLElement;
      expect(headRow).toBeInTheDocument();
      expect(headRow.textContent).toContain('When');
      expect(headRow.textContent).toContain('Recipients');
    });
  });
});
