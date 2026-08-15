// w52-d (DEC-678 amendment): an empty progress roster renders through the
// shared EmptyState 'fresh' block, never a bare `<p className="chq-empty">`
// -- no action prop, since the standalone route's "Remind the N not
// started" control already sits on the section head.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProgressPanel } from './ProgressPanel';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const PLAN_ID = 'plan-progress-1';

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
});
