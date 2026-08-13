// CNT-12: content-approval reachability. Locks in the always-visible
// per-row Approve/Request changes control on the worklist (SessionList),
// which previously required drilling into DeliverableDetail (itself
// reachable only after uploading a file) to reach
// POST /api/v1/submissions/:id/content-status. Mirrors the DEC-144
// layer-2 harness pattern used by Submissions.render.test.tsx.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { ContentApp } from './ContentApp';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-content-render-1';

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe('ContentApp / SessionList render smoke: always-visible content-status control', () => {
  it('approves content directly from the worklist row without opening deliverable detail', async () => {
    const contentStatusMock = vi.fn(() => ({ id: 'sub-1', contentStatus: 'approved' }));
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([
        {
          id: 'sub-1',
          ref: 'S-001',
          title: 'A Talk With No Files Yet',
          status: 'accepted',
          contentStatus: 'pending',
          speakers: [{ contactId: 'c1', name: 'Ada Lovelace' }],
          trackIds: [],
          submittedAt: null,
          createdAt: 1700000000000,
          deliverableCounts: { presentation: 0, poster: 0, handout: 0 },
        },
      ]),
      [`POST /api/v1/submissions/sub-1/content-status`]: contentStatusMock,
    });

    render(
      <MemoryRouter>
        <ContentApp />
      </MemoryRouter>,
    );

    // Default tab is 'changes_requested' — switch to 'All' to see the row.
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'All' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('tab', { name: 'All' }));

    await waitFor(() => {
      expect(screen.getByText('A Talk With No Files Yet')).toBeInTheDocument();
    });

    // w1-h reskin: DEC-370's binding copy for this action is "Ask for
    // changes" (not the old "Request changes"), inline on the worklist row.
    expect(screen.getByRole('button', { name: 'Ask for changes' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    await waitFor(() => {
      expect(contentStatusMock).toHaveBeenCalled();
    });
  });
});

// w1-h reskin smoke: page shell uses the shared DEC-367/368 tokens/classes
// rather than the old unstyled chq-page/chq-tab markup.
describe('ContentApp reskin (DEC-366..368)', () => {
  it('renders the page title and view tabs with the shared shell classes', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
    });

    render(
      <MemoryRouter>
        <ContentApp />
      </MemoryRouter>,
    );

    const heading = await screen.findByRole('heading', { name: 'Content' });
    expect(heading).toHaveClass('chq-page-title');

    const worklistTab = screen.getByRole('tab', { name: 'Worklist' });
    expect(worklistTab).toHaveClass('chq-pill');
    expect(worklistTab).toHaveClass('is-active');
  });
});

// CNT-07b regression: deliverable counts on the worklist come straight from
// the DEC-341 list payload's deliverableCounts field (server-hydrated via a
// chain-roots-only grouped query, DEC-247) — no per-row files fan-out.
describe('ContentApp worklist deliverable counts (DEC-247 chain roots)', () => {
  it('renders the server-reported chain-root count for a replaced presentation file', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([
        {
          id: 'sub-1',
          ref: 'S-001',
          title: 'A Talk With A Replaced File',
          status: 'accepted',
          contentStatus: 'pending',
          speakers: [],
          trackIds: [],
          submittedAt: null,
          createdAt: 1700000000000,
          // Server already counted only the chain root (1), not the
          // replaced ancestor.
          deliverableCounts: { presentation: 1, poster: 0, handout: 0 },
        },
      ]),
    });

    render(
      <MemoryRouter>
        <ContentApp />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('tab', { name: 'All' }));

    const row = (await screen.findByText('A Talk With A Replaced File')).closest('tr');
    if (!row) throw new Error('worklist row not found');

    const headerCells = Array.from(row.closest('table')!.querySelectorAll('thead th'));
    const presentationColIndex = headerCells.findIndex((th) => th.textContent === 'Presentation');
    expect(presentationColIndex).toBeGreaterThanOrEqual(0);

    const rowCells = Array.from(row.querySelectorAll('td'));
    expect(rowCells[presentationColIndex]?.textContent).toBe('1');
  });
});

// DEC-825 amendment: set-based bulk content-approval — selecting rows on
// the worklist surfaces a .chq-bulkbar (shared vocabulary, DEC-825) with
// Approve/Request changes/Mark pending, sending one POST carrying every
// selected id and reloading the worklist on success.
describe('ContentApp worklist bulk content-status (DEC-825 amendment)', () => {
  function twoRowEnvelope() {
    return listEnvelope([
      {
        id: 'sub-1',
        ref: 'S-001',
        title: 'Talk One',
        status: 'accepted',
        contentStatus: 'pending',
        speakers: [],
        trackIds: [],
        submittedAt: null,
        createdAt: 1700000000000,
        deliverableCounts: { presentation: 0, poster: 0, handout: 0 },
      },
      {
        id: 'sub-2',
        ref: 'S-002',
        title: 'Talk Two',
        status: 'accepted',
        contentStatus: 'pending',
        speakers: [],
        trackIds: [],
        submittedAt: null,
        createdAt: 1700000001000,
        deliverableCounts: { presentation: 0, poster: 0, handout: 0 },
      },
    ]);
  }

  it('shows a selection count and sends one POST carrying every selected id, then reloads', async () => {
    const submissionsMock = vi.fn(() => twoRowEnvelope());
    const fetchMock = mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: submissionsMock,
      [`POST /api/v1/events/${EVENT_ID}/submissions/content-status`]: { updated: 2 },
    });

    render(
      <MemoryRouter>
        <ContentApp />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('tab', { name: 'All' }));
    await screen.findByText('Talk One');
    await screen.findByText('Talk Two');

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all on page' }));

    expect(await screen.findByText('2 selected')).toBeInTheDocument();

    const callsBeforeBulk = submissionsMock.mock.calls.length;

    const bulkbar = screen.getByRole('toolbar', { name: 'Bulk content actions' });
    fireEvent.click(within(bulkbar).getByRole('button', { name: 'Approve' }));

    await waitFor(() => {
      const bulkCalls = fetchMock.mock.calls.filter(
        ([input]) => String(input).includes('/submissions/content-status'),
      );
      expect(bulkCalls).toHaveLength(1);
    });
    const [, init] = fetchMock.mock.calls.find(([input]) => String(input).includes('/submissions/content-status'))!;
    const body = JSON.parse((init as RequestInit).body as string) as { ids: string[]; contentStatus: string };
    expect(body.contentStatus).toBe('approved');
    expect(body.ids.sort()).toEqual(['sub-1', 'sub-2']);

    // Selection clears and the worklist reloads.
    await waitFor(() => {
      expect(submissionsMock.mock.calls.length).toBeGreaterThan(callsBeforeBulk);
    });
    expect(screen.queryByText('2 selected')).not.toBeInTheDocument();
  });
});

// w1-e: staleness fixes — switching Worklist <-> Files refetches, and the
// explicit Refresh button re-fetches whichever list is currently visible.
describe('ContentApp: fresh loads on view switch and explicit refresh', () => {
  it('refetches the worklist when the Refresh button is clicked', async () => {
    const submissionsMock = vi.fn(() =>
      listEnvelope([
        {
          id: 'sub-1',
          ref: 'S-001',
          title: 'A Talk',
          status: 'accepted',
          contentStatus: 'pending',
          speakers: [],
          trackIds: [],
          submittedAt: null,
          createdAt: 1700000000000,
          deliverableCounts: { presentation: 0, poster: 0, handout: 0 },
        },
      ]),
    );
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: submissionsMock,
    });

    render(
      <MemoryRouter>
        <ContentApp />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
    });
    expect(submissionsMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    await waitFor(() => {
      expect(submissionsMock).toHaveBeenCalledTimes(2);
    });
  });

  it('reloads the Files library when switching from Worklist to Files', async () => {
    const filesMock = vi.fn(() => listEnvelope([]));
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/files`]: filesMock,
    });

    render(
      <MemoryRouter>
        <ContentApp />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Files' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('tab', { name: 'Files' }));

    await waitFor(() => {
      expect(filesMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    await waitFor(() => {
      expect(filesMock).toHaveBeenCalledTimes(2);
    });
  });
});
