// v12m-w4-t-r1-c: OnboardingGrid's grid read moved off the imperative
// loadGrid()/[grid,loading] useState pair onto the shared SWR cache
// (useCachedGet, DEC_013/DEC_851/DEC_678/DEC_518). This proves the read
// side of that swap: a cold mount still skeletons, a remount at an
// identical URL paints from cache with no skeleton frame, a genuinely
// different URL (page/filter change) skeletons again, an explicit
// gridRead.refetch() (a post-write reload) never re-paints the skeleton
// over an already-rendered grid, and a REJECTED refetch leaves the stale
// grid on screen with the failure routed into the page's error banner
// (DEC_518: replace wholesale on resolve, leave untouched on reject).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { OnboardingGrid } from './OnboardingGrid';
import { mockApi } from '../../test-utils/mockApi';
import { resetApiCacheForTests } from '../../lib/api';
import type { OnboardingGridResponse } from './types';

const EVENT_ID = 'evt-onboarding-swr';

const GRID: OnboardingGridResponse = {
  tasks: [{ id: 'task-1', kind: 'general', title: 'Sign speaker agreement', dueDate: null, required: true }],
  rows: [
    {
      contact: {
        id: 'ct1',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        company: 'Acme',
        hasAccount: true,
        participations: [{ participantId: 'p-ct1', submissionId: 'sub-ct1', ref: 'SES-001', title: 'Talk', inviteStatus: 'accepted' }],
      },
      cells: [{ taskId: 'task-1', assignmentId: 'as1', status: 'pending', completedAt: null, fileId: null, fileName: null, assignedAt: 0 }],
    },
  ],
  total: 1,
  page: 1,
  perPage: 50,
  counts: { speakers: 1, outstandingRequired: 1, overdue: 0, outstandingContacts: 1 },
  timezone: 'UTC',
};

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  resetApiCacheForTests();
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  expect(consoleErrorSpy).not.toHaveBeenCalled();
  consoleErrorSpy.mockRestore();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

function renderGrid() {
  return render(
    <MemoryRouter>
      <OnboardingGrid onAddSpeaker={vi.fn()} />
    </MemoryRouter>,
  );
}

describe('OnboardingGrid SWR adoption (v12m-w4-t-r1-c)', () => {
  it('cold mount renders the skeleton and no empty state', () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });

    renderGrid();

    // Synchronous check, before the mocked fetch's promise chain resolves:
    // nothing is cached for this URL yet, so gridRead.loading is true.
    expect(document.querySelector('.chq-skeleton-frame')).not.toBeNull();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('No speakers on the roster yet.')).not.toBeInTheDocument();
  });

  it('a remount at the same eventId+filters+page renders the grid with no skeleton on the first frame', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });

    const first = renderGrid();
    await waitFor(() => expect(screen.getAllByText('Ada Lovelace').length > 0).toBe(true));
    first.unmount();

    // Same URL as the first mount -- peekCachedRead seeds gridRead.data
    // synchronously, so this mount never shows a skeleton frame at all.
    renderGrid();
    expect(document.querySelector('.chq-skeleton-frame')).toBeNull();
    expect(screen.getAllByText('Ada Lovelace').length > 0).toBe(true);
  });

  it('a page/filter change (a different URL) goes back through the skeleton', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
    });

    renderGrid();
    await waitFor(() => expect(screen.getAllByText('Ada Lovelace').length > 0).toBe(true));
    expect(document.querySelector('.chq-skeleton-frame')).toBeNull();

    // "Overdue only" composes a new query string (overdueOnly=1) -- a cache
    // key never fetched before, so the hook has no seed and skeletons again.
    fireEvent.click(screen.getByRole('button', { name: 'Overdue only' }));
    expect(document.querySelector('.chq-skeleton-frame')).not.toBeNull();

    await waitFor(() => expect(screen.getAllByText('Ada Lovelace').length > 0).toBe(true));
    expect(document.querySelector('.chq-skeleton-frame')).toBeNull();
  });

  it("refetch() resolves after the response and leaves the previous grid rendered throughout (no skeleton mid-flight)", async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: GRID,
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
      'PATCH /api/v1/task-assignments/as1': { status: 500, body: { error: { code: 'internal', message: 'boom' } } },
    });

    renderGrid();
    await waitFor(() => expect(screen.getAllByText('Ada Lovelace').length > 0).toBe(true));

    // Provoke the DEC-265 rolled-back-write banner -- its "Reload the grid"
    // control is the plain, no-side-optimism path through gridRead.refetch().
    fireEvent.click(screen.getAllByRole('button', { name: 'Toggle Sign speaker agreement for Ada Lovelace' })[0]!);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reload the grid' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Reload the grid' }));
    // Mid-flight: the previous grid is still on screen, no skeleton frame.
    expect(document.querySelector('.chq-skeleton-frame')).toBeNull();
    expect(screen.getAllByText('Ada Lovelace').length > 0).toBe(true);

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Reload the grid' })).not.toBeInTheDocument());
    expect(document.querySelector('.chq-skeleton-frame')).toBeNull();
    expect(screen.getAllByText('Ada Lovelace').length > 0).toBe(true);
  });

  it('a rejected refetch keeps the grid AND surfaces the error banner', async () => {
    let onboardingCalls = 0;
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: () => {
        onboardingCalls += 1;
        if (onboardingCalls === 1) return GRID;
        return { status: 500, body: { error: { code: 'internal', message: 'grid reload boom' } } };
      },
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
      'PATCH /api/v1/task-assignments/as1': { status: 500, body: { error: { code: 'internal', message: 'boom' } } },
    });

    renderGrid();
    await waitFor(() => expect(screen.getAllByText('Ada Lovelace').length > 0).toBe(true));

    fireEvent.click(screen.getAllByRole('button', { name: 'Toggle Sign speaker agreement for Ada Lovelace' })[0]!);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reload the grid' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Reload the grid' }));

    await waitFor(() => expect(screen.getByText('grid reload boom')).toBeInTheDocument());
    // DEC_518: the reject left gridRead.data untouched -- the stale, still-
    // correct row stays on screen rather than the page going blank.
    expect(screen.getAllByText('Ada Lovelace').length > 0).toBe(true);
  });

  it('DEC_518 wave-117: a filter change while a post-mutation refetch is still in flight never lets the old key\'s payload land -- the grid shows only the new filter\'s rows', async () => {
    const OVERDUE_GRID: OnboardingGridResponse = {
      ...GRID,
      rows: [
        {
          contact: {
            id: 'ct2',
            name: 'Grace Overdue',
            email: 'grace@example.com',
            company: 'Acme',
            hasAccount: true,
            participations: [{ participantId: 'p-ct2', submissionId: 'sub-ct2', ref: 'SES-002', title: 'Talk', inviteStatus: 'accepted' }],
          },
          cells: [{ taskId: 'task-1', assignmentId: 'as2', status: 'pending', completedAt: null, fileId: null, fileName: null, assignedAt: 0 }],
        },
      ],
      counts: { speakers: 1, outstandingRequired: 1, overdue: 1, outstandingContacts: 1 },
    };
    // Distinguishable from GRID -- if this ever lands after the filter click
    // it proves the old key's stale payload reached the new-filter view.
    const STALE_RELOAD_GRID: OnboardingGridResponse = {
      ...GRID,
      rows: [{ ...GRID.rows[0]!, contact: { ...GRID.rows[0]!.contact, name: 'STALE Ada' } }],
    };

    let onboardingCalls = 0;
    let resolveStaleReload!: (value: Response) => void;
    const staleReloadPromise = new Promise<Response>((resolve) => {
      resolveStaleReload = resolve;
    });

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const rawUrl = typeof input === 'string' ? input : input.toString();
      const url = new URL(rawUrl, 'http://localhost');
      const method = (init?.method ?? 'GET').toUpperCase();
      const key = `${method} ${url.pathname}`;
      const jsonResponse = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

      if (key === `GET /api/v1/events/${EVENT_ID}/onboarding`) {
        onboardingCalls += 1;
        if (onboardingCalls === 1) return jsonResponse(GRID); // cold mount
        if (onboardingCalls === 2) return staleReloadPromise; // post-mutation reload, held open
        return jsonResponse(OVERDUE_GRID); // the filter change's own fetch
      }
      if (key === `GET /api/v1/events/${EVENT_ID}/forms`) return jsonResponse({ forms: [] });
      if (key === 'PATCH /api/v1/task-assignments/as1') {
        return jsonResponse({ error: { code: 'internal', message: 'boom' } }, 500);
      }
      throw new Error(`unhandled route ${key}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    renderGrid();
    await waitFor(() => expect(screen.getAllByText('Ada Lovelace').length > 0).toBe(true));

    // Provoke the rolled-back-write banner, then reload -- this issues the
    // post-mutation refetch() at the OLD (default-filters) key, held open by
    // staleReloadPromise above.
    fireEvent.click(screen.getAllByRole('button', { name: 'Toggle Sign speaker agreement for Ada Lovelace' })[0]!);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reload the grid' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Reload the grid' }));

    // While that reload is still in flight, change the filter -- a new
    // gridPath, its own fetch (onboardingCalls === 3, OVERDUE_GRID).
    fireEvent.click(screen.getByRole('button', { name: 'Overdue only' }));
    await waitFor(() => expect(screen.getAllByText('Grace Overdue').length > 0).toBe(true));
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument();
    expect(screen.queryByText('STALE Ada')).not.toBeInTheDocument();

    // Now let the stale reload resolve -- the fix's generation/path guard
    // must discard it; the overdue-filtered grid must stay exactly as is.
    resolveStaleReload(
      new Response(JSON.stringify(STALE_RELOAD_GRID), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    // A real macrotask flush -- an unguarded stale setData lands a tick
    // after Response.json()'s own microtask chain, past a couple of bare
    // `await Promise.resolve()` ticks.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByText('STALE Ada')).not.toBeInTheDocument();
    expect(screen.getAllByText('Grace Overdue').length > 0).toBe(true);
  });
});
