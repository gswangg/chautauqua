// DEC-271 (rubric ABS-12): reviewer conflict-of-interest recusal control.
// Codes strictly against the fixed wire contract:
//   POST/DELETE /api/v1/review/plans/:planId/recusals/:submissionId
//   POST body {"reason": string|null}
//   POST response {"recusal":{"planId","submissionId","userId","reason","createdAt"}} (201 new, 200 existing)
//   DELETE -> 204
//   Queue envelope gains `recused: [{submissionId, ref, title, reason}]`.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Scorecard } from './Scorecard';
import { ReviewerQueue } from './ReviewerQueue';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const PLAN_ID = 'plan-recusal-1';
const SUBMISSION_ID = 'sub-recusal-1';

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
    rounds: 1,
    currentRound: 1,
    roundCriteria: null,
    maxEvaluations: null,
    createdAt: 1700000000000,
  };
}

// DEC-939 (wave-6 amendment) supersedes the earlier "Recuse me — conflict of
// interest" wording with the frame's copy, and moves the ref out of the h1
// onto the meta line. Both are asserted here through this one constant so a
// future copy change has a single edit point.
const RECUSE_LABEL = 'Recuse me from this one';

function submissionDetail() {
  return {
    id: SUBMISSION_ID,
    ref: 'S-020',
    title: 'A Conflicted Talk',
    description: 'A talk with a conflict.',
    speakers: [{ contactId: 'c1', name: 'Ada Lovelace', company: null, title: null }],
    sessionAnswers: [],
    myEvaluation: undefined,
    criteria: [{ id: 'c1', label: 'Quality', kind: 'rating', weight: 1 }],
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

describe('Scorecard recusal control (DEC-271/DEC-939 bare checkbox)', () => {
  it('renders a bare checkbox control labelled with the frame copy, with no sibling button', async () => {
    mockApi({
      'GET /api/v1/review/plans': listEnvelope([plan()]),
      [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: submissionDetail(),
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}/submissions/${SUBMISSION_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId/submissions/:submissionId" element={<Scorecard />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'A Conflicted Talk' })).toBeInTheDocument();
    // The wording is recorded as evidence: DEC-939's wave-6 amendment names
    // the frame copy exactly, so the visible control label is asserted
    // verbatim rather than by substring.
    const checkbox = screen.getByRole('checkbox', { name: RECUSE_LABEL });
    expect(checkbox).toBeInstanceOf(HTMLInputElement);
    expect((checkbox as HTMLInputElement).type).toBe('checkbox');
    expect(screen.getAllByText(RECUSE_LABEL).length).toBeGreaterThan(0);
    // The superseded "conflict of interest" phrasing is gone from the control.
    expect(screen.queryByText(/conflict of interest/i)).not.toBeInTheDocument();
    // frame 03--01: the ref left the h1 for the meta line beneath it.
    expect(document.querySelector('.chq-review-scorecard-meta')?.textContent).toContain('S-020');
    // DEC-939 (bare recusal amendment): no separate Declare button, no
    // bordered card wrapper.
    expect(screen.queryByRole('button', { name: RECUSE_LABEL })).not.toBeInTheDocument();
    const recusalBlock = document.querySelector('.chq-review-recusal')!;
    expect(recusalBlock).toBeInTheDocument();
    expect(recusalBlock.querySelector('button')).toBeNull();
    // DEC-939 (bare recusal amendment): the card styling is stripped via a
    // pairing modifier class, not by deleting review.css's shared rule.
    expect(recusalBlock).toHaveClass('chq-review-recusal-bare');
  });

  it('POSTs the exact recusal URL/body (reason: null) the instant the checkbox is checked, then renders the recused state and disables scoring', async () => {
    const fetchMock = mockApi({
      'GET /api/v1/review/plans': listEnvelope([plan()]),
      [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: submissionDetail(),
      [`POST /api/v1/review/plans/${PLAN_ID}/recusals/${SUBMISSION_ID}`]: {
        status: 201,
        body: {
          recusal: {
            planId: PLAN_ID,
            submissionId: SUBMISSION_ID,
            userId: 'u-reviewer',
            reason: null,
            createdAt: 1700000000000,
          },
        },
      },
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}/submissions/${SUBMISSION_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId/submissions/:submissionId" element={<Scorecard />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'A Conflicted Talk' })).toBeInTheDocument();

    // DEC-939 (bare recusal amendment): no reason field or separate action
    // -- checking the checkbox itself is the declaration.
    expect(screen.queryByPlaceholderText('Reason (optional)')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: RECUSE_LABEL }));

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(([input, init]) => {
        const url = typeof input === 'string' ? input : (input as URL).toString();
        return (init as RequestInit | undefined)?.method === 'POST' && url.includes('/recusals/');
      });
      expect(postCall).toBeDefined();
      const [input, init] = postCall!;
      const url = typeof input === 'string' ? input : (input as URL).toString();
      expect(url).toContain(`/api/v1/review/plans/${PLAN_ID}/recusals/${SUBMISSION_ID}`);
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body).toEqual({ reason: null });
    });

    expect(await screen.findByText('You recused yourself from this submission.')).toBeInTheDocument();

    // DEC-873: the rating control is a segmented radiogroup of buttons,
    // not a number input -- every rating button disables while recused.
    const ratingButtons = screen.getByRole('radiogroup', { name: 'Quality (c1)' }).querySelectorAll('button');
    expect(ratingButtons.length).toBeGreaterThan(0);
    ratingButtons.forEach((btn) => expect(btn).toBeDisabled());
    expect(screen.getByRole('button', { name: 'Submit and next' })).toBeDisabled();
  });

  it('DELETEs the exact recusal URL on Undo, clearing the recused state', async () => {
    const fetchMock = mockApi({
      'GET /api/v1/review/plans': listEnvelope([plan()]),
      [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: submissionDetail(),
      [`POST /api/v1/review/plans/${PLAN_ID}/recusals/${SUBMISSION_ID}`]: {
        status: 201,
        body: {
          recusal: {
            planId: PLAN_ID,
            submissionId: SUBMISSION_ID,
            userId: 'u-reviewer',
            reason: null,
            createdAt: 1700000000000,
          },
        },
      },
      [`DELETE /api/v1/review/plans/${PLAN_ID}/recusals/${SUBMISSION_ID}`]: { status: 204, body: undefined },
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}/submissions/${SUBMISSION_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId/submissions/:submissionId" element={<Scorecard />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'A Conflicted Talk' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: RECUSE_LABEL }));
    expect(await screen.findByText('You recused yourself from this submission.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

    await waitFor(() => {
      const deleteCall = fetchMock.mock.calls.find(([input, init]) => {
        const url = typeof input === 'string' ? input : (input as URL).toString();
        return (init as RequestInit | undefined)?.method === 'DELETE' && url.includes('/recusals/');
      });
      expect(deleteCall).toBeDefined();
      const [input] = deleteCall!;
      const url = typeof input === 'string' ? input : (input as URL).toString();
      expect(url).toContain(`/api/v1/review/plans/${PLAN_ID}/recusals/${SUBMISSION_ID}`);
    });

    await waitFor(() => {
      expect(screen.queryByText('You recused yourself from this submission.')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('checkbox', { name: RECUSE_LABEL })).toBeInTheDocument();
  });
});

// DEC-874: recused rows render INLINE in the same ordered list as the
// actionable queue (marked, with reason + Undo) rather than in a separate
// trailing "Recused (not in your queue)" section.
describe('ReviewerQueue recused rows render inline (DEC-271/DEC-874)', () => {
  it('reads the envelope recused array, renders it inside the same list as items, and offers Undo', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: {
        ...listEnvelope([{ submissionId: 'sub-active', ref: 'S-001', title: 'Still In Queue', ratingsCount: 0 }]),
        open: true,
        recused: [{ submissionId: SUBMISSION_ID, ref: 'S-020', title: 'A Conflicted Talk', reason: 'Personal conflict' }],
      },
      [`DELETE /api/v1/review/plans/${PLAN_ID}/recusals/${SUBMISSION_ID}`]: { status: 204, body: undefined },
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
        <Routes>
          <Route path="/review/plans/:planId" element={<ReviewerQueue />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('link', { name: /Still In Queue/ })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Recused (not in your queue)' })).not.toBeInTheDocument();
    expect(screen.getByText(/A Conflicted Talk/)).toBeInTheDocument();
    expect(screen.getByText('Personal conflict')).toBeInTheDocument();
    // Recused items are not rendered as queue links (no scorecard nav).
    expect(screen.queryByRole('link', { name: /A Conflicted Talk/ })).not.toBeInTheDocument();
    // Both rows live in the same ordered list.
    const list = screen.getByRole('link', { name: /Still In Queue/ }).closest('ol');
    expect(list).toContainElement(screen.getByText(/A Conflicted Talk/));

    const undoButton = screen.getByRole('button', { name: 'Undo' });
    fireEvent.click(undoButton);

    await waitFor(() => {
      const deleteCall = fetchMock.mock.calls.find(([input, init]) => {
        const url = typeof input === 'string' ? input : (input as URL).toString();
        return (init as RequestInit | undefined)?.method === 'DELETE' && url.includes('/recusals/');
      });
      expect(deleteCall).toBeDefined();
      const [input] = deleteCall!;
      const url = typeof input === 'string' ? input : (input as URL).toString();
      expect(url).toContain(`/api/v1/review/plans/${PLAN_ID}/recusals/${SUBMISSION_ID}`);
    });
  });
});
