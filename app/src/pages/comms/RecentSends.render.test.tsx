// DEC-751: RecentSends is a presentational component fed already-fetched
// batch rows -- these tests exercise both mounts directly (no fetch mock
// needed, except for the recipients-disclosure drill-in, which History's
// mount still owns).
//
// w41-g (DEC-751 amendment): the row is exactly five columns -- [when]
// [subject][N sent][template][Open]. These tests exercise that shape plus
// the section-head subtitle and both mounts' trailing control.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { RecentSends } from './RecentSends';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';
import { formatDateTime, formatDate } from '../../lib/dates';
import type { EmailBatchRow } from './types';
import type { SendRhythm } from './sendRhythm';

const EVENT_ID = 'evt-recent-sends';

// jsdom does not lay out CSS grid tracks, so the "same grid" half of DEC-751
// (wave-21 amendment, B8) is asserted against the stylesheet source text
// rather than computed style, mirroring settings-field-width.test.ts.
const cssPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'comms.css');
const commsCss = readFileSync(cssPath, 'utf8');

function ruleBodyFor(css: string, selector: string): string {
  const idx = css.indexOf(selector);
  expect(idx, `selector ${selector} not found in comms.css`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf('{', idx);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

function batch(overrides: Partial<EmailBatchRow> = {}): EmailBatchRow {
  return {
    batchKey: 'batch-1',
    subject: 'You are in!',
    sentAt: 1700000000000,
    recipientCount: 3,
    statusCounts: { sent: 3 },
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

function batchRowCells(row: HTMLElement): HTMLElement[] {
  return Array.from(row.children) as HTMLElement[];
}

describe('RecentSends', () => {
  it('renders the shared EmptyState fresh block when there are no batches, and withholds the subtitle', () => {
    render(<RecentSends eventId={EVENT_ID} batchesLoaded batches={[]} templatesById={{}} />);
    expect(screen.getByText('Recent sends')).toBeInTheDocument();
    expect(screen.getByText('No emails sent yet.')).toBeInTheDocument();
    expect(document.querySelector('.chq-empty-block-fresh')).toBeInTheDocument();
    expect(document.querySelector('.chq-empty-actions')).not.toBeInTheDocument();
    expect(document.querySelector('.chq-comms-recent-sends-subtitle')).not.toBeInTheDocument();
  });

  // DEC-678 (wave-36): an empty state is only reachable from a SETTLED load.
  // The compose mount renders this component with batches=[] on every first
  // paint, before GET .../email-log?groupBy=batch has come back.
  it('withholds the empty state while the batches request is still in flight', () => {
    render(<RecentSends eventId={EVENT_ID} batchesLoaded={false} batches={[]} templatesById={{}} />);
    expect(screen.getByText('Recent sends')).toBeInTheDocument();
    expect(screen.queryByText('No emails sent yet.')).not.toBeInTheDocument();
    expect(document.querySelectorAll('.chq-empty')).toHaveLength(0);
  });

  it('renders exactly five cells per batch row: when, subject, N sent, template, Open', () => {
    render(<RecentSends eventId={EVENT_ID} batchesLoaded batches={[batch()]} templatesById={{}} />);
    const row = document.querySelector('.chq-comms-batch-row') as HTMLElement;
    const cells = batchRowCells(row);
    expect(cells).toHaveLength(5);
    expect(cells[0]!.textContent).toBe(formatDateTime(1700000000000));
    expect(cells[1]!.textContent).toBe('You are in!');
    expect(cells[2]!.textContent).toBe('3 sent');
    expect(cells[3]!.textContent).toBe('—');
    expect(cells[4]!.tagName).toBe('BUTTON');
  });

  it("states '<n> sent' with no failed suffix when there are no failures", () => {
    render(<RecentSends eventId={EVENT_ID} batchesLoaded batches={[batch({ statusCounts: { sent: 5 } })]} templatesById={{}} />);
    expect(screen.getByText('5 sent')).toBeInTheDocument();
    expect(screen.queryByText(/failed/)).not.toBeInTheDocument();
  });

  it("appends '· N failed' only when a failure exists", () => {
    render(<RecentSends eventId={EVENT_ID} batchesLoaded batches={[batch({ statusCounts: { sent: 2, failed: 1 } })]} templatesById={{}} />);
    expect(screen.getByText('2 sent · 1 failed')).toBeInTheDocument();
  });

  it('renders a batch whose statusCounts are all failures exactly like any other batch', () => {
    render(<RecentSends eventId={EVENT_ID} batchesLoaded batches={[batch({ statusCounts: { failed: 3 } })]} templatesById={{}} />);
    expect(screen.getByText('You are in!')).toBeInTheDocument();
    expect(screen.getByText('0 sent · 3 failed')).toBeInTheDocument();
  });

  it('names the template from templatesById when both templateId and the map entry are present', () => {
    render(
      <RecentSends
        eventId={EVENT_ID} batchesLoaded
        batches={[batch({ templateId: 'tpl-1' })]}
        templatesById={{ 'tpl-1': 'Acceptance letter' }}
      />,
    );
    expect(screen.getByText('Acceptance letter')).toBeInTheDocument();
  });

  it('renders an em dash for the template column when templateId is null', () => {
    render(<RecentSends eventId={EVENT_ID} batchesLoaded batches={[batch({ templateId: null })]} templatesById={{}} />);
    const row = document.querySelector('.chq-comms-batch-row') as HTMLElement;
    expect(batchRowCells(row)[3]!.textContent).toBe('—');
  });

  it('renders an em dash for the template column when templateId is set but missing from templatesById', () => {
    render(<RecentSends eventId={EVENT_ID} batchesLoaded batches={[batch({ templateId: 'tpl-missing' })]} templatesById={{}} />);
    const row = document.querySelector('.chq-comms-batch-row') as HTMLElement;
    expect(batchRowCells(row)[3]!.textContent).toBe('—');
  });

  // DEC-751 amendment (w15-d): "All history" is the only control onSeeAll
  // still drives -- the per-row "Open" always expands the recipients
  // disclosure in place, on both mounts.
  it('caps rows at `limit`, renders "All history" (calling onSeeAll with no argument), and a per-row "Open" that drills in place', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/email-log`]: listEnvelope([
        { id: 'log-1', eventName: 'Evt', toEmail: 'ada@example.com', subject: 'Send #1', status: 'sent', sentAt: 1700000000000 },
      ]),
    });
    const onSeeAll = vi.fn();
    const batches = [1, 2, 3, 4, 5].map((n) =>
      batch({ batchKey: `b${n}`, subject: `Send #${n}`, statusCounts: { sent: n } }),
    );

    render(<RecentSends eventId={EVENT_ID} batchesLoaded batches={batches} limit={4} onSeeAll={onSeeAll} templatesById={{}} />);

    expect(screen.getByText('Send #1')).toBeInTheDocument();
    expect(screen.getByText('Send #4')).toBeInTheDocument();
    expect(screen.queryByText('Send #5')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'All history' }));
    expect(onSeeAll).toHaveBeenCalledTimes(1);
    // "All history" carries no argument -- it switches tabs, nothing more.
    expect(onSeeAll).toHaveBeenLastCalledWith();

    const openButtons = screen.getAllByRole('button', { name: 'Open' });
    expect(openButtons).toHaveLength(4);
    fireEvent.click(openButtons[0]!);
    // The per-row "Open" never calls onSeeAll -- it drills in place.
    expect(onSeeAll).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Close' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('never fabricates a count it did not receive -- omits a limit when none is given', () => {
    const batches = [1, 2, 3, 4, 5].map((n) => batch({ batchKey: `b${n}`, subject: `Send #${n}` }));
    render(<RecentSends eventId={EVENT_ID} batchesLoaded batches={batches} templatesById={{}} />);
    expect(screen.getByText('Send #5')).toBeInTheDocument();
  });

  // DEC-905 (wave-59 amendment): RecentSends renders no aggregate of its
  // own -- the subtitle is the caller-supplied `rhythm`, formatted via the
  // shared formatSendRhythm, never re-derived from `batches`.
  it('withholds the subtitle when rhythm is not supplied, even with batches present', () => {
    render(<RecentSends eventId={EVENT_ID} batchesLoaded batches={[batch()]} templatesById={{}} />);
    expect(document.querySelector('.chq-comms-recent-sends-subtitle')).not.toBeInTheDocument();
  });

  it('renders the exact rhythm sentence it is given on the compose mount (limit=4, onSeeAll present)', () => {
    const rhythm: SendRhythm = { sentLast7Days: 7, failedLast7Days: 0, lastSentAt: 1700000000000 };
    render(
      <RecentSends
        eventId={EVENT_ID}
        batchesLoaded
        batches={[batch()]}
        limit={4}
        onSeeAll={() => undefined}
        templatesById={{}}
        rhythm={rhythm}
      />,
    );
    expect(screen.getByText(`7 sent in the last 7 days · last ${formatDate(1700000000000)}`)).toBeInTheDocument();
  });

  it('renders the exact rhythm sentence it is given on the history mount (no limit, no onSeeAll)', () => {
    const rhythm: SendRhythm = { sentLast7Days: 2, failedLast7Days: 1, lastSentAt: 1700000000000 };
    render(<RecentSends eventId={EVENT_ID} batchesLoaded batches={[batch()]} templatesById={{}} rhythm={rhythm} />);
    expect(
      screen.getByText(`2 sent in the last 7 days · 1 failed · last ${formatDate(1700000000000)}`),
    ).toBeInTheDocument();
  });

  it('the rhythm figure is unchanged by a batches array missing older batches -- it never re-derives from batches', () => {
    const rhythm: SendRhythm = { sentLast7Days: 9, failedLast7Days: 0, lastSentAt: 1700000000000 };
    const fullBatches = [
      batch({ batchKey: 'recent-1', subject: 'Recent A', sentAt: 1700000000000, statusCounts: { sent: 4 } }),
      batch({ batchKey: 'old', subject: 'Old', sentAt: 1600000000000, statusCounts: { sent: 5 } }),
    ];
    const { rerender } = render(
      <RecentSends eventId={EVENT_ID} batchesLoaded batches={fullBatches} templatesById={{}} rhythm={rhythm} />,
    );
    expect(screen.getByText(`9 sent in the last 7 days · last ${formatDate(1700000000000)}`)).toBeInTheDocument();

    // Missing the older batch entirely -- the same rhythm prop still renders
    // the same sentence, because RecentSends never sums or filters `batches`
    // to produce it.
    const trimmedBatches = [fullBatches[0]!];
    rerender(<RecentSends eventId={EVENT_ID} batchesLoaded batches={trimmedBatches} templatesById={{}} rhythm={rhythm} />);
    expect(screen.getByText(`9 sent in the last 7 days · last ${formatDate(1700000000000)}`)).toBeInTheDocument();
  });

  // w1-g: History's "Open" handoff carries the batch's key -- landing on
  // History with that batch's key given (expandBatchKey) must expand and
  // load it without a click, exactly as if the reader had clicked Open.
  it('lands already expanded and loads recipients when expandBatchKey names a batch', async () => {
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

    render(
      <RecentSends eventId={EVENT_ID} batchesLoaded batches={[batch()]} templatesById={{}} expandBatchKey="batch-1" />,
    );

    const toggle = screen.getByRole('button', { name: 'Close' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await waitFor(() => {
      expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    });
  });

  it('without onSeeAll, renders the "Open"/"Close" recipients disclosure and drills in on click (History mount)', async () => {
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

    render(<RecentSends eventId={EVENT_ID} batchesLoaded batches={[batch()]} templatesById={{}} />);

    expect(screen.queryByRole('button', { name: 'All history' })).not.toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'Open' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const row = toggle.closest('.chq-comms-batch-row') as HTMLElement;
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    });

    const closeButton = within(row).getByRole('button', { name: 'Close' });
    expect(closeButton).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(closeButton);
    expect(screen.queryByText('ada@example.com')).not.toBeInTheDocument();
  });

  // DEC-751 amendment (w41-g): the per-status tally that used to sit on the
  // collapsed row now lives inside the expanded recipients disclosure -- an
  // all-failed batch stays auditable there even though the row itself only
  // states the sent/failed summary.
  it('shows the full per-status tally inside the expanded disclosure', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/email-log`]: listEnvelope([]),
    });

    render(<RecentSends eventId={EVENT_ID} batchesLoaded batches={[batch({ statusCounts: { sent: 1, failed: 2, bounced: 1 } })]} templatesById={{}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    await waitFor(() => {
      expect(document.querySelector('.chq-comms-batch-tally')).toBeInTheDocument();
    });
    expect(document.querySelector('.chq-comms-batch-tally')?.textContent).toBe('1 bounced, 2 failed, 1 sent');
  });

  // DEC-603 amendment (wave 66, gate-11 sweep item 6): the expanded
  // recipients disclosure gets a head row over the SAME five-track grid the
  // recipient rows use -- empty / Recipient / Result / empty / empty --
  // rendered only once there's at least one recipient row.
  describe('recipient column heads (DEC-603, wave 66 amendment)', () => {
    it('emits exactly one head row naming Recipient/Result once recipients have loaded', async () => {
      mockApi({
        [`GET /api/v1/events/${EVENT_ID}/email-log`]: listEnvelope([
          { id: 'log-1', eventName: 'Evt', toEmail: 'ada@example.com', subject: 'You are in!', status: 'sent', sentAt: 1700000000000 },
          { id: 'log-2', eventName: 'Evt', toEmail: 'bo@example.com', subject: 'You are in!', status: 'sent', sentAt: 1700000000000 },
        ]),
      });

      render(<RecentSends eventId={EVENT_ID} batchesLoaded batches={[batch()]} templatesById={{}} />);
      fireEvent.click(screen.getByRole('button', { name: 'Open' }));
      await waitFor(() => {
        expect(screen.getByText('ada@example.com')).toBeInTheDocument();
      });

      const headRows = document.querySelectorAll('.chq-comms-recipient-col-heads-row');
      expect(headRows).toHaveLength(1);
      const headCells = Array.from(headRows[0]!.children).map((el) => el.textContent);
      expect(headCells).toEqual(['', 'Recipient', 'Result', '', '']);
      // The head shares the recipient row's own five-track grid class.
      expect(headRows[0]!.className).toContain('chq-comms-recipient-row');
    });

    it('withholds the head row while recipients are still loading', async () => {
      // A fetch that never resolves keeps the recipients disclosure in its
      // loading (DelayedLoading) state indefinitely, matching the pattern
      // used elsewhere for "still loading" assertions (e.g.
      // Review.render.test.tsx, EventSwitcher.render.test.tsx).
      vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));

      render(<RecentSends eventId={EVENT_ID} batchesLoaded batches={[batch()]} templatesById={{}} />);
      fireEvent.click(screen.getByRole('button', { name: 'Open' }));

      await waitFor(() => {
        expect(document.querySelector('.chq-comms-batch-tally')).toBeInTheDocument();
      });
      expect(document.querySelector('.chq-comms-recipient-col-heads-row')).toBeNull();
    });

    it('withholds the head row when the recipients fetch errors', async () => {
      mockApi({
        [`GET /api/v1/events/${EVENT_ID}/email-log`]: { status: 500, body: { error: { code: 'internal_error', message: 'Failed to load recipients' } } },
      });

      render(<RecentSends eventId={EVENT_ID} batchesLoaded batches={[batch()]} templatesById={{}} />);
      fireEvent.click(screen.getByRole('button', { name: 'Open' }));

      await waitFor(() => {
        expect(screen.getByText('Failed to load recipients')).toBeInTheDocument();
      });
      expect(document.querySelector('.chq-comms-recipient-col-heads-row')).toBeNull();
    });
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

    render(<RecentSends eventId={EVENT_ID} batchesLoaded batches={[batch()]} templatesById={{}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
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

    render(<RecentSends eventId={EVENT_ID} batchesLoaded batches={[batch()]} templatesById={{}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    await waitFor(() => {
      expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    });

    // The batch subject renders exactly once in the whole component.
    expect(screen.getAllByText('You are in!')).toHaveLength(1);
    // No per-recipient timestamp anywhere in the collapsed list -- only the
    // batch row's own single .chq-comms-history-when span survives.
    expect(document.querySelectorAll('.chq-comms-history-when')).toHaveLength(1);
    expect(screen.queryByText(/Subject:/)).not.toBeInTheDocument();

    const rows = document.querySelectorAll('.chq-comms-recipient-row:not(.chq-comms-recipient-col-heads-row)');
    expect(rows).toHaveLength(2);
    for (const row of Array.from(rows)) {
      // DEC-751 (wave-21 amendment, B8): the recipient row's five cells lead
      // with an empty cell (aligning under the batch row's empty "when"-less
      // first track's counterpart) -- the address is the SECOND cell.
      expect((row.children[1] as HTMLElement).className).toContain('chq-comms-recipient-to');
    }
    expect(rows[0]!.querySelector('.chq-comms-recipient-to')?.textContent).toBe('ada@example.com');
    expect(rows[1]!.querySelector('.chq-comms-recipient-to')?.textContent).toBe('bo@example.com');
  });

  // DEC-751 (wave-21 amendment, B8): the expanded band's rows repeat the
  // batch row's own five tracks -- an empty leading cell, the recipient,
  // the result, their submission's differing subject (or nothing), and the
  // trailing disclosure -- and the band shares that grid via the same CSS
  // variable rather than declaring its own.
  it('renders five cells per recipient row, matching the batch row\'s own grid, indent-free', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/email-log`]: listEnvelope([
        { id: 'log-1', eventName: 'Evt', toEmail: 'ada@example.com', subject: 'You are in!', status: 'sent', sentAt: 1700000000000 },
      ]),
    });

    render(<RecentSends eventId={EVENT_ID} batchesLoaded batches={[batch()]} templatesById={{}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    await waitFor(() => {
      expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    });

    const recipientRow = document.querySelector(
      '.chq-comms-recipient-row:not(.chq-comms-recipient-col-heads-row)',
    ) as HTMLElement;
    expect(recipientRow.children).toHaveLength(5);
    expect(recipientRow.children[1]!.className).toContain('chq-comms-recipient-to');
    expect(recipientRow.children[2]!.textContent).toBe('sent');
    expect(recipientRow.children[4]!.tagName).toBe('DIV');
  });

  it("shows a 'Subject:' line only for the recipient row whose subject differs from the batch subject", async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/email-log`]: listEnvelope([
        { id: 'log-1', eventName: 'Evt', toEmail: 'ada@example.com', subject: 'You are in!', status: 'sent', sentAt: 1700000000000 },
        { id: 'log-2', eventName: 'Evt', toEmail: 'bo@example.com', subject: 'You are in, Bo!', status: 'sent', sentAt: 1700000000000 },
      ]),
    });

    render(<RecentSends eventId={EVENT_ID} batchesLoaded batches={[batch()]} templatesById={{}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
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

    render(<RecentSends eventId={EVENT_ID} batchesLoaded batches={[batch()]} templatesById={{}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
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

describe('comms.css: the expanded recipients band inherits the batch row\'s grid (DEC-751, wave-21 amendment, B8)', () => {
  it('declares the five-track grid + gap exactly once and reuses it for both mounts', () => {
    const batchBody = ruleBodyFor(commsCss, '.chq-comms-batch {');
    expect(batchBody).toMatch(/--chq-comms-batch-grid:\s*150px 1fr 130px 150px auto/);
    expect(batchBody).toMatch(/--chq-comms-batch-gap:\s*18px/);

    const batchRowBody = ruleBodyFor(commsCss, '.chq-comms-batch-row {');
    expect(batchRowBody).toMatch(/grid-template-columns:\s*var\(--chq-comms-batch-grid\)/);
    expect(batchRowBody).toMatch(/gap:\s*var\(--chq-comms-batch-gap\)/);

    const recipientRowBody = ruleBodyFor(commsCss, '.chq-comms-batch-recipients .chq-comms-recipient-row {');
    expect(recipientRowBody).toMatch(/grid-template-columns:\s*var\(--chq-comms-batch-grid\)/);
    expect(recipientRowBody).toMatch(/gap:\s*var\(--chq-comms-batch-gap\)/);

    // No hardcoded track list left behind on the recipient-row rule that
    // could drift from the batch row's own tracks.
    expect(recipientRowBody).not.toMatch(/1fr\s+130px\s+auto/);
  });

  it('does not repeat .chq-comms-batch-row\'s own tracks under a different literal (ONE grid serves both mounts)', () => {
    const batchRowBody = ruleBodyFor(commsCss, '.chq-comms-batch-row {');
    expect(batchRowBody).toMatch(/grid-template-columns:\s*var\(--chq-comms-batch-grid\)/);
    expect(batchRowBody).not.toMatch(/150px 1fr 130px 150px auto/);
  });

  it('drops the wrapper indent and gives the band a surface fill with top+bottom hairline rules', () => {
    const bandBody = ruleBodyFor(commsCss, '.chq-comms-batch-recipients {');
    expect(bandBody).not.toMatch(/padding-left/);
    expect(bandBody).toMatch(/background:\s*var\(--chq-surface\)/);
    expect(bandBody).toMatch(/border-top:\s*1px solid var\(--chq-hairline\)/);
    expect(bandBody).toMatch(/border-bottom:\s*1px solid var\(--chq-hairline\)/);
  });

  it('leaves the compose step-3 .chq-comms-recipient-row (comms.css:146) untouched', () => {
    // That rule is a plain, unscoped .chq-comms-recipient-row selector --
    // still present, still owned by ComposeWizard.tsx's own 2-column grid.
    expect(commsCss).toMatch(/\n\.chq-comms-recipient-row\s*\{/);
  });
});

// DEC-603 (wave-56 amendment, frame :634-636): the History tab's optional
// column-head row -- WHEN / SUBJECT / RECIPIENTS / TEMPLATE / (blank) over
// the SAME grid the batch rows use, and it suppresses this component's own
// "Recent sends" section head. Default (Compose mount) is unchanged.
describe('columnHeads (DEC-603, wave-56 amendment)', () => {
  it('defaults to false: no head row, "Recent sends" section head still renders', () => {
    render(<RecentSends eventId={EVENT_ID} batches={[batch()]} batchesLoaded templatesById={{}} />);
    expect(screen.getByText('Recent sends')).toBeInTheDocument();
    expect(document.querySelector('.chq-comms-batch-col-heads-row')).toBeNull();
  });

  it('when true: emits exactly one head row naming the five columns and suppresses the "Recent sends" section head', () => {
    render(<RecentSends eventId={EVENT_ID} batches={[batch()]} batchesLoaded templatesById={{}} columnHeads />);
    expect(screen.queryByText('Recent sends')).not.toBeInTheDocument();
    const headRow = document.querySelector('.chq-comms-batch-col-heads-row') as HTMLElement;
    expect(headRow).toBeInTheDocument();
    const cells = batchRowCells(headRow).map((el) => el.textContent);
    expect(cells).toEqual(['When', 'Subject', 'Recipients', 'Template', '']);
  });

  it('the head row shares the SAME grid template as the batch rows (heads and cells cannot drift)', () => {
    const headRowBody = ruleBodyFor(commsCss, '.chq-comms-batch-col-heads-row {');
    // The head row rule itself carries no grid-template-columns -- it
    // inherits .chq-comms-batch-row's `display: grid; grid-template-columns:
    // var(--chq-comms-batch-grid)` by also carrying that class.
    expect(headRowBody).not.toMatch(/grid-template-columns/);
  });

  it('withholds the head row entirely when there are no batches (nothing to head)', () => {
    render(<RecentSends eventId={EVENT_ID} batches={[]} batchesLoaded templatesById={{}} columnHeads />);
    expect(document.querySelector('.chq-comms-batch-col-heads-row')).toBeNull();
  });
});
