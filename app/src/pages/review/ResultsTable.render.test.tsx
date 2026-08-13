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

  it('expanding a row fetches and renders a comment plus the reviewer name (DEC-736)', async () => {
    mockApi({
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/results`]: listEnvelope([resultsRow()]),
      [`GET /api/v1/submissions/sub-1/evaluations`]: listEnvelope([
        {
          planId: PLAN_ID,
          planName: 'Track Review',
          round: 1,
          reviewerName: 'Priya Patel',
          scores: { c1: 4 },
          score: 4,
          criteria: [{ id: 'c1', label: 'Quality', kind: 'rating', weight: 1 }],
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
    // DEC-736: the server always resolves a reviewer name -- no
    // '(anonymized)' branch on this organiser-facing endpoint.
    expect(screen.getByText('Priya Patel')).toBeInTheDocument();
    expect(screen.queryByText('(anonymized)')).not.toBeInTheDocument();
    // DEC-723: the evaluation's own blended score, and a criterion chip
    // labelled from `criteria[].label` -- the raw criterionId never
    // appears in the DOM.
    expect(screen.getByText('4.00')).toBeInTheDocument();
    expect(screen.getByText('Quality: 4')).toBeInTheDocument();
    expect(screen.queryByText(/c1/)).not.toBeInTheDocument();
  });
});

// DEC-763: the row disclosure is plan-scoped -- expanding a row's
// "Reviews (n)" toggle must ask the server for only this plan's
// evaluations, and the expanded list must show exactly n entries.
describe('ResultsTable row disclosure is plan-scoped (DEC-763)', () => {
  it('requests /submissions/:id/evaluations?planId=<this plan> and renders exactly the row\'s evaluation count', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/results`]: listEnvelope([resultsRow({ status: 'pending' })]),
      [`GET /api/v1/submissions/sub-1/evaluations`]: listEnvelope([
        {
          planId: PLAN_ID,
          planName: 'Track Review',
          round: 1,
          reviewerName: 'Priya Patel',
          scores: { c1: 4 },
          score: 4,
          criteria: [{ id: 'c1', label: 'Quality', kind: 'rating', weight: 1 }],
          comment: 'Strong proposal, well scoped.',
          submittedAt: 1700000000000,
        },
        {
          planId: PLAN_ID,
          planName: 'Track Review',
          round: 1,
          reviewerName: 'Jamie Reviewer',
          scores: { c1: 3 },
          score: 3,
          criteria: [{ id: 'c1', label: 'Quality', kind: 'rating', weight: 1 }],
          comment: 'Reasonable, could tighten the scope.',
          submittedAt: 1700000100000,
        },
        {
          planId: PLAN_ID,
          planName: 'Track Review',
          round: 1,
          reviewerName: 'Robin Lee',
          scores: { c1: 5 },
          score: 5,
          criteria: [{ id: 'c1', label: 'Quality', kind: 'rating', weight: 1 }],
          comment: 'Excellent talk.',
          submittedAt: 1700000200000,
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
    const reviewsButton = screen.getByRole('button', { name: /Reviews \(3\)/ });
    fireEvent.click(reviewsButton);

    expect(await screen.findByText('Strong proposal, well scoped.')).toBeInTheDocument();

    // The disclosure request carried this plan's id.
    const evaluationsCall = fetchMock.mock.calls.find(([input]) => {
      const url = typeof input === 'string' ? input : (input as URL | Request).toString();
      return url.includes('/submissions/sub-1/evaluations');
    });
    expect(evaluationsCall).toBeDefined();
    const calledUrl = new URL(
      (typeof evaluationsCall![0] === 'string' ? evaluationsCall![0] : evaluationsCall![0].toString()) as string,
      'http://localhost',
    );
    expect(calledUrl.searchParams.get('planId')).toBe(PLAN_ID);

    // The expanded entry count equals the row's "# Evaluations" (3).
    expect(screen.getByText('Priya Patel')).toBeInTheDocument();
    expect(screen.getByText('Jamie Reviewer')).toBeInTheDocument();
    expect(screen.getByText('Robin Lee')).toBeInTheDocument();
  });
});

// DEC-737: the sort control cannot lie. Two rapid header clicks always land
// on a `dir`, an arrow, and rendered rows that agree with each other and
// with the last click made -- even when the first (stale) response resolves
// after the second's, and even when a results fetch fails outright (rows
// are cleared, never left contradicting the header).
describe('ResultsTable sort honesty (DEC-737)', () => {
  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((res) => {
      resolve = res;
    });
    return { promise, resolve };
  }

  it('a stale in-flight response never overwrites the newer request\'s rows/dir', async () => {
    const pending: { url: string; deferred: ReturnType<typeof deferred<Response>> }[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const rawUrl = typeof input === 'string' ? input : input.toString();
      const url = new URL(rawUrl, 'http://localhost');
      const path = url.pathname;

      if (path === `/api/v1/plans/${PLAN_ID}`) {
        return new Response(JSON.stringify(plan()), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (path === `/api/v1/plans/${PLAN_ID}/results`) {
        const d = deferred<Response>();
        pending.push({ url: rawUrl, deferred: d });
        return d.promise;
      }
      throw new Error(`unexpected fetch: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}/results`]}>
        <Routes>
          <Route path="/review/plans/:planId/results" element={<ResultsTable />} />
        </Routes>
      </MemoryRouter>,
    );

    // Wait for the initial (unsorted) results request to be issued.
    await waitFor(() => expect(pending.length).toBe(1));
    pending[0]!.deferred.resolve(
      new Response(JSON.stringify(listEnvelope([resultsRow()])), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    expect(await screen.findByText('A Great Talk')).toBeInTheDocument();

    // First click: sorts by Score (average), descending by default.
    fireEvent.click(screen.getByRole('button', { name: /^Weighted score/ }));
    await waitFor(() => expect(pending.length).toBe(2));
    const firstRequestUrl = pending[1]!.url;
    expect(new URL(firstRequestUrl, 'http://localhost').searchParams.get('dir')).toBe('desc');

    // Second click (rapid): toggles Score to ascending -- this is now the
    // newest request.
    fireEvent.click(screen.getByRole('button', { name: /^Weighted score/ }));
    await waitFor(() => expect(pending.length).toBe(3));
    const secondRequestUrl = pending[2]!.url;
    expect(new URL(secondRequestUrl, 'http://localhost').searchParams.get('dir')).toBe('asc');

    // Resolve the SECOND (newest) request first, with its own distinct row.
    pending[2]!.deferred.resolve(
      new Response(
        JSON.stringify(listEnvelope([resultsRow({ status: 'pending' })].map((r) => ({ ...r, ref: 'S-NEWEST' })))),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    await waitFor(() => expect(screen.getByText('S-NEWEST')).toBeInTheDocument());

    // Now resolve the FIRST (stale) request -- it must be discarded outright,
    // never overwriting the newer response's rows.
    pending[1]!.deferred.resolve(
      new Response(
        JSON.stringify(listEnvelope([resultsRow({ status: 'pending' })].map((r) => ({ ...r, ref: 'S-STALE' })))),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    // Give the stale promise a tick to (not) apply.
    await Promise.resolve();
    await Promise.resolve();

    expect(screen.getByText('S-NEWEST')).toBeInTheDocument();
    expect(screen.queryByText('S-STALE')).not.toBeInTheDocument();

    // The arrow reflects the direction actually sent by the newest request.
    expect(screen.getByRole('button', { name: /^Weighted score/ }).textContent).toContain('▲');
    const scoreHeader = screen.getByRole('button', { name: /^Weighted score/ }).closest('th')!;
    expect(scoreHeader.getAttribute('aria-sort')).toBe('ascending');

    // The CSV href's dir matches the arrow.
    const csvLink = screen.getByRole('link', { name: 'Download CSV' });
    expect(new URL(csvLink.getAttribute('href')!, 'http://localhost').searchParams.get('dir')).toBe('asc');
  });

  it('a failed results fetch clears rows rather than leaving them under a new header', async () => {
    mockApi({
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/results`]: () => {
        return { status: 500, body: errorEnvelope('internal', 'Results failed') };
      },
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}/results`]}>
        <Routes>
          <Route path="/review/plans/:planId/results" element={<ResultsTable />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Results failed');
    });
    expect(screen.getByText('No results yet.')).toBeInTheDocument();
  });
});
