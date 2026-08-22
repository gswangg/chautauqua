// w29-e: `docs/design/Chautauqua Review.dc.html:594` ("Plan editor · 390"),
// extent 594-673 -- the pack's densest phone frame (24 drawn strings). This
// file's only prior citation of the extent
// (`PlanEditor.render.test.tsx`/`PlanEditor.tsx` themselves) is the BARE
// `Chautauqua Review.dc.html:<line>` shorthand DEC-808's wave-29 amendment
// declined to grade -- every citation below uses the STRICT
// `docs/design/Chautauqua Review.dc.html:<line>` form so a frame ledger can
// actually see this extent.
//
// Two halves:
//   (A) `verbatimLine` citations (DEC-967 shape, copied from
//       PlanEditor.copy-390.render.test.tsx) for all 24 drawn literals, so a
//       future frame edit fails this file loudly instead of rotting a
//       citation silently.
//   (B) render assertions against the SHIPPED phone tree. Two of the
//       frame's drawn strings do not exist in the built product at all --
//       :640's second clause and :662's whole sentence use a different
//       grammar than the frame draws, and the frame's per-criterion
//       "Options"/"Weight" eyebrows (:612/:627) have no phone-visible text
//       counterpart at all (only an aria-hidden desktop head-row carries
//       those words, unconditionally, at every width). This task's OWNS
//       list does not include PlanEditor.tsx, so DEC-385 wave-29 condition
//       (4) ("touches only files the lane OWNS") fails for all three --
//       each is asserted here as the REAL shipped shape (never the frame's
//       literal numbers, DEC-967 wave-29) and recorded as a DIVERGES row in
//       docs/design/audit/review-admin-v12.md instead of silently fixed.
//   The dock's "Save the plan"/"Cancel" (:666/:667) divergence is NOT new --
//   it is already RESOLVED BY RULING in docs/design/DEVIATIONS.md (DEC-745
//   wave-98): the dock is whichever pair the title row already renders
//   (Duplicate/Save for an existing plan), never a second button pair. This
//   file asserts that shipped pair, not the frame's literal copy.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PlanEditor } from './PlanEditor';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Review.dc.html');

/** DEC-967 shape, copied verbatim from PlanEditor.copy-390.render.test.tsx's
 * own `verbatimLine`: read the ACTUAL design-file line and assert it
 * byte-for-byte matches the literal this file claims. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

const EVENT_ID = 'evt-plan-editor-frame390';
const PLAN_ID = 'plan-frame390';
const PLAN_NAME = 'Frame 390 Coverage';

function plan(overrides: Record<string, unknown> = {}) {
  return {
    id: PLAN_ID,
    eventId: EVENT_ID,
    name: PLAN_NAME,
    instructions: '',
    openDate: null,
    closeDate: 1900000000000,
    filters: null,
    anonymized: false,
    scale: { min: 1, max: 5 },
    // Deliberately NOT the frame's own counts (2 criteria, not 3; 4 of 6
    // options, not 3 of 6; 5 reviewers, not 4) -- shape assertions below
    // never pin the frame's literal numbers (DEC-967 wave-29).
    criteria: [
      { id: 'c1', label: 'Content', kind: 'rating', weight: 2 },
      {
        id: 'c2',
        label: 'Format',
        kind: 'dropdown',
        options: ['Talk', 'Workshop', 'Panel', 'Lightning'],
      },
    ],
    rounds: 1,
    currentRound: 1,
    roundCriteria: null,
    maxEvaluations: 3,
    createdAt: 1700000000000,
    timezone: 'UTC',
    ...overrides,
  };
}

const REVIEWER_ROWS = [1, 2, 3, 4, 5].map((n) => ({
  id: `pr-${n}`,
  userId: `user-${n}`,
  email: `reviewer${n}@example.test`,
  trackId: null,
  submissionId: null,
  trackName: null,
  submissionRef: null,
  submissionTitle: null,
}));

class FakeMediaQueryList {
  matches = true;
  addEventListener() {}
  removeEventListener() {}
}

function stubPhoneMatchMedia() {
  vi.stubGlobal('matchMedia', () => new FakeMediaQueryList());
}

function mockPlan() {
  mockApi({
    [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
    [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
    [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope(REVIEWER_ROWS, { total: REVIEWER_ROWS.length }),
    [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([], { total: 6, submissionsInScope: 13 }),
    'GET /api/v1/users': listEnvelope([]),
  });
}

function renderEditor() {
  return render(
    <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
      <Routes>
        <Route path="/review/plans/:planId" element={<PlanEditor />} />
      </Routes>
    </MemoryRouter>,
  );
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  expect(consoleErrorSpy).not.toHaveBeenCalled();
  consoleErrorSpy.mockRestore();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  cleanup();
});

describe('Plan editor · 390 frame citations (Chautauqua Review.dc.html:594-673, strict form)', () => {
  it(':596 back link "‹ Review"', () => {
    verbatimLine(
      596,
      '        <a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Review</a>',
    );
  });

  it(':597 plan name as H1', () => {
    verbatimLine(
      597,
      '        <h1 style="margin:0; font-family:\'Familjen Grotesk\', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">Wave 2</h1>',
    );
  });

  it(':598 scope · closes · reviews-per-talk subtitle', () => {
    verbatimLine(598, '        <span style="font-size:13px; color:#565A4B">AI Engineering · closes 30 Aug · 2 reviews per talk</span>');
  });

  it(':601/:602 Criteria eyebrow + count', () => {
    verbatimLine(
      601,
      '          <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase">Criteria</span>',
    );
    verbatimLine(602, '          <span style="font-size:12px; font-weight:700; color:#565A4B">3</span>');
  });

  it(':606-:608 per-criterion label / hint / typeLabel select', () => {
    verbatimLine(
      606,
      '            <div style="border:1px solid #BAB6A6; border-radius:6px; background:#FAF8F2; min-height:48px; display:flex; align-items:center; padding:0 13px; font-size:15px; font-weight:600">{{ c.label }}</div>',
    );
    verbatimLine(607, '            <div style="{{ c.hintStyleM }}">{{ c.hint }}</div>');
    verbatimLine(
      608,
      '            <div style="border:1px solid #BAB6A6; border-radius:6px; background:#FAF8F2; min-height:46px; display:flex; align-items:center; justify-content:space-between; gap:10px; padding:0 13px; font-size:14px">{{ c.typeLabel }} <span style="color:#565A4B; padding-left:6px">▾</span></div>',
    );
  });

  it(':612/:613 Options eyebrow + "N of M"', () => {
    verbatimLine(
      612,
      '                  <span style="font-size:11px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#565A4B">Options</span>',
    );
    verbatimLine(613, '                  <span style="font-size:12px; color:#565A4B">3 of 6</span>');
  });

  it(':617-:619 drag handle / option label / Remove', () => {
    verbatimLine(617, '                    <span style="font-size:14px; color:#8E8A7A">⋮⋮</span>');
    verbatimLine(
      618,
      '                    <div style="flex:1; min-width:0; border:1px solid #BAB6A6; border-radius:6px; background:#FAF8F2; min-height:46px; display:flex; align-items:center; padding:0 13px; font-size:15px">{{ o.label }}</div>',
    );
    verbatimLine(619, '                    <span style="{{ o.delStyleM }}">Remove</span>');
  });

  it(':622 "Add an option"', () => {
    verbatimLine(
      622,
      '                <a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:inline-flex; align-items:center">Add an option</a>',
    );
  });

  it(':627-:629 Weight eyebrow / value / share', () => {
    verbatimLine(
      627,
      '                <span style="font-size:11px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#565A4B">Weight</span>',
    );
    verbatimLine(
      628,
      '                <div style="border:1px solid #BAB6A6; border-radius:6px; background:#FAF8F2; min-height:44px; width:58px; display:flex; align-items:center; justify-content:center; font-family:\'Familjen Grotesk\', sans-serif; font-size:16px; font-weight:700">{{ c.weight }}</div>',
    );
    verbatimLine(629, '                <span style="font-size:13px; color:#565A4B">{{ c.share }}</span>');
  });

  it(':632 "Recorded as a spread · no weight"', () => {
    verbatimLine(632, '                <span style="font-size:12px; color:#565A4B; line-height:1.5">Recorded as a spread · no weight</span>');
  });

  it(':639/:640 "Add criterion" + consequence line', () => {
    verbatimLine(
      639,
      '          <a href="#" style="font-size:14px; font-weight:700; min-height:44px; display:flex; align-items:center">Add criterion</a>',
    );
    verbatimLine(
      640,
      '          <span style="font-size:12px; color:#565A4B; line-height:1.5">3 of about 7 · the two scored ones average by weight</span>',
    );
  });

  it(':643/:644 Reviewers eyebrow + count', () => {
    verbatimLine(
      643,
      '          <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase">Reviewers</span>',
    );
    verbatimLine(644, '          <span style="font-size:12px; font-weight:700; color:#565A4B">4</span>');
  });

  it(':649/:650 assignee row (name / track · load)', () => {
    verbatimLine(
      649,
      '              <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:16px; font-weight:600; letter-spacing:-0.015em">{{ a.name }}</span>',
    );
    verbatimLine(650, '              <span style="font-size:12px; color:#565A4B">{{ a.track }} · {{ a.load }}</span>');
  });

  it(':652 "Swap"', () => {
    verbatimLine(
      652,
      '            <span style="border:1px solid #BAB6A6; border-radius:6px; background:#EFEBDF; min-height:44px; display:flex; align-items:center; padding:0 14px; font-size:13px; font-weight:600">Swap</span>',
    );
  });

  it(':657-:659 "Cap each" / value / "talks"', () => {
    verbatimLine(
      657,
      '            <span style="font-size:11px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#565A4B">Cap each</span>',
    );
    verbatimLine(
      658,
      '            <div style="border:1px solid #BAB6A6; border-radius:6px; background:#FAF8F2; min-height:44px; width:62px; display:flex; align-items:center; justify-content:center; font-family:\'Familjen Grotesk\', sans-serif; font-size:16px; font-weight:700">8</div>',
    );
    verbatimLine(659, '            <span style="font-size:13px; color:#565A4B">talks</span>');
  });

  it(':661 "Distribute the unassigned"', () => {
    verbatimLine(
      661,
      '          <span style="border:1px solid #CFC7B7; border-radius:6px; background:#EFEBDF; min-height:46px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600; color:#2E2A24">Distribute the unassigned</span>',
    );
  });

  it(':662 "Would assign N of M · you confirm before anything saves"', () => {
    verbatimLine(662, '          <span style="font-size:12px; color:#565A4B; line-height:1.5">Would assign 22 of 36 · you confirm before anything saves</span>');
  });

  it(':663 second "Assign a reviewer" control', () => {
    verbatimLine(
      663,
      '          <span style="display:flex; align-items:center; justify-content:center; border:1px dashed #BAB6A6; border-radius:6px; min-height:46px; font-size:13px; font-weight:700; color:#4E5C31">Assign a reviewer</span>',
    );
  });

  it(':666/:667 docked "Save the plan" + "Cancel"', () => {
    verbatimLine(
      666,
      '        <span style="flex:1; background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:48px; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700">Save the plan</span>',
    );
    verbatimLine(
      667,
      '        <span style="border:1px solid #BAB6A6; border-radius:6px; min-height:48px; display:flex; align-items:center; padding:0 16px; font-size:13px; font-weight:600">Cancel</span>',
    );
  });
});

describe('Plan editor · 390 shipped anatomy (matches the frame)', () => {
  it('renders the phone dock ".chq-review-editor-title-actions" with exactly the shipped Duplicate/Save pair, in that order -- never the frame\'s literal "Save the plan"/"Cancel" (DEVIATIONS.md, DEC-745 wave-98)', async () => {
    stubPhoneMatchMedia();
    mockPlan();
    const { container } = renderEditor();

    await screen.findByDisplayValue(PLAN_NAME);
    const dock = container.querySelector('.chq-review-editor-title-actions');
    expect(dock).not.toBeNull();
    const buttons = within(dock as HTMLElement).getAllByRole('button');
    expect(buttons).toHaveLength(2);
    expect(buttons.map((b) => b.textContent)).toEqual(['Duplicate', 'Save']);

    // The frame's literal dock copy never renders anywhere on phone -- this
    // is the already-RULED divergence (DEVIATIONS.md, DEC-745 wave-98), not
    // a defect this file re-opens.
    expect(screen.queryByText('Save the plan')).not.toBeInTheDocument();
    expect(within(dock as HTMLElement).queryByText('Cancel')).not.toBeInTheDocument();
  });

  it('page section order: "Criteria" (phone eyebrow) precedes "Who reviews what"', async () => {
    stubPhoneMatchMedia();
    mockPlan();
    renderEditor();

    const heads = (await screen.findAllByRole('heading', { level: 2 })).map((h) => h.textContent);
    const criteriaIdx = heads.indexOf('Criteria');
    const reviewersIdx = heads.indexOf('Who reviews what');
    expect(criteriaIdx).toBeGreaterThanOrEqual(0);
    expect(reviewersIdx).toBeGreaterThan(criteriaIdx);
  });

  it('desktop label is ABSENT at 390 -- "Cap per reviewer" never renders alongside the phone "Cap each"', async () => {
    stubPhoneMatchMedia();
    mockPlan();
    renderEditor();

    expect(await screen.findByText('Cap each')).toBeInTheDocument();
    expect(screen.queryByText('Cap per reviewer')).not.toBeInTheDocument();
  });

  it('counted heads: the phone Criteria count and the phone Reviewers count each read a bare digit string, never the frame\'s literal 3/4 (DEC-967 wave-29)', async () => {
    stubPhoneMatchMedia();
    mockPlan();
    const { container } = renderEditor();

    await screen.findByDisplayValue(PLAN_NAME);
    const criteriaCount = container.querySelector('.chq-review-criteria-count-phone');
    const reviewersCount = await screen.findByText((_, el) =>
      el?.className === 'chq-review-reviewers-count-phone',
    );
    expect(criteriaCount).not.toBeNull();
    expect(criteriaCount!.textContent).toMatch(/^\d+$/);
    expect(criteriaCount!.textContent).toBe('2'); // this mock's own criteria count, not the frame's "3"
    expect(reviewersCount.textContent).toMatch(/^\d+$/);
    expect(reviewersCount.textContent).toBe(String(REVIEWER_ROWS.length));
  });

  it('the Options count reads "N of M" shape, sourced from MAX_CRITERION_OPTIONS -- never the frame\'s literal "3 of 6"', async () => {
    stubPhoneMatchMedia();
    mockPlan();
    renderEditor();

    const optionsCount = await screen.findByText(/^\d+ of \d+$/);
    expect(optionsCount.textContent).toBe('4 of 6'); // this mock's 4 options, MAX_CRITERION_OPTIONS=6
    expect(optionsCount.textContent).not.toBe('3 of 6');
  });

  it('within a criterion row, DOM order is label -> guidance -> type select -> the kind-specific block (options for a Choice criterion)', async () => {
    stubPhoneMatchMedia();
    mockPlan();
    const { container } = renderEditor();

    await screen.findByDisplayValue(PLAN_NAME);
    const formatRow = Array.from(container.querySelectorAll('.chq-review-criterion-row')).find((row) =>
      (row.querySelector('input[aria-label="Criterion label"]') as HTMLInputElement | null)?.value === 'Format',
    );
    expect(formatRow).toBeTruthy();
    const label = formatRow!.querySelector('input[aria-label="Criterion label"]')!;
    const guidance = formatRow!.querySelector('input[aria-label$="guidance"]')!;
    const typeSelect = formatRow!.querySelector('select')!;
    const optionsBlock = formatRow!.querySelector('.chq-review-criterion-options')!;
    const order = [label, guidance, typeSelect, optionsBlock].map((el) =>
      Array.from(formatRow!.querySelectorAll('input, select, div.chq-review-criterion-options')).indexOf(el),
    );
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('"Add an option" and "Add criterion" render as the frame names them', async () => {
    stubPhoneMatchMedia();
    mockPlan();
    renderEditor();

    expect(await screen.findByText('Add an option')).toBeInTheDocument();
    expect(await screen.findByText('Add criterion')).toBeInTheDocument();
  });

  it('the Distribute row: "Cap each", a numeric value, "Distribute the unassigned"', async () => {
    stubPhoneMatchMedia();
    mockPlan();
    renderEditor();

    expect(await screen.findByText('Cap each')).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'Distribute the unassigned' }),
    ).toBeInTheDocument();
  });

  it('the below-roster dashed "Assign a reviewer" control (:663) renders with its own accessible name, distinct from the section-head toggle', async () => {
    stubPhoneMatchMedia();
    mockPlan();
    renderEditor();

    expect(
      await screen.findByRole('button', { name: 'Assign a reviewer, below the roster' }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Assign a reviewer' })).toBeInTheDocument();
  });
});

describe('Plan editor · 390 DIVERGENCES from the frame (real gaps, not fixed here -- DEC-385 wave-29 condition 4 fails: fixing needs app/src/pages/review/PlanEditor.tsx, which this task does not own)', () => {
  it(':612/:627 "Options"/"Weight" eyebrows have NO phone-visible text counterpart -- only an aria-hidden desktop head-row cell carries those words, unconditionally at every width', async () => {
    stubPhoneMatchMedia();
    mockPlan();
    const { container } = renderEditor();

    await screen.findByDisplayValue(PLAN_NAME);
    // The only "Weight"/"Options" text nodes anywhere in the tree are the
    // aria-hidden desktop head-row's column labels (chq-review-criteria-head-row,
    // itself aria-hidden="true" and rendered unconditionally, not phone-only).
    const headRow = container.querySelector('.chq-review-criteria-head-row');
    expect(headRow).not.toBeNull();
    expect(headRow!.getAttribute('aria-hidden')).toBe('true');
    expect(headRow!.textContent).toContain('Weight');
    // No SECOND, phone-scoped "Weight"/"Options" eyebrow exists per criterion
    // row the way the frame draws one inline with each criterion's own
    // weight/options block.
    const criterionScopedWeightLabels = container.querySelectorAll(
      '.chq-review-criterion-row .chq-review-criterion-weight-label, .chq-review-criterion-options .chq-review-criterion-options-label',
    );
    expect(criterionScopedWeightLabels.length).toBe(0);
  });

  it(':640 consequence line keeps the frame\'s "N of about M · " prefix but a DIFFERENT second clause ("more than that and reviewers rush the last ones", not "the two scored ones average by weight")', async () => {
    stubPhoneMatchMedia();
    mockPlan();
    renderEditor();

    const line = await screen.findByText(/^\d+ of about \d+ · /);
    expect(line.textContent).toBe('2 of about 7 · more than that and reviewers rush the last ones');
    expect(line.textContent).not.toContain('the two scored ones average by weight');
  });

  // This test used to record a DIVERGENCE: the phone cap row rendered
  // desktop's distributeSummaryText grammar ("N talks · M reviews needed at
  // K each · R reviewers") rather than the sentence frame :662 draws.
  // DEC-745 wave-33 closed it by adding capRowSummaryLinePhone -- a SECOND
  // composer beside capRowSummaryLine, not a rewrite of it, so desktop's
  // wording is byte-identical to what it was. The receipt therefore moves
  // to the frame's grammar and now also guards the split: seeing desktop's
  // sentence on a phone-width mount is the regression to catch.
  it(':662 the phone cap row reads the frame\'s own "Would assign N of M · you confirm before anything saves" grammar (DEC-745 wave-33)', async () => {
    stubPhoneMatchMedia();
    mockPlan();
    renderEditor();

    const summary = await screen.findByText(/^Would assign \d+ of \d+ · you confirm before anything saves$/);
    expect(summary).toBeInTheDocument();
    expect(screen.queryByText(/talks? · \d+ reviews? needed at \d+ each · \d+ reviewers?$/)).not.toBeInTheDocument();
  });

  it(':652 reviewer-row action reads "Remove", not the frame\'s "Swap" -- already RULED (DEVIATIONS.md, DEC-745 wave-98: no reassign-in-place capability exists)', async () => {
    stubPhoneMatchMedia();
    mockPlan();
    renderEditor();

    expect(await screen.findAllByRole('button', { name: 'Remove' })).not.toHaveLength(0);
    expect(screen.queryByText('Swap')).not.toBeInTheDocument();
  });
});
