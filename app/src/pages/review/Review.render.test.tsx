// DEC-144 layer-2 harness, DEC-146/DEC-171 regression: mounts the real
// /review router surface (app/src/pages/Review.tsx) for both the organizer
// (plan list / plan detail / progress / results) and reviewer
// (ReviewerQueue) branches, against mocked fetch shaped like the REAL wire
// envelope returned by GET /api/v1/plans/:id (PlanRecord: openDate/
// closeDate/filters/maxEvaluations -- NOT the SPA-internal openAt/closeAt/
// trackIds/maxEvaluationsPerSubmission names). The plan-detail case
// specifically covers a plan with NULL openDate/closeDate/filters (DEC-146's
// P1 blank-page crash class, later reintroduced as a wire-name mismatch and
// fixed under DEC-171/task-w6-e): PlanEditor renders those through the
// null-safe msToDateInput helper, which must fall back to an empty
// <input type="date"> value rather than throwing on
// `new Date(null).toISOString()`, and must not throw on `filters: null`
// (draft.trackIds.includes crash).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { ReviewPage } from '../Review';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-review-render';
const PLAN_ID = 'plan-render-1';

function organizerMe() {
  return { userId: 'u-organizer', email: 'organizer@example.com', role: 'organizer', orgId: 'org-1' };
}

function reviewerMe() {
  return { userId: 'u-reviewer', email: 'reviewer@example.com', role: 'reviewer', orgId: 'org-1' };
}

function planWithNullDates() {
  return {
    id: PLAN_ID,
    eventId: EVENT_ID,
    name: 'Keynote Track Review',
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

function planWithTrackFilter() {
  return {
    ...planWithNullDates(),
    openDate: 1700000000000,
    closeDate: 1700100000000,
    filters: { trackIds: ['track-1'] },
    maxEvaluations: 3,
  };
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    throw new Error(`console.error called during render: ${args.map(String).join(' ')}`);
  });
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  consoleErrorSpy.mockRestore();
});

describe('ReviewPage render smoke: organizer', () => {
  it('renders the plan list', async () => {
    mockApi({
      'GET /api/v1/me': organizerMe(),
      [`GET /api/v1/events/${EVENT_ID}/plans`]: listEnvelope([planWithNullDates()]),
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <ReviewPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Evaluation plans' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Keynote Track Review' })).toBeInTheDocument();
  });

  it('renders plan detail for a plan with NULL open/close dates without throwing (DEC-146)', async () => {
    mockApi({
      'GET /api/v1/me': organizerMe(),
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}`]: planWithNullDates(),
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
    });

    render(
      <MemoryRouter initialEntries={[`/plans/${PLAN_ID}`]}>
        <ReviewPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Keynote Track Review' })).toBeInTheDocument();

    // Null-safe fallback: msToDateInput(null) -> '' rather than throwing.
    const opensInput = screen.getByLabelText('Opens') as HTMLInputElement;
    const closesInput = screen.getByLabelText('Closes') as HTMLInputElement;
    expect(opensInput.value).toBe('');
    expect(closesInput.value).toBe('');
  });

  it('renders plan detail for a plan with filters.trackIds set without throwing, and saves using wire field names (DEC-171)', async () => {
    const fetchMock = mockApi({
      'GET /api/v1/me': organizerMe(),
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([{ id: 'track-1', name: 'Main Stage' }]),
      [`GET /api/v1/plans/${PLAN_ID}`]: planWithTrackFilter(),
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
      [`GET /api/v1/users`]: listEnvelope([]),
      [`PATCH /api/v1/plans/${PLAN_ID}`]: planWithTrackFilter(),
    });

    render(
      <MemoryRouter initialEntries={[`/plans/${PLAN_ID}`]}>
        <ReviewPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Keynote Track Review' })).toBeInTheDocument();
    const trackCheckbox = screen.getByLabelText('Main Stage') as HTMLInputElement;
    expect(trackCheckbox.checked).toBe(true);

    const saveButton = screen.getByRole('button', { name: 'Save plan' });
    saveButton.click();

    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(([input, init]) => {
        const url = typeof input === 'string' ? input : (input as URL).toString();
        return url.includes(`/plans/${PLAN_ID}`) && (init as RequestInit | undefined)?.method === 'PATCH';
      });
      expect(patchCall).toBeDefined();
      const body = JSON.parse((patchCall![1] as RequestInit).body as string);
      expect(body).toMatchObject({
        openDate: 1700000000000,
        closeDate: 1700100000000,
        filters: { trackIds: ['track-1'] },
        maxEvaluations: 3,
      });
      expect(body.openAt).toBeUndefined();
      expect(body.closeAt).toBeUndefined();
      expect(body.trackIds).toBeUndefined();
      expect(body.maxEvaluationsPerSubmission).toBeUndefined();
    });
  });

  it('renders the progress panel', async () => {
    mockApi({
      'GET /api/v1/me': organizerMe(),
      [`GET /api/v1/plans/${PLAN_ID}`]: planWithNullDates(),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([
        { userId: 'u-1', email: 'rev1@example.com', assigned: 4, completed: 2, recused: 0 },
      ]),
    });

    render(
      <MemoryRouter initialEntries={[`/plans/${PLAN_ID}/progress`]}>
        <ReviewPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Reviewer progress' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('rev1@example.com')).toBeInTheDocument();
    });
  });

  it('renders the results view', async () => {
    mockApi({
      'GET /api/v1/me': organizerMe(),
      [`GET /api/v1/plans/${PLAN_ID}`]: planWithNullDates(),
      [`GET /api/v1/plans/${PLAN_ID}/results`]: listEnvelope([
        { submissionId: 'sub-1', ref: 'S-001', title: 'A Talk', count: 2, average: 4.5, perCriterion: { c1: 4.5 } },
      ]),
    });

    render(
      <MemoryRouter initialEntries={[`/plans/${PLAN_ID}/results`]}>
        <ReviewPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Results: Keynote Track Review' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('A Talk')).toBeInTheDocument();
    });
  });
});

describe('ReviewPage render smoke: reviewer', () => {
  it('renders a non-empty ReviewerQueue', async () => {
    mockApi({
      'GET /api/v1/me': reviewerMe(),
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: {
        ...listEnvelope([
          { submissionId: 'sub-1', ref: 'S-001', title: 'A Talk About Testing', ratingsCount: 0 },
          { submissionId: 'sub-2', ref: 'S-002', title: 'Another Talk', ratingsCount: 1 },
        ]),
        open: true,
        recused: [],
      },
    });

    render(
      <MemoryRouter initialEntries={[`/plans/${PLAN_ID}`]}>
        <ReviewPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Your queue' })).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /A Talk About Testing/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Another Talk/ })).toBeInTheDocument();
  });
});
