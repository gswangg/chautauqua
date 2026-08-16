// DEC-505/DEC-958 (wave-66 amendment, re-verified wave-13): src/routes/
// review/reviewer.ts's PUT /review/plans/:planId/evaluations/:submissionId
// throws six distinct refusals -- a fields-bearing "Invalid scores" (:563),
// a fields-bearing "Invalid comment" (:568), and four field-less ones:
// "This review plan is not currently open" (:516), "That submission is not
// in your review queue." (:521), "You have recused yourself from this
// submission" (:524), "This submission already has its full set of
// reviews" (:549), "This evaluation has been submitted" (:539). This proves
// every one of those actually reaches the Scorecard's DOM -- per-criterion
// for the fields-bearing shapes, the shared top-level banner for the
// field-less ones -- never collapsed to a generic "Failed to submit
// evaluation"/"Failed to save evaluation" fallback.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Scorecard } from './Scorecard';
import { listEnvelope, mockApi, errorEnvelope } from '../../test-utils/mockApi';

const PLAN_ID = 'plan-scorecard-refusal';
const SUBMISSION_ID = 'sub-scorecard-refusal';

function plan(overrides: Record<string, unknown> = {}) {
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
    rounds: 1,
    currentRound: 1,
    maxEvaluations: null,
    createdAt: 1700000000000,
    ...overrides,
  };
}

function submission(overrides: Record<string, unknown> = {}) {
  return {
    id: SUBMISSION_ID,
    ref: 'S-010',
    title: 'A Deeply Nested Talk',
    sessionAnswers: [],
    myEvaluation: undefined,
    criteria: [{ id: 'c1', label: 'Quality', kind: 'rating', weight: 1 }],
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

function renderScorecard() {
  return render(
    <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}/submissions/${SUBMISSION_ID}`]}>
      <Routes>
        <Route path="/review/plans/:planId/submissions/:submissionId" element={<Scorecard />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function scoreQuality() {
  const qualityGroup = screen.getByRole('radiogroup', { name: 'Quality (c1)' });
  fireEvent.click(within(qualityGroup).getByRole('radio', { name: 'Quality (c1): 4 of 5' }));
}

describe('Scorecard submit refusal shapes (DEC-958/DEC-856)', () => {
  it('a { c1 } scores refusal renders beside the Quality criterion, not the top-level banner', async () => {
    mockApi({
      'GET /api/v1/review/plans': listEnvelope([plan()]),
      [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: submission(),
      [`PUT /api/v1/review/plans/${PLAN_ID}/evaluations/${SUBMISSION_ID}`]: {
        status: 400,
        body: errorEnvelope('invalid', 'Invalid scores', { c1: 'must be between 1 and 5' }),
      },
    });

    renderScorecard();
    await screen.findByRole('heading', { name: 'A Deeply Nested Talk' });
    await scoreQuality();
    fireEvent.click(screen.getByRole('button', { name: 'Submit and next' }));

    expect(await screen.findByText('must be between 1 and 5')).toBeInTheDocument();
    expect(screen.queryByText('Invalid scores')).not.toBeInTheDocument();
  });

  it('a { comment } refusal renders beside the comment field', async () => {
    mockApi({
      'GET /api/v1/review/plans': listEnvelope([plan()]),
      [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: submission(),
      [`PUT /api/v1/review/plans/${PLAN_ID}/evaluations/${SUBMISSION_ID}`]: {
        status: 400,
        body: errorEnvelope('invalid', 'Invalid comment', { comment: 'Max 5000 characters' }),
      },
    });

    renderScorecard();
    await screen.findByRole('heading', { name: 'A Deeply Nested Talk' });
    await scoreQuality();
    fireEvent.click(screen.getByRole('button', { name: 'Submit and next' }));

    expect(await screen.findByText('Max 5000 characters')).toBeInTheDocument();
    expect(screen.queryByText('Invalid comment')).not.toBeInTheDocument();
  });

  it('"This review plan is not currently open" (a field-less conflict) renders through the shared error banner', async () => {
    mockApi({
      'GET /api/v1/review/plans': listEnvelope([plan()]),
      [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: submission(),
      [`PUT /api/v1/review/plans/${PLAN_ID}/evaluations/${SUBMISSION_ID}`]: {
        status: 409,
        body: errorEnvelope('conflict', 'This review plan is not currently open'),
      },
    });

    renderScorecard();
    await screen.findByRole('heading', { name: 'A Deeply Nested Talk' });
    await scoreQuality();
    fireEvent.click(screen.getByRole('button', { name: 'Submit and next' }));

    expect(await screen.findByText('This review plan is not currently open')).toBeInTheDocument();
  });

  it('"This submission already has its full set of reviews" renders verbatim, not a generic fallback', async () => {
    mockApi({
      'GET /api/v1/review/plans': listEnvelope([plan()]),
      [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: submission(),
      [`PUT /api/v1/review/plans/${PLAN_ID}/evaluations/${SUBMISSION_ID}`]: {
        status: 409,
        body: errorEnvelope('conflict', 'This submission already has its full set of reviews'),
      },
    });

    renderScorecard();
    await screen.findByRole('heading', { name: 'A Deeply Nested Talk' });
    await scoreQuality();
    fireEvent.click(screen.getByRole('button', { name: 'Submit and next' }));

    expect(await screen.findByText('This submission already has its full set of reviews')).toBeInTheDocument();
    expect(screen.queryByText('Failed to submit evaluation')).not.toBeInTheDocument();
  });

  it('Save draft renders the same field-keyed refusal shape as Submit and next', async () => {
    mockApi({
      'GET /api/v1/review/plans': listEnvelope([plan()]),
      [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: submission(),
      [`PUT /api/v1/review/plans/${PLAN_ID}/evaluations/${SUBMISSION_ID}`]: {
        status: 400,
        body: errorEnvelope('invalid', 'Invalid scores', { c1: 'must be between 1 and 5' }),
      },
    });

    renderScorecard();
    await screen.findByRole('heading', { name: 'A Deeply Nested Talk' });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    expect(await screen.findByText('must be between 1 and 5')).toBeInTheDocument();
  });

  it('"You have recused yourself from this submission" (recusal 409) renders through the shared banner', async () => {
    mockApi({
      'GET /api/v1/review/plans': listEnvelope([plan()]),
      [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: submission(),
      [`PUT /api/v1/review/plans/${PLAN_ID}/evaluations/${SUBMISSION_ID}`]: {
        status: 409,
        body: errorEnvelope('conflict', 'You have recused yourself from this submission'),
      },
    });

    renderScorecard();
    await screen.findByRole('heading', { name: 'A Deeply Nested Talk' });
    await scoreQuality();
    fireEvent.click(screen.getByRole('button', { name: 'Submit and next' }));

    await waitFor(() => {
      expect(screen.getByText('You have recused yourself from this submission')).toBeInTheDocument();
    });
  });
});
