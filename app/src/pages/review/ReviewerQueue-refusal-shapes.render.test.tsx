// DEC-505 (wave-13 amendment): src/routes/review/recusals.ts's DELETE
// /review/plans/:planId/recusals/:submissionId throws several field-less
// refusals -- "This review plan is not currently open" (:68, a plan closed
// mid-session), "Submission not found" (:64/:73), "Recusal not found"
// (:77) -- and the queue fetch itself (GET /queue) can refuse too. This
// proves each reaches the DOM through ReviewerQueue's existing top-level
// `chq-error` banner, never a generic "Failed to undo recusal"/"Failed to
// load your queue" fallback.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ReviewerQueue } from './ReviewerQueue';
import { listEnvelope, mockApi, errorEnvelope } from '../../test-utils/mockApi';

const PLAN_ID = 'plan-refusal-1';

function queueEnvelope(overrides: Record<string, unknown> = {}) {
  return {
    ...listEnvelope([]),
    total: 0,
    unscoredTotal: 0,
    open: true,
    viewerIsOrganizer: false,
    cappedOut: 0,
    recused: [
      { submissionId: 'sub-r1', ref: 'S-020', title: 'Conflicted Talk', reason: 'Personal conflict' },
    ],
    ...overrides,
  };
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  consoleErrorSpy.mockRestore();
});

function renderQueue() {
  return render(
    <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
      <Routes>
        <Route path="/review/plans/:planId" element={<ReviewerQueue />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ReviewerQueue undo-recusal refusal shapes (DEC-505 wave-13 amendment)', () => {
  it('"This review plan is not currently open" (a plan closed mid-session) renders through the shared banner', async () => {
    mockApi({
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: queueEnvelope(),
      [`DELETE /api/v1/review/plans/${PLAN_ID}/recusals/sub-r1`]: {
        status: 409,
        body: errorEnvelope('conflict', 'This review plan is not currently open'),
      },
    });

    renderQueue();
    const undo = await screen.findByRole('button', { name: 'Undo' });
    fireEvent.click(undo);

    expect(await screen.findByText('This review plan is not currently open')).toBeInTheDocument();
    expect(screen.queryByText('Failed to undo recusal')).not.toBeInTheDocument();
  });

  it('"Recusal not found" renders verbatim, not a generic fallback', async () => {
    mockApi({
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: queueEnvelope(),
      [`DELETE /api/v1/review/plans/${PLAN_ID}/recusals/sub-r1`]: {
        status: 404,
        body: errorEnvelope('not_found', 'Recusal not found'),
      },
    });

    renderQueue();
    const undo = await screen.findByRole('button', { name: 'Undo' });
    fireEvent.click(undo);

    expect(await screen.findByText('Recusal not found')).toBeInTheDocument();
  });

  it('a refused queue load ("Plan not found") renders through the same top-level banner', async () => {
    mockApi({
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: {
        status: 404,
        body: errorEnvelope('not_found', 'Plan not found'),
      },
    });

    renderQueue();

    await waitFor(() => {
      expect(screen.getByText('Plan not found')).toBeInTheDocument();
    });
  });
});
