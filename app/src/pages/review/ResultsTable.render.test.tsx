// DEC-386/390: results table -> phone cards. Every <td> in a body row must
// carry a data-label equal to its column's header text -- that attribute is
// what keeps the card readable once thead is hidden and td::before renders
// the micro-label off of it (review.css). This test asserts the invariant
// on the underlying DOM, independent of viewport width.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ResultsTable } from './ResultsTable';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

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

function resultsRow() {
  return {
    submissionId: 'sub-1',
    ref: 'S-001',
    title: 'A Great Talk',
    count: 3,
    average: 4.5,
    perCriterion: { c1: 4.5 },
    perDropdown: { c2: { counts: { Yes: 2, No: 1 }, modal: 'Yes' } },
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
