// DEC-354 (amendment, wave 61): a narrower reviewer scope laid over a
// broader one is an ADVISORY, never a silent supersede and never a
// refusal. POST /api/v1/plans/:id/reviewers still writes the row and
// answers 201 with `scopeAdvisory: string | null` -- this file proves
// PlanEditor renders that sentence as a quiet advisory beside the
// reviewer list, distinct from the reviewerAssignErrors ErrorSummary
// (nothing failed, so it must not carry role="alert" or the
// .chq-field-error/.chq-error-summary shapes).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PlanEditor } from './PlanEditor';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-plan-editor-scope-advisory';
const PLAN_ID = 'plan-1';

function plan(overrides: Record<string, unknown> = {}) {
  return {
    id: PLAN_ID,
    eventId: EVENT_ID,
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
    timezone: 'UTC',
    ...overrides,
  };
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  consoleErrorSpy.mockRestore();
  window.localStorage.clear();
});

async function openAssignForm() {
  fireEvent.click(await screen.findByRole('button', { name: 'Assign a reviewer' }));
}

const ADVISORY_TEXT =
  'This reviewer already holds an all-submissions (plan-wide) assignment on this plan -- their effective queue is the union of all their rows, not narrowed by this new assignment.';

describe('PlanEditor scope-overlap advisory (DEC-354, wave 61)', () => {
  it('renders the advisory beside the reviewer list after an Assign that overlaps a broader row, not as an error', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
      'GET /api/v1/users': listEnvelope([
        { id: 'user-42', email: 'reviewer@example.test', role: 'reviewer', contactId: null, createdAt: 0 },
      ]),
      [`POST /api/v1/plans/${PLAN_ID}/reviewers`]: {
        status: 201,
        body: {
          id: 'pr-1',
          userId: 'user-42',
          email: 'reviewer@example.test',
          trackId: null,
          submissionId: 'sub-1',
          trackName: null,
          submissionRef: 'SES-1',
          submissionTitle: 'A Talk',
          scopeAdvisory: ADVISORY_TEXT,
        },
      },
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId" element={<PlanEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    await openAssignForm();
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'reviewer@example.test' })).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText('Reviewer'), { target: { value: 'user-42' } });
    fireEvent.change(screen.getByLabelText('Assignment scope'), { target: { value: 'submission' } });
    fireEvent.change(screen.getByLabelText('Submission'), { target: { value: 'SES-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Assign' }));

    const advisory = await screen.findByText(ADVISORY_TEXT);
    expect(advisory).toBeInTheDocument();
    expect(advisory).toHaveClass('chq-review-scope-advisory');

    // Not the error standard: no role="alert" on this element, and it
    // carries none of the error-only classes.
    expect(advisory).not.toHaveAttribute('role', 'alert');
    expect(advisory.className).not.toContain('chq-field-error');
    expect(advisory.className).not.toContain('chq-error-summary');
  });

  it('renders nothing when the newly assigned row does not overlap an existing broader one (scopeAdvisory: null)', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
      'GET /api/v1/users': listEnvelope([
        { id: 'user-42', email: 'reviewer@example.test', role: 'reviewer', contactId: null, createdAt: 0 },
      ]),
      [`POST /api/v1/plans/${PLAN_ID}/reviewers`]: {
        status: 201,
        body: {
          id: 'pr-1',
          userId: 'user-42',
          email: 'reviewer@example.test',
          trackId: null,
          submissionId: null,
          trackName: null,
          submissionRef: null,
          submissionTitle: null,
          scopeAdvisory: null,
        },
      },
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId" element={<PlanEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    await openAssignForm();
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'reviewer@example.test' })).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText('Reviewer'), { target: { value: 'user-42' } });
    fireEvent.click(screen.getByRole('button', { name: 'Assign' }));

    await waitFor(() => {
      expect(screen.getByText(/reviewer@example\.test/)).toBeInTheDocument();
    });
    expect(document.querySelector('.chq-review-scope-advisory')).toBeNull();
  });
});
