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
        ...listEnvelope([queueItem({ alreadyRatedByMe: true, myScore: 4.5 })]),
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
        ...listEnvelope([queueItem({ alreadyRatedByMe: false })]),
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
        ...listEnvelope([]),
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

  it('shows "Showing 5 of N" / "Show all N" once the combined items+recused count exceeds 5, and reveals the rest on click', async () => {
    const items = Array.from({ length: 4 }, (_, i) => queueItem({ submissionId: `sub-${i}`, ref: `S-00${i}`, title: `Talk ${i}` }));
    const recused = [
      { submissionId: 'sub-r1', ref: 'S-r1', title: 'Recused One', reason: 'conflict' },
      { submissionId: 'sub-r2', ref: 'S-r2', title: 'Recused Two', reason: 'conflict' },
      { submissionId: 'sub-r3', ref: 'S-r3', title: 'Recused Three', reason: 'conflict' },
    ];
    mockApi({
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: {
        ...listEnvelope(items),
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
        ...listEnvelope([queueItem()]),
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
        ...listEnvelope(items),
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
        ...listEnvelope([]),
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
        ...listEnvelope([queueItem({ format: 'Talk (30 min)', audienceLevel: 'Advanced' })]),
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
        ...listEnvelope([
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

describe('"Score the next one" plan-scoped title-row shortcut (REVIEW PACK frame 03-03)', () => {
  it('renders, right-aligned on the h1 row, linking to the first not-yet-scored submission, when one exists', async () => {
    mockApi({
      [`GET /api/v1/review/plans/${PLAN_ID}`]: { timezone: 'America/New_York' },
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: {
        ...listEnvelope([
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
        ...listEnvelope([queueItem({ alreadyRatedByMe: true, myScore: 5 })]),
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
});
