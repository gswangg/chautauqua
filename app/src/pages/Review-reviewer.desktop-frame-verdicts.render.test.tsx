// w26-e (DEC-651/DEC-976/DEC-032): the DESKTOP (1600) per-frame render
// verdict for the reviewer-facing family of the Review cluster --
// v12m-w23-d's own PlanEditor-family desktop ledger names these four
// frames as NOT its own ("a later wave's reviewer-facing-family lane owns
// those"); this file is that lane. Sibling to
// Review.frame-verdicts.render.test.tsx (the 390 phone ledger for a
// DIFFERENT five frames) and modelled on the LANDED
// Speakers.desktop-frame-verdicts.render.test.tsx: entered through the
// real routes/components, each frame gets exactly one it() titled MATCHES
// or DIVERGES with the divergence named in the title. jsdom applies no
// stylesheet (no @media, no computed grid-template-columns), so every
// assertion is DOM structure/order/text, or review.css's/scorecard.css's
// own stylesheet TEXT for the one inherently-CSS claim (the results-table
// track set) -- the design pack is never re-read as its own proof
// (DEC-976/DEC-967). Every frame citation carries its verbatimLine receipt
// beside its expect(.
//
// STRICTLY MEASUREMENT ONLY (DEC-651 wave-26): this file renders the real
// route, verdicts what the tree actually produces, and files divergences
// in prose in the sibling audit doc -- it moves no desktop byte and edits
// no component or stylesheet, even where a real divergence is found.
//
// NARROWEST-INTERPRETATION NOTE (flagged per this task's own instruction):
// the brief names review/PlanList.tsx as frame :830's component. Measured
// against the tree, frame :830 ("Your plans · /review") is NOT drawn by
// PlanList.tsx (the organiser's plan list, mounted at the organiser's own
// "/" route) -- it is drawn by ReviewerQueue.tsx's own multi-plan hub
// branch (`plans.length > 1`, docs/design/Chautauqua
// Review.dc.html:793-830 cited directly in that component's own comments).
// This file enters :830 through ReviewerQueue.tsx accordingly; PlanList.tsx
// is not imported here.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProgressPanel } from './review/ProgressPanel';
import { ResultsTable } from './review/ResultsTable';
import { Scorecard } from './review/Scorecard';
import { ReviewerQueue } from './review/ReviewerQueue';
import { listEnvelope, mockApi } from '../test-utils/mockApi';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Review.dc.html');
const RULINGS_FILE = join(REPO_ROOT, 'docs', 'design', 'DESIGN-RULINGS.md');
const REVIEW_CSS_FILE = join(HERE, 'review', 'review.css');

/** DEC-967 shape: read the ACTUAL line, assert it byte-for-byte matches the
 * literal this file claims. Copied from
 * Speakers.desktop-frame-verdicts.render.test.tsx's own verbatimLine. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

/** Same shape, for a citation into DESIGN-RULINGS.md (the results-table
 * track-set claim this file verdicts is a RULING, not a frame pixel). */
function verbatimRulingLine(lineNo: number, literal: string): void {
  const lines = readFileSync(RULINGS_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`rulings file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

const PLAN_ID = 'plan-w26e-1';
const SUBMISSION_ID = 'sub-w26e-1';

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  expect(consoleErrorSpy).not.toHaveBeenCalled();
  consoleErrorSpy.mockRestore();
  vi.unstubAllGlobals();
});

function plan(overrides: Record<string, unknown> = {}) {
  return {
    id: PLAN_ID,
    eventId: 'evt-w26e',
    name: 'Track Review',
    timezone: 'UTC',
    instructions: '',
    openDate: null,
    closeDate: null,
    filters: null,
    anonymized: false,
    scale: { min: 1, max: 5 },
    criteria: [{ id: 'c1', label: 'Relevance', kind: 'rating', weight: 3 }],
    rounds: 1,
    currentRound: 1,
    roundCriteria: null,
    maxEvaluations: null,
    createdAt: 1700000000000,
    ...overrides,
  };
}

describe('v12 Review DESKTOP (1600) reviewer-facing frames: per-frame render verdict receipts (w26-e, DEC-651/DEC-976/DEC-032)', () => {
  // ---------------------------------------------------------------------
  // Frame :28 "Organiser view · 1600" -- this lane's assigned checks cover
  // only the results-table track set (ResultsTable) and the reviewer-
  // progress band (ProgressPanel), the two pieces the brief names.
  // ---------------------------------------------------------------------
  describe('frame :28 "Organiser view · 1600"', () => {
    function resultsRow() {
      return {
        submissionId: 'sub-r1',
        rank: 1,
        ref: 'S-001',
        title: 'A Great Talk',
        count: 3,
        average: 4.5,
        perCriterion: { c1: 4.5 },
        perDropdown: {},
        status: 'pending',
        speakers: ['Ada Lovelace'],
        trackNames: ['Engineering'],
        recusals: 0,
      };
    }

    it('DIVERGES: the results-table track set has drifted from DESIGN-RULINGS.md:191\'s own restatement of the frame\'s grid, in three of its seven tracks', async () => {
      // docs/design/Chautauqua Review.dc.html:28 identifies this frame.
      verbatimLine(28, '      <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:19px; font-weight:600">Organiser view · 1600</span>');
      // docs/design/Chautauqua Review.dc.html:124-125 -- the results table's
      // own head row grid and its seven column labels.
      verbatimLine(124, '          <div style="display:grid; grid-template-columns:44px 1fr 132px 118px 190px 84px auto; gap:16px; padding:9px 0; border-bottom:1px solid #D3CFC0; font-size:10px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#565A4B">');
      verbatimLine(125, '            <span>Rank</span><span>Submission</span><span>Speaker</span><span>Track</span><span>Score</span><span>Reviews</span><span></span>');
      // DESIGN-RULINGS.md:191 -- the ruling that pins the intended track
      // set as 44px 1fr 150px 130px 92px 92px auto (Rank/Title/Speaker/
      // Track/Score/Reviews/Decision).
      verbatimRulingLine(
        191,
        "Applied to item 27: the expanded reviews band repeats the results table's `44px 1fr 150px 130px 92px 92px auto` grid, so each reviewer's score sits under the Score column and their name under Submission — with the rubric chips on a second line inside the same track.",
      );

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

      // The head labels are the same SEVEN columns, in the same order, but
      // one text label diverges: the frame's second column reads
      // "Submission" (frame :125); the tree's own results-table header
      // reads "Title" (a pre-existing rename, out of this measurement-only
      // lane's scope to fix).
      const table = document.querySelector('table.chq-review-results-table')!;
      const headerLabels = Array.from(table.querySelectorAll('thead th')).map((th) => th.textContent!.trim());
      expect(headerLabels).toEqual(['Rank', 'Title', 'Speaker', 'Track', 'Score', 'Reviews', 'Decision']);

      // review.css's OWN rule text (jsdom applies no stylesheet) -- the
      // per-column widths that carry the ruling's numbers into the tree.
      const css = readFileSync(REVIEW_CSS_FILE, 'utf-8');
      const rankWidth = css.match(/\.chq-review-results-col-rank\s*\{\s*width:\s*(\d+)px;/)?.[1];
      const speakerWidth = css.match(/\.chq-review-results-col-speaker\s*\{\s*width:\s*(\d+)px;/)?.[1];
      const trackWidth = css.match(/\.chq-review-results-col-track\s*\{\s*width:\s*(\d+)px;/)?.[1];
      const scoreWidth = css.match(/\.chq-review-results-col-score\s*\{\s*width:\s*(\d+)px;/)?.[1];
      const reviewsWidth = css.match(/\.chq-review-results-col-reviews\s*\{[\s\S]*?width:\s*(\d+)px;/)?.[1];
      const decisionWidth = css.match(/\.chq-review-results-col-decision\s*\{[\s\S]*?width:\s*(\d+)px;/)?.[1];

      // MATCHES the ruling exactly: Speaker (150), Track (130), Score (92).
      expect(speakerWidth).toBe('150');
      expect(trackWidth).toBe('130');
      expect(scoreWidth).toBe('92');

      // DIVERGES from the ruling's 44/92/auto: Rank is 56 (review.css's own
      // DEC-902 comment: "44 fit RANK only before the shared 16px first-cell
      // inset landed"), Reviews is 210 not 92 (the gate-9 fit for the full
      // "▸ N reviews · M recusals" label), and Decision is a fixed 190px
      // (nowrap) rather than the ruling's `auto` (the gate-9 fit for the
      // Accept/Decline button pair under table-layout:fixed).
      expect(rankWidth).toBe('56');
      expect(rankWidth).not.toBe('44');
      expect(reviewsWidth).toBe('210');
      expect(reviewsWidth).not.toBe('92');
      expect(decisionWidth).toBe('190');

      cleanup();

      // The reviewer-progress band (frame :95-119): "Remind laggards (N)"
      // always renders, "Remind the N not started" only when that
      // population is non-empty -- docs/design/Chautauqua
      // Review.dc.html:97-98.
      verbatimLine(97, '              <a href="#" style="font-size:13px; font-weight:700">Remind laggards (5)</a>');
      verbatimLine(98, '              <a href="#" style="font-size:13px; font-weight:700; color:#565A4B">Remind the 4 not started</a>');
      mockApi({
        [`GET /api/v1/plans/${PLAN_ID}`]: plan(),
        [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([
          { userId: 'u1', email: 'a@example.com', name: 'Reviewer A', assigned: 5, completed: 0, recused: 0, trackName: null },
          { userId: 'u2', email: 'b@example.com', name: 'Reviewer B', assigned: 5, completed: 2, recused: 0, trackName: null },
        ]),
      });
      render(
        <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}/progress`]}>
          <Routes>
            <Route path="/review/plans/:planId/progress" element={<ProgressPanel />} />
          </Routes>
        </MemoryRouter>,
      );
      expect(await screen.findByText('Reviewer A')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Remind laggards \(2\)/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Remind the 1 not started/ })).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------
  // Frame :183 "Reviewer scorecard · /review/plans/:id/submissions/:id"
  // ---------------------------------------------------------------------
  describe('frame :183 "Reviewer scorecard · /review/plans/:id/submissions/:id"', () => {
    it('MATCHES: the rubric-chip anatomy (label/weight/hint/scale) and the header-slot counter portal', async () => {
      // docs/design/Chautauqua Review.dc.html:183 identifies this frame.
      verbatimLine(183, '      <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:19px; font-weight:600">Reviewer scorecard · /review/plans/:id/submissions/:id</span>');
      // docs/design/Chautauqua Review.dc.html:232-233,235,237 -- each
      // criterion is label + weight caption, a hint line, then a row of
      // scale chips.
      verbatimLine(232, '                <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:12px; font-weight:700; letter-spacing:-0.01em">{{ c.label }}</span>');
      verbatimLine(233, '                <span style="font-size:11px; font-weight:600; color:#565A4B; white-space:nowrap">{{ c.weight }}</span>');
      verbatimLine(235, '              <span style="display:block; padding:10px 0 0; font-size:13px; color:#565A4B; line-height:1.5">{{ c.hint }}</span>');
      verbatimLine(237, '                <sc-for list="{{ c.scale }}" as="n" hint-placeholder-count="5">');
      // docs/design/Chautauqua Review.dc.html:192 -- the header-slot counter.
      verbatimLine(192, '          <span style="font-size:13px; color:#565A4B">7 of 18 done</span>');

      const headerSlot = document.createElement('div');
      headerSlot.id = 'chq-header-slot';
      document.body.appendChild(headerSlot);

      mockApi({
        'GET /api/v1/review/plans': listEnvelope([plan()]),
        [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: {
          id: SUBMISSION_ID,
          ref: 'S-010',
          title: 'Your AI Pair Programmer Is Lying to You',
          sessionAnswers: [],
          myEvaluation: undefined,
          criteria: [{ id: 'c1', label: 'Relevance', kind: 'rating', weight: 3, guidance: 'How on-track is this?' }],
        },
        [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: {
          items: [
            { submissionId: 'sub-a', ref: 'S-001', title: 'Rated', ratingsCount: 1, alreadyRatedByMe: true, myScore: 4, format: null },
            { submissionId: 'sub-b', ref: 'S-002', title: 'Unrated', ratingsCount: 0, alreadyRatedByMe: false, myScore: null, format: null },
          ],
          total: 2,
          unscoredTotal: 1,
          page: 1,
          perPage: 200,
          open: true,
          recused: [],
          closeDate: null,
        },
      });

      render(
        <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}/submissions/${SUBMISSION_ID}`]}>
          <Routes>
            <Route path="/review/plans/:planId/submissions/:submissionId" element={<Scorecard />} />
          </Routes>
        </MemoryRouter>,
      );

      expect(await screen.findByRole('heading', { name: 'Your AI Pair Programmer Is Lying to You' })).toBeInTheDocument();

      // Rubric-chip anatomy: one .chq-review-criterion fieldset per
      // criterion, carrying the label, the weight caption, and a
      // role="radiogroup" scale.
      const fieldset = document.querySelector('.chq-review-criterion')!;
      expect(within(fieldset as HTMLElement).getByText('Relevance')).toBeInTheDocument();
      expect(within(fieldset as HTMLElement).getByText(/Weight 3/)).toBeInTheDocument();
      const scaleGroup = within(fieldset as HTMLElement).getByRole('radiogroup');
      expect(within(scaleGroup).getAllByRole('radio').length).toBeGreaterThan(0);

      // Header-slot counter portal: renders "N of M done" inside
      // #chq-header-slot, computed off the SAME queue the phone counter
      // reads (DEC-939).
      await waitFor(() => expect(within(headerSlot).getByText('1 of 2 done')).toBeInTheDocument());
      headerSlot.remove();
    });
  });

  // ---------------------------------------------------------------------
  // Frame :351 "Reviewer queue · /review/plans/:id"
  // ---------------------------------------------------------------------
  describe('frame :351 "Reviewer queue · /review/plans/:id"', () => {
    it('MATCHES: the per-row state vocabulary is exactly SCORED/NOT SCORED/RECUSED, each pairing its own action label', async () => {
      // docs/design/Chautauqua Review.dc.html:351 identifies this frame.
      verbatimLine(351, '      <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:19px; font-weight:600">Reviewer queue · /review/plans/:id</span>');
      // docs/design/Chautauqua Review.dc.html:381-386 -- one row is
      // eyebrow (ref) + state mark + title + meta, then a single action;
      // the mark and the action are driven by the SAME per-row state.
      verbatimLine(387, '              <div style="display:flex; align-items:baseline; gap:12px">');
      verbatimLine(388, '                <span style="font-size:11px; font-weight:800; letter-spacing:0.09em; text-transform:uppercase; color:#565A4B">{{ q.ref }}</span>');
      verbatimLine(389, '                <span style="{{ q.markStyle }}">{{ q.mark }}</span>');

      mockApi({
        [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: {
          items: [
            { submissionId: 'sub-scored', ref: 'S-001', title: 'A Scored Talk', ratingsCount: 1, alreadyRatedByMe: true, myScore: 4.5, format: null },
            { submissionId: 'sub-unscored', ref: 'S-002', title: 'An Unscored Talk', ratingsCount: 0, alreadyRatedByMe: false, myScore: null, format: null },
          ],
          total: 2,
          unscoredTotal: 1,
          page: 1,
          perPage: 200,
          open: true,
          recused: [{ submissionId: 'sub-recused', ref: 'S-003', title: 'A Recused Talk', reason: 'Personal conflict' }],
        },
      });

      render(
        <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}`]}>
          <Routes>
            <Route path="/review/plans/:planId" element={<ReviewerQueue />} />
          </Routes>
        </MemoryRouter>,
      );

      expect(await screen.findByText('A Scored Talk')).toBeInTheDocument();

      // SCORED row: score mark plus a secondary "Change your score" action.
      const scoredRow = screen.getByText('A Scored Talk').closest('li')!;
      expect(within(scoredRow).getByText('SCORED 4.5')).toBeInTheDocument();
      expect(within(scoredRow).getByRole('link', { name: 'Change your score' })).toHaveClass('chq-btn-secondary');

      // NOT SCORED row: no-score mark plus a primary "Score this" action.
      const unscoredRow = screen.getByText('An Unscored Talk').closest('li')!;
      expect(within(unscoredRow).getByText('NOT SCORED')).toBeInTheDocument();
      expect(within(unscoredRow).getByRole('link', { name: 'Score this' })).toHaveClass('chq-btn-primary');

      // RECUSED row: RECUSED mark, action column is the reason (never a
      // live button).
      const recusedRow = screen.getByText('A Recused Talk').closest('li')!;
      expect(within(recusedRow).getByText('RECUSED')).toBeInTheDocument();
      expect(within(recusedRow).getByText('Personal conflict')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------
  // Frame :830 "Your plans · /review"
  // ---------------------------------------------------------------------
  describe('frame :830 "Your plans · /review"', () => {
    it('MATCHES: plan cards each carry exactly ONE action -- Start scoring / Score the next one / Read your scores, never more than one', async () => {
      // docs/design/Chautauqua Review.dc.html:830 identifies this frame.
      verbatimLine(830, '      <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:19px; font-weight:600">Your plans · /review</span>');
      // docs/design/Chautauqua Review.dc.html:847-852 -- one plan row is
      // name+meta / state pill / progress bar / a SINGLE action link.
      verbatimLine(852, '            <div style="display:grid; grid-template-columns:1fr 150px 190px auto; gap:20px; align-items:center; padding:16px 0; border-bottom:1px solid #E1DDCE">');
      verbatimLine(863, '              <a href="#" style="font-size:13px; font-weight:700; white-space:nowrap">{{ p.btn }}</a>');

      mockApi({
        'GET /api/v1/review/plans': listEnvelope([
          plan({ id: 'plan-a', name: 'Track Review A' }),
          plan({ id: 'plan-b', name: 'Track Review B' }),
        ]),
        'GET /api/v1/review/plans/plan-a/queue': {
          items: [{ submissionId: 's1', ref: 'S-001', title: 'T1', ratingsCount: 0, alreadyRatedByMe: false, myScore: null, format: null }],
          total: 5,
          unscoredTotal: 2,
          page: 1,
          perPage: 200,
          open: true,
          recused: [],
          closeDate: null,
        },
        'GET /api/v1/review/plans/plan-b/queue': {
          items: [],
          total: 3,
          unscoredTotal: 3,
          page: 1,
          perPage: 200,
          open: true,
          recused: [],
          closeDate: null,
        },
      });

      render(
        <MemoryRouter initialEntries={['/review']}>
          <Routes>
            <Route path="/review" element={<ReviewerQueue />} />
          </Routes>
        </MemoryRouter>,
      );

      expect(await screen.findByRole('heading', { name: 'Your plans' })).toBeInTheDocument();

      const rows = document.querySelectorAll('.chq-reviewer-plan-row');
      expect(rows.length).toBe(2);
      for (const row of rows) {
        const actions = within(row as HTMLElement).getAllByRole('link', {
          name: /^(Start scoring|Score the next one|Read your scores)$/,
        });
        expect(actions).toHaveLength(1);
      }
    });
  });
});
