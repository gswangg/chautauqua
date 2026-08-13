// DEC-751: RecentSends is a presentational component fed already-fetched
// batch rows -- these tests exercise both mounts directly (no fetch mock
// needed, except for the recipients-disclosure drill-in, which History's
// mount still owns).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { RecentSends } from './RecentSends';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';
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
          bodyText: 'Congrats Ada,\nsee you there',
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

    // DEC-846: the recipient's stored body renders under its row, whitespace
    // preserved, so an expanded batch shows exactly what was attempted.
    const bodyEl = screen.getByText((_, el) => el?.textContent === 'Congrats Ada,\nsee you there');
    expect(bodyEl).toHaveClass('chq-comms-history-body');

    fireEvent.click(within(row).getByRole('button', { name: 'Hide the recipients' }));
    expect(screen.queryByText('ada@example.com')).not.toBeInTheDocument();
  });

  // DEC-846: a fully-failed batch is auditable to its words too -- expanding
  // it still shows the body that was attempted, not just the failure status.
  it('renders the stored body for a fully-failed batch on expansion', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/email-log`]: listEnvelope([
        {
          id: 'log-2',
          eventName: 'Evt',
          toEmail: 'bounced@example.com',
          subject: 'You are in!',
          bodyText: 'Congrats, this bounced',
          status: 'failed',
          sentAt: 1700000000000,
        },
      ]),
    });

    render(<RecentSends eventId={EVENT_ID} batches={[batch({ statusCounts: { failed: 1 }, recipientCount: 1 })]} />);

    fireEvent.click(screen.getByRole('button', { name: 'See the recipients' }));

    await waitFor(() => {
      expect(screen.getByText('Congrats, this bounced')).toBeInTheDocument();
    });
  });
});
