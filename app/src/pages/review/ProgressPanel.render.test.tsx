// w52-d (DEC-678 amendment): an empty progress roster renders through the
// shared EmptyState 'fresh' block, never a bare `<p className="chq-empty">`
// -- no action prop, since the standalone route's "Remind the N not
// started" control already sits on the section head.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProgressPanel } from './ProgressPanel';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';
import type { ProgressRow } from './types';

const PLAN_ID = 'plan-progress-1';

// A "not started" row (completed === 0, assigned > 0) is also a laggard
// (completed < assigned) -- selectRemindTargets('incomplete') covers both.
const NOT_STARTED_ROW: ProgressRow = {
  userId: 'user-1',
  email: 'reviewer-a@example.com',
  name: 'Reviewer A',
  assigned: 5,
  completed: 0,
  recused: 0,
  trackName: null,
};

// A partially-scored row: a laggard (completed < assigned) but NOT
// not-started (completed > 0) -- used to exercise the empty not-started
// population while the laggard population stays non-empty.
const PARTIAL_ROW: ProgressRow = {
  userId: 'user-2',
  email: 'reviewer-b@example.com',
  name: 'Reviewer B',
  assigned: 5,
  completed: 2,
  recused: 0,
  trackName: null,
};

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  consoleErrorSpy.mockRestore();
  vi.unstubAllGlobals();
});

function plan(overrides: Record<string, unknown> = {}) {
  return {
    id: PLAN_ID,
    eventId: 'evt-progress',
    name: 'Track Review',
    instructions: '',
    openDate: null,
    closeDate: null,
    filters: null,
    anonymized: false,
    scale: { min: 1, max: 5 },
    criteria: [],
    rounds: 1,
    currentRound: 1,
    roundCriteria: null,
    maxEvaluations: null,
    createdAt: 1700000000000,
    ...overrides,
  };
}

describe('ProgressPanel render smoke', () => {
  it('renders the shared EmptyState fresh block for an empty roster, with no duplicate action', async () => {
    mockApi({
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}/progress`]}>
        <Routes>
          <Route path="/review/plans/:planId/progress" element={<ProgressPanel />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('No reviewers assigned yet.')).toBeInTheDocument();
    expect(document.querySelector('.chq-empty-block-fresh')).toBeInTheDocument();
    expect(document.querySelector('.chq-empty-actions')).not.toBeInTheDocument();
  });

  // DEC-760 (wave-60 amendment): both reminder scopes render on both
  // surfaces (standalone page and landing embed). "Remind laggards" keeps
  // its disabled-when-empty rule (its population always exists); "Remind
  // the N not started" keeps its hidden-when-zero rule (DEC-733: an action
  // with no possible target is absent, not disabled).
  it.each([
    { label: 'standalone', embedded: false },
    { label: 'embedded', embedded: true },
  ])('$label: shows both scopes when not-started is non-empty', async ({ embedded }) => {
    mockApi({
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([NOT_STARTED_ROW, PARTIAL_ROW]),
    });

    if (embedded) {
      render(<ProgressPanel planId={PLAN_ID} />);
    } else {
      render(
        <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}/progress`]}>
          <Routes>
            <Route path="/review/plans/:planId/progress" element={<ProgressPanel />} />
          </Routes>
        </MemoryRouter>,
      );
    }

    const laggardsButton = await screen.findByRole('button', { name: /^Remind laggards/ });
    expect(laggardsButton).toBeInTheDocument();
    expect(laggardsButton).not.toBeDisabled();

    const notStartedButton = screen.getByRole('button', { name: /^Remind the \d+ not started/ });
    expect(notStartedButton).toBeInTheDocument();
    expect(notStartedButton).not.toBeDisabled();
  });

  it.each([
    { label: 'standalone', embedded: false },
    { label: 'embedded', embedded: true },
  ])('$label: hides "Remind the N not started" and disables laggards when both populations are empty', async ({ embedded }) => {
    mockApi({
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
    });

    if (embedded) {
      render(<ProgressPanel planId={PLAN_ID} />);
    } else {
      render(
        <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}/progress`]}>
          <Routes>
            <Route path="/review/plans/:planId/progress" element={<ProgressPanel />} />
          </Routes>
        </MemoryRouter>,
      );
    }

    const laggardsButton = await screen.findByRole('button', { name: /^Remind laggards/ });
    expect(laggardsButton).toBeInTheDocument();
    expect(laggardsButton).toBeDisabled();

    expect(screen.queryByRole('button', { name: /not started/ })).not.toBeInTheDocument();
  });

  it('reports sent, skipped and remaining from the server response on the standalone surface', async () => {
    mockApi({
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([NOT_STARTED_ROW]),
      [`POST /api/v1/plans/${PLAN_ID}/remind`]: { sent: 3, skipped: 1, remaining: 2 },
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}/progress`]}>
        <Routes>
          <Route path="/review/plans/:planId/progress" element={<ProgressPanel />} />
        </Routes>
      </MemoryRouter>,
    );

    const laggardsButton = await screen.findByRole('button', { name: /^Remind laggards/ });
    fireEvent.click(laggardsButton);

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Sent: 3. Skipped: 1. Remaining: 2.');
    });
  });

  // DEC-238 (wave-66 amendment): the server's remind response carries a
  // CLOSED vocabulary -- sent/skipped/remaining are ALWAYS present -- so the
  // panel never falls back to a client-hedged "unknown". A failed count,
  // when present, appends a fourth clause -- and per DEC-664 (wave-59
  // amendment) that clause names the server's per-recipient REASON through
  // the shared failureLines reporter, never the count alone.
  it('appends a failure clause naming the reason when the server reports failed sends', async () => {
    mockApi({
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([NOT_STARTED_ROW]),
      [`POST /api/v1/plans/${PLAN_ID}/remind`]: { sent: 3, skipped: 0, remaining: 0, failed: [{ email: 'x@example.com', message: 'boom' }] },
    });

    render(<ProgressPanel planId={PLAN_ID} />);

    const notStartedButton = await screen.findByRole('button', { name: /^Remind the \d+ not started/ });
    fireEvent.click(notStartedButton);

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Sent: 3. Skipped: 0. Remaining: 0. Failed: 1. boom');
    });
  });

  it('names the plan in the rounds counter so it reads as a per-plan fact', async () => {
    mockApi({
      [`GET /api/v1/plans/${PLAN_ID}`]: plan({ name: 'Track Review', currentRound: 1, rounds: 2 }),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}/progress`]}>
        <Routes>
          <Route path="/review/plans/:planId/progress" element={<ProgressPanel />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Track Review: round 1 of 2')).toBeInTheDocument();
  });

  // DEC-147 wave-63 amendment: a single-round plan's round count is noise,
  // not information -- planNamesRound(1) is false, so no round line at all
  // (not an empty span) rather than "round 1 of 1".
  it('renders no round line for a single-round plan', async () => {
    mockApi({
      [`GET /api/v1/plans/${PLAN_ID}`]: plan({ name: 'Track Review', currentRound: 1, rounds: 1 }),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}/progress`]}>
        <Routes>
          <Route path="/review/plans/:planId/progress" element={<ProgressPanel />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { name: 'Reviewer progress' });
    expect(screen.queryByText(/round 1 of 1/)).not.toBeInTheDocument();
    expect(document.querySelector('.chq-summary')).not.toBeInTheDocument();
  });
});
