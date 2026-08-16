// DEC-505 (wave-13 amendment): POST /api/v1/plans/:id/remind's success body
// always carries the CLOSED {sent,skipped,remaining} vocabulary (DEC-238),
// and formatReminderResult prints those server-reported counts verbatim
// (never a generic "Reminders sent" line) -- this proves that for BOTH
// reminder scopes ("Remind laggards" / "Remind the N not started"). It also
// proves a genuinely refused remind/advance-round call (requireOwnedPlan's
// "Plan not found", the 409 conflict a mid-session round advance can hit)
// reaches the shared top-level banner, never a generic
// "Failed to send reminders"/"Failed to advance round" fallback.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProgressPanel } from './ProgressPanel';
import { listEnvelope, mockApi, errorEnvelope } from '../../test-utils/mockApi';
import type { ProgressRow } from './types';

const PLAN_ID = 'plan-progress-refusal';

const NOT_STARTED_ROW: ProgressRow = {
  userId: 'user-1',
  email: 'reviewer-a@example.com',
  name: 'Reviewer A',
  assigned: 5,
  completed: 0,
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
    eventId: 'evt-progress-refusal',
    name: 'Track Review',
    instructions: '',
    openDate: null,
    closeDate: null,
    filters: null,
    anonymized: false,
    scale: { min: 1, max: 5 },
    criteria: [],
    rounds: 2,
    currentRound: 1,
    roundCriteria: null,
    maxEvaluations: null,
    createdAt: 1700000000000,
    ...overrides,
  };
}

function renderPanel() {
  return render(
    <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}/progress`]}>
      <Routes>
        <Route path="/review/plans/:planId/progress" element={<ProgressPanel />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProgressPanel reminder result wording (DEC-238/DEC-505)', () => {
  it('"Remind laggards" prints the server\'s own sent/skipped/remaining counts, not a generic line', async () => {
    mockApi({
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([NOT_STARTED_ROW]),
      [`POST /api/v1/plans/${PLAN_ID}/remind`]: { sent: 2, skipped: 1, remaining: 3 },
    });

    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: /Remind laggards/ }));

    expect(await screen.findByText('Sent: 2. Skipped: 1. Remaining: 3.')).toBeInTheDocument();
    expect(screen.queryByText('Reminders sent')).not.toBeInTheDocument();
  });

  it('"Remind the N not started" also prints the server\'s own counts', async () => {
    mockApi({
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([NOT_STARTED_ROW]),
      [`POST /api/v1/plans/${PLAN_ID}/remind`]: { sent: 1, skipped: 0, remaining: 0 },
    });

    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: /Remind the 1 not started/ }));

    expect(await screen.findByText('Sent: 1. Skipped: 0. Remaining: 0.')).toBeInTheDocument();
  });

  it('a refused remind (Plan not found) renders through the shared error banner, not a generic fallback', async () => {
    mockApi({
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([NOT_STARTED_ROW]),
      [`POST /api/v1/plans/${PLAN_ID}/remind`]: {
        status: 404,
        body: errorEnvelope('not_found', 'Plan not found'),
      },
    });

    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: /Remind laggards/ }));

    expect(await screen.findByText('Plan not found')).toBeInTheDocument();
    expect(screen.queryByText('Failed to send reminders')).not.toBeInTheDocument();
  });

  it('a refused advance-round renders through the shared error banner', async () => {
    mockApi({
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
      [`POST /api/v1/plans/${PLAN_ID}/advance-round`]: {
        status: 409,
        body: errorEnvelope('conflict', 'Every submission in this round must be scored before advancing'),
      },
    });

    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: 'Advance to round 2' }));
    const dialog = await screen.findByRole('dialog', { name: 'Advance round' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Advance round' }));

    await waitFor(() => {
      expect(screen.getByText('Every submission in this round must be scored before advancing')).toBeInTheDocument();
    });
  });
});
