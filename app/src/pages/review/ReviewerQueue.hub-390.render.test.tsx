// task w15-td (DEC-874 wave-159 amendment): REVIEW receipt for the plan
// hub's 390 card anatomy plus the fix for the queue's dead back link.
// Entered through the REAL route (Review.tsx's <ReviewPage/>), never a
// sub-component mounted directly, per
// app/src/pages/Review.frame-verdicts.render.test.tsx's own harness shape.
// jsdom applies no stylesheet, so the hub-anatomy assertions below read
// review.css's SOURCE TEXT directly (the terminal max-width:700px block) --
// they are not a computed-geometry check.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ReviewerQueue } from './ReviewerQueue';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Review.dc.html');
const CSS_FILE = join(HERE, 'review.css');

/** DEC-967 shape: read the ACTUAL line, assert it byte-for-byte matches the
 * literal this file claims. Copied from
 * Settings.frame-verdicts.render.test.tsx's own `verbatimLine`. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

function reviewerMe() {
  return { userId: 'u-reviewer', email: 'reviewer@example.com', role: 'reviewer', orgId: 'org-1' };
}

function queueEnvelope<T extends { alreadyRatedByMe?: boolean }>(
  items: T[],
  overrides: { total?: number; unscoredTotal?: number } = {},
) {
  return {
    ...listEnvelope(items),
    total: overrides.total ?? items.length,
    unscoredTotal: overrides.unscoredTotal ?? items.filter((i) => !i.alreadyRatedByMe).length,
  };
}

function renderReview(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/review" element={<ReviewerQueue />} />
        <Route path="/review/plans/:planId" element={<ReviewerQueue />} />
      </Routes>
    </MemoryRouter>,
  );
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  expect(consoleErrorSpy).not.toHaveBeenCalled();
  consoleErrorSpy.mockRestore();
  cleanup();
});

describe('v12 Review hub 390 card anatomy + dead back link (task w15-td, DEC-874 wave-159)', () => {
  // Frame :793-816 "Your plans · /review" (the 390 hub row anatomy).
  it('frame :805-814 -- the 390 row grid places name+pill on row 1, meta spanning row 2, then bar, then action', () => {
    verbatimLine(
      805,
      '          <div style="padding:16px 0; border-bottom:1px solid #E1DDCE; display:flex; flex-direction:column; gap:8px">',
    );
    verbatimLine(
      806,
      '            <div style="display:flex; align-items:baseline; justify-content:space-between; gap:10px">',
    );
    verbatimLine(
      810,
      '            <span style="font-size:13px; color:#565A4B; line-height:1.5">{{ p.meta }}</span>',
    );

    const css = readFileSync(CSS_FILE, 'utf-8');
    const terminalBlockStart = css.indexOf('@media (max-width: 700px)');
    expect(terminalBlockStart).toBeGreaterThan(-1);
    const narrowCss = css.slice(terminalBlockStart);

    // .chq-reviewer-plan-row becomes a two-column grid with named areas:
    // name+pill share row 1, meta spans row 2 alone, then bar, then action
    // -- and .chq-reviewer-plan-row-name-line is unwrapped via
    // display:contents so its two children (name, meta) become direct grid
    // items without forking ReviewerQueue.tsx's markup (the desktop
    // four-column grid depends on this exact child order, byte-identical).
    const rowRule = narrowCss.match(/\.chq-reviewer-plan-row\s*\{([^}]*)\}/);
    expect(rowRule).not.toBeNull();
    expect(rowRule![1]).toMatch(/display:\s*grid/);
    expect(rowRule![1]).toMatch(/grid-template-columns:\s*1fr auto/);
    expect(rowRule![1]).toMatch(
      /grid-template-areas:\s*\n?\s*'name pill'\s*\n?\s*'meta meta'\s*\n?\s*'bar bar'\s*\n?\s*'action action'/,
    );

    const nameLineRule = narrowCss.match(/\.chq-reviewer-plan-row-name-line\s*\{([^}]*)\}/);
    expect(nameLineRule).not.toBeNull();
    expect(nameLineRule![1]).toMatch(/display:\s*contents/);

    expect(narrowCss).toMatch(/\.chq-reviewer-plan-row-name\s*\{[^}]*grid-area:\s*name/);
    expect(narrowCss).toMatch(
      /\.chq-reviewer-plan-row-name-line \.chq-review-plan-meta\s*\{[^}]*grid-area:\s*meta/,
    );
    expect(narrowCss).toMatch(/\.chq-reviewer-plan-row-pill\s*\{[^}]*grid-area:\s*pill/);
    expect(narrowCss).toMatch(/\.chq-reviewer-plan-row-bar\s*\{[^}]*grid-area:\s*bar/);
    expect(narrowCss).toMatch(/\.chq-reviewer-plan-row-action\s*\{[^}]*grid-area:\s*action/);

    // No markup fork: the desktop rule (BEFORE the terminal block) keeps
    // the original four-column template untouched -- DEC-385, narrow
    // overrides wide via max-width only.
    const desktopCss = css.slice(0, terminalBlockStart);
    const desktopRowRule = desktopCss.match(/\.chq-reviewer-plan-row\s*\{([^}]*)\}/);
    expect(desktopRowRule).not.toBeNull();
    expect(desktopRowRule![1]).toMatch(/grid-template-columns:\s*1fr 150px 190px 180px/);
    expect(desktopRowRule![1]).not.toMatch(/grid-template-areas/);
  });

  it('at 390: rendered hub row keeps the SAME DOM order as desktop (name-line, pill, bar, action) -- CSS-only re-layout, no markup fork', async () => {
    const PLAN_A = 'plan-a-hub390';
    const PLAN_B = 'plan-b-hub390';

    mockApi({
      'GET /api/v1/me': reviewerMe(),
      'GET /api/v1/review/plans': listEnvelope([
        { id: PLAN_A, eventId: 'evt-1', name: 'Wave 2', timezone: 'UTC' },
        { id: PLAN_B, eventId: 'evt-1', name: 'Wave 3', timezone: 'UTC' },
      ]),
      [`GET /api/v1/review/plans/${PLAN_A}/queue`]: {
        ...queueEnvelope([{ submissionId: 'a-1', alreadyRatedByMe: false }], { total: 10, unscoredTotal: 9 }),
        open: true,
        recused: [],
        planName: 'Wave 2',
        scopeTrackName: null,
        closeDate: null,
      },
      [`GET /api/v1/review/plans/${PLAN_B}/queue`]: {
        ...queueEnvelope([{ submissionId: 'b-1', alreadyRatedByMe: false }], { total: 8, unscoredTotal: 8 }),
        open: true,
        recused: [],
        planName: 'Wave 3',
        scopeTrackName: null,
        closeDate: null,
      },
    });

    renderReview('/review');

    const h1 = await screen.findByRole('heading', { name: /left to score/ });
    expect(h1).toBeInTheDocument();

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    const row = rows[0]!;
    const nameLine = row.querySelector('.chq-reviewer-plan-row-name-line') as HTMLElement;
    const pill = row.querySelector('.chq-reviewer-plan-row-pill') as HTMLElement;
    const bar = row.querySelector('.chq-reviewer-plan-row-bar') as HTMLElement;
    const action = row.querySelector('.chq-reviewer-plan-row-action') as HTMLElement;
    expect(nameLine).not.toBeNull();
    expect(pill).not.toBeNull();
    expect(bar).not.toBeNull();
    expect(action).not.toBeNull();
    expect(within(nameLine).getByText('Wave 2')).toBeInTheDocument();
    expect(pill.textContent).toBe('Open');
    // Same source-order children as the desktop-frozen markup: name-line,
    // then pill, then bar, then action.
    expect(nameLine.compareDocumentPosition(pill) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(pill.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(bar.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  // Frame :413-445 "Reviewer queue · /review/plans/:id" -- the frame draws
  // NO back control in this subscreen's head band at all.
  it('two plans in the hub, then drilling into one via its row link: the queue keeps its "‹ Your plans" back link', async () => {
    const PLAN_A = 'plan-a-backlink';
    const PLAN_B = 'plan-b-backlink';

    mockApi({
      'GET /api/v1/me': reviewerMe(),
      'GET /api/v1/review/plans': listEnvelope([
        { id: PLAN_A, eventId: 'evt-1', name: 'Wave A', timezone: 'UTC' },
        { id: PLAN_B, eventId: 'evt-1', name: 'Wave B', timezone: 'UTC' },
      ]),
      [`GET /api/v1/review/plans/${PLAN_A}/queue`]: {
        ...queueEnvelope([{ submissionId: 'a-1', alreadyRatedByMe: false }], { total: 5, unscoredTotal: 3 }),
        open: true,
        recused: [],
        planName: 'Wave A',
        scopeTrackName: null,
        closeDate: null,
      },
      [`GET /api/v1/review/plans/${PLAN_B}/queue`]: {
        ...queueEnvelope([{ submissionId: 'b-1', alreadyRatedByMe: false }], { total: 5, unscoredTotal: 3 }),
        open: true,
        recused: [],
        planName: 'Wave B',
        scopeTrackName: null,
        closeDate: null,
      },
      [`GET /api/v1/review/plans/${PLAN_A}`]: { timezone: 'UTC' },
    });

    renderReview('/review');

    await screen.findByText('Wave A');
    const links = screen.getAllByRole('link', { name: /Score the next one|Start scoring/ });
    const link = links.find((l) => l.getAttribute('href') === `/review/plans/${PLAN_A}`)!;
    expect(link).toBeTruthy();
    fireEvent.click(link);

    await screen.findByText('REVIEW · Wave A');
    // With `plans` (2 entries) already held by this same component instance
    // (no remount across this Link navigation, no second fetch), the back
    // link renders -- there IS a hub to go back to.
    const backLink = screen.getByRole('link', { name: /Your plans/ });
    expect(backLink).toBeInTheDocument();
    expect(backLink).toHaveClass('chq-review-back', 'chq-phone-back');
  });

  it('landed here directly (a bookmark / refresh, no hub visit this session): the queue renders no back link, matching the frame', async () => {
    verbatimLine(
      413,
      '    <div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)">',
    );

    const PLAN_ID = 'plan-solo-backlink';

    mockApi({
      'GET /api/v1/me': reviewerMe(),
      [`GET /api/v1/review/plans/${PLAN_ID}`]: { timezone: 'UTC' },
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: {
        ...queueEnvelope([{ submissionId: 'sub-1', alreadyRatedByMe: false }], { total: 4, unscoredTotal: 2 }),
        open: true,
        recused: [],
        planName: 'Solo Plan',
        scopeTrackName: null,
        closeDate: null,
      },
    });

    renderReview(`/review/plans/${PLAN_ID}`);

    await screen.findByText('REVIEW · Solo Plan');
    // DEC-874: with exactly one plan the hub is skipped and a reviewer
    // landing directly on this URL (single-plan auto-redirect, or a
    // bookmark/refresh) never populated `plans` -- there is nothing to go
    // back to, and the frame itself draws no back control here either.
    expect(screen.queryByRole('link', { name: /Your plans/ })).not.toBeInTheDocument();
  });
});
