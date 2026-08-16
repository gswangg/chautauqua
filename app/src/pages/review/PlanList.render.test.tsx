// DEC-706/DEC-707 render regression: the Review landing's plan list has no
// radio input (a row is chosen by clicking the row, quiet active state +
// aria-current), and the embedded progress region's "Remind the N not
// started" tertiary link count equals selectRemindTargets(rows,
// 'not_started').length -- the SAME domain predicate the route imports,
// never a hand-copied count in the SPA.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PlanList } from './PlanList';
import { selectRemindTargets } from '../../../../src/domain/evaluation';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';
import type { ProgressRow } from './types';

const HERE = dirname(fileURLToPath(import.meta.url));

const EVENT_ID = 'evt-planlist-render';
const PLAN_ID = 'plan-a';

function plan() {
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
    // DEC-522: PlanList's window read now delegates to the shared
    // isPlanOpen domain predicate, which requires a non-empty timezone.
    timezone: 'UTC',
  };
}

const PROGRESS_ROWS: ProgressRow[] = [
  { userId: 'u-1', email: 'started@example.com', name: null, assigned: 4, completed: 2, recused: 0, trackName: null },
  { userId: 'u-2', email: 'fresh1@example.com', name: null, assigned: 4, completed: 0, recused: 0, trackName: null },
  { userId: 'u-3', email: 'fresh2@example.com', name: null, assigned: 4, completed: 0, recused: 0, trackName: null },
  { userId: 'u-4', email: 'done@example.com', name: null, assigned: 4, completed: 4, recused: 0, trackName: null },
];

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

describe('PlanList (DEC-706/DEC-707 render)', () => {
  it('renders a plan row with no radio input, and the remind link names the not-started count', async () => {
    mockApi({
      'GET /api/v1/me': { userId: 'u-organizer', email: 'organizer@example.com', role: 'organizer', orgId: 'org-1' },
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/plans`]: listEnvelope([plan()]),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope(PROGRESS_ROWS),
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/results`]: listEnvelope([]),
    });

    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <PlanList />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Keynote Track Review')).toBeInTheDocument();

    // DEC-706: no radio input anywhere in a plan row -- selection is the row
    // click itself.
    expect(container.querySelector('input[type="radio"]')).toBeNull();

    // The row itself carries aria-current once selected (default selection
    // is the only/open plan).
    const row = screen.getByText('Keynote Track Review').closest('.chq-review-plan-row');
    expect(row).toHaveAttribute('aria-current', 'true');

    // DEC-707: the tertiary "Remind the N not started" link's count is
    // exactly selectRemindTargets(rows, 'not_started').length -- computed
    // from the SAME rows the row-level state reads, never a hardcoded
    // literal in this test.
    const expectedCount = selectRemindTargets(PROGRESS_ROWS, 'not_started').length;
    await waitFor(() => {
      expect(screen.getByRole('button', { name: `Remind the ${expectedCount} not started` })).toBeInTheDocument();
    });
  });

  it('New plan and Export results CSV live on the title row, not a standalone toolbar band', async () => {
    mockApi({
      'GET /api/v1/me': { userId: 'u-organizer', email: 'organizer@example.com', role: 'organizer', orgId: 'org-1' },
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/plans`]: listEnvelope([plan()]),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/results`]: listEnvelope([]),
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <PlanList />
      </MemoryRouter>,
    );

    const newPlanLink = await screen.findByRole('link', { name: 'New plan' });
    expect(newPlanLink.closest('.chq-review-title-row')).not.toBeNull();

    const exportLink = screen.getByRole('link', { name: 'Export results CSV' });
    expect(exportLink.closest('.chq-review-title-row')).not.toBeNull();
    expect(exportLink).toHaveAttribute('href', expect.stringContaining(PLAN_ID));
  });

  // DEC-763: the title-row 'Export results CSV' link must honour whatever
  // sort the in-table 'Download CSV' link is currently showing -- the same
  // header click that changes the table's own arrow must also change this
  // link's href.
  it('the title-row export link gains sort/dir after a results header click', async () => {
    mockApi({
      'GET /api/v1/me': { userId: 'u-organizer', email: 'organizer@example.com', role: 'organizer', orgId: 'org-1' },
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/plans`]: listEnvelope([plan()]),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/results`]: listEnvelope([
        {
          submissionId: 'sub-1',
          ref: 'S-001',
          title: 'A Great Talk',
          count: 1,
          average: 4,
          perCriterion: { c1: 4 },
          perDropdown: {},
          status: 'pending',
          speakers: ['Ada Lovelace'],
          trackNames: [],
        },
      ]),
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <PlanList />
      </MemoryRouter>,
    );

    const exportLinkBefore = await screen.findByRole('link', { name: 'Export results CSV' });
    expect(new URL(exportLinkBefore.getAttribute('href')!, 'http://localhost').searchParams.get('sort')).toBeNull();

    expect(await screen.findByText(/A Great Talk/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Score/ }));

    await waitFor(() => {
      const exportLinkAfter = screen.getByRole('link', { name: 'Export results CSV' });
      const url = new URL(exportLinkAfter.getAttribute('href')!, 'http://localhost');
      expect(url.searchParams.get('sort')).toBe('average');
      expect(url.searchParams.get('dir')).toBe('desc');
    });

    // w2-d/DEC-737: embedded, the in-table 'Download CSV' link is gone --
    // export ownership stays with the title-row link exclusively.
    expect(screen.queryByRole('link', { name: 'Download CSV' })).not.toBeInTheDocument();
  });

  // DEC-760: the title-row plan count gains a second clause once each
  // plan's progress aggregate has resolved -- "N with evaluations in"
  // counts plans with at least one recorded evaluation, and the clause is
  // withheld entirely (no fabricated number) while any plan's progress is
  // still in flight.
  it('the plan-count summary adds "N with evaluations in" once progress resolves, and a plan row shows its scope subtitle', async () => {
    const planB = { ...plan(), id: 'plan-b', name: 'Empty Plan', filters: { trackIds: ['track-1'] }, maxEvaluations: 2 };
    mockApi({
      'GET /api/v1/me': { userId: 'u-organizer', email: 'organizer@example.com', role: 'organizer', orgId: 'org-1' },
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([{ id: 'track-1', name: 'AI Engineering' }]),
      [`GET /api/v1/events/${EVENT_ID}/plans`]: listEnvelope([plan(), planB]),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope(PROGRESS_ROWS),
      [`GET /api/v1/plans/plan-b/progress`]: listEnvelope([]),
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/results`]: listEnvelope([]),
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <PlanList />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Keynote Track Review')).toBeInTheDocument();

    // Only 'plan-a' has completed evaluations (PROGRESS_ROWS has completed >
    // 0 entries); 'plan-b' has none -- so the count is 1, not 2.
    await waitFor(() => {
      expect(screen.getByText('2 plans · 1 with evaluations in')).toBeInTheDocument();
    });

    // plan() has filters: null and maxEvaluations: null -- "All tracks"
    // with no "reviews each" clause (DEC-377: never guess a number).
    const rowA = screen.getByText('Keynote Track Review').closest('.chq-review-plan-row')!;
    expect(rowA).toHaveTextContent('All tracks');
    expect(rowA).not.toHaveTextContent('reviews each');

    // planB carries a track filter + a max-evaluations cap -- the resolved
    // track NAME (never the raw id) plus the reviews-each count.
    const rowB = screen.getByText('Empty Plan').closest('.chq-review-plan-row')!;
    expect(rowB).toHaveTextContent('AI Engineering · 2 reviews each');
  });

  // B7 (DEC-678 amendment): a fresh (never-created) plan list renders the
  // shared EmptyState with a 'New plan' action, and never a results header
  // over an unselected/nonexistent plan.
  it('renders the fresh empty state with a New plan action, and no results header, when there are no plans', async () => {
    mockApi({
      'GET /api/v1/me': { userId: 'u-organizer', email: 'organizer@example.com', role: 'organizer', orgId: 'org-1' },
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/plans`]: listEnvelope([]),
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <PlanList />
      </MemoryRouter>,
    );

    expect(await screen.findByText('No review plans yet')).toBeInTheDocument();
    // Two "New plan" affordances is fine (title-row link + empty-state
    // action) -- what matters is at least one exists and no results table
    // header renders over a nonexistent selection.
    expect(screen.getAllByRole('link', { name: 'New plan' }).length).toBeGreaterThan(0);
    expect(screen.queryByText(/results · ranked/)).not.toBeInTheDocument();
  });

  // DEC-674 (wave-58 amendment): planState/isWindowOpen delegate to the
  // shared isPlanOpen domain predicate (zone-aware), so a plan whose
  // closeDate is TODAY in a non-UTC event timezone still reads 'Open now'
  // and stays the landing page's default selection at a wall-clock moment
  // that is already past UTC midnight of that day.
  it('a plan closing today in a non-UTC event timezone still reads Open now and stays the default selection', async () => {
    // closeDate is the UTC-midnight day label for 2027-03-01. `now` is
    // 2027-03-01T20:00:00Z -- noon in America/Los_Angeles (UTC-8 in March,
    // before DST), still the same Pacific calendar day, but already past
    // the bare `closeDate < now` comparison the old code used to make.
    const closeDate = Date.UTC(2027, 2, 1);
    const now = Date.UTC(2027, 2, 1, 20, 0, 0);
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(now);
    try {
      const tzPlan = { ...plan(), openDate: null, closeDate, timezone: 'America/Los_Angeles' };
      mockApi({
        'GET /api/v1/me': { userId: 'u-organizer', email: 'organizer@example.com', role: 'organizer', orgId: 'org-1' },
        [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
        [`GET /api/v1/events/${EVENT_ID}/plans`]: listEnvelope([tzPlan]),
        [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
        [`GET /api/v1/plans/${PLAN_ID}`]: tzPlan,
        [`GET /api/v1/plans/${PLAN_ID}/results`]: listEnvelope([]),
      });

      render(
        <MemoryRouter initialEntries={['/']}>
          <PlanList />
        </MemoryRouter>,
      );

      expect(await screen.findByText('Open now')).toBeInTheDocument();
      const row = screen.getByText('Keynote Track Review').closest('.chq-review-plan-row');
      // The landing page's default selection is this plan (the only plan,
      // and its window is still open) -- aria-current stays true.
      expect(row).toHaveAttribute('aria-current', 'true');
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  // DEC-674 (wave-58 amendment): a drift detector -- no file under
  // app/src/pages/review compares openDate/closeDate/openAt/closeAt
  // directly against now/Date.now(), which is exactly the bug this task
  // fixed. Every window read must go through the shared isPlanOpen domain
  // predicate instead.
  it('no file under app/src/pages/review compares a window bound directly against now', () => {
    const reviewDir = HERE;
    // Source files only -- test files legitimately discuss/quote the exact
    // comparison shape in comments (this file included) while constructing
    // the close-day-in-a-non-UTC-zone fixture the bug required.
    const files = readdirSync(reviewDir).filter((f) => (f.endsWith('.tsx') || f.endsWith('.ts')) && !f.includes('.test.'));
    const boundRe = /\b(openDate|closeDate|openAt|closeAt)\b\s*(<|>)\s*(now|Date\.now\(\))/;
    const reverseBoundRe = /\b(now|Date\.now\(\))\s*(<|>)\s*\b(openDate|closeDate|openAt|closeAt)\b/;
    const offenders: string[] = [];
    for (const file of files) {
      const contents = readFileSync(join(reviewDir, file), 'utf-8');
      if (boundRe.test(contents) || reverseBoundRe.test(contents)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  // DEC-147 wave-63 amendment: planNamesRound gates the row's round clause
  // -- a single-round plan renders no round line at all (not an empty
  // string in the meta span), while a multi-round plan still shows it.
  it('renders no round line for a single-round plan', async () => {
    mockApi({
      'GET /api/v1/me': { userId: 'u-organizer', email: 'organizer@example.com', role: 'organizer', orgId: 'org-1' },
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/plans`]: listEnvelope([plan()]),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope(PROGRESS_ROWS),
      [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
      [`GET /api/v1/plans/${PLAN_ID}/results`]: listEnvelope([]),
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <PlanList />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Keynote Track Review')).toBeInTheDocument();
    expect(screen.queryByText(/Round \d+ of \d+/)).not.toBeInTheDocument();
  });

  it('renders the round line for a multi-round plan', async () => {
    const multiRoundPlan = { ...plan(), rounds: 2, currentRound: 1 };
    mockApi({
      'GET /api/v1/me': { userId: 'u-organizer', email: 'organizer@example.com', role: 'organizer', orgId: 'org-1' },
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/plans`]: listEnvelope([multiRoundPlan]),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope(PROGRESS_ROWS),
      [`GET /api/v1/plans/${PLAN_ID}`]: multiRoundPlan,
      [`GET /api/v1/plans/${PLAN_ID}/results`]: listEnvelope([]),
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <PlanList />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Keynote Track Review')).toBeInTheDocument();
    expect(screen.getByText(/Round 1 of 2/)).toBeInTheDocument();
  });
});
