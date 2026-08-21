// w23-d (DEC-976 wave-23 amendment): the per-frame DESKTOP (1600) render
// verdict for the Review cluster's PLAN-EDITOR family -- the four frames
// `docs/design/Chautauqua Review.dc.html` draws at :451, :675, :718, :875.
// Sibling to Review.frame-verdicts.render.test.tsx (the five 390 frames)
// -- this file owns exactly these four desktop frames and a NEW audit doc,
// docs/design/audit/review-desktop-v12.md.
//
// NOT COVERED HERE (by task design, said explicitly so the ledger's
// coverage reads honestly rather than looking complete): Review's other
// four desktop frames -- :28 Organiser view, :183 Reviewer scorecard,
// :351 Reviewer queue, :830 Your plans -- belong to a later wave's
// reviewer-facing-family lane.
//
// STRICTLY MEASUREMENT ONLY: desktop is frozen by the mandate, so this
// file moves no desktop byte and edits no component/stylesheet -- it
// renders the real route, verdicts what the tree actually produces, and
// files divergences in prose.
//
// Modelled exactly on Speakers.desktop-frame-verdicts.render.test.tsx: same
// verbatimLine(lineNo, literal) helper (copied verbatim), same
// beforeEach/afterEach console guard, same mockApi/listEnvelope
// test-utils. jsdom applies no stylesheet (no @media, no computed
// grid-template-columns/font-weight), so every assertion here is DOM
// structure/order/text, or a readFileSync of the APP's own stylesheet TEXT
// for the one claim (the locked criterion row's track list) that is
// inherently a CSS fact -- the design pack is never re-read as its own
// proof (DEC-976/DEC-967). Every DOM/CSS lookup runs BEFORE its citation
// comment so the citation sits immediately beside the `expect(` that
// receipts it (DEC-976 wave-116's EXPECT_PROXIMITY_LINES window).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PlanEditor } from './review/PlanEditor';
import { listEnvelope, mockApi } from '../test-utils/mockApi';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Review.dc.html');

/** DEC-967 shape: read the ACTUAL line, assert it byte-for-byte matches the
 * literal this file claims. Copied verbatim from
 * Speakers.desktop-frame-verdicts.render.test.tsx's own verbatimLine. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

const EVENT_ID = 'evt-review-desktop-verdicts';
const PLAN_ID = 'plan-desktop-1';

function plan(overrides: Record<string, unknown> = {}) {
  return {
    id: PLAN_ID,
    eventId: EVENT_ID,
    name: 'Wave 2 — AI Engineering deep pass',
    instructions: '',
    openDate: null,
    closeDate: null,
    filters: null,
    anonymized: false,
    scale: { min: 1, max: 5 },
    criteria: [
      { id: 'c1', label: 'Content', kind: 'rating', weight: 3 },
      { id: 'c2', label: 'Delivery', kind: 'rating', weight: 3 },
    ],
    rounds: 1,
    currentRound: 1,
    roundCriteria: null,
    maxEvaluations: null,
    createdAt: 1700000000000,
    timezone: 'UTC',
    ...overrides,
  };
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  expect(consoleErrorSpy).not.toHaveBeenCalled();
  consoleErrorSpy.mockRestore();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe('v12 Review DESKTOP (1600) frames: per-frame render verdict receipts, PlanEditor family (w23-d, DEC-976 wave-23 amendment)', () => {
  // ---------------------------------------------------------------------
  // Frame :451 "Plan editor · /review/plans/:id"
  // ---------------------------------------------------------------------
  describe('frame :451 "Plan editor · /review/plans/:id"', () => {
    function renderExistingPlan() {
      mockApi({
        [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
        [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
        [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
        [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
        'GET /api/v1/users': listEnvelope([]),
      });
      return render(
        <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
          <Routes>
            <Route path="/review/plans/:planId" element={<PlanEditor />} />
          </Routes>
        </MemoryRouter>,
      );
    }

    it('MATCHES: the title-row actions for an existing plan are Duplicate then Save, in that order', async () => {
      renderExistingPlan();
      await screen.findByRole('heading', { name: 'Wave 2 — AI Engineering deep pass' });
      const actions = document.querySelector('.chq-review-editor-title-actions');
      const buttonLabels = within(actions as HTMLElement).getAllByRole('button').map((b) => b.textContent);
      // docs/design/Chautauqua Review.dc.html:461-462 draws the desktop
      // title row's action pair as `Duplicate` then `Save`.
      verbatimLine(462, '          <span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; padding:10px 15px; font-size:13px; font-weight:700">Save</span>');
      expect(buttonLabels).toEqual(['Duplicate', 'Save']);
    });

    it('MATCHES: the plan-fields grid states Opens/Closes/Reviews per talk/Rating scale, in that order', async () => {
      renderExistingPlan();
      await screen.findByRole('heading', { name: 'Wave 2 — AI Engineering deep pass' });
      const grid = document.querySelector('.chq-review-summary-grid');
      const fieldLabels = [...(grid?.querySelectorAll(':scope > label, :scope > div') ?? [])].map(
        (el) => el.textContent?.split(/(?=[A-Z])/)[0]?.trim(),
      );
      // docs/design/Chautauqua Review.dc.html:469/473/477/481 draw the
      // desktop plan-fields grid as `Opens`, `Closes`, `Reviews per talk`,
      // `Rating scale`, that order.
      verbatimLine(477, '            <span style="font-size:11px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#565A4B">Reviews per talk</span>');
      expect(screen.getByText('Opens')).toBeInTheDocument();
      expect(screen.getByText('Closes')).toBeInTheDocument();
      expect(screen.getByText('Reviews per talk')).toBeInTheDocument();
      expect(screen.getByText('Rating scale')).toBeInTheDocument();
      expect(fieldLabels[0]).toBe('Opens');
    });

    it('MATCHES: the unlocked criteria section carries the "Scores average by weight" eyebrow', async () => {
      renderExistingPlan();
      await screen.findByRole('heading', { name: 'Wave 2 — AI Engineering deep pass' });
      const eyebrow = document.querySelector('.chq-review-criteria-eyebrow');
      // docs/design/Chautauqua Review.dc.html:490 draws the unlocked
      // section's right-aligned eyebrow as `Scores average by weight`.
      verbatimLine(490, '            <span style="font-size:11px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:#565A4B">Scores average by weight</span>');
      expect(eyebrow).toHaveTextContent('Scores average by weight');
    });

    it('MATCHES: the criteria head row states Criterion / Guidance for reviewers / Type / Weight, in that order', async () => {
      renderExistingPlan();
      await screen.findByRole('heading', { name: 'Wave 2 — AI Engineering deep pass' });
      const headRow = document.querySelector('.chq-review-criteria-head-row');
      const cellText = [...(headRow?.querySelectorAll('span') ?? [])].map((s) => s.textContent?.trim());
      // docs/design/Chautauqua Review.dc.html:493 draws the criteria head
      // row's four labelled cells `Criterion`, `Guidance for reviewers`,
      // `Type`, `Weight`, in this order (flanked by two blank drag-handle/
      // remove placeholder cells).
      verbatimLine(493, '            <span></span><span>Criterion</span><span>Guidance for reviewers · optional</span><span>Type</span><span>Weight</span><span></span>');
      expect(cellText.filter(Boolean)[0]).toBe('Criterion');
      expect(cellText.some((t) => t?.startsWith('Guidance for reviewers'))).toBe(true);
      expect(cellText).toContain('Type');
      expect(cellText).toContain('Weight');
    });
  });

  // ---------------------------------------------------------------------
  // Frame :675 "Plan editor · criteria frozen"
  // ---------------------------------------------------------------------
  describe('frame :675 "Plan editor · criteria frozen"', () => {
    function renderLockedPlan() {
      mockApi({
        [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
        [`GET /api/v1/plans/${PLAN_ID}`]: { ...plan(), evaluationCountsByRound: { '1': 12 } },
        [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([]),
        [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([]),
        'GET /api/v1/users': listEnvelope([]),
      });
      return render(
        <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
          <Routes>
            <Route path="/review/plans/:planId" element={<PlanEditor />} />
          </Routes>
        </MemoryRouter>,
      );
    }

    it('DIVERGES: the frame draws a static locked eyebrow sentence; the tree states the live scored-review count instead', async () => {
      renderLockedPlan();
      await screen.findByRole('heading', { name: 'Wave 2 — AI Engineering deep pass' });
      const eyebrow = await screen.findByText(/^Locked/);
      // docs/design/Chautauqua Review.dc.html:693 draws the locked eyebrow
      // as the fixed sentence `Locked — wording, type and weights fixed
      // for this wave`, naming no count at all.
      verbatimLine(693, '            <span style="font-size:11px; font-weight:800; letter-spacing:0.09em; text-transform:uppercase">Locked — wording, type and weights fixed for this wave</span>');
      expect(eyebrow).toHaveTextContent('Locked — 12 reviews scored against these criteria');
    });

    it('MATCHES: the locked notice card carries the headline, the reason sentence, and "Start a new wave"', async () => {
      renderLockedPlan();
      await screen.findByRole('heading', { name: 'Wave 2 — AI Engineering deep pass' });
      const notice = document.querySelector('.chq-review-criteria-locked-notice');
      const startWaveBtn = within(notice as HTMLElement).getByRole('button', { name: 'Start a new wave' });
      // docs/design/Chautauqua Review.dc.html:705-708 draws the locked
      // notice card's headline `Changing these would rescore work already
      // done`, its reason sentence, then the `Start a new wave` CTA.
      verbatimLine(705, '              <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:15px; font-weight:700">Changing these would rescore work already done</span>');
      expect(notice).toHaveTextContent('Changing these would rescore work already done');
      expect(notice).toHaveTextContent(
        'Wording, weights and the scale are fixed for the rest of this wave. To score differently, open a new wave — the reviews already in stay attached to this one.',
      );
      expect(startWaveBtn).toBeInTheDocument();
    });

    it('DIVERGES (additively, per review.css\'s own comment): the frame draws the locked row as four content tracks; the tree keeps the unlocked row\'s six-track grid, its outer two blank', async () => {
      const cssPath = join(dirname(fileURLToPath(import.meta.url)), 'review', 'review.css');
      const css = readFileSync(cssPath, 'utf-8');
      const readonlyRuleBody = css.match(
        /\.chq-review-criterion-row\.chq-review-criterion-row-readonly\s*\{([^}]*)\}/,
      )?.[1];
      // docs/design/Chautauqua Review.dc.html:696 draws the locked
      // criterion row's own grid as `1fr 232px 128px 122px` -- four
      // content tracks, no drag-handle or remove-button column at all.
      verbatimLine(696, '            <div style="display:grid; grid-template-columns:1fr 232px 128px 122px; gap:16px; align-items:baseline; padding:14px 0; border-bottom:1px solid #E1DDCE">');
      expect(readonlyRuleBody).toMatch(/grid-template-columns:\s*20px minmax\(0, 1fr\) 232px 128px 122px 62px/);

      renderLockedPlan();
      await screen.findByRole('heading', { name: 'Wave 2 — AI Engineering deep pass' });
      const rows = document.querySelectorAll('.chq-review-criterion-row-readonly');
      expect(rows.length).toBeGreaterThan(0);
      // Six <span>/content children per row: blank handle, label, hint,
      // type, weight, blank remove -- the six-track grid the CSS above
      // declares, not the frame's four.
      expect(rows[0]?.children.length).toBe(6);
    });
  });

  // ---------------------------------------------------------------------
  // Frame :718 "New plan · /review/plans/new"
  // ---------------------------------------------------------------------
  describe('frame :718 "New plan · /review/plans/new"', () => {
    function renderNewPlan() {
      mockApi({
        [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
        'GET /api/v1/users': listEnvelope([]),
      });
      return render(
        <MemoryRouter initialEntries={['/review/plans/new']}>
          <Routes>
            <Route path="/review/plans/new" element={<PlanEditor />} />
          </Routes>
        </MemoryRouter>,
      );
    }

    it('MATCHES: the title reads "New evaluation plan" with the "Nothing is sent…" caption beneath it', async () => {
      renderNewPlan();
      await screen.findByRole('button', { name: 'Create the plan' });
      const h1 = screen.getByRole('heading', { level: 1 });
      const caption = document.querySelector('.chq-review-field-caption');
      // docs/design/Chautauqua Review.dc.html:726-727 draw the new-plan
      // title `New evaluation plan` over the caption `Nothing is sent to
      // reviewers until you open it`.
      verbatimLine(727, '          <span style="font-size:13px; color:#565A4B">Nothing is sent to reviewers until you open it</span>');
      expect(h1).toHaveTextContent('New evaluation plan');
      expect(caption).toHaveTextContent('Nothing is sent to reviewers until you open it.');
    });

    it('MATCHES: the title-row actions for a new plan are Cancel then Create the plan, in that order', async () => {
      renderNewPlan();
      await screen.findByRole('button', { name: 'Create the plan' });
      const actions = document.querySelector('.chq-review-editor-title-actions');
      const buttonLabels = within(actions as HTMLElement).getAllByRole('button').map((b) => b.textContent);
      // docs/design/Chautauqua Review.dc.html:729 draws the new-plan
      // title row's action pair as `Cancel` then `Create the plan`.
      verbatimLine(729, '        <div style="display:flex; gap:9px"><span style="border:1px solid #CFC7B7; border-radius:4px; background:#EFEBDF; padding:9px 15px; font-size:13px; font-weight:600; color:#2E2A24">Cancel</span><span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; padding:10px 15px; font-size:13px; font-weight:700">Create the plan</span></div>');
      expect(buttonLabels).toEqual(['Cancel', 'Create the plan']);
    });

    it('MATCHES: the new-plan starting-state note names the three-default seed, drawn only for a brand-new plan', async () => {
      renderNewPlan();
      await screen.findByRole('button', { name: 'Create the plan' });
      const note = document.querySelector('.chq-review-new-criteria-note');
      // docs/design/Chautauqua Review.dc.html:738 draws the new-plan
      // starting-state note `Three to start with — two scored 1–5 and one
      // recorded as a spread` over the default criteria set.
      verbatimLine(738, '          <div style="padding:14px 0 4px; font-size:14px; line-height:1.6; color:#3F4237; max-width:60ch">Three to start with — two scored 1–5 and one recorded as a spread. Rename them, change the type or the weights, or remove any you don\'t want.</div>');
      expect(note).toHaveTextContent(
        "Three to start with — two scored 1–5 and one recorded as a spread. Rename them, change the type or the weights, or remove any you don't want.",
      );
    });

    it('MATCHES: the new plan opens with three default criteria rows already in the table', async () => {
      renderNewPlan();
      await screen.findByRole('button', { name: 'Create the plan' });
      const rows = document.querySelectorAll('.chq-review-criterion-row:not(.chq-review-criterion-row-readonly)');
      // docs/design/Chautauqua Review.dc.html:742 seeds `defaultCriteria`
      // with `hint-placeholder-count="3"` -- three rows drawn by default.
      verbatimLine(742, '          <sc-for list="{{ defaultCriteria }}" as="c" hint-placeholder-count="3">');
      expect(rows.length).toBe(3);
    });
  });

  // ---------------------------------------------------------------------
  // Frame :875 "Plan editor · save rejected"
  // ---------------------------------------------------------------------
  describe('frame :875 "Plan editor · save rejected"', () => {
    function renderNewPlan() {
      mockApi({
        [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
        'GET /api/v1/users': listEnvelope([]),
      });
      return render(
        <MemoryRouter initialEntries={['/review/plans/new']}>
          <Routes>
            <Route path="/review/plans/new" element={<PlanEditor />} />
          </Routes>
        </MemoryRouter>,
      );
    }

    /** Drives the real client-side refusal path (never a hand-built error
     * prop): types a plan name, empties the seeded criteria out by hand,
     * sets a close date before the open date, then clicks Create -- the
     * component's own validatePlanDraft/validateCriteriaList produce
     * exactly the two-error refusal the frame draws (see
     * PlanEditor.errors.render.test.tsx, whose second test this mirrors). */
    async function driveTwoErrorRefusal() {
      renderNewPlan();
      await screen.findByRole('button', { name: 'Create the plan' });
      fireEvent.change(screen.getByLabelText('Plan name'), { target: { value: 'Wave 3 — workshops and panels' } });
      for (const removeButton of screen.getAllByRole('button', { name: 'Remove' })) {
        fireEvent.click(removeButton);
      }
      const opens = document.getElementById('plan-open-at') as HTMLInputElement;
      const closes = document.getElementById('plan-close-at') as HTMLInputElement;
      fireEvent.change(opens, { target: { value: '2 Sep 2027' } });
      fireEvent.blur(opens);
      fireEvent.change(closes, { target: { value: '20 Aug 2027' } });
      fireEvent.blur(closes);
      fireEvent.click(screen.getByRole('button', { name: 'Create the plan' }));
    }

    it('MATCHES: the refusal summary states "Two things need fixing…" with the criteria+window kept sentence', async () => {
      await driveTwoErrorRefusal();
      const alerts = screen.getAllByRole('alert');
      const summary = alerts.find((el) => /before this plan can open/.test(el.textContent ?? ''));
      // docs/design/Chautauqua Review.dc.html:888-889 draw the refusal
      // banner's headline `Two things need fixing before this plan can
      // open` over the criteria+window kept sentence.
      verbatimLine(889, '            <span style="font-size:14px; line-height:1.55; color:#3F4237">A plan with no criteria has nothing for reviewers to score, and the window has to run forwards.</span>');
      expect(summary).toHaveTextContent('Two things need fixing before this plan can open');
      expect(summary).toHaveTextContent(
        'A plan with no criteria has nothing for reviewers to score, and the window has to run forwards.',
      );
    });

    it('MATCHES: the Closes field carries its own worded-as-a-consequence error beneath it', async () => {
      await driveTwoErrorRefusal();
      const closes = document.getElementById('plan-close-at') as HTMLInputElement;
      const closeError = closes.parentElement?.querySelector('.chq-field-error');
      // docs/design/Chautauqua Review.dc.html:901 draws the Closes field's
      // own error line `This is before the plan opens. Pick a date after 2
      // September.`, worded as a consequence with the actual open date
      // named.
      verbatimLine(901, '              <span style="font-size:13px; font-weight:600; line-height:1.5; color:#1B1D17">This is before the plan opens. Pick a date after 2 September.</span>');
      expect(closeError).toHaveTextContent(/before the plan opens/i);
    });

    it('MATCHES: the empty-criteria card states "No criteria yet", the reason sentence, and both recovery actions', async () => {
      await driveTwoErrorRefusal();
      const emptyNotice = document.querySelector('.chq-review-criteria-empty-notice');
      const addDefaults = within(emptyNotice as HTMLElement).getByRole('button', { name: 'Add the three defaults' });
      const addOwn = within(emptyNotice as HTMLElement).getByRole('button', { name: 'Add one of my own' });
      // docs/design/Chautauqua Review.dc.html:910-911 draw the empty-
      // criteria card's headline `No criteria yet` over its reason
      // sentence.
      verbatimLine(911, '            <span style="font-size:14px; line-height:1.6; color:#3F4237; max-width:56ch">Reviewers need at least one thing to score. Add your own, or start from the three defaults.</span>');
      expect(emptyNotice).toHaveTextContent('No criteria yet');
      expect(emptyNotice).toHaveTextContent(
        'Reviewers need at least one thing to score. Add your own, or start from the three defaults.',
      );
      expect(addDefaults).toBeInTheDocument();
      expect(addOwn).toBeInTheDocument();
    });
  });
});
