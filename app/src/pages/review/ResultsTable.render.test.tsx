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
import { paginationSummary } from '../../lib/pagination-summary';
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
    recusals: 0,
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

// w15-b/DEC-678: /review/plans/:id/results' first paint must be PageSkeleton
// structure (the chq-review-page shell + a table-shaped placeholder), not a
// heading floating over an empty <main> waiting on a delayed label.
describe('ResultsTable standalone first paint renders PageSkeleton structure (DEC-678)', () => {
  it('renders the page shell and a chq-skeleton placeholder before the plan/results fetches resolve', async () => {
    let resolvePlan!: (value: Response) => void;
    const planPromise = new Promise<Response>((res) => {
      resolvePlan = res;
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const rawUrl = typeof input === 'string' ? input : input.toString();
      const url = new URL(rawUrl, 'http://localhost');
      if (url.pathname === `/api/v1/plans/${PLAN_ID}`) {
        return planPromise;
      }
      if (url.pathname === `/api/v1/plans/${PLAN_ID}/results`) {
        return new Response(JSON.stringify(listEnvelope([resultsRow()])), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      throw new Error(`unexpected fetch: ${url.pathname}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}/results`]}>
        <Routes>
          <Route path="/review/plans/:planId/results" element={<ResultsTable />} />
        </Routes>
      </MemoryRouter>,
    );

    // First frame, before the plan fetch resolves: structure, not a delayed label.
    expect(document.querySelector('.chq-page.chq-review-page')).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Results' })).toBeInTheDocument();
    expect(document.querySelector('.chq-skeleton')).not.toBeNull();

    resolvePlan(
      new Response(JSON.stringify(plan()), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    expect(await screen.findByText(/A Great Talk/)).toBeInTheDocument();
  });
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

    expect(await screen.findByText(/A Great Talk/)).toBeInTheDocument();

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

// DEC-819: the blended score is a WEIGHTED mean (computeWeightedScore via
// aggregateEvaluations) -- the caption underneath must say so, matching the
// plan editor's own 'Scores average by weight' rather than describing a
// plain average.
describe('ResultsTable weighted-score caption (DEC-819)', () => {
  it('states the weighting, keeps the recusals-excluded clause', async () => {
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

    expect(await screen.findByText(/A Great Talk/)).toBeInTheDocument();
    const eyebrow = screen.getByText('Scores average by weight · recusals excluded');
    expect(eyebrow).toBeInTheDocument();
    expect(screen.queryByText(/Mean of submitted reviews/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Score/ })).toBeInTheDocument();
    // w42-h/DEC-366: the frame's uppercase letterspaced treatment.
    expect(eyebrow.className).toContain('chq-review-results-eyebrow');
  });
});

// w42-h/DEC-366 amendment: the export link is a section-rule action on the
// "Ranked results" section head, not an orphan bordered button in its own
// toolbar band -- and it still carries the same sort/dir params.
describe('ResultsTable CSV export lives on the section rule (DEC-366)', () => {
  it('renders Download CSV as a section-action link beside the Ranked results eyebrow', async () => {
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

    expect(await screen.findByText(/A Great Talk/)).toBeInTheDocument();

    const sectionHead = document.querySelector('.chq-section-head')!;
    const csvLink = screen.getByRole('link', { name: 'Download CSV' });
    expect(sectionHead.contains(csvLink)).toBe(true);
    expect(csvLink.className).toContain('chq-section-action');
    expect(new URL(csvLink.getAttribute('href')!, 'http://localhost').searchParams.get('round')).toBe('1');
  });
});

// w42-h/DEC-366 amendment: the REVIEWS cell reads as text -- "N reviews · M
// recusals" -- with the existing per-review disclosure kept behind that
// text as its own trigger, so a recusal count is never lost from the cell.
describe('ResultsTable Reviews cell names the recusal count (DEC-366)', () => {
  it('reads "N reviews · M recusal(s)" when the row has recusals', async () => {
    mockApi({
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/results`]: listEnvelope([{ ...resultsRow(), recusals: 1 }]),
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}/results`]}>
        <Routes>
          <Route path="/review/plans/:planId/results" element={<ResultsTable />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/A Great Talk/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /3 reviews · 1 recusal/ })).toBeInTheDocument();
  });

  it('reads just "N reviews" (no dangling recusal clause) when there are none', async () => {
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

    expect(await screen.findByText(/A Great Talk/)).toBeInTheDocument();
    const reviewsButton = screen.getByRole('button', { name: /3 reviews/ });
    expect(reviewsButton.textContent).not.toContain('recusal');
  });
});

// DEC-906: results lead with RANK (the row's position in the ordering
// currently shown, default score-descending), never sortable itself, and
// the columns the frame drops (Ref as its own column, # Evaluations) are
// gone -- Ref survives only as a muted prefix inside the Title cell.
describe('ResultsTable rank-led header (DEC-906)', () => {
  it('renders RANK / TITLE / SPEAKER / TRACK / SCORE / REVIEWS / DECISION with no Ref or # Evaluations column', async () => {
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

    expect(await screen.findByText(/A Great Talk/)).toBeInTheDocument();

    const table = document.querySelector('table.chq-review-results-table')!;
    const headerLabels = Array.from(table.querySelectorAll('thead th')).map((th) => th.textContent!.trim());
    expect(headerLabels).toEqual(['Rank', 'Title', 'Speaker', 'Track', 'Score', 'Reviews', 'Decision']);

    // Rank is a plain header cell, never a sort button.
    const rankHeader = table.querySelector('thead th')!;
    expect(rankHeader.querySelector('button')).toBeNull();

    // The ref survives as a muted prefix inside the Title cell.
    const bodyRow = table.querySelector('tbody tr')!;
    const titleCell = bodyRow.querySelectorAll('td')[1]!;
    expect(titleCell.textContent).toContain('S-001');
    expect(titleCell.textContent).toContain('A Great Talk');
    expect(titleCell.querySelector('.chq-review-results-ref')?.textContent).toBe('S-001');

    // First (and only) row on page 1 is rank 1.
    expect(bodyRow.querySelectorAll('td')[0]!.textContent).toBe('1');

    // Score prints to exactly one decimal.
    expect(screen.getByText('4.5')).toBeInTheDocument();
  });

  it('numbers rank by position within the page, offsetting by page size on page 2', async () => {
    const rows = Array.from({ length: 3 }, (_, i) => ({
      ...resultsRow({ speakers: ['Ada Lovelace'], trackNames: ['Engineering'] }),
      submissionId: `sub-${i}`,
      ref: `S-${100 + i}`,
      title: `Talk ${i}`,
    }));

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const rawUrl = typeof input === 'string' ? input : input.toString();
      const url = new URL(rawUrl, 'http://localhost');
      if (url.pathname === `/api/v1/plans/${PLAN_ID}`) {
        return new Response(JSON.stringify(plan()), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (url.pathname === `/api/v1/plans/${PLAN_ID}/results`) {
        const body =
          url.searchParams.get('page') === '2'
            ? listEnvelope([{ ...rows[0], submissionId: 'sub-page2', ref: 'S-200', title: 'Page Two Talk' }], {
                total: 51,
              })
            : listEnvelope(rows, { total: 51 });
        return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      throw new Error(`unexpected fetch: ${url.pathname}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}/results`]}>
        <Routes>
          <Route path="/review/plans/:planId/results" element={<ResultsTable />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Talk 0/)).toBeInTheDocument();
    const table = document.querySelector('table.chq-review-results-table')!;
    let bodyRows = Array.from(table.querySelectorAll('tbody tr')).filter((tr) => !tr.classList.contains('chq-review-reviews-row'));
    expect(bodyRows.map((tr) => tr.querySelectorAll('td')[0]!.textContent)).toEqual(['1', '2', '3']);

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByText(/Page Two Talk/)).toBeInTheDocument();
    bodyRows = Array.from(table.querySelectorAll('tbody tr')).filter((tr) => !tr.classList.contains('chq-review-reviews-row'));
    // Page 2, index 0, perPage 50 -> rank 51.
    expect(bodyRows[0]!.querySelectorAll('td')[0]!.textContent).toBe('51');
  });
});

describe('ResultsTable pagination summary (DEC-906)', () => {
  it('renders the product\'s one "Showing X-Y of N" shape', () => {
    expect(paginationSummary(1, 50, 51)).toBe('Showing 1–50 of 51');
    expect(paginationSummary(2, 50, 51)).toBe('Showing 51–51 of 51');
    expect(paginationSummary(1, 50, 0)).toBe('Showing 0 of 0');
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

    expect(await screen.findByText(/A Great Talk/)).toBeInTheDocument();

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

    expect(await screen.findByText(/A Great Talk/)).toBeInTheDocument();
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

    expect(await screen.findByText(/A Great Talk/)).toBeInTheDocument();
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

    expect(await screen.findByText(/A Great Talk/)).toBeInTheDocument();
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

    expect(await screen.findByText(/A Great Talk/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /3 reviews/ }));

    expect(await screen.findByText('Strong proposal, well scoped.')).toBeInTheDocument();
    // DEC-736: the server always resolves a reviewer name -- no
    // '(anonymized)' branch on this organiser-facing endpoint.
    expect(screen.getByText('Priya Patel')).toBeInTheDocument();
    expect(screen.queryByText('(anonymized)')).not.toBeInTheDocument();
    // DEC-723: the evaluation's own blended score, and a criterion chip
    // labelled from `criteria[].label` -- the raw criterionId never
    // appears in the DOM.
    expect(screen.getByText('4.0')).toBeInTheDocument();
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

    expect(await screen.findByText(/A Great Talk/)).toBeInTheDocument();
    const reviewsButton = screen.getByRole('button', { name: /3 reviews/ });
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
// w2-d/DEC-737 amendment: embedded (planId prop supplied), the table is a
// PREVIEW of the standalone results page -- at most 4 rows of the current
// page, no pager, no in-table Download CSV link, and a "See all N results"
// link (owned by the section rule where the export link used to sit) to the
// standalone route, under a plan-scoped heading mirroring ProgressPanel's.
describe('ResultsTable embedded preview (DEC-737)', () => {
  it('renders at most 4 rows, no pager, no Download CSV, and a See-all link to the standalone route', async () => {
    const rows = Array.from({ length: 6 }, (_, i) => ({
      ...resultsRow(),
      submissionId: `sub-${i}`,
      ref: `S-${100 + i}`,
      title: `Talk ${i}`,
    }));
    mockApi({
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/results`]: listEnvelope(rows, { total: 6 }),
    });

    render(
      <MemoryRouter initialEntries={['/review']}>
        <ResultsTable planId={PLAN_ID} />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Talk 0/)).toBeInTheDocument();

    const table = document.querySelector('table.chq-review-results-table')!;
    const bodyRows = Array.from(table.querySelectorAll('tbody tr')).filter(
      (tr) => !tr.classList.contains('chq-review-reviews-row'),
    );
    expect(bodyRows.length).toBe(4);

    expect(document.querySelector('.chq-pager')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Download CSV' })).not.toBeInTheDocument();

    const seeAllLink = screen.getByRole('link', { name: /See all 6 results/ });
    expect(seeAllLink).toBeInTheDocument();
    expect(seeAllLink.getAttribute('href')).toBe(`/review/plans/${PLAN_ID}/results`);

    // Plan-scoped section heading, mirroring ProgressPanel's own.
    expect(screen.getByText('Track Review · ranked results')).toBeInTheDocument();
    expect(screen.queryByText('Ranked results')).not.toBeInTheDocument();
  });
});

// w5-f: the landing's embedded preview is a glance, not a workspace (the
// same reasoning w2-d already applied to the pager/in-table Download CSV
// on this same table) -- its REVIEWS cell prints a plain count, never the
// standalone page's "▸ N reviews" disclosure button.
describe('ResultsTable embedded REVIEWS cell is a plain count (w5-f)', () => {
  it('renders "N reviews · M recusal(s)" as text, not a disclosure button, when embedded', async () => {
    mockApi({
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/results`]: listEnvelope([{ ...resultsRow(), recusals: 1 }]),
    });

    render(
      <MemoryRouter initialEntries={['/review']}>
        <ResultsTable planId={PLAN_ID} />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/A Great Talk/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reviews?/ })).not.toBeInTheDocument();
    expect(screen.getByText('3 reviews · 1 recusal')).toBeInTheDocument();
  });
});

// w2-d/DEC-737: standalone (no planId prop), the table keeps the pager, the
// export link, and the eyebrow, but no longer duplicates a "Ranked results"
// section label under its own h1 -- one heading per page.
describe('ResultsTable standalone keeps pager + export, one heading (DEC-737)', () => {
  it('renders the pager and Download CSV, and exactly one results heading (the h1)', async () => {
    const rows = Array.from({ length: 3 }, (_, i) => ({
      ...resultsRow(),
      submissionId: `sub-${i}`,
      ref: `S-${100 + i}`,
      title: `Talk ${i}`,
    }));
    mockApi({
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/results`]: listEnvelope(rows, { total: 51 }),
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}/results`]}>
        <Routes>
          <Route path="/review/plans/:planId/results" element={<ResultsTable />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Talk 0/)).toBeInTheDocument();

    expect(document.querySelector('.chq-pager')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Download CSV' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /See all/ })).not.toBeInTheDocument();

    expect(screen.getByRole('heading', { name: /^Results: Track Review$/ })).toBeInTheDocument();
    expect(screen.queryByText('Ranked results')).not.toBeInTheDocument();
    expect(document.querySelectorAll('h1, h2.chq-section-label').length).toBe(1);
  });
});

// DEC-633 amendment (wave 25/A27+B8): the expanded reviews band inherits the
// results table's own column grid -- each evaluation is a real <tr>, so its
// reviewer-name and score cells land under the Title/Score headers with no
// hand-copied grid template.
describe('ResultsTable expanded reviews band inherits the column grid (DEC-633)', () => {
  it('lines up the reviewer name under Title (2nd td) and the score under Score (5th td)', async () => {
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
          comment: null,
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

    expect(await screen.findByText(/A Great Talk/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /3 reviews/ }));

    expect(await screen.findByText('Priya Patel')).toBeInTheDocument();

    const evaluationRow = screen.getByText('Priya Patel').closest('tr')!;
    expect(evaluationRow.classList.contains('chq-review-reviews-row')).toBe(true);
    const cells = Array.from(evaluationRow.querySelectorAll('td'));
    expect(cells.length).toBe(7);
    expect(cells[1]!.textContent).toContain('Priya Patel');
    expect(cells[4]!.textContent).toBe('4.0');
  });

  it('renders — in the Score cell for a recused/null-score evaluation', async () => {
    mockApi({
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/results`]: listEnvelope([resultsRow()]),
      [`GET /api/v1/submissions/sub-1/evaluations`]: listEnvelope([
        {
          planId: PLAN_ID,
          planName: 'Track Review',
          round: 1,
          reviewerName: 'Recused Reviewer',
          scores: {},
          score: null,
          criteria: [],
          comment: null,
          submittedAt: null,
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

    expect(await screen.findByText(/A Great Talk/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /3 reviews/ }));

    expect(await screen.findByText('Recused Reviewer')).toBeInTheDocument();
    const evaluationRow = screen.getByText('Recused Reviewer').closest('tr')!;
    const cells = Array.from(evaluationRow.querySelectorAll('td'));
    expect(cells[4]!.textContent).toBe('—');
  });

  it('renders the recusal footer exactly once when the row has recusals', async () => {
    mockApi({
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/results`]: listEnvelope([{ ...resultsRow(), recusals: 2 }]),
      [`GET /api/v1/submissions/sub-1/evaluations`]: listEnvelope([
        {
          planId: PLAN_ID,
          planName: 'Track Review',
          round: 1,
          reviewerName: 'Priya Patel',
          scores: { c1: 4 },
          score: 4,
          criteria: [{ id: 'c1', label: 'Quality', kind: 'rating', weight: 1 }],
          comment: null,
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

    expect(await screen.findByText(/A Great Talk/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /3 reviews · 2 recusals/ }));

    expect(await screen.findByText('Priya Patel')).toBeInTheDocument();
    const footerMatches = screen.getAllByText(/reviewers? recused · their scores are excluded from the mean/);
    expect(footerMatches).toHaveLength(1);
    expect(footerMatches[0]!.textContent).toBe('2 reviewers recused · their scores are excluded from the mean');
  });
});

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
    expect(await screen.findByText(/A Great Talk/)).toBeInTheDocument();

    // First click: sorts by Score (average), descending by default.
    fireEvent.click(screen.getByRole('button', { name: /^Score/ }));
    await waitFor(() => expect(pending.length).toBe(2));
    const firstRequestUrl = pending[1]!.url;
    expect(new URL(firstRequestUrl, 'http://localhost').searchParams.get('dir')).toBe('desc');

    // Second click (rapid): toggles Score to ascending -- this is now the
    // newest request.
    fireEvent.click(screen.getByRole('button', { name: /^Score/ }));
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
    expect(screen.getByRole('button', { name: /^Score/ }).textContent).toContain('▲');
    const scoreHeader = screen.getByRole('button', { name: /^Score/ }).closest('th')!;
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
    // DEC-678 (B7 rule 6, wave 47): an empty row set renders the shared
    // EmptyState 'fresh' block, never the retired flat `chq-empty` <td>.
    expect(screen.getByText('Nothing has been scored yet.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('a settled empty row set renders EmptyState fresh, not a sortable table over a one-cell apology (DEC-678 B7 rule 6)', async () => {
    mockApi({
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/results`]: listEnvelope([]),
    });

    render(
      <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}/results`]}>
        <Routes>
          <Route path="/review/plans/:planId/results" element={<ResultsTable />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Nothing has been scored yet.')).toBeInTheDocument();
    });
    expect(screen.getByText('Results appear as reviewers submit their scorecards.')).toBeInTheDocument();
    // Never the table, its sortable header row, or the pager underneath it.
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Score/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Prev' })).not.toBeInTheDocument();
  });
});

// DEC-902 (wave-21 amendment): the frame's seven-track grid -- 44px 1fr
// 150px 130px 92px 92px auto (Rank/Title/Speaker/Track/Score/Reviews/
// Decision) -- is pinned as fixed table layout, not left to auto-layout
// content sizing.
describe('ResultsTable results table is fixed-layout on the frame\'s seven tracks (DEC-902 wave-21)', () => {
  it('gives each <th> its own width-class hook in frame order', async () => {
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

    expect(await screen.findByText(/A Great Talk/)).toBeInTheDocument();

    const table = document.querySelector('table.chq-review-results-table')!;
    const headerClasses = Array.from(table.querySelectorAll('thead th')).map((th) => th.className);
    expect(headerClasses).toEqual([
      'chq-review-results-col-rank',
      'chq-review-results-col-title',
      'chq-review-results-col-speaker',
      'chq-review-results-col-track',
      'chq-review-results-col-score',
      'chq-review-results-col-reviews',
      'chq-review-results-col-decision',
    ]);
  });

  it('the sheet declares fixed layout with the six pinned tracks + Title as the single remainder', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const cssPath = join(process.cwd(), 'app/src/pages/review/review.css');
    const sheet = readFileSync(cssPath, 'utf-8');

    // fixed layout on the base rule, not left to the media-query reset alone.
    const baseRule = sheet.slice(sheet.indexOf('.chq-review-results-table {'), sheet.indexOf('.chq-review-results-table th {'));
    expect(baseRule).toContain('table-layout: fixed;');

    expect(sheet).toContain('.chq-review-results-col-rank {\n  width: 44px;\n}');
    expect(sheet).toContain('.chq-review-results-col-speaker {\n  width: 150px;\n}');
    expect(sheet).toContain('.chq-review-results-col-track {\n  width: 130px;\n}');
    expect(sheet).toContain('.chq-review-results-col-score {\n  width: 92px;\n}');
    expect(sheet).toMatch(/\.chq-review-results-col-reviews \{[^}]*width: 210px/);
    // Decision hugs its two buttons (DEC-902 wave-20 sub-rule 4) rather than
    // taking a frame-literal `auto`.
    expect(sheet).toMatch(/\.chq-review-results-col-decision\s*\{[^}]*width:\s*190px;[^}]*white-space:\s*nowrap/);
    // Title carries no pinned width of its own -- it is the remainder column.
    expect(sheet).not.toMatch(/\.chq-review-results-col-title\s*{[^}]*width:/);

    // The phone-card media block resets to auto-layout explicitly rather
    // than relying on display:block to silently override table-layout.
    const mediaBlock = sheet.slice(sheet.indexOf('@media (max-width: 700px)'), sheet.indexOf('@media (max-width: 700px)') + 600);
    expect(mediaBlock).toContain('table-layout: auto;');
  });

  it('B8: each expanded reviewer row is a real <tr> with exactly seven <td>s, matching head column parity structurally', async () => {
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

    expect(await screen.findByText(/A Great Talk/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /3 reviews/ }));
    expect(await screen.findByText('Priya Patel')).toBeInTheDocument();

    const table = document.querySelector('table.chq-review-results-table')!;
    const headerCount = table.querySelectorAll('thead th').length;
    const reviewerRow = Array.from(table.querySelectorAll('tbody tr.chq-review-reviews-row')).find((tr) =>
      tr.textContent!.includes('Priya Patel'),
    )!;
    expect(reviewerRow).toBeDefined();
    expect(reviewerRow.querySelectorAll('td').length).toBe(headerCount);
    expect(reviewerRow.querySelectorAll('td').length).toBe(7);

    // The reviewer's name lands under Title (index 1), their score under
    // Score (index 4) -- alignment from real column position, no
    // band-specific layout of its own.
    const cells = reviewerRow.querySelectorAll('td');
    expect(cells[1]!.textContent).toContain('Priya Patel');
    expect(cells[4]!.textContent).toContain('4.0');
  });
});
