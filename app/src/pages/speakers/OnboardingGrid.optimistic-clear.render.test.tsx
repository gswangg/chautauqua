// DEC-265 wave-138 amendment: the optimistic `optimisticOverride` grid
// snapshot must retire on a SUCCESSFUL write (applyCellStatus /
// applyInviteStatus), not just on a gridPath change or an explicit reload.
// Left set, it freezes the v12 column-head aggregate (taskDoneLabel above,
// "N of M done") and the counts panel behind a snapshot with only ONE field
// flipped, forever -- the bug this file proves fixed.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { OnboardingGrid } from './OnboardingGrid';
import { mockApi } from '../../test-utils/mockApi';
import { resetApiCacheForTests } from '../../lib/api';
import type { OnboardingGridResponse } from './types';

const EVENT_ID = 'evt-onboarding-optimistic-clear';

function baseGrid(assigned: number, complete: number): OnboardingGridResponse {
  return {
    tasks: [{ id: 'task-1', kind: 'general', title: 'Sign speaker agreement', dueDate: null, required: true, assigned, complete }],
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

describe('OnboardingGrid optimistic override retires on write success (DEC-265 wave-138)', () => {
  it('applyCellStatus: after a successful PATCH, the column head shows the SERVER refetch numbers, not the locally-guessed flip', async () => {
    let onboardingCalls = 0;
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: () => {
        onboardingCalls += 1;
        // Cold mount: the mandate's own Tier-0 shape, "7 of 12 done".
        if (onboardingCalls === 1) return baseGrid(12, 7);
        // Post-mutation refetch: the server's real aggregate jumped by TWO
        // (some other client's write landed too), not the naive
        // complete+1 a client-side guess would produce.
        return baseGrid(12, 9);
      },
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
      'PATCH /api/v1/task-assignments/as1': {},
    });

    renderGrid();
    await waitFor(() => expect(screen.getByText('7 of 12 done')).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole('button', { name: 'Toggle Sign speaker agreement for Ada Lovelace' })[0]!);

    // The refetched server payload must become visible -- the override must
    // not freeze the head at a client-guessed number forever.
    await waitFor(() => expect(screen.getByText('9 of 12 done')).toBeInTheDocument());
    expect(screen.queryByText('7 of 12 done')).not.toBeInTheDocument();
    expect(screen.queryByText('8 of 12 done')).not.toBeInTheDocument();
  });

  it('applyCellStatus failure path: only the one cell rolls back, and a later reload still reaches the server payload', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: baseGrid(12, 7),
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
      'PATCH /api/v1/task-assignments/as1': { status: 500, body: { error: { code: 'internal', message: 'boom' } } },
    });

    renderGrid();
    await waitFor(() => expect(screen.getByText('7 of 12 done')).toBeInTheDocument());

    const toggle = screen.getAllByRole('button', { name: 'Toggle Sign speaker agreement for Ada Lovelace' })[0]!;
    fireEvent.click(toggle);

    // The failed write's banner appears and the one cell is rolled back --
    // the aggregate itself is untouched by a single cell's rollback (this
    // page never recomputes it client-side).
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reload the grid' })).toBeInTheDocument());
    expect(screen.getByText('7 of 12 done')).toBeInTheDocument();
  });

  it('applyInviteStatus: after a successful participation write, the SERVER refetch numbers replace the client snapshot', async () => {
    let onboardingCalls = 0;
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: () => {
        onboardingCalls += 1;
        if (onboardingCalls === 1) return baseGrid(12, 7);
        // The refetch's server aggregate differs from the pre-write
        // snapshot -- proves the override was retired rather than masking
        // this response too.
        return baseGrid(12, 10);
      },
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
      'PATCH /api/v1/submissions/sub-ct1/participants/p-ct1': {},
    });

    renderGrid();
    await waitFor(() => expect(screen.getByText('7 of 12 done')).toBeInTheDocument());

    const table = within(screen.getByRole('table'));
    fireEvent.click(table.getByRole('button', { name: 'Participation status for Ada Lovelace: Confirmed' }));
    const menu = within(screen.getByRole('menu', { name: 'Participation status for Ada Lovelace' }));
    fireEvent.click(menu.getByRole('menuitemradio', { name: /^Declined/ }));

    await waitFor(() => expect(screen.getByText('10 of 12 done')).toBeInTheDocument());
    expect(screen.queryByText('7 of 12 done')).not.toBeInTheDocument();
  });

  it('applyInviteStatus failure path: only the one participation rolls back', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/onboarding`]: baseGrid(12, 7),
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [] },
      'PATCH /api/v1/submissions/sub-ct1/participants/p-ct1': {
        status: 500,
        body: { error: { code: 'internal', message: 'boom' } },
      },
    });

    renderGrid();
    await waitFor(() => expect(screen.getByText('7 of 12 done')).toBeInTheDocument());

    const table = within(screen.getByRole('table'));
    fireEvent.click(table.getByRole('button', { name: 'Participation status for Ada Lovelace: Confirmed' }));
    const menu = within(screen.getByRole('menu', { name: 'Participation status for Ada Lovelace' }));
    fireEvent.click(menu.getByRole('menuitemradio', { name: /^Declined/ }));

    // Rolled back to the pre-flip participation status -- the trigger's own
    // accessible name names the restored value.
    await waitFor(() =>
      expect(table.getByRole('button', { name: 'Participation status for Ada Lovelace: Confirmed' })).toBeInTheDocument(),
    );
    expect(screen.getByText('7 of 12 done')).toBeInTheDocument();
  });
});
