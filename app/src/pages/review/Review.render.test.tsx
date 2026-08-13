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
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/plans`]: listEnvelope([planWithNullDates()]),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([
        { userId: 'u-1', email: 'rev1@example.com', assigned: 4, completed: 1, recused: 0 },
      ]),
      [`GET /api/v1/plans/${PLAN_ID}`]: planWithNullDates(),
      [`GET /api/v1/plans/${PLAN_ID}/results`]: listEnvelope([]),
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <ReviewPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Evaluation plans' })).toBeInTheDocument();
    expect(await screen.findByText('Keynote Track Review')).toBeInTheDocument();
    // DEC-706: the plan row is chosen by clicking the row, not a radio --
    // per-row navigation is via the Edit link (Edit -> /review/plans/:id).
    expect(screen.getByRole('link', { name: 'Edit' })).toBeInTheDocument();

    // DEC-587: inline row progress reads from the SAME /plans/:id/progress
    // aggregate the Progress page consumes -- 1 of 4 evaluations in here.
    await waitFor(() => {
      expect(screen.getByText('1 of 4 evaluations in')).toBeInTheDocument();
    });
  });

  // DEC-674: the landing page composes the plan list with the reviewer
  // progress and ranked results regions for the selected plan, all on one
  // page -- no navigation required to see any of the three regions.
  it('renders the plan list, reviewer-progress region, and ranked-results region together, without navigation', async () => {
    const planB = { ...planWithNullDates(), id: 'plan-b', name: 'Lightning Talks' };
    mockApi({
      'GET /api/v1/me': organizerMe(),
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/plans`]: listEnvelope([planWithNullDates(), planB]),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([
        { userId: 'u-1', email: 'rev1@example.com', assigned: 4, completed: 0, recused: 0 },
      ]),
      [`GET /api/v1/plans/plan-b/progress`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}`]: planWithNullDates(),
      [`GET /api/v1/plans/${PLAN_ID}/results`]: listEnvelope([
        { submissionId: 'sub-1', ref: 'S-001', title: 'A Talk', count: 2, average: 4.5, perCriterion: { c1: 4.5 }, perDropdown: {}, status: 'pending', speakers: [], trackNames: [] },
      ]),
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <ReviewPage />
      </MemoryRouter>,
    );

    // Region one: the plans list.
    expect(await screen.findByRole('heading', { name: 'Evaluation plans' })).toBeInTheDocument();
    expect(await screen.findByText('Keynote Track Review')).toBeInTheDocument();

    // Region two: the selected plan's reviewer-progress table, embedded
    // (no navigation) with the DEC-706/707 tertiary "Remind the N not
    // started" link on its section rule (never a filled primary button).
    await waitFor(() => {
      expect(screen.getByText('rev1@example.com')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Remind the 1 not started' })).toBeInTheDocument();

    // Region three: the selected plan's ranked-results table, embedded (no
    // navigation) with an Accept control present.
    await waitFor(() => {
      expect(screen.getByText('A Talk')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument();

    // Embedded regions never render their own standalone page title/back
    // link chrome -- only the landing page's own "Review" title.
    expect(screen.queryByRole('heading', { name: 'Reviewer progress' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /^Results/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Back to plans/ })).not.toBeInTheDocument();
  });

  // DEC-760/DEC-733: when nobody is unstarted the "Remind the N not
  // started" reminder is an impossible action -- absent, never rendered
  // disabled.
  it('hides the "Remind the N not started" link when every reviewer has started', async () => {
    mockApi({
      'GET /api/v1/me': organizerMe(),
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/plans`]: listEnvelope([planWithNullDates()]),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([
        { userId: 'u-1', email: 'rev1@example.com', assigned: 4, completed: 2, recused: 0 },
      ]),
      [`GET /api/v1/plans/${PLAN_ID}`]: planWithNullDates(),
      [`GET /api/v1/plans/${PLAN_ID}/results`]: listEnvelope([]),
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <ReviewPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('rev1@example.com')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /Remind the .* not started/ })).not.toBeInTheDocument();
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

    // DEC-745: the plan NAME is the page title, rendered as an editable
    // input rather than an <h1> -- no heading role for it anymore.
    expect(await screen.findByDisplayValue('Keynote Track Review')).toBeInTheDocument();

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

    // DEC-745: no heading role and no track-filter checkboxes anymore --
    // the plan's already-loaded filters.trackIds still round-trips through
    // Save even without a UI to edit it (draft.trackIds is preserved data,
    // just no longer an editable field row).
    expect(await screen.findByDisplayValue('Keynote Track Review')).toBeInTheDocument();
    expect(screen.queryByLabelText('Main Stage')).not.toBeInTheDocument();

    const saveButton = screen.getByRole('button', { name: 'Save' });
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

    // DEC-674: the standalone route still renders its own page title and
    // back-link chrome unchanged -- deep links aren't broken by embedding.
    expect(await screen.findByRole('heading', { name: 'Reviewer progress' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to plans/ })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('rev1@example.com')).toBeInTheDocument();
    });
    // DEC-819: each per-reviewer row carries its own "X of Y" numeric
    // beside the bar, alongside the DONE/N-TO-GO state flag.
    expect(screen.getByText('2 of 4')).toBeInTheDocument();
  });

  it('renders the results view', async () => {
    mockApi({
      'GET /api/v1/me': organizerMe(),
      [`GET /api/v1/plans/${PLAN_ID}`]: planWithNullDates(),
      [`GET /api/v1/plans/${PLAN_ID}/results`]: listEnvelope([
        { submissionId: 'sub-1', ref: 'S-001', title: 'A Talk', count: 2, average: 4.5, perCriterion: { c1: 4.5 }, perDropdown: {}, status: 'pending', speakers: [], trackNames: [] },
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
  it('renders a non-empty ReviewerQueue, headed by the plan\'s own name (DEC-819)', async () => {
    mockApi({
      'GET /api/v1/me': reviewerMe(),
      [`GET /api/v1/review/plans/${PLAN_ID}`]: planWithNullDates(),
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: {
        ...listEnvelope([
          { submissionId: 'sub-1', ref: 'S-001', title: 'A Talk About Testing', ratingsCount: 0, alreadyRatedByMe: false, myScore: null },
          { submissionId: 'sub-2', ref: 'S-002', title: 'Another Talk', ratingsCount: 1, alreadyRatedByMe: true, myScore: 4.5 },
        ]),
        open: true,
        recused: [],
        planName: 'Keynote Track Review',
        scopeTrackName: null,
        closeDate: null,
      },
    });

    render(
      <MemoryRouter initialEntries={[`/plans/${PLAN_ID}`]}>
        <ReviewPage />
      </MemoryRouter>,
    );

    // DEC-819/DEC-831: the plan-scoped route is headed by an eyebrow naming
    // the plan (never the landing page's generic "Your queue"), and the h1
    // itself now reads "N left to score" -- 1 of the 2 seeded items is
    // still unrated.
    await waitFor(() => {
      expect(screen.getByText('REVIEW · Keynote Track Review')).toBeInTheDocument();
    });
    expect(await screen.findByRole('heading', { name: '1 left to score' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Your queue' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Your plans/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /A Talk About Testing/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Another Talk/ })).toBeInTheDocument();

    // DEC-831: rows read SCORED/NOT SCORED, replacing the old bare
    // "N ratings so far" count.
    expect(screen.getByText('NOT SCORED')).toBeInTheDocument();
    expect(screen.getByText('SCORED 4.5')).toBeInTheDocument();

    // DEC-561/DEC-845: completed items keep their spot in the delivered
    // (never re-sorted) order -- SCORED/NOT SCORED replaces the old Complete
    // pill entirely, so neither row renders that word anymore.
    const rows = screen.getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('A Talk About Testing');
    expect(rows[0]).toHaveTextContent('NOT SCORED');
    expect(rows[0]).not.toHaveTextContent('Complete');
    expect(rows[1]).toHaveTextContent('Another Talk');
    expect(rows[1]).toHaveTextContent('SCORED 4.5');
    expect(rows[1]).not.toHaveTextContent('Complete');
  });

  // DEC-857: a row's action link names the action it actually offers, the
  // ref renders exactly once (title alone), and the format meta line only
  // renders when the queue item carries a non-null format.
  it('names the row action by scored state, renders the ref once, and prints format meta only when present', async () => {
    mockApi({
      'GET /api/v1/me': reviewerMe(),
      [`GET /api/v1/review/plans/${PLAN_ID}`]: planWithNullDates(),
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: {
        ...listEnvelope([
          {
            submissionId: 'sub-1',
            ref: 'S-001',
            title: 'A Talk About Testing',
            ratingsCount: 0,
            alreadyRatedByMe: false,
            myScore: null,
            format: 'Talk (30 min)',
          },
          {
            submissionId: 'sub-2',
            ref: 'S-002',
            title: 'Another Talk',
            ratingsCount: 1,
            alreadyRatedByMe: true,
            myScore: 4.5,
            format: null,
          },
        ]),
        open: true,
        recused: [],
        planName: 'Keynote Track Review',
        scopeTrackName: null,
        closeDate: null,
      },
    });

    render(
      <MemoryRouter initialEntries={[`/plans/${PLAN_ID}`]}>
        <ReviewPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('A Talk About Testing')).toBeInTheDocument();
    });

    const rows = screen.getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Score this');
    expect(rows[0]).toHaveTextContent('Talk (30 min)');
    expect(rows[1]).toHaveTextContent('Change your score');
    expect(rows[1]).not.toHaveTextContent('Score this');

    // The ref string appears exactly once within each row's textContent.
    const countOccurrences = (haystack: string, needle: string) =>
      haystack.split(needle).length - 1;
    expect(countOccurrences(rows[0]?.textContent ?? '', 'S-001')).toBe(1);
    expect(countOccurrences(rows[1]?.textContent ?? '', 'S-002')).toBe(1);

    // No format meta text leaks into the second (format: null) row, and the
    // first row's format meta renders exactly one element (row-scoped, since
    // the page header may render its own .chq-review-plan-meta subtitle).
    expect(rows[1]).not.toHaveTextContent('Talk (30 min)');
    expect(rows[0]?.querySelectorAll('.chq-review-plan-meta').length).toBe(1);
    expect(rows[1]?.querySelectorAll('.chq-review-plan-meta').length).toBe(0);
  });

  // DEC-845: the subtitle names the CALLER's own scope track (or "All
  // tracks") and "closes in N days" -- omitted entirely when the plan has
  // no close date. The progress bar reads scored/total.
  it('renders the subtitle scope/close clause and progress bar from the queue envelope', async () => {
    mockApi({
      'GET /api/v1/me': reviewerMe(),
      [`GET /api/v1/review/plans/${PLAN_ID}`]: { ...planWithNullDates(), timezone: 'America/New_York' },
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: {
        ...listEnvelope([
          { submissionId: 'sub-1', ref: 'S-001', title: 'A Talk About Testing', ratingsCount: 0, alreadyRatedByMe: false, myScore: null },
          { submissionId: 'sub-2', ref: 'S-002', title: 'Another Talk', ratingsCount: 1, alreadyRatedByMe: true, myScore: 4.5 },
        ]),
        open: true,
        recused: [],
        planName: 'Keynote Track Review',
        scopeTrackName: 'Main Stage',
        closeDate: Date.now() + 3 * 24 * 60 * 60 * 1000,
      },
    });

    render(
      <MemoryRouter initialEntries={[`/plans/${PLAN_ID}`]}>
        <ReviewPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Main Stage/)).toBeInTheDocument();
    expect(screen.getByText(/closes in \d+ days?/)).toBeInTheDocument();

    const bar = document.querySelector('.chq-review-scoped-progress .chq-bar-fill') as HTMLElement;
    expect(bar).toBeTruthy();
    // 1 of 2 items scored -> 50%.
    expect(bar.style.width).toBe('50%');
  });

  // DEC-845: the zero-count case never reads "0 left to score" -- it keeps
  // the existing empty-queue copy.
  it('reads "Nothing left in your queue. Nicely done." when nothing is left to score', async () => {
    mockApi({
      'GET /api/v1/me': reviewerMe(),
      [`GET /api/v1/review/plans/${PLAN_ID}`]: planWithNullDates(),
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: {
        ...listEnvelope([
          { submissionId: 'sub-1', ref: 'S-001', title: 'A Talk About Testing', ratingsCount: 1, alreadyRatedByMe: true, myScore: 4 },
        ]),
        open: true,
        recused: [],
        planName: 'Keynote Track Review',
        scopeTrackName: null,
        closeDate: null,
      },
    });

    render(
      <MemoryRouter initialEntries={[`/plans/${PLAN_ID}`]}>
        <ReviewPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Nothing left in your queue. Nicely done.' })).toBeInTheDocument();
  });

  it('landing on /review with exactly one plan shows the queue directly, no plan-name-only picker', async () => {
    mockApi({
      'GET /api/v1/me': reviewerMe(),
      'GET /api/v1/review/plans': listEnvelope([{ ...planWithNullDates(), id: PLAN_ID, name: 'Solo Plan' }]),
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: {
        ...listEnvelope([
          { submissionId: 'sub-1', ref: 'S-001', title: 'Only Talk', ratingsCount: 0, alreadyRatedByMe: false },
        ]),
        open: true,
        recused: [],
      },
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <ReviewPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('link', { name: /Only Talk/ })).toBeInTheDocument();
    // No picker: the single plan's name never renders as its own heading.
    expect(screen.queryByRole('heading', { name: 'Solo Plan' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Your evaluation plans' })).not.toBeInTheDocument();
  });

  it('landing on /review with several plans renders one section per plan, in list order, without merging or re-sorting items', async () => {
    const planA = { ...planWithNullDates(), id: 'plan-a', name: 'Plan A' };
    const planB = { ...planWithNullDates(), id: 'plan-b', name: 'Plan B' };
    mockApi({
      'GET /api/v1/me': reviewerMe(),
      'GET /api/v1/review/plans': listEnvelope([planA, planB]),
      'GET /api/v1/review/plans/plan-a/queue': {
        ...listEnvelope([
          { submissionId: 'a-1', ref: 'A-001', title: 'Alpha First', ratingsCount: 0, alreadyRatedByMe: false },
          { submissionId: 'a-2', ref: 'A-002', title: 'Alpha Second', ratingsCount: 1, alreadyRatedByMe: true },
        ]),
        open: true,
        recused: [],
      },
      'GET /api/v1/review/plans/plan-b/queue': {
        ...listEnvelope([
          { submissionId: 'b-1', ref: 'B-001', title: 'Beta First', ratingsCount: 0, alreadyRatedByMe: false },
        ]),
        open: true,
        recused: [{ submissionId: 'b-2', ref: 'B-002', title: 'Beta Recused', reason: 'conflict' }],
      },
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <ReviewPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Plan A' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Plan B' })).toBeInTheDocument();

    const headings = screen.getAllByRole('heading', { level: 2 });
    const headingNames = headings.map((h) => h.textContent);
    expect(headingNames.indexOf('Plan A')).toBeLessThan(headingNames.indexOf('Plan B'));

    // Item order within each section is delivered exactly as the server
    // sent it -- never re-sorted, and never merged across plan sections.
    const planASection = screen.getByRole('heading', { name: 'Plan A' }).closest('section')!;
    const planARows = planASection.querySelectorAll('li.chq-review-queue-row');
    expect(planARows[0]).toHaveTextContent('Alpha First');
    expect(planARows[1]).toHaveTextContent('Alpha Second');

    // The recusal stays attached to its own plan (Plan B), never Plan A.
    const planBSection = screen.getByRole('heading', { name: 'Plan B' }).closest('section')!;
    expect(planBSection).toHaveTextContent('Beta Recused');
    expect(planASection).not.toHaveTextContent('Beta Recused');
  });
});

// DEC-608: each role's route subtree ends in a catch-all rather than
// rendering an empty <main> for a URL that belongs to the other role.
describe('ReviewPage catch-all (DEC-608)', () => {
  it('an organiser opening a reviewer scorecard URL sees a named boundary panel, not a blank main', async () => {
    mockApi({
      'GET /api/v1/me': organizerMe(),
    });

    render(
      <MemoryRouter initialEntries={[`/plans/${PLAN_ID}/submissions/sub-1`]}>
        <ReviewPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/belongs to the reviewer view/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Back to Review' });
    expect(link).toHaveAttribute('href', '/review');
  });

  it('a reviewer opening an organiser-only URL sees a named boundary panel, not a blank main', async () => {
    mockApi({
      'GET /api/v1/me': reviewerMe(),
    });

    render(
      <MemoryRouter initialEntries={[`/plans/${PLAN_ID}/results`]}>
        <ReviewPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/belongs to the organiser view/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Back to Review' });
    expect(link).toHaveAttribute('href', '/review');
  });
});
