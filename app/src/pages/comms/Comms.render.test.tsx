// DEC-144 layer-2 harness for the Comms SPA (app/src/pages/Comms.tsx):
// mounts the real CommsPage against mocked fetch shaped like the real wire
// envelopes and walks the compose wizard (submission pick -> template pick
// -> per-recipient preview), plus renders the templates and history tabs.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { CommsPage } from '../Comms';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-comms-render';

function submission() {
  return {
    id: 'sub-1',
    ref: 'S-001',
    title: 'A Talk About Testing',
    status: 'accepted',
    contentStatus: 'approved',
    speakers: [{ contactId: 'c1', name: 'Ada Lovelace' }],
    trackIds: [],
    submittedAt: null,
    createdAt: 1700000000000,
  };
}

// Exposes the current router location.search as visible text, so tests can
// assert on the URL search param without depending on jsdom's real
// window.location (MemoryRouter keeps its own in-memory history stack).
function LocationSearchProbe() {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
}

function template() {
  return { id: 'tpl-1', eventId: EVENT_ID, name: 'Acceptance', subject: 'You are in!', bodyText: 'Congrats {speaker_name}' };
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    throw new Error(`console.error called during render: ${args.map(String).join(' ')}`);
  });
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  consoleErrorSpy.mockRestore();
});

describe('CommsPage render smoke', () => {
  it('walks the compose wizard through to a per-recipient preview', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([submission()]),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([template()]),
      [`GET /api/v1/events/${EVENT_ID}/email-log`]: listEnvelope([]),
      [`POST /api/v1/events/${EVENT_ID}/compose/preview`]: {
        items: [
          {
            contactId: 'c1',
            submissionId: 'sub-1',
            email: 'ada@example.com',
            name: 'Ada Lovelace',
            subject: 'You are in!',
            text: 'Congrats Ada Lovelace',
          },
        ],
      },
    });

    render(
      <MemoryRouter>
        <CommsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Comms' })).toBeInTheDocument();
    expect(await screen.findByText('A Talk About Testing')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Select A Talk About Testing'));
    fireEvent.click(screen.getByRole('button', { name: /Next: choose template/ }));

    expect(await screen.findByText('2. Pick or edit a template')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Template/), { target: { value: 'tpl-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next: preview' }));

    expect(await screen.findByText('Recipients · 1')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByText('ada@example.com', { exact: false }).length).toBeGreaterThan(0);
    });
  });

  it('renders the templates tab', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([template()]),
      [`GET /api/v1/events/${EVENT_ID}/email-log`]: listEnvelope([]),
    });

    render(
      <MemoryRouter>
        <CommsPage />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('tab', { name: 'Templates' }));

    await waitFor(() => {
      expect(screen.getByText('Acceptance')).toBeInTheDocument();
    });
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
  });

  it('renders the history tab as batch rows that expand to per-recipient rows', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/email-log`]: (() => {
        // DEC-603: mockApi matches on path only (query strings stripped), so
        // the same route key must answer both the batch-list fetch
        // (?groupBy=batch) and the drill-in fetch (?batchId=...). Since the
        // handler can't see the query string here, this test only exercises
        // the batch-row rendering; recipient drill-in fetches the second
        // response spec below, which happens to be the same rendering it
        // reuses when it can't distinguish the two -- so we only assert on
        // the batch row heading, not the expanded content.
        return listEnvelope([
          {
            batchKey: 'batch-1',
            subject: 'You are in!',
            sentAt: 1700000000000,
            recipientCount: 3,
            statusCounts: { sent: 3 },
          },
        ]);
      })(),
    });

    render(
      <MemoryRouter>
        <CommsPage />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('tab', { name: 'History' }));

    const row = await screen.findByText('You are in!');
    const batchButton = row.closest('.chq-comms-batch-row') as HTMLElement;
    expect(within(batchButton).getByText('3 sent')).toBeInTheDocument();
    expect(screen.getByText('1 total')).toBeInTheDocument();

    // DEC-732 (eval-findings 59): expansion is an explicit bordered
    // control, not the whole row silently doubling as a toggle.
    const toggle = within(batchButton).getByRole('button', { name: 'Open' });
    expect(toggle).toHaveClass('chq-btn');
    fireEvent.click(toggle);
    expect(within(batchButton).getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });
});

// DEC-905 (wave-61 amendment): the head's "N sent in the last 7 days" reads
// a `status=sent`-scoped total, plus a second `status=failed`-scoped total
// rendered only when non-zero -- neither figure comes from the unfiltered
// envelope, which would count a failed send as if it went out. mockApi
// strips query strings before matching, so these tests stub fetch directly
// to answer the sent/failed requests differently by their `status` param.
describe('CommsPage head "N sent in the last 7 days" counts what it claims (DEC-905)', () => {
  function stubEmailLogFetch(counts: { sent: number; failed: number }) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const rawUrl = typeof input === 'string' ? input : input.toString();
        const url = new URL(rawUrl, 'http://localhost');
        if (url.pathname === `/api/v1/events/${EVENT_ID}/submissions`) {
          return new Response(JSON.stringify({ items: [], total: 0, page: 1, perPage: 20 }), { status: 200 });
        }
        if (url.pathname === `/api/v1/events/${EVENT_ID}/templates`) {
          return new Response(JSON.stringify({ items: [], total: 0, page: 1, perPage: 20 }), { status: 200 });
        }
        if (url.pathname === `/api/v1/events/${EVENT_ID}/email-log`) {
          const status = url.searchParams.get('status');
          const total = status === 'sent' ? counts.sent : status === 'failed' ? counts.failed : 0;
          return new Response(JSON.stringify({ items: [], total, page: 1, perPage: 20 }), { status: 200 });
        }
        throw new Error(`unstubbed fetch: ${rawUrl}`);
      }),
    );
  }

  it('renders "2 sent in the last 7 days · 3 failed" for a 2 sent + 3 failed window, not "5 sent"', async () => {
    stubEmailLogFetch({ sent: 2, failed: 3 });

    render(
      <MemoryRouter>
        <CommsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('2 sent in the last 7 days · 3 failed', { exact: false })).toBeInTheDocument();
    expect(screen.queryByText('5 sent', { exact: false })).not.toBeInTheDocument();
  });

  it('renders no failed clause when the window has zero failures', async () => {
    stubEmailLogFetch({ sent: 4, failed: 0 });

    render(
      <MemoryRouter>
        <CommsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('4 sent in the last 7 days', { exact: false })).toBeInTheDocument();
    expect(screen.queryByText(/failed/)).not.toBeInTheDocument();
  });
});

// DEC-710: the Compose/Templates/History strip reads and writes ?tab= via
// useSearchParams instead of component state, so the tab is bookmarkable and
// participates in back/forward.
describe('CommsPage tab strip is URL state (DEC-710)', () => {
  it('mounts at /comms?tab=history directly on the history tab, with aria-selected set from the URL', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/email-log`]: listEnvelope([]),
    });

    render(
      <MemoryRouter initialEntries={['/comms?tab=history']}>
        <CommsPage />
      </MemoryRouter>,
    );

    const historyTab = await screen.findByRole('tab', { name: 'History' });
    expect(historyTab).toHaveAttribute('aria-selected', 'true');
    const composeTab = screen.getByRole('tab', { name: 'Compose' });
    expect(composeTab).toHaveAttribute('aria-selected', 'false');
  });

  it('falls back to compose when ?tab= is absent or unknown', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/email-log`]: listEnvelope([]),
    });

    render(
      <MemoryRouter initialEntries={['/comms?tab=not-a-real-tab']}>
        <CommsPage />
      </MemoryRouter>,
    );

    const composeTab = await screen.findByRole('tab', { name: 'Compose' });
    expect(composeTab).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByText('1. Pick submissions')).toBeInTheDocument();
  });

  it('clicking a tab updates the ?tab= search param', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([template()]),
      [`GET /api/v1/events/${EVENT_ID}/email-log`]: listEnvelope([]),
    });

    render(
      <MemoryRouter initialEntries={['/comms']}>
        <CommsPage />
        <LocationSearchProbe />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('tab', { name: 'Templates' }));

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Templates' })).toHaveAttribute('aria-selected', 'true');
    });
    expect(screen.getByTestId('location-search')).toHaveTextContent('?tab=templates');
  });
});

describe('ComposeWizard compose-step field layout (DEC-710)', () => {
  it('renders Subject and Body sharing the same field-row class, with no per-control width override', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([submission()]),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([template()]),
      [`GET /api/v1/events/${EVENT_ID}/email-log`]: listEnvelope([]),
    });

    render(
      <MemoryRouter>
        <CommsPage />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByLabelText('Select A Talk About Testing'));
    fireEvent.click(screen.getByRole('button', { name: /Next: choose template/ }));

    expect(await screen.findByText('2. Pick or edit a template')).toBeInTheDocument();

    const subjectInput = screen.getByLabelText('Subject');
    const bodyTextarea = screen.getByLabelText('Body');

    const subjectRow = subjectInput.closest('.chq-form-row') as HTMLElement;
    const bodyRow = bodyTextarea.closest('.chq-form-row') as HTMLElement;
    expect(subjectRow).not.toBeNull();
    expect(bodyRow).not.toBeNull();

    // Same field-row skeleton for both -- no bespoke width class on either
    // control (the shared .chq-form-row-control > .chq-input/.chq-textarea
    // rule is what gives them the same full measure).
    expect(subjectInput.className).toBe('chq-input');
    expect(bodyTextarea.className).toBe('chq-textarea');
  });
});

// DEC-751: Recent sends lives under Compose too -- capped, read-only, and
// its "All history" link switches ?tab= rather than navigating away.
describe('CommsPage Recent sends under Compose (DEC-751)', () => {
  function batch(n: number) {
    return {
      batchKey: `batch-${n}`,
      subject: `Send #${n}`,
      sentAt: 1700000000000 + n,
      recipientCount: n,
      statusCounts: n % 2 === 0 ? { failed: n } : { sent: n },
    };
  }

  it('renders up to four batches under Compose, with no recipients disclosure, and switches ?tab= on "All history"', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/email-log`]: listEnvelope([batch(1), batch(2), batch(3), batch(4), batch(5)]),
    });

    render(
      <MemoryRouter initialEntries={['/comms']}>
        <CommsPage />
        <LocationSearchProbe />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Send #1')).toBeInTheDocument();
    // Capped at four rows -- the fifth batch never appears here.
    expect(screen.queryByText('Send #5')).not.toBeInTheDocument();

    // A batch whose statusCounts are all failures still renders -- an
    // attempted send is auditable whatever the transport did.
    expect(screen.getByText('0 sent · 2 failed')).toBeInTheDocument();

    // Read-only under Compose: no per-row recipients disclosure -- the
    // trailing "Open" control is a link into History instead (DEC-751
    // amendment, w41-g), same destination as "All history".
    fireEvent.click(screen.getAllByRole('button', { name: 'Open' })[0]!);
    await waitFor(() => {
      expect(screen.getByTestId('location-search')).toHaveTextContent('?tab=history');
    });
  });

  it('switches ?tab= to history on the "All history" link', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/email-log`]: listEnvelope([batch(1)]),
    });

    render(
      <MemoryRouter initialEntries={['/comms']}>
        <CommsPage />
        <LocationSearchProbe />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'All history' }));

    await waitFor(() => {
      expect(screen.getByTestId('location-search')).toHaveTextContent('?tab=history');
    });
  });
});
