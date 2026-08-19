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
});
