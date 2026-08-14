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
    recipientCount: 2,
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
          return calls === 1 ? listEnvelope([batch({ recipientCount: 1, statusCounts: { failed: 1 } })]) : listEnvelope([logRow({ status: 'failed' })]);
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
});
