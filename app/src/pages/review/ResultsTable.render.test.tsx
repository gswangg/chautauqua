// DEC-386/390: results table -> phone cards. Every <td> in a body row must
// carry a data-label equal to its column's header text -- that attribute is
// what keeps the card readable once thead is hidden and td::before renders
// the micro-label off of it (review.css). This test asserts the invariant
// on the underlying DOM, independent of viewport width.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ResultsTable } from './ResultsTable';
import { errorEnvelope, listEnvelope, mockApi } from '../../test-utils/mockApi';

const PLAN_ID = 'plan-results-1';

function plan() {
  return {
    id: PLAN_ID,
    eventId: 'evt-1',
    name: 'Track Review',
    instructions: '',
    openDate: null,
    closeDate: null,
    filters: null,
    anonymized: false,
    scale: { min: 1, max: 5 },
    criteria: [
      { id: 'c1', label: 'Quality', kind: 'rating', weight: 1 },
      { id: 'c2', label: 'Fit', kind: 'dropdown', options: ['Yes', 'No'] },
    ],
    rounds: 1,
    currentRound: 1,
    roundCriteria: null,
    maxEvaluations: null,
    createdAt: 1700000000000,
  };
}

function resultsRow(overrides: Partial<{ status: string; speakers: string[]; trackNames: string[] }> = {}) {
  return {
    submissionId: 'sub-1',
    ref: 'S-001',
    title: 'A Great Talk',
    count: 3,
    average: 4.5,
    perCriterion: { c1: 4.5 },
    perDropdown: { c2: { counts: { Yes: 2, No: 1 }, modal: 'Yes' } },
    status: overrides.status ?? 'pending',
    speakers: overrides.speakers ?? ['Ada Lovelace'],
    trackNames: overrides.trackNames ?? ['Engineering'],
  };
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    throw new Error(`console.error called during render: ${args.map(String).join(' ')}`);
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  consoleErrorSpy.mockRestore();
});

describe('ResultsTable phone-card data-label invariant (DEC-390)', () => {
  it('gives every body <td> a data-label matching its column header text', async () => {
    mockApi({
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/results`]: listEnvelope([resultsRow()]),
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}/results`]}>
        <Routes>
          <Route path="/review/plans/:planId/results" element={<ResultsTable />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('A Great Talk')).toBeInTheDocument();

    const table = document.querySelector('table.chq-review-results-table')!;
    const headerLabels = Array.from(table.querySelectorAll('thead th')).map((th) => th.textContent!.trim());

    const bodyRow = table.querySelector('tbody tr')!;
    const cells = Array.from(bodyRow.querySelectorAll('td'));

    expect(cells.length).toBe(headerLabels.length);
    cells.forEach((cell, i) => {
      expect(cell.getAttribute('data-label')).toBe(headerLabels[i]);
    });
  });
});

// DEC-703: the ranked results row names the human and the track, between the
// title and score columns -- the one screen an organizer decides the
// programme from must answer "who is this and where does it go" without
// leaving the page.
describe('ResultsTable Speaker/Track columns (DEC-703)', () => {
  it('renders Speaker and Track header cells and a populated row cell', async () => {
    mockApi({
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/results`]: listEnvelope([
        resultsRow({ speakers: ['Ada Lovelace', 'Grace Hopper'], trackNames: ['Engineering'] }),
      ]),
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}/results`]}>
        <Routes>
          <Route path="/review/plans/:planId/results" element={<ResultsTable />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('A Great Talk')).toBeInTheDocument();

    const table = document.querySelector('table.chq-review-results-table')!;
    const headerLabels = Array.from(table.querySelectorAll('thead th')).map((th) => th.textContent!.trim());
    expect(headerLabels).toContain('Speaker');
    expect(headerLabels).toContain('Track');

    expect(screen.getByText('Ada Lovelace, Grace Hopper')).toBeInTheDocument();
    expect(screen.getByText('Engineering')).toBeInTheDocument();
  });
});

// DEC-587/DEC-193: inline Accept/Decline reuses the submissions table's own
// status endpoint, optimistically reflects the decision, and on a failed
// write rolls the optimistic state back and refetches server truth (never
// restores a stale pre-update snapshot).
describe('ResultsTable inline decision (DEC-587)', () => {
  it('optimistically marks a row Accepted on a successful decision', async () => {
    mockApi({
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/results`]: listEnvelope([resultsRow()]),
      'POST /api/v1/events/evt-1/submissions/status': { updated: 1 },
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}/results`]}>
        <Routes>
          <Route path="/review/plans/:planId/results" element={<ResultsTable />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('A Great Talk')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));

    await waitFor(() => {
      expect(screen.getByText('Accepted')).toBeInTheDocument();
    });

    // Said once, not per row.
    expect(screen.getAllByText(/Deciding here never sends email/)).toHaveLength(1);
  });

  it('rolls back the optimistic decision and refetches on a failed write (DEC-193)', async () => {
    let statusCalls = 0;
    mockApi({
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/results`]: listEnvelope([resultsRow()]),
      'POST /api/v1/events/evt-1/submissions/status': () => {
        statusCalls += 1;
        return { status: 500, body: errorEnvelope('internal', 'Something broke') };
      },
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}/results`]}>
        <Routes>
          <Route path="/review/plans/:planId/results" element={<ResultsTable />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('A Great Talk')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Something broke');
    });

    // Rolled back -- no stale "Declined" label left behind.
    expect(screen.queryByText('Declined')).not.toBeInTheDocument();
    // DEC-193: a refetch of the results list follows the failed write.
    await waitFor(() => {
      expect(statusCalls).toBe(1);
    });
  });
});

// DEC-632/DEC-633: the results screen tells the truth about decisions
// (server `status`, never a stale blank pair of buttons) and shows the
// reviews behind them (DEC-596 evaluations endpoint), rendering an
// anonymized reviewer as '(anonymized)' rather than a blank cell.
describe('ResultsTable decision truth + reviews drawer (DEC-632/DEC-633)', () => {
  it('renders a decided row\'s server status after a fresh load, not decision buttons', async () => {
    mockApi({
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/results`]: listEnvelope([resultsRow({ status: 'accepted' })]),
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}/results`]}>
        <Routes>
          <Route path="/review/plans/:planId/results" element={<ResultsTable />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('A Great Talk')).toBeInTheDocument();
    expect(screen.getByText('Accepted')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Decline' })).not.toBeInTheDocument();
  });

  it('expanding a row fetches and renders a comment plus an anonymized reviewer', async () => {
    mockApi({
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/results`]: listEnvelope([resultsRow()]),
      [`GET /api/v1/submissions/sub-1/evaluations`]: listEnvelope([
        {
          planId: PLAN_ID,
          planName: 'Track Review',
          round: 1,
          reviewerName: null,
          scores: { c1: 4 },
          comment: 'Strong proposal, well scoped.',
          submittedAt: 1700000000000,
        },
      ]),
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}/results`]}>
        <Routes>
          <Route path="/review/plans/:planId/results" element={<ResultsTable />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('A Great Talk')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Reviews \(3\)/ }));

    expect(await screen.findByText('Strong proposal, well scoped.')).toBeInTheDocument();
    expect(screen.getByText('(anonymized)')).toBeInTheDocument();
  });
});
