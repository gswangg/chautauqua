// DEC-751: RecentSends is a presentational component fed already-fetched
// batch rows -- these tests exercise both mounts directly (no fetch mock
// needed, except for the recipients-disclosure drill-in, which History's
// mount still owns).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { RecentSends } from './RecentSends';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';
import { formatDateTime } from '../../lib/dates';
import type { EmailBatchRow } from './types';

const EVENT_ID = 'evt-recent-sends';

function batch(overrides: Partial<EmailBatchRow> = {}): EmailBatchRow {
  return {
    batchKey: 'batch-1',
    subject: 'You are in!',
    sentAt: 1700000000000,
    recipientCount: 3,
    statusCounts: { sent: 3 },
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

describe('RecentSends', () => {
  it('renders an empty state when there are no batches', () => {
    render(<RecentSends eventId={EVENT_ID} batches={[]} />);
    expect(screen.getByText('Recent sends')).toBeInTheDocument();
    expect(screen.getByText('No emails sent yet.')).toBeInTheDocument();
  });

  it('caps rows at `limit` and renders "All history" instead of a recipients disclosure when onSeeAll is given', () => {
    const onSeeAll = vi.fn();
    const batches = [1, 2, 3, 4, 5].map((n) =>
      batch({ batchKey: `b${n}`, subject: `Send #${n}`, statusCounts: { sent: n } }),
    );

    render(<RecentSends eventId={EVENT_ID} batches={batches} limit={4} onSeeAll={onSeeAll} />);

    expect(screen.getByText('Send #1')).toBeInTheDocument();
    expect(screen.getByText('Send #4')).toBeInTheDocument();
    expect(screen.queryByText('Send #5')).not.toBeInTheDocument();

    expect(screen.queryByRole('button', { name: 'See the recipients' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'All history' }));
    expect(onSeeAll).toHaveBeenCalledTimes(1);
  });

  it('renders a batch whose statusCounts are all failures exactly like any other batch', () => {
    render(<RecentSends eventId={EVENT_ID} batches={[batch({ statusCounts: { failed: 3 } })]} />);
    expect(screen.getByText('You are in!')).toBeInTheDocument();
    expect(screen.getByText('3 failed')).toBeInTheDocument();
  });

  it('never fabricates a count it did not receive -- omits a limit when none is given', () => {
    const batches = [1, 2, 3, 4, 5].map((n) => batch({ batchKey: `b${n}`, subject: `Send #${n}` }));
    render(<RecentSends eventId={EVENT_ID} batches={batches} />);
    expect(screen.getByText('Send #5')).toBeInTheDocument();
  });

  it('without onSeeAll, renders the recipients disclosure and drills in on click (History mount)', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/email-log`]: listEnvelope([
        {
          id: 'log-1',
          eventName: 'Evt',
          toEmail: 'ada@example.com',
          subject: 'You are in!',
          status: 'sent',
          sentAt: 1700000000000,
        },
      ]),
    });

    render(<RecentSends eventId={EVENT_ID} batches={[batch()]} />);

    expect(screen.queryByRole('button', { name: 'All history' })).not.toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'See the recipients' });
    const row = toggle.closest('.chq-comms-batch-row') as HTMLElement;
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    });

    fireEvent.click(within(row).getByRole('button', { name: 'Hide the recipients' }));
    expect(screen.queryByText('ada@example.com')).not.toBeInTheDocument();
  });

  // DEC-833 (+ DEC-846's "history owes the WORDS" half): each recipient row
  // gets a quiet "Show what was sent" disclosure
  // that fetches the full stored row once and renders subject+bodyText
  // verbatim -- including for a failed attempt.
  it('shows what was sent for a recipient row, verbatim, including a failed attempt', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/email-log`]: listEnvelope([
        { id: 'log-1', eventName: 'Evt', toEmail: 'ada@example.com', subject: 'You are in!', status: 'sent', sentAt: 1700000000000 },
        { id: 'log-2', eventName: 'Evt', toEmail: 'bad@example.com', subject: 'You are in!', status: 'failed', sentAt: 1700000000000 },
      ]),
      [`GET /api/v1/events/${EVENT_ID}/email-log/log-1`]: {
        id: 'log-1',
        eventId: EVENT_ID,
        eventName: 'Evt',
        templateId: null,
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
      },
      [`GET /api/v1/events/${EVENT_ID}/email-log/log-2`]: {
        id: 'log-2',
        eventId: EVENT_ID,
        eventName: 'Evt',
        templateId: null,
        contactId: 'ct-2',
        toEmail: 'bad@example.com',
        subject: 'You are in!',
        bodyText: 'Hi Bad, welcome aboard.',
        bodyHtml: null,
        icsText: null,
        icsFilename: null,
        provider: 'dev',
        status: 'failed',
        sentAt: 1700000000000,
      },
    });

    render(<RecentSends eventId={EVENT_ID} batches={[batch()]} />);

    fireEvent.click(screen.getByRole('button', { name: 'See the recipients' }));
    await waitFor(() => {
      expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    });

    const disclosures = screen.getAllByRole('button', { name: 'Show what was sent' });
    expect(disclosures).toHaveLength(2);

    fireEvent.click(disclosures[0]!);
    await waitFor(() => {
      expect(screen.getByText('Hi Ada, welcome aboard.')).toBeInTheDocument();
    });

    // The failed attempt's stored row is shown too -- the audit record
    // covers it exactly like a successful send.
    fireEvent.click(disclosures[1]!);
    await waitFor(() => {
      expect(screen.getByText('Hi Bad, welcome aboard.')).toBeInTheDocument();
    });
  });

  // w28-f: recipient rows no longer repeat the batch's own subject/
  // timestamp on every line -- that's already printed once at the batch
  // row, and a merge field making a recipient's subject differ is exactly
  // when it's worth the extra line.
  it('renders the shared batch subject once, no per-recipient timestamp, and the address as each row\'s first cell', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/email-log`]: listEnvelope([
        { id: 'log-1', eventName: 'Evt', toEmail: 'ada@example.com', subject: 'You are in!', status: 'sent', sentAt: 1700000000000 },
        { id: 'log-2', eventName: 'Evt', toEmail: 'bo@example.com', subject: 'You are in!', status: 'sent', sentAt: 1700000000000 },
      ]),
    });

    render(<RecentSends eventId={EVENT_ID} batches={[batch()]} />);

    fireEvent.click(screen.getByRole('button', { name: 'See the recipients' }));
    await waitFor(() => {
      expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    });

    // The batch subject renders exactly once in the whole component.
    expect(screen.getAllByText('You are in!')).toHaveLength(1);
    // No per-recipient timestamp anywhere in the collapsed list -- only the
    // batch row's own single .chq-comms-history-when span survives.
    expect(document.querySelectorAll('.chq-comms-history-when')).toHaveLength(1);
    expect(screen.queryByText(/Subject:/)).not.toBeInTheDocument();

    const rows = document.querySelectorAll('.chq-comms-recipient-row');
    expect(rows).toHaveLength(2);
    for (const row of Array.from(rows)) {
      expect((row.firstElementChild as HTMLElement).className).toContain('chq-comms-recipient-to');
    }
    expect(rows[0]!.querySelector('.chq-comms-recipient-to')?.textContent).toBe('ada@example.com');
    expect(rows[1]!.querySelector('.chq-comms-recipient-to')?.textContent).toBe('bo@example.com');
  });

  it("shows a 'Subject:' line only for the recipient row whose subject differs from the batch subject", async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/email-log`]: listEnvelope([
        { id: 'log-1', eventName: 'Evt', toEmail: 'ada@example.com', subject: 'You are in!', status: 'sent', sentAt: 1700000000000 },
        { id: 'log-2', eventName: 'Evt', toEmail: 'bo@example.com', subject: 'You are in, Bo!', status: 'sent', sentAt: 1700000000000 },
      ]),
    });

    render(<RecentSends eventId={EVENT_ID} batches={[batch()]} />);

    fireEvent.click(screen.getByRole('button', { name: 'See the recipients' }));
    await waitFor(() => {
      expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    });

    const rows = document.querySelectorAll('.chq-comms-recipient-row');
    const adaRow = Array.from(rows).find((r) => within(r as HTMLElement).queryByText('ada@example.com')) as HTMLElement;
    const boRow = Array.from(rows).find((r) => within(r as HTMLElement).queryByText('bo@example.com')) as HTMLElement;

    expect(within(adaRow).queryByText(/Subject:/)).not.toBeInTheDocument();
    expect(within(boRow).getByText('Subject: You are in, Bo!')).toBeInTheDocument();
  });

  it("puts the recipient's own send time in the expanded disclosure body, not the collapsed row", async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/email-log`]: listEnvelope([
        { id: 'log-1', eventName: 'Evt', toEmail: 'ada@example.com', subject: 'You are in!', status: 'sent', sentAt: 1700000000000 },
      ]),
      [`GET /api/v1/events/${EVENT_ID}/email-log/log-1`]: {
        id: 'log-1',
        eventId: EVENT_ID,
        eventName: 'Evt',
        templateId: null,
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
      },
    });

    render(<RecentSends eventId={EVENT_ID} batches={[batch()]} />);

    fireEvent.click(screen.getByRole('button', { name: 'See the recipients' }));
    await waitFor(() => {
      expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Show what was sent' }));
    await waitFor(() => {
      expect(screen.getByText('Hi Ada, welcome aboard.')).toBeInTheDocument();
    });

    const body = document.querySelector('.chq-comms-send-detail-body') as HTMLElement;
    expect(within(body).getByText(formatDateTime(1700000000000))).toBeInTheDocument();
  });
});
