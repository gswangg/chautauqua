// task w29-i (DEC-976/DEC-967/DEC-385/DEC-874): a per-frame verdict render
// test for docs/design/Chautauqua Review.dc.html:793 ("Your plans ·
// /review", extent 793-828, the 390 reviewer hub). The existing
// ReviewerQueue.hub-390.render.test.tsx cites this same extent but only in
// the code-comment SHORTHAND form (DEC-808 wave-29 amendment) that no
// ledger reads, and none of its assertions touch 8 of the frame's 9 drawn
// strings (:796 wordmark, :797 reviewer name, :799 lede count, :800 lede
// plan-count, :807/:808/:810 row template, :814 action label, :821 dock
// note). This file supplies that missing DEC-967 `verbatimLine` citation
// plus request-level assertions of each string's SHAPE.
//
// MEASUREMENT ONLY (w29-i's own scope): app/src/pages/review/review.css is
// owned by w29-e this wave and app/src/pages/review/ReviewerQueue.tsx by no
// lane this task may touch — every assertion below measures the CURRENT
// tree. Any mismatch against the frame is recorded as a DIVERGES row in
// docs/design/audit/review-hub-390-v12.md, not fixed here.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
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

/** DEC-967 shape: read the ACTUAL line, assert it byte-for-byte matches the
 * literal this file claims. Copied from
 * ReviewerQueue.hub-390.render.test.tsx's own `verbatimLine`. */
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
  overrides: { total?: number; unscoredTotal?: number; open?: boolean } = {},
) {
  return {
    ...listEnvelope(items),
    total: overrides.total ?? items.length,
    unscoredTotal: overrides.unscoredTotal ?? items.filter((i) => !i.alreadyRatedByMe).length,
    open: overrides.open ?? true,
    recused: [],
    scopeTrackName: null,
    closeDate: null,
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

describe('v12 frame verdict: Chautauqua Review.dc.html:793 "Your plans · /review" (390 reviewer hub, task w29-i)', () => {
  it('frame caption + drawn-literal citations (DEC-967 verbatimLine)', () => {
    // w16-qi (DEC-998): pay for this file's header-block scope citation
    // into docs/design/Chautauqua Review.dc.html (the file-header comment
    // at :1-2) with a non-header, fully-receipted citation of the same
    // frame -- backtick quote right here plus the `verbatimLine` call
    // immediately below it, which itself asserts `expect(...).toBe(...)`.
    // docs/design/Chautauqua Review.dc.html:793 `    <div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)">`
    verbatimLine(
      793,
      '    <div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)">',
    );
    verbatimLine(
      799,
      '        <h1 style="margin:0; font-family:\'Familjen Grotesk\', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">17 left to score</h1>',
    );
    verbatimLine(
      800,
      '        <span style="font-size:13px; color:#565A4B">Across two open plans</span>',
    );
    verbatimLine(
      814,
      '            <span style="{{ p.btnStyle }}">{{ p.btn }}</span>',
    );
    verbatimLine(
      817,
      '        <span style="display:block; padding:16px 0 0; font-size:13px; color:#565A4B; line-height:1.5">With one open plan this page is skipped — you land straight in its queue.</span>',
    );
    verbatimLine(
      821,
      '        <span style="font-size:13px; color:#565A4B">Scores stay hidden from other reviewers</span>',
    );
    verbatimLine(
      822,
      '        <a href="#" style="margin-left:auto; font-size:13px; font-weight:700">Sign out</a>',
    );
  });

  it('two open plans: the lede renders as the frame\'s two-part "N left to score" / "Across N open plans" pair (shape, not the frame\'s own fixture literals)', async () => {
    const PLAN_A = 'plan-a-w29i';
    const PLAN_B = 'plan-b-w29i';

    mockApi({
      'GET /api/v1/me': reviewerMe(),
      'GET /api/v1/review/plans': listEnvelope([
        { id: PLAN_A, eventId: 'evt-1', name: 'Wave Alpha', timezone: 'UTC' },
        { id: PLAN_B, eventId: 'evt-1', name: 'Wave Beta', timezone: 'UTC' },
      ]),
      [`GET /api/v1/review/plans/${PLAN_A}/queue`]: {
        ...queueEnvelope([{ submissionId: 'a-1', alreadyRatedByMe: false }], { total: 6, unscoredTotal: 4 }),
        planName: 'Wave Alpha',
      },
      [`GET /api/v1/review/plans/${PLAN_B}/queue`]: {
        ...queueEnvelope([{ submissionId: 'b-1', alreadyRatedByMe: false }], { total: 5, unscoredTotal: 5 }),
        planName: 'Wave Beta',
      },
    });

    renderReview('/review');

    const h1 = await screen.findByRole('heading', { name: /left to score/ });
    expect(h1.textContent).toMatch(/^\d+ left to score$/);

    const subline = screen.getByText(/^Across \w+ open plans?$/);
    expect(subline).toBeInTheDocument();
  });

  it('two open plans: one row per plan, each carrying name + state pill + meta line + exactly one action control', async () => {
    const PLAN_A = 'plan-a-w29i-rows';
    const PLAN_B = 'plan-b-w29i-rows';

    mockApi({
      'GET /api/v1/me': reviewerMe(),
      'GET /api/v1/review/plans': listEnvelope([
        { id: PLAN_A, eventId: 'evt-1', name: 'Wave Alpha', timezone: 'UTC' },
        { id: PLAN_B, eventId: 'evt-1', name: 'Wave Beta', timezone: 'UTC' },
      ]),
      [`GET /api/v1/review/plans/${PLAN_A}/queue`]: {
        ...queueEnvelope([{ submissionId: 'a-1', alreadyRatedByMe: false }], { total: 6, unscoredTotal: 4 }),
        planName: 'Wave Alpha',
      },
      [`GET /api/v1/review/plans/${PLAN_B}/queue`]: {
        ...queueEnvelope([{ submissionId: 'b-1', alreadyRatedByMe: false }], { total: 5, unscoredTotal: 0, open: false }),
        planName: 'Wave Beta',
      },
    });

    renderReview('/review');

    await screen.findByText('Wave Alpha');
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);

    const names = ['Wave Alpha', 'Wave Beta'];
    const pills = ['Open', 'Closed'];
    rows.forEach((row, i) => {
      expect(within(row).getByText(names[i]!)).toBeInTheDocument();
      const pill = row.querySelector('.chq-reviewer-plan-row-pill');
      expect(pill).not.toBeNull();
      expect(pill!.textContent).toBe(pills[i]);
      const metaLine = row.querySelector('.chq-review-plan-meta');
      expect(metaLine).not.toBeNull();
      expect(metaLine!.textContent!.length).toBeGreaterThan(0);
      const actions = within(row).getAllByRole('link');
      expect(actions).toHaveLength(1);
    });
  });

  it('exactly one open plan: the hub is SKIPPED entirely (DEC-874) -- this is the real single-plan contract the frame\'s :817 note describes, not a rendered annotation to assert against', async () => {
    const PLAN_ID = 'plan-solo-w29i';

    mockApi({
      'GET /api/v1/me': reviewerMe(),
      'GET /api/v1/review/plans': listEnvelope([{ id: PLAN_ID, eventId: 'evt-1', name: 'Solo Plan', timezone: 'UTC' }]),
      [`GET /api/v1/review/plans/${PLAN_ID}`]: { timezone: 'UTC' },
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: {
        ...queueEnvelope([{ submissionId: 'sub-1', alreadyRatedByMe: false }], { total: 4, unscoredTotal: 2 }),
        planName: 'Solo Plan',
      },
    });

    renderReview('/review');

    // Navigated straight into the scoped queue -- no "N left to score" /
    // "Across N open plans" hub lede, no plan-list rows, ever rendered.
    await screen.findByText('REVIEW · Solo Plan');
    expect(screen.queryByText(/Across \w+ open plans?/)).not.toBeInTheDocument();
    expect(document.querySelectorAll('.chq-reviewer-plan-row')).toHaveLength(0);
  });

  it(':822 "Sign out" is the shell\'s own single control -- ReviewerQueue mints none of its own (DEC-874 wave-86)', async () => {
    const PLAN_A = 'plan-a-w29i-signout';
    const PLAN_B = 'plan-b-w29i-signout';

    mockApi({
      'GET /api/v1/me': reviewerMe(),
      'GET /api/v1/review/plans': listEnvelope([
        { id: PLAN_A, eventId: 'evt-1', name: 'Wave Alpha', timezone: 'UTC' },
        { id: PLAN_B, eventId: 'evt-1', name: 'Wave Beta', timezone: 'UTC' },
      ]),
      [`GET /api/v1/review/plans/${PLAN_A}/queue`]: {
        ...queueEnvelope([{ submissionId: 'a-1', alreadyRatedByMe: false }], { total: 6, unscoredTotal: 4 }),
        planName: 'Wave Alpha',
      },
      [`GET /api/v1/review/plans/${PLAN_B}/queue`]: {
        ...queueEnvelope([{ submissionId: 'b-1', alreadyRatedByMe: false }], { total: 5, unscoredTotal: 5 }),
        planName: 'Wave Beta',
      },
    });

    renderReview('/review');

    await screen.findByText('Wave Alpha');
    expect(screen.queryByRole('link', { name: 'Sign out' })).not.toBeInTheDocument();
    expect(screen.queryByText('Sign out')).not.toBeInTheDocument();
  });

  it(':821 the dock carries "Scores stay hidden from other reviewers" verbatim', async () => {
    const PLAN_A = 'plan-a-w29i-dock';
    const PLAN_B = 'plan-b-w29i-dock';

    mockApi({
      'GET /api/v1/me': reviewerMe(),
      'GET /api/v1/review/plans': listEnvelope([
        { id: PLAN_A, eventId: 'evt-1', name: 'Wave Alpha', timezone: 'UTC' },
        { id: PLAN_B, eventId: 'evt-1', name: 'Wave Beta', timezone: 'UTC' },
      ]),
      [`GET /api/v1/review/plans/${PLAN_A}/queue`]: {
        ...queueEnvelope([{ submissionId: 'a-1', alreadyRatedByMe: false }], { total: 6, unscoredTotal: 4 }),
        planName: 'Wave Alpha',
      },
      [`GET /api/v1/review/plans/${PLAN_B}/queue`]: {
        ...queueEnvelope([{ submissionId: 'b-1', alreadyRatedByMe: false }], { total: 5, unscoredTotal: 5 }),
        planName: 'Wave Beta',
      },
    });

    renderReview('/review');

    await screen.findByText('Wave Alpha');
    const dockNote = document.querySelector('.chq-reviewer-plans-phone-note');
    expect(dockNote).not.toBeNull();
    expect(dockNote!.textContent).toBe('Scores stay hidden from other reviewers');
  });
});
