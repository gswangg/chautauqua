// DEC-265 wave-138 amendment: the grid's optimistic override
// (`optimisticOverride`, layered over `gridRead.data` -- see the
// `useCachedGet` seam documented in OnboardingGrid.swr.render.test.tsx) is
// cleared by the write that SUCCEEDS, not only by the write that fails.
// Before this fix, applyCellStatus's and applyInviteStatus's success paths
// reconciled `pendingFailure` and stopped -- the override lived on forever
// (nothing else clears it besides a `gridPath` change), so the server's
// post-mutation payload (task.assigned/task.complete behind the column
// head's "N of M done" label, and the `counts` panel) never reached the
// screen for that filter/page until the user changed filters or reloaded.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, within, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { OnboardingGrid } from './OnboardingGrid';
import { mockApi } from '../../test-utils/mockApi';
import { resetApiCacheForTests } from '../../lib/api';
import type { OnboardingGridResponse } from './types';

const EVENT_ID = 'evt-onboarding-optimistic-clear';

function baseGrid(overrides: Partial<OnboardingGridResponse> = {}): OnboardingGridResponse {
  return {
    tasks: [{ id: 'task-1', kind: 'general', title: 'Sign speaker agreement', dueDate: null, required: true, assigned: 12, complete: 7 }],
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
    ...overrides,
  };
}

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

function summaryText() {
  return within(document.querySelector('.chq-speakers-head')!).getByText(/accepted/).closest('span');
}

describe('OnboardingGrid: DEC-265 wave-138 -- a successful write clears the optimistic override', () => {
  it('applyCellStatus: a successful PATCH refetches and clears the override, so the column head and counts panel show the server post-mutation totals', async () => {
    const grid = baseGrid();
    // The server's post-mutation payload: assigned/complete moved (the
    // column head's "N of M done" label), and the counts panel moved too.
    const gridAfterWrite: OnboardingGridResponse = {
      ...baseGrid(),
      tasks: [{ ...baseGrid().tasks[0]!, assigned: 12, complete: 8 }],
      counts: { speakers: 1, outstandingRequired: 0, overdue: 0, outstandingContacts: 0 },
    };

    let onboardingCalls = 0;
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: () => {
        onboardingCalls += 1;
        return onboardingCalls === 1 ? grid : gridAfterWrite;
      },
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
      'PATCH /api/v1/task-assignments/as1': { body: {} },
    });

    renderGrid();
    await waitFor(() => expect(screen.getAllByText('Ada Lovelace').length > 0).toBe(true));
    expect(screen.getByText('7 of 12 done')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: /Toggle Sign speaker agreement for Ada Lovelace/ })[0]!);

    // The column head must eventually reflect the refetched, incremented
    // total rather than freezing on the pre-toggle optimistic snapshot.
    await waitFor(() => expect(screen.getByText('8 of 12 done')).toBeInTheDocument());
    expect(screen.queryByText('7 of 12 done')).not.toBeInTheDocument();

    // The counts panel moved too.
    await waitFor(() => expect(summaryText()).toHaveTextContent('0 overdue'));

    // The post-mutation refetch actually happened (beyond the cold mount).
    expect(onboardingCalls).toBeGreaterThanOrEqual(2);
  });

  it('applyInviteStatus: a successful PATCH refetches and clears the override, so a server-supplied inviteStatus change is visible', async () => {
    const grid = baseGrid();
    const gridAfterWrite: OnboardingGridResponse = {
      ...baseGrid(),
      rows: [
        {
          ...baseGrid().rows[0]!,
          contact: {
            ...baseGrid().rows[0]!.contact,
            participations: [{ participantId: 'p-ct1', submissionId: 'sub-ct1', ref: 'SES-001', title: 'Talk', inviteStatus: 'declined' }],
          },
        },
      ],
    };

    let onboardingCalls = 0;
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: () => {
        onboardingCalls += 1;
        return onboardingCalls === 1 ? grid : gridAfterWrite;
      },
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
      'PATCH /api/v1/submissions/sub-ct1/participants/p-ct1': { body: {} },
    });

    renderGrid();
    await waitFor(() => expect(screen.getAllByText('Ada Lovelace').length > 0).toBe(true));

    const table = within(screen.getByRole('table'));
    fireEvent.click(table.getByRole('button', { name: 'Participation status for Ada Lovelace: Confirmed' }));
    const menu = table.getByRole('menu', { name: 'Participation status for Ada Lovelace' });
    fireEvent.click(within(menu).getByRole('menuitemradio', { name: /^Declined/ }));

    // Optimistic paint first (still whatever the write requested).
    await waitFor(() => {
      expect(table.getByRole('button', { name: 'Participation status for Ada Lovelace: Declined' })).toBeInTheDocument();
    });

    // The refetch must actually have happened -- proves the override was
    // cleared rather than permanently masking gridRead.data.
    await waitFor(() => expect(onboardingCalls).toBeGreaterThanOrEqual(2));
    // And the server's post-mutation payload (which this test made
    // identical to the optimistic guess on purpose) is what's on screen,
    // not a frozen pre-toggle snapshot.
    expect(table.getByRole('button', { name: 'Participation status for Ada Lovelace: Declined' })).toBeInTheDocument();
  });

  it('negative: the FAILURE path still rolls back exactly one cell and leaves a concurrent success on another cell alone (DEC-265 wave-110 guarantee, unchanged)', async () => {
    const grid: OnboardingGridResponse = {
      tasks: [{ id: 'task-1', kind: 'general', title: 'Sign speaker agreement', dueDate: null, required: true, assigned: 2, complete: 0 }],
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
        {
          contact: {
            id: 'ct2',
            name: 'Grace Hopper',
            email: 'grace@example.com',
            company: 'Acme',
            hasAccount: true,
            participations: [{ participantId: 'p-ct2', submissionId: 'sub-ct2', ref: 'SES-002', title: 'Talk', inviteStatus: 'accepted' }],
          },
          cells: [{ taskId: 'task-1', assignmentId: 'as2', status: 'pending', completedAt: null, fileId: null, fileName: null, assignedAt: 0 }],
        },
      ],
      total: 2,
      page: 1,
      perPage: 50,
      counts: { speakers: 2, outstandingRequired: 2, overdue: 0, outstandingContacts: 2 },
      timezone: 'UTC',
    };

    // The refetch this fix adds must see the WRITE's effect, exactly as a
    // real server would -- as2's successful PATCH is reflected server-side
    // before the grid's post-success refetch runs.
    const gridAfterAs2Success: OnboardingGridResponse = {
      ...grid,
      rows: [
        grid.rows[0]!,
        { ...grid.rows[1]!, cells: [{ ...grid.rows[1]!.cells[0]!, status: 'complete', completedAt: 1 }] },
      ],
    };
    let as2Succeeded = false;

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: () => (as2Succeeded ? gridAfterAs2Success : grid),
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
      'PATCH /api/v1/task-assignments/as1': { status: 500, body: { error: { code: 'internal', message: 'boom' } } },
      'PATCH /api/v1/task-assignments/as2': () => {
        as2Succeeded = true;
        return { body: {} };
      },
    });

    renderGrid();
    await waitFor(() => expect(screen.getAllByText('Ada Lovelace').length > 0).toBe(true));

    // Fire the failing write (as1) and the concurrent success (as2)
    // together -- both optimistically flip first.
    fireEvent.click(screen.getAllByRole('button', { name: /Toggle Sign speaker agreement for Ada Lovelace/ })[0]!);
    fireEvent.click(screen.getAllByRole('button', { name: /Toggle Sign speaker agreement for Grace Hopper/ })[0]!);

    // The failed cell rolls back to Pending and the banner names it.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reload the grid' })).toBeInTheDocument());
    const adaRow = screen.getAllByText('Ada Lovelace')[0]!.closest('tr')!;
    expect(within(adaRow).getByText(/^Pending/)).toBeInTheDocument();

    // The concurrent success on Grace's cell must NOT have been clobbered
    // by as1's whole-grid-shaped rollback -- it stays Complete.
    const graceRow = screen.getAllByText('Grace Hopper')[0]!.closest('tr')!;
    expect(within(graceRow).getByText('Complete')).toBeInTheDocument();
  });
});
