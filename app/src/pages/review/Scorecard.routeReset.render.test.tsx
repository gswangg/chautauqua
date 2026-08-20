// DEC-678 (wave-118 amendment, task w7-d): a route-param change on the
// Scorecard is a NEW PAGE -- `attempted`, `saved`, `serverFieldErrors` and
// `recusalConfirmed` are all scoped to the OLD submission and must not
// survive a `[planId, submissionId]` navigation ("Submit and next" or the
// reviewer queue both reuse the same mounted component instance). This file
// proves the reset added at the head of that effect, and the `cancelled`
// guard that stops a slow in-flight read for the old submission from
// painting once the route has moved on.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { Scorecard } from './Scorecard';
import { listEnvelope, mockApi, errorEnvelope } from '../../test-utils/mockApi';

const PLAN_ID = 'plan-scorecard-reset';
const SUB_A = 'sub-scorecard-reset-a';
const SUB_B = 'sub-scorecard-reset-b';

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
    maxEvaluations: null,
    createdAt: 1700000000000,
  };
}

function submission(id: string, title: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    ref: id,
    title,
    sessionAnswers: [],
    myEvaluation: undefined,
    criteria: [{ id: 'c1', label: 'Quality', kind: 'rating', weight: 1 }],
    ...overrides,
  };
}

// Sits alongside <Scorecard/> under the SAME <Route>, so clicking it changes
// only the :submissionId param -- Scorecard's component instance stays
// mounted, exactly the "Submit and next"/reviewer-queue navigation shape
// DEC-678 describes.
function NavTo({ path }: { path: string }) {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(path)}>
      go-to-next
    </button>
  );
}

function renderTwoSubmissionRoute() {
  return render(
    <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}/submissions/${SUB_A}`]}>
      <Routes>
        <Route
          path="/review/plans/:planId/submissions/:submissionId"
          element={
            <>
              <NavTo path={`/review/plans/${PLAN_ID}/submissions/${SUB_B}`} />
              <Scorecard />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

async function scoreQuality() {
  const qualityGroup = screen.getByRole('radiogroup', { name: 'Quality (c1)' });
  fireEvent.click(within(qualityGroup).getByRole('radio', { name: 'Quality (c1): 4 of 5' }));
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

describe('Scorecard route-param reset (DEC-678 wave-118)', () => {
  it('a fields refusal on A renders no per-criterion server error and no incomplete notice after routing to B', async () => {
    mockApi({
      'GET /api/v1/review/plans': listEnvelope([plan()]),
      [`GET /api/v1/review/submissions/${SUB_A}`]: submission(SUB_A, 'Submission A'),
      [`GET /api/v1/review/submissions/${SUB_B}`]: submission(SUB_B, 'Submission B'),
      [`PUT /api/v1/review/plans/${PLAN_ID}/evaluations/${SUB_A}`]: {
        status: 400,
        body: errorEnvelope('invalid', 'Invalid scores', { c1: 'must be between 1 and 5' }),
      },
    });

    renderTwoSubmissionRoute();

    await screen.findByRole('heading', { name: 'Submission A' });

    // First attempt: nothing scored yet -- arms `attempted` and surfaces
    // the client-side incomplete-criteria notice, with no PUT sent.
    fireEvent.click(screen.getByRole('button', { name: 'Submit and next' }));
    expect(await screen.findByText(/Rate every criterion before submitting/)).toBeInTheDocument();

    // Now complete the criterion and submit again -- the notice clears
    // (criteria complete) and the server refusal renders per-criterion.
    await scoreQuality();
    await waitFor(() => expect(screen.queryByText(/Rate every criterion before submitting/)).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Submit and next' }));
    expect(await screen.findByText('must be between 1 and 5')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'go-to-next' }));

    await screen.findByRole('heading', { name: 'Submission B' });
    // serverFieldErrors reset: A's { c1: ... } refusal does not re-attach
    // to B's identically-keyed 'c1' criterion.
    expect(screen.queryByText('must be between 1 and 5')).not.toBeInTheDocument();
    // attempted reset: B's first paint shows no incomplete-criteria notice,
    // even though B (like A) starts fully unscored.
    expect(screen.queryByText(/Rate every criterion before submitting/)).not.toBeInTheDocument();
  });

  it('a slow-resolving detail for A never paints once the route has moved to B', async () => {
    let resolveA!: (value: unknown) => void;
    const aResponse = new Promise((resolve) => {
      resolveA = resolve;
    });

    const staticRoutes: Record<string, unknown> = {
      'GET /api/v1/review/plans': listEnvelope([plan()]),
      [`GET /api/v1/review/submissions/${SUB_B}`]: submission(SUB_B, 'Submission B'),
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const rawUrl = typeof input === 'string' ? input : input.toString();
      const path = rawUrl.startsWith('http') ? new URL(rawUrl).pathname : rawUrl.split('?')[0];
      const method = (init?.method ?? 'GET').toUpperCase();
      const key = `${method} ${path}`;

      if (key === `GET /api/v1/review/submissions/${SUB_A}`) {
        const body = await aResponse;
        return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (!(key in staticRoutes)) {
        // Queue-progress fetches (both submissions share the plan) are not
        // registered on purpose -- the component's own .catch() handles a
        // missing route by rendering no counter, matching production
        // behaviour for an unreachable queue endpoint.
        throw new Error(`unregistered route: ${key}`);
      }
      return new Response(JSON.stringify(staticRoutes[key]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderTwoSubmissionRoute();

    // A's submission GET is now in flight and deliberately held open.
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    // Route moves to B before A ever resolves -- this is the effect's
    // cleanup firing (cancelled = true) for A's still-pending request.
    fireEvent.click(screen.getByRole('button', { name: 'go-to-next' }));
    await screen.findByRole('heading', { name: 'Submission B' });

    // Now let A's slow response land.
    resolveA(submission(SUB_A, 'Submission A'));
    await Promise.resolve();
    await Promise.resolve();

    // B's paint must survive untouched -- A's cancelled response never
    // overwrote plan/submission/scores/etc.
    expect(screen.getByRole('heading', { name: 'Submission B' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Submission A' })).not.toBeInTheDocument();
  });

  it('the recusal checkbox is unchecked on arrival at B, even with a still-in-flight recusal POST for A', async () => {
    let resolveRecusePost!: (value: unknown) => void;
    const recusePostResponse = new Promise((resolve) => {
      resolveRecusePost = resolve;
    });

    const staticRoutes: Record<string, unknown> = {
      'GET /api/v1/review/plans': listEnvelope([plan()]),
      [`GET /api/v1/review/submissions/${SUB_A}`]: submission(SUB_A, 'Submission A'),
      [`GET /api/v1/review/submissions/${SUB_B}`]: submission(SUB_B, 'Submission B'),
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const rawUrl = typeof input === 'string' ? input : input.toString();
      const path = rawUrl.startsWith('http') ? new URL(rawUrl).pathname : rawUrl.split('?')[0];
      const method = (init?.method ?? 'GET').toUpperCase();
      const key = `${method} ${path}`;

      if (key === `POST /api/v1/review/plans/${PLAN_ID}/recusals/${SUB_A}`) {
        const body = await recusePostResponse;
        return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (!(key in staticRoutes)) {
        throw new Error(`unregistered route: ${key}`);
      }
      return new Response(JSON.stringify(staticRoutes[key]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderTwoSubmissionRoute();

    await screen.findByRole('heading', { name: 'Submission A' });
    const recuseCheckbox = screen.getByRole('checkbox', { name: /recuse me/i });
    fireEvent.click(recuseCheckbox);
    // Checking the box arms `recusalConfirmed` synchronously, before the
    // POST it also fires has any chance to resolve.
    expect(recuseCheckbox).toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: 'go-to-next' }));
    await screen.findByRole('heading', { name: 'Submission B' });

    const bCheckbox = screen.getByRole('checkbox', { name: /recuse me/i });
    expect(bCheckbox).not.toBeChecked();

    // Let A's abandoned POST resolve so it doesn't leak into another test.
    resolveRecusePost({ recusal: { reason: null, createdAt: 1700000000000 } });
    await Promise.resolve();
  });
});
