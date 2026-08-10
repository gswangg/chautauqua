// DEC-144 layer-2 harness, DEC-147/DEC-148 regression: mounts Scorecard with
// a submission whose resolved criteria (GET /review/submissions/:id's
// `criteria` field -- criteriaForRound's per-round resolution) include all
// three criterion kinds (rating, dropdown, free-text), asserting each
// control renders. DEC-148: text criteria must render alongside
// rating/dropdown without participating in the weighted math -- covered
// here only as a render assertion, not a re-derivation of criteriaForRound
// itself.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Scorecard } from './Scorecard';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const PLAN_ID = 'plan-scorecard-1';
const SUBMISSION_ID = 'sub-scorecard-1';

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
    criteria: [{ id: 'c1', label: 'Quality', kind: 'rating', weight: 1 }],
    rounds: 2,
    currentRound: 2,
    // DEC-147: round 2 overrides the base criteria with all three kinds.
    roundCriteria: {
      '2': [
        { id: 'c1', label: 'Quality', kind: 'rating', weight: 1 },
        { id: 'c2', label: 'Fit', kind: 'dropdown', options: ['Poor', 'OK', 'Great'] },
        { id: 'c3', label: 'Notes', kind: 'text', required: false },
      ],
    },
    maxEvaluations: null,
    createdAt: 1700000000000,
  };
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    throw new Error(`console.error called during render: ${args.map(String).join(' ')}`);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  consoleErrorSpy.mockRestore();
});

describe('Scorecard render smoke', () => {
  it('renders rating, dropdown, and free-text criteria from the round-resolved criteria list', async () => {
    mockApi({
      'GET /api/v1/review/plans': listEnvelope([plan()]),
      [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: {
        id: SUBMISSION_ID,
        ref: 'S-010',
        title: 'A Deeply Nested Talk',
        description: 'A talk about testing scorecards.',
        speakers: [{ contactId: 'c1', name: 'Ada Lovelace' }],
        answers: {},
        myEvaluation: undefined,
        // Server-resolved via criteriaForRound for the plan's active round.
        criteria: [
          { id: 'c1', label: 'Quality', kind: 'rating', weight: 1 },
          { id: 'c2', label: 'Fit', kind: 'dropdown', options: ['Poor', 'OK', 'Great'] },
          { id: 'c3', label: 'Notes', kind: 'text', required: false },
        ],
      },
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}/submissions/${SUBMISSION_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId/submissions/:submissionId" element={<Scorecard />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'S-010 — A Deeply Nested Talk' })).toBeInTheDocument();

    // rating criterion -> number input
    const qualityLabel = screen.getByText('Quality').closest('div')!;
    expect(qualityLabel.querySelector('input[type="number"]')).toBeInTheDocument();

    // dropdown criterion -> select with its options
    expect(screen.getByRole('option', { name: 'Great' })).toBeInTheDocument();

    // free-text criterion -> textarea
    expect(screen.getByLabelText('Notes')).toBeInTheDocument();
    expect(screen.getByLabelText('Notes').tagName).toBe('TEXTAREA');
  });
});
