// REVIEW PACK frame 03-03 (DEC-874 wave-65 amendment): the desktop row
// anatomy -- two-column grid (never a full-width phone-frame button), a
// scored row's action takes the secondary face, a recused row's action IS
// its reason (never a live button), the plan-scoped title row's own
// "Score the next one" shortcut, and the capped-list "Showing 5 of N" /
// "Show all N" footer. DEC-939's binding contrast guard
// (review-primary-contrast.test.ts) already covers the color/background
// ban on classes sharing an element with .chq-btn-primary/.chq-btn-secondary.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ReviewerQueue } from './ReviewerQueue';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const HERE = dirname(fileURLToPath(import.meta.url));
const PLAN_ID = 'plan-frame-1';

function queueItem(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    submissionId: 'sub-1',
    ref: 'S-001',
    title: 'A Talk',
    ratingsCount: 0,
    alreadyRatedByMe: false,
    myScore: null,
    ...overrides,
  };
}

// DEC-845 amendment (wave 38): every queue envelope now carries
// `unscoredTotal` -- the header/footer counts read it, never
// items.length/filter. Defaults to the true count off the SAME items array
// (mirroring the route's own unscoredTotal computation) so existing fixtures
// stay accurate without hand-counting each call site; `overrides.total`/
// `overrides.unscoredTotal` let a test simulate a scope bigger than the
// loaded page.
function queueEnvelope(
  items: ReturnType<typeof queueItem>[],
  overrides: { total?: number; unscoredTotal?: number } = {},
) {
  return {
    ...listEnvelope(items),
    total: overrides.total ?? items.length,
    unscoredTotal:
      overrides.unscoredTotal ??
      items.filter((i) => !(i as { alreadyRatedByMe?: boolean }).alreadyRatedByMe).length,
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

function renderQueue() {
  return render(
    <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
      <Routes>
        <Route path="/review/plans/:planId" element={<ReviewerQueue />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ReviewerQueue desktop row anatomy (REVIEW PACK frame 03-03)', () => {
  it('the row action selector carries no width:100% declaration in review.css', () => {
    const css = readFileSync(join(HERE, 'review.css'), 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');
    const rules = css.match(/\.chq-review-queue-row-action\s*\{([^{}]*)\}/);
    expect(rules).not.toBeNull();
    expect(rules![1]).not.toMatch(/width:\s*100%/);
  });

  it('a scored row action uses the secondary face and reads "Change your score"', async () => {
    mockApi({
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: {
        ...queueEnvelope([queueItem({ alreadyRatedByMe: true, myScore: 4.5 })]),
        open: true,
        recused: [],
      },
    });

    renderQueue();

    const action = await screen.findByRole('link', { name: 'Change your score' });
    expect(action).toHaveClass('chq-btn-secondary');
    expect(action).not.toHaveClass('chq-btn-primary');
  });

  it('an unscored row action uses the primary face and reads "Score this"', async () => {
    mockApi({
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: {
        ...queueEnvelope([queueItem({ alreadyRatedByMe: false })]),
        open: true,
        recused: [],
      },
    });

    renderQueue();

    const action = await screen.findByRole('link', { name: 'Score this' });
    expect(action).toHaveClass('chq-btn-primary');
    expect(action).not.toHaveClass('chq-btn-secondary');
  });

  it('a recused row\'s action column carries the reason text (falling back when null), reads RECUSED in caps, and Undo still fires the DELETE', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: {
        ...queueEnvelope([]),
        open: true,
        recused: [
          { submissionId: 'sub-r1', ref: 'S-020', title: 'Conflicted Talk', reason: 'Personal conflict' },
          { submissionId: 'sub-r2', ref: 'S-021', title: 'Other Conflicted Talk', reason: null },
        ],
      },
      [`DELETE /api/v1/review/plans/${PLAN_ID}/recusals/sub-r1`]: { status: 204, body: undefined },
    });

    renderQueue();

    expect(await screen.findByText('Personal conflict')).toBeInTheDocument();
    expect(screen.getByText('You work with this speaker')).toBeInTheDocument();
    expect(screen.getAllByText('RECUSED').length).toBe(2);

    const undoButtons = screen.getAllByRole('button', { name: 'Undo' });
    expect(undoButtons.length).toBe(2);
    // The reason is not itself a live button.
    expect(screen.queryByRole('button', { name: 'Personal conflict' })).not.toBeInTheDocument();

    fireEvent.click(undoButtons[0]!);

    await waitFor(() => {
      const deleteCall = fetchMock.mock.calls.find(([input, init]) => {
        const url = typeof input === 'string' ? input : (input as URL).toString();
        return (init as RequestInit | undefined)?.method === 'DELETE' && url.includes('/recusals/sub-r1');
      });
      expect(deleteCall).toBeDefined();
    });
  });

  // DEC-018 (wave-58 amendment): the queue's closed-plan dead end is a
  // reviewer-only voice -- a reviewer sees the "not currently open" message
  // and no rows.
  it('shows the reviewer dead end and no rows for a reviewer on a closed plan', async () => {
    mockApi({
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: {
        ...queueEnvelope([]),
        open: false,
        viewerIsOrganizer: false,
        recused: [],
      },
    });

    renderQueue();

    expect(await screen.findByText('This review plan is not currently open.')).toBeInTheDocument();
    expect(
      screen.queryByText('This plan is closed. You are seeing it as an organiser — reviewers cannot score it now.'),
    ).not.toBeInTheDocument();
  });

  // The organiser voice: the same closed plan still renders its full queue
  // rows (server-admitted, same as the submission detail route), with a
  // muted note naming what they're seeing instead of the reviewer dead end.
  it('shows the organiser note and still renders queue rows for an organizer on a closed plan', async () => {
    mockApi({
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: {
        ...queueEnvelope([queueItem({ submissionId: 'sub-closed-1', title: 'Closed Plan Talk' })]),
        open: false,
        viewerIsOrganizer: true,
        recused: [],
      },
    });

    renderQueue();

    expect(await screen.findByText('Closed Plan Talk')).toBeInTheDocument();
    expect(
      screen.getByText('This plan is closed. You are seeing it as an organiser — reviewers cannot score it now.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('This review plan is not currently open.')).not.toBeInTheDocument();
  });

  it('shows "Showing 5 of N" / "Show all N" once the combined items+recused count exceeds 5, and reveals the rest on click', async () => {
    const items = Array.from({ length: 4 }, (_, i) => queueItem({ submissionId: `sub-${i}`, ref: `S-00${i}`, title: `Talk ${i}` }));
    const recused = [
      { submissionId: 'sub-r1', ref: 'S-r1', title: 'Recused One', reason: 'conflict' },
      { submissionId: 'sub-r2', ref: 'S-r2', title: 'Recused Two', reason: 'conflict' },
      { submissionId: 'sub-r3', ref: 'S-r3', title: 'Recused Three', reason: 'conflict' },
    ];
    mockApi({
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: {
        ...queueEnvelope(items),
        open: true,
        recused,
      },
    });

    renderQueue();

    expect(await screen.findByText('Talk 0')).toBeInTheDocument();
    expect(screen.getByText('Showing 5 of 7')).toBeInTheDocument();
    // Only 5 of the 7 combined rows render: all 4 items plus 1 recused row.
    expect(screen.getByText('Recused One')).toBeInTheDocument();
    expect(screen.queryByText('Recused Two')).not.toBeInTheDocument();
    expect(screen.queryByText('Recused Three')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show all 7' }));

    expect(screen.getByText('Recused Two')).toBeInTheDocument();
    expect(screen.getByText('Recused Three')).toBeInTheDocument();
    expect(screen.queryByText('Showing 5 of 7')).not.toBeInTheDocument();
  });

  // DEC-874 wave-72 amendment (c): the footer ROW is the queue's own row and
  // renders whenever the queue has rows -- the reassurance note is the
  // footer's permanent content; only the count/Show-all group inside it
  // stays conditional on >5 rows.
  it('renders the footer note but not the count/Show-all group when the combined count is 5 or fewer', async () => {
    mockApi({
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: {
        ...queueEnvelope([queueItem()]),
        open: true,
        recused: [],
      },
    });

    renderQueue();

    expect(await screen.findByText('A Talk')).toBeInTheDocument();
    expect(screen.getByText('Your scores stay hidden from other reviewers')).toBeInTheDocument();
    expect(screen.queryByText(/^Showing/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Show all/ })).not.toBeInTheDocument();
  });

  it('renders the reassurance note right-aligned alongside the count/Show-all group when the queue is over 5 rows', async () => {
    const items = Array.from({ length: 6 }, (_, i) => queueItem({ submissionId: `sub-${i}`, ref: `S-00${i}`, title: `Talk ${i}` }));
    mockApi({
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: {
        ...queueEnvelope(items),
        open: true,
        recused: [],
      },
    });

    renderQueue();

    expect(await screen.findByText('Showing 5 of 6')).toBeInTheDocument();
    expect(screen.getByText('Your scores stay hidden from other reviewers')).toBeInTheDocument();
  });

  // DEC-874 wave-72 amendment (a): REF + STATE are one left-aligned eyebrow
  // pair, not spread across the row.
  it('the row-top eyebrow group is left-aligned with no space-between spread', () => {
    const css = readFileSync(join(HERE, 'review.css'), 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');
    const rules = css.match(/\.chq-review-queue-row-top\s*\{([^{}]*)\}/);
    expect(rules).not.toBeNull();
    expect(rules![1]).not.toMatch(/justify-content:\s*space-between/);
    expect(rules![1]).toMatch(/gap:\s*8px/);
  });

  it('a recused row keeps its meta line, exactly like an actionable row', async () => {
    mockApi({
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: {
        ...queueEnvelope([]),
        open: true,
        recused: [
          {
            submissionId: 'sub-r1',
            ref: 'S-020',
            title: 'Conflicted Talk',
            reason: 'Personal conflict',
            format: 'Talk (30 min)',
            audienceLevel: 'Advanced',
          },
        ],
      },
    });

    renderQueue();

    expect(await screen.findByText('Conflicted Talk')).toBeInTheDocument();
    expect(screen.getByText('Talk, 30 min · advanced')).toBeInTheDocument();
  });

  // gate-4 03-review still-present finding: an actionable row's meta line
  // must read "Talk, 30 min · advanced" -- format joined with the queue
  // item's own audienceLevel, through the ONE session-vocabulary module
  // (session-vocabulary.ts) the meta line routes BOTH clauses through --
  // the seed stores audienceLevel Title-Case ('Advanced'); only the display
  // reshaping lowercases it.
  it('an actionable row meta line joins format and audienceLevel through the same vocabulary', async () => {
    mockApi({
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: {
        ...queueEnvelope([queueItem({ format: 'Talk (30 min)', audienceLevel: 'Advanced' })]),
        open: true,
        recused: [],
      },
    });

    renderQueue();

    expect(await screen.findByText('A Talk')).toBeInTheDocument();
    expect(screen.getByText('Talk, 30 min · advanced')).toBeInTheDocument();
  });
});

describe('ReviewerQueue progress caption (gate-4 03-review still-present finding)', () => {
  it('places the "N of M done" caption in the same flex row as the bar (right of it, not stacked below)', async () => {
    mockApi({
      [`GET /api/v1/review/plans/${PLAN_ID}`]: { timezone: 'America/New_York' },
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: {
        ...queueEnvelope([
          queueItem({ submissionId: 'sub-1', alreadyRatedByMe: true, myScore: 3 }),
          queueItem({ submissionId: 'sub-2', ref: 'S-002', title: 'Talk Two', alreadyRatedByMe: false }),
        ]),
        open: true,
        recused: [],
        planName: 'Frame Plan',
        scopeTrackName: null,
        closeDate: null,
      },
    });

    renderQueue();

    const caption = await screen.findByText('1 of 2 done');
    const bar = caption.parentElement!.querySelector('.chq-review-scoped-progress');
    expect(bar).not.toBeNull();
    expect(caption.parentElement).toHaveClass('chq-review-scoped-progress-row');
    expect(bar!.parentElement).toBe(caption.parentElement);
  });

  it('the progress row is a flex container, and the caption never wraps', () => {
    const css = readFileSync(join(HERE, 'review.css'), 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');
    const rowRules = css.match(/\.chq-review-scoped-progress-row\s*\{([^{}]*)\}/);
    expect(rowRules).not.toBeNull();
    expect(rowRules![1]).toMatch(/display:\s*flex/);
    const captionRules = css.match(/\.chq-review-scoped-progress-caption\s*\{([^{}]*)\}/);
    expect(captionRules).not.toBeNull();
    expect(captionRules![1]).toMatch(/white-space:\s*nowrap/);
  });
});

// DEC-874 (findings wave 5 amendment): the reviewer plans hub -- H1 sums
// unscoredTotal across OPEN plans, subline spells the open-plan count, and
// every row renders the frame's five elements (name + state pill, meta
// line, progress bar, one action) off a hub-owned envelope map.
describe('ReviewerQueue hub row (DEC-874 findings wave 5 amendment)', () => {
  function renderHub() {
    return render(
      <MemoryRouter initialEntries={['/review']}>
        <Routes>
          <Route path="/review" element={<ReviewerQueue />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  const openPlan = { id: 'plan-open', eventId: 'evt-1', name: 'Open Plan', timezone: 'America/New_York' };
  const closedPlan = { id: 'plan-closed', eventId: 'evt-1', name: 'Closed Plan', timezone: 'America/New_York' };
  const openPlan2 = { id: 'plan-open-2', eventId: 'evt-1', name: 'Second Open Plan', timezone: 'America/New_York' };

  it('H1 sums unscoredTotal across open plans only, with a spelled-count subline, and every row renders its five elements', async () => {
    mockApi({
      'GET /api/v1/review/plans': listEnvelope([openPlan, closedPlan, openPlan2]),
      'GET /api/v1/review/plans/plan-open/queue': {
        ...queueEnvelope([queueItem({ submissionId: 'open-1', alreadyRatedByMe: false })], { total: 6, unscoredTotal: 5 }),
        open: true,
        recused: [],
        planName: 'Open Plan',
        scopeTrackName: null,
        closeDate: Date.now() + 19 * 24 * 60 * 60 * 1000,
      },
      'GET /api/v1/review/plans/plan-closed/queue': {
        ...queueEnvelope([queueItem({ submissionId: 'closed-1', alreadyRatedByMe: true, myScore: 4 })], { total: 3, unscoredTotal: 0 }),
        open: false,
        recused: [],
        planName: 'Closed Plan',
        scopeTrackName: null,
        closeDate: Date.now() - 10 * 24 * 60 * 60 * 1000,
      },
      'GET /api/v1/review/plans/plan-open-2/queue': {
        ...queueEnvelope([], { total: 4, unscoredTotal: 4 }),
        open: true,
        recused: [],
        planName: 'Second Open Plan',
        scopeTrackName: null,
        closeDate: null,
      },
    });

    renderHub();

    // 5 (Open Plan) + 4 (Second Open Plan) = 9; Closed Plan is excluded
    // from the sum entirely because it isn't open.
    expect(await screen.findByRole('heading', { name: '9 left to score' })).toBeInTheDocument();
    expect(screen.getByText('Across two open plans')).toBeInTheDocument();

    // DEC-874 wave-19 amendment: the hub's own column-header row, above the
    // list, sharing the row's own grid.
    const headRow = document.querySelector('.chq-reviewer-plan-head-row')!;
    expect(headRow.textContent).toContain('Plan');
    expect(headRow.textContent).toContain('State');
    expect(headRow.textContent).toContain('Your progress');

    // Open Plan row: name, Open pill, meta (assigned/left/closes), bar,
    // "Score the next one" action (5 of 6 left -> some already scored) --
    // a right-flushed tertiary link, not a filled .chq-btn.
    const openRow = screen.getByText('Open Plan').closest('li')!;
    expect(openRow.textContent).toContain('Open');
    expect(openRow.textContent).toMatch(/6 assigned · 5 left · closes in \d+ days?/);
    expect(openRow.querySelector('.chq-bar-fill')).not.toBeNull();
    const openAction = openRow.querySelector('.chq-reviewer-plan-row-action') as HTMLAnchorElement;
    expect(openAction.textContent).toBe('Score the next one');
    expect(openAction).not.toHaveClass('chq-btn');

    // Closed Plan row: Closed pill, meta drops the "left" clause, action
    // reads "Read your scores" as the secondary face.
    const closedRow = screen.getByText('Closed Plan').closest('li')!;
    expect(closedRow.textContent).toContain('Closed');
    expect(closedRow.textContent).toContain('3 assigned');
    expect(closedRow.textContent).not.toMatch(/\bleft\b/);
    const closedAction = closedRow.querySelector('.chq-reviewer-plan-row-action') as HTMLAnchorElement;
    expect(closedAction.textContent).toBe('Read your scores');
    expect(closedAction).not.toHaveClass('chq-btn');

    // Second Open Plan row: nothing scored yet (0 of 4) -> "Start scoring".
    const openRow2 = screen.getByText('Second Open Plan').closest('li')!;
    const openAction2 = openRow2.querySelector('.chq-reviewer-plan-row-action') as HTMLAnchorElement;
    expect(openAction2.textContent).toBe('Start scoring');

    // Closing muted line -- both sentences from frame :775.
    expect(
      screen.getByText(
        'With one open plan this page is skipped — you land straight in its queue. Scores stay hidden from other reviewers.',
      ),
    ).toBeInTheDocument();
  });

  it('a row whose per-plan envelope fetch rejects still renders its name and still links into its queue', async () => {
    mockApi({
      'GET /api/v1/review/plans': listEnvelope([openPlan, closedPlan]),
      'GET /api/v1/review/plans/plan-open/queue': {
        ...queueEnvelope([], { total: 2, unscoredTotal: 1 }),
        open: true,
        recused: [],
        planName: 'Open Plan',
        scopeTrackName: null,
        closeDate: null,
      },
      'GET /api/v1/review/plans/plan-closed/queue': { status: 500, body: { error: { code: 'internal', message: 'boom' } } },
    });

    renderHub();

    expect(await screen.findByText('Closed Plan')).toBeInTheDocument();
    const closedRow = screen.getByText('Closed Plan').closest('li')!;
    expect(closedRow.querySelector('a[href="/review/plans/plan-closed"]')).not.toBeNull();
    // Still exactly one action control, even with no envelope to read.
    expect(closedRow.querySelectorAll('.chq-reviewer-plan-row-action').length).toBe(1);
    // Still exposes its name/pill/bar/action columns even though the
    // envelope for this row rejected.
    expect(closedRow.querySelector('.chq-reviewer-plan-row-name')).not.toBeNull();
    expect(closedRow.querySelector('.chq-reviewer-plan-row-pill')).not.toBeNull();
    expect(closedRow.querySelector('.chq-bar-fill')).not.toBeNull();
  });
});

describe('"Score the next one" plan-scoped title-row shortcut (REVIEW PACK frame 03-03)', () => {
  it('renders, right-aligned on the h1 row, linking to the first not-yet-scored submission, when one exists', async () => {
    mockApi({
      [`GET /api/v1/review/plans/${PLAN_ID}`]: { timezone: 'America/New_York' },
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: {
        ...queueEnvelope([
          queueItem({ submissionId: 'sub-1', alreadyRatedByMe: true, myScore: 3 }),
          queueItem({ submissionId: 'sub-2', ref: 'S-002', title: 'Talk Two', alreadyRatedByMe: false }),
        ]),
        open: true,
        recused: [],
        planName: 'Frame Plan',
        scopeTrackName: null,
        closeDate: null,
      },
    });

    renderQueue();

    const shortcut = await screen.findByRole('link', { name: 'Score the next one' });
    expect(shortcut).toHaveAttribute('href', `/review/plans/${PLAN_ID}/submissions/sub-2`);
  });

  it('is absent once every item in the queue is already scored', async () => {
    mockApi({
      [`GET /api/v1/review/plans/${PLAN_ID}`]: { timezone: 'America/New_York' },
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: {
        ...queueEnvelope([queueItem({ alreadyRatedByMe: true, myScore: 5 })]),
        open: true,
        recused: [],
        planName: 'Frame Plan',
        scopeTrackName: null,
        closeDate: null,
      },
    });

    renderQueue();

    expect(await screen.findByRole('heading', { name: 'Nothing left in your queue. Nicely done.' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Score the next one' })).not.toBeInTheDocument();
  });

  // w52-d (DEC-678 amendment): a genuinely empty queue (no actionable items
  // AND no recused rows) renders the section's own "nothing left" line
  // through the shared EmptyState 'fresh' block, never a bare `.chq-empty`
  // line -- distinct from the congratulatory title-row h1 above, which
  // fires even when the queue is empty only because everything already
  // scored.
  it('renders the shared EmptyState fresh block when the queue and recusals are both empty', async () => {
    mockApi({
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: {
        ...queueEnvelope([]),
        open: true,
        recused: [],
      },
    });

    renderQueue();

    // Both the title-row h1 (scoreLeft === 0) and the section's own
    // EmptyState body share this exact sentence -- assert the block
    // directly rather than by text, which would be ambiguous here.
    await waitFor(() => {
      expect(document.querySelector('.chq-empty-block-fresh')).toBeInTheDocument();
    });
    expect(document.querySelector('.chq-empty-block-fresh .chq-empty-what')).toHaveTextContent(
      'Nothing left in your queue. Nicely done.',
    );
    expect(document.querySelector('.chq-empty-actions')).not.toBeInTheDocument();
  });
});

// DEC-346 (wave-74 amendment): the cap filter can empty or shorten a queue
// without anything being wrong -- `cappedOut` names how many of this
// reviewer's own scoped submissions were dropped for already having a full
// set of reviews, so the empty/short states say why instead of reading like
// a broken assignment.
describe('ReviewerQueue cappedOut messaging (DEC-346 wave-74 amendment)', () => {
  it('renders the cap-explaining empty state, not the generic "nothing left", when items and recused are both empty but cappedOut > 0', async () => {
    mockApi({
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: {
        ...queueEnvelope([]),
        open: true,
        recused: [],
        cappedOut: 3,
      },
    });

    renderQueue();

    expect(await screen.findByText('3 talks still in your scope already have a full set of reviews.')).toBeInTheDocument();
    // The EmptyState body (this section's own "why is this empty" copy)
    // must not fall back to the generic congratulatory sentence -- the
    // title-row h1 above the section is a separate element with its own
    // scoreLeft-driven copy and is out of this test's scope.
    expect(document.querySelector('.chq-empty-what')).toHaveTextContent(
      '3 talks still in your scope already have a full set of reviews.',
    );
  });

  it('renders the singular form for cappedOut === 1', async () => {
    mockApi({
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: {
        ...queueEnvelope([]),
        open: true,
        recused: [],
        cappedOut: 1,
      },
    });

    renderQueue();

    expect(await screen.findByText('1 talk still in your scope already has a full set of reviews.')).toBeInTheDocument();
  });

  it('renders a quiet cappedOut line beside the footer count when the queue is non-empty', async () => {
    mockApi({
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: {
        ...queueEnvelope([queueItem()]),
        open: true,
        recused: [],
        cappedOut: 2,
      },
    });

    renderQueue();

    expect(await screen.findByText('A Talk')).toBeInTheDocument();
    expect(screen.getByText('2 talks in your scope already have a full set of reviews')).toBeInTheDocument();
  });

  it('renders neither cap line when cappedOut is 0', async () => {
    mockApi({
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: {
        ...queueEnvelope([queueItem()]),
        open: true,
        recused: [],
        cappedOut: 0,
      },
    });

    renderQueue();

    expect(await screen.findByText('A Talk')).toBeInTheDocument();
    expect(screen.queryByText(/already (has|have) a full set of reviews/)).not.toBeInTheDocument();
  });
});

// DEC-845 amendment (wave 38): a reviewer scope of 250 actionable
// submissions -- the h1 must read the TRUE 250 (not the 200-row page 1
// clamp), and "Show all 250" must page past row 200 to actually render
// every row.
describe('ReviewerQueue past MAX_PER_PAGE=200 rows (DEC-845 amendment, wave 38)', () => {
  it('renders "250 left to score" and "Show all 250", and clicking it pages to row 250', async () => {
    const page1Items = Array.from({ length: 200 }, (_, i) =>
      queueItem({ submissionId: `sub-${i}`, ref: `S-${i}`, title: `Talk ${i}` }),
    );
    const page2Items = Array.from({ length: 50 }, (_, i) =>
      queueItem({ submissionId: `sub-${200 + i}`, ref: `S-${200 + i}`, title: `Talk ${200 + i}` }),
    );

    let queueCalls = 0;
    const fetchMock = mockApi({
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: () => {
        queueCalls += 1;
        const items = queueCalls === 1 ? page1Items : page2Items;
        return {
          items,
          total: 250,
          unscoredTotal: 250,
          page: queueCalls === 1 ? 1 : 2,
          perPage: 200,
          open: true,
          recused: [],
          planName: 'Big Plan',
          scopeTrackName: null,
          closeDate: null,
        };
      },
    });

    renderQueue();

    expect(await screen.findByRole('heading', { name: '250 left to score' })).toBeInTheDocument();
    const showAllButton = await screen.findByRole('button', { name: 'Show all 250' });

    fireEvent.click(showAllButton);

    await waitFor(() => {
      const page2Call = fetchMock.mock.calls.find(([input]) => {
        const url = typeof input === 'string' ? input : (input as URL).toString();
        return url.includes('/queue') && url.includes('page=2');
      });
      expect(page2Call).toBeDefined();
    });

    await waitFor(() => {
      expect(screen.getAllByText(/^S-\d+$/).length).toBe(250);
    });
    expect(screen.getByText('Talk 0')).toBeInTheDocument();
    expect(screen.getByText('Talk 249')).toBeInTheDocument();
    expect(screen.queryByText(/^Showing 5 of/)).not.toBeInTheDocument();
  });
});
