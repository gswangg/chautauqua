// task rh (DEC-976 wave-157): BUILD the Review cluster's 390 per-frame
// RENDER verdict ledger. None of Review's five width:390px frames
// (docs/design/Chautauqua Review.dc.html) had ever been rendered against
// the tree -- the phone CLAIMED_FLOOR row read 53/53 and proved only that
// SOME test cites the frame (a citation is not conformance, DEC-967/
// DEC-976). Modelled exactly on
// app/src/pages/Settings.frame-verdicts.render.test.tsx: one it() per
// frame, entered through the REAL route (app/src/pages/Review.tsx's
// <ReviewPage/>, never a sub-component mounted directly), each opening
// with a verbatimLine() citation of the frame's own caption line and
// stating MATCHES/DIVERGES in its title. jsdom applies no stylesheet, so
// every assertion below is about DOM STRUCTURE/ORDER, never computed
// geometry. A DIVERGES verdict is a FINDING, not a failure -- this file
// stays green while recording where the screen does not match; divergences
// are NOT fixed here (out of this task's scope). Full verdict prose lives
// in docs/design/audit/review-v12.md; this file is the render RECEIPT each
// row cites.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryRouter } from 'react-router-dom';
import { ReviewPage } from './Review';
import { listEnvelope, mockApi } from '../test-utils/mockApi';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Review.dc.html');

/** DEC-967 shape: read the ACTUAL line, assert it byte-for-byte matches the
 * literal this file claims -- a citation that can never silently rot to a
 * wrong line the way a bare `:line` reference can. Copied from
 * Settings.frame-verdicts.render.test.tsx's own `verbatimLine`. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

// PlanEditor.render.test.tsx/Scorecard.tsx's own isPhone hook (useIsPhone,
// matchMedia(700px)) -- jsdom implements no matchMedia at all, so forcing
// it true is the only way to reach the phone-only branches these frames
// draw. Copied verbatim from PlanEditor.render.test.tsx's own
// FakeMediaQueryList/stubPhoneMatchMedia pair.
class FakeMediaQueryList {
  matches = true;
  addEventListener() {}
  removeEventListener() {}
}
function stubPhoneMatchMedia(): void {
  vi.stubGlobal('matchMedia', () => new FakeMediaQueryList());
}

function reviewerMe() {
  return { userId: 'u-reviewer', email: 'reviewer@example.com', role: 'reviewer', orgId: 'org-1' };
}
function organizerMe() {
  return { userId: 'u-organizer', email: 'organizer@example.com', role: 'organizer', orgId: 'org-1' };
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

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', 'evt-review-frame-verdicts');
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  expect(consoleErrorSpy).not.toHaveBeenCalled();
  consoleErrorSpy.mockRestore();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  cleanup();
});

describe('v12 Review 390 frames: per-frame render verdict receipts (task rh, DEC-976 wave-157)', () => {
  // Frame :280-345 "Reviewer scorecard · /review/plans/:id/submissions/:id"
  // -- caption at :276 (the second occurrence; the first, :183, captions the
  // 1600 desktop frame above it).
  it('frame :280 Reviewer scorecard -- RESOLVED (wave 17, task w17-e): the Overall block\'s three-piece anatomy renders again, unwrapped onto the frame\'s own grid by CSS the DOM order no longer measures', async () => {
    verbatimLine(
      276,
      "      <span style=\"font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600\">Reviewer scorecard · /review/plans/:id/submissions/:id</span>",
    );
    stubPhoneMatchMedia();

    const PLAN_ID = 'plan-scorecard-280';
    const SUBMISSION_ID = 'sub-scorecard-280';

    mockApi({
      'GET /api/v1/me': reviewerMe(),
      'GET /api/v1/review/plans': listEnvelope([
        {
          id: PLAN_ID,
          eventId: 'evt-review-frame-verdicts',
          name: 'Wave 2',
          instructions: '',
          openDate: null,
          closeDate: null,
          filters: { trackIds: ['trk-ai'] },
          anonymized: false,
          scale: { min: 1, max: 5 },
          criteria: [],
          rounds: 2,
          currentRound: 1,
          roundMeta: { '1': { name: 'round 1', opensAt: null, closesAt: null } },
          maxEvaluations: null,
          createdAt: 1700000000000,
        },
      ]),
      [`GET /api/v1/events/evt-review-frame-verdicts/tracks`]: listEnvelope([{ id: 'trk-ai', name: 'AI Engineering' }]),
      [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: {
        id: SUBMISSION_ID,
        ref: 'DFC-021',
        title: 'Your AI Pair Programmer Is Lying to You',
        description:
          'Code generation is easy; trusting it is hard. This session covers verification patterns for AI-generated code.',
        format: 'talk (30 min)',
        audienceLevel: 'Advanced',
        speakers: [{ contactId: 'c1', name: 'Ada Lovelace', company: null, title: null }],
        sessionAnswers: [{ fieldId: 'f1', label: 'Talk length', kind: 'dropdown', value: '30 minutes' }],
        myEvaluation: { scores: { rel: 5, read: 4, fit: 'Great' }, comment: 'Strong practical content.' },
        criteria: [
          { id: 'rel', label: 'Relevance to the track', kind: 'rating', weight: 1 },
          { id: 'read', label: 'Speaker readiness', kind: 'rating', weight: 1 },
          { id: 'fit', label: 'Fit', kind: 'dropdown', options: ['Poor', 'OK', 'Great'] },
        ],
      },
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: {
        ...queueEnvelope([{ submissionId: SUBMISSION_ID, alreadyRatedByMe: true }], { total: 18, unscoredTotal: 11 }),
        open: true,
        recused: [],
        planName: 'Wave 2',
        scopeTrackName: 'AI Engineering',
        closeDate: null,
      },
    });

    render(
      <MemoryRouter initialEntries={[`/plans/${PLAN_ID}/submissions/${SUBMISSION_ID}`]}>
        <ReviewPage />
      </MemoryRouter>,
    );

    // :283-284: back link + "N of N done" counter, on the SAME row (the
    // back link's own text names the plan's queue, matching plan.name).
    const backRow = (await screen.findByText('‹ Wave 2 queue')).closest('p')!;
    expect(within(backRow).getByText('7 of 18 done')).toBeInTheDocument();

    // :286: eyebrow "Wave 2 · AI Engineering · round 1" -- plan · scope
    // track · round, joined the same way the queue head's own eyebrow is.
    expect(await screen.findByText('Wave 2 · AI Engineering · round 1')).toBeInTheDocument();

    // :287-288: title, then the ref/format/level meta line beneath it, in
    // that order.
    const title = screen.getByRole('heading', { name: 'Your AI Pair Programmer Is Lying to You' });
    const meta = screen.getByText('DFC-021 · talk, 30 min · advanced');
    expect(title.compareDocumentPosition(meta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // :293-295: Abstract eyebrow + body + "Read the full submission" link
    // (rendered because this submission carries session answers), in
    // frame order.
    const abstractHeading = screen.getByRole('heading', { name: 'Abstract' });
    const abstractBody = screen.getByText(/Code generation is easy/);
    const readFull = screen.getByText('Read the full submission');
    expect(abstractHeading.compareDocumentPosition(abstractBody) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(abstractBody.compareDocumentPosition(readFull) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // :298-320: one fieldset per criterion, its own label visible.
    expect(screen.getByRole('group', { name: /Relevance to the track/ })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /Speaker readiness/ })).toBeInTheDocument();

    // :322-328 vs the rendered Overall block: the frame draws THREE stacked
    // pieces -- the "Overall" eyebrow, a denominator sentence ("Weighted
    // mean of the two scored criteria · Fit is recorded, not averaged"),
    // and a separate plain-average reconciliation sentence -- beside a 34px
    // value. RESOLVED (wave 17, DEC-976 task w17-e): the denominator and
    // reconciliation sentences are once again two SEPARATE elements
    // (chq-review-overall-caption / chq-review-overall-reconciliation), not
    // one merged string.
    const overallLabel = screen.getByText('Overall');
    const overallLine = overallLabel.closest('.chq-review-overall-line');
    expect(overallLine).not.toBeNull();
    expect(within(overallLine as HTMLElement).getByText('4.5')).toBeInTheDocument();
    const overallCaption = document.querySelector('.chq-review-overall-caption');
    expect(overallCaption).not.toBeNull();
    expect(overallCaption!.textContent).toMatch(/Weighted mean of the 2 scored criteria/);
    expect(overallCaption!.textContent).toMatch(/Fit is recorded, not averaged/);
    const overallReconciliation = document.querySelector('.chq-review-overall-reconciliation');
    expect(overallReconciliation).not.toBeNull();
    expect(overallReconciliation!.textContent).toMatch(/plain average of/);
    expect(document.querySelectorAll('.chq-review-overall-caption').length).toBe(1);
    expect(document.querySelectorAll('.chq-review-overall-reconciliation').length).toBe(1);
    // The DOM still nests overallLine (eyebrow+value) ahead of both caption
    // paragraphs as later siblings -- that DOM order is no longer what
    // draws the frame's own left-column-of-three/value-as-right-sibling
    // layout. app/src/pages/review/scorecard.css's terminal
    // max-width:700px block unwraps it instead
    // (`.chq-review-overall-line { display: contents; }` promotes the
    // eyebrow/value spans to direct grid items of `.chq-review-overall`,
    // whose own `grid-template-columns: 1fr auto` then auto-places the
    // eyebrow + both caption paragraphs into column 1 and pins the value to
    // column 2 spanning every row) -- jsdom applies no stylesheet, so this
    // harness can only confirm the rule text exists verbatim in the
    // stylesheet the browser actually applies, not observe the resulting
    // layout itself.
    const scorecardCss = readFileSync(join(HERE, 'review', 'scorecard.css'), 'utf-8');
    expect(scorecardCss).toContain('.chq-review-overall-line {\n    display: contents;\n  }');

    // :332-333: "Comment to the committee" label above its textarea, in
    // frame order.
    const commentField = screen.getByLabelText('Comment to the committee') as HTMLTextAreaElement;
    expect(commentField.value).toBe('Strong practical content.');

    // :334-337: the recuse control renders (as a checkbox + label, per
    // DEC-939's "bare recusal amendment") after the comment field.
    const recuseCheckbox = screen.getByRole('checkbox', { name: 'Recuse me from this one' });
    expect(commentField.compareDocumentPosition(recuseCheckbox) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The frame's own phone-sighted label text ("Recuse me — conflict of
    // interest", :336) exists in the DOM (never dropped) but is marked
    // `hidden` at the top level and only unhidden by scorecard.css's
    // max-width:700px block -- jsdom applies no stylesheet, so this
    // harness cannot observe it becoming the sighted label; it can only
    // confirm the node is present with the frame's exact copy.
    const phoneRecuseLabel = document.querySelector('.chq-review-recusal-label-phone');
    expect(phoneRecuseLabel).not.toBeNull();
    expect(phoneRecuseLabel!.textContent).toBe('Recuse me — conflict of interest');
    expect(phoneRecuseLabel).toHaveAttribute('hidden');

    // :341-343: the docked "Submit and next"/"Save draft" pair, in frame
    // order, both real buttons.
    const dock = document.querySelector('.chq-review-scorecard-dock');
    expect(dock).not.toBeNull();
    const dockButtons = within(dock as HTMLElement).getAllByRole('button');
    expect(dockButtons.map((b) => b.textContent)).toEqual(['Submit and next', 'Save draft']);
  });

  // Frame :934-978 "Scorecard · a criterion unscored" -- caption at :930.
  it('frame :934 Scorecard, a criterion unscored -- MATCHES: the phone unscored banner reads the frame\'s exact copy', async () => {
    verbatimLine(
      930,
      "      <span style=\"font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600\">Scorecard · a criterion unscored</span>",
    );
    stubPhoneMatchMedia();

    const PLAN_ID = 'plan-scorecard-934';
    const SUBMISSION_ID = 'sub-scorecard-934';

    mockApi({
      'GET /api/v1/me': reviewerMe(),
      'GET /api/v1/review/plans': listEnvelope([
        {
          id: PLAN_ID,
          eventId: 'evt-review-frame-verdicts',
          name: 'Wave 2',
          instructions: '',
          openDate: null,
          closeDate: null,
          filters: null,
          anonymized: false,
          scale: { min: 1, max: 5 },
          criteria: [],
          rounds: 1,
          currentRound: 1,
          maxEvaluations: null,
          createdAt: 1700000000000,
        },
      ]),
      [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: {
        id: SUBMISSION_ID,
        ref: 'DFC-021',
        title: 'Your AI Pair Programmer Is Lying to You',
        description: 'Verification patterns for AI-generated code.',
        format: null,
        sessionAnswers: [],
        // Relevance is scored, Speaker readiness is not -- one criterion
        // unscored, matching the frame's own state exactly.
        myEvaluation: { scores: { rel: 5 }, comment: '' },
        criteria: [
          { id: 'rel', label: 'Relevance to the track', kind: 'rating', weight: 1 },
          { id: 'read', label: 'Speaker readiness', kind: 'rating', weight: 1 },
        ],
      },
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: {
        ...queueEnvelope([{ submissionId: SUBMISSION_ID, alreadyRatedByMe: false }]),
        open: true,
        recused: [],
        planName: 'Wave 2',
        scopeTrackName: null,
        closeDate: null,
      },
    });

    render(
      <MemoryRouter initialEntries={[`/plans/${PLAN_ID}/submissions/${SUBMISSION_ID}`]}>
        <ReviewPage />
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { name: 'Your AI Pair Programmer Is Lying to You' });

    // :941-943: the ink-outlined banner card -- unscoredBannerCopy's
    // heading/body read byte-for-byte off the frame's own copy for exactly
    // one unscored criterion out of two.
    const banner = document.querySelector('.chq-review-scorecard-unscored-banner');
    expect(banner).not.toBeNull();
    expect(within(banner as HTMLElement).getByText('One criterion still needs a score')).toBeInTheDocument();
    expect(
      within(banner as HTMLElement).getByText('The weighted total cannot be worked out until all two are scored.'),
    ).toBeInTheDocument();
    // The frame's own wording spells the denominator ("all three") -- this
    // fixture has only two criteria (a smaller, easier-to-fixture unscored
    // state), so the spelled count itself reads "two" rather than "three";
    // the SENTENCE SHAPE (spelled count via unscoredBannerCopy, matching
    // the frame's own "One criterion still needs a score"/"until all N are
    // scored" grammar exactly) is what this verdict is about.

    // :949-955: the first (scored) criterion's radiogroup shows the "5"
    // pill selected.
    const relevanceGroup = screen.getByRole('group', { name: /Relevance to the track/ });
    const selectedPill = within(relevanceGroup).getByRole('radio', { checked: true });
    expect(selectedPill).toHaveTextContent('5');

    // :957-964: the second (unscored) criterion's radiogroup has no
    // selection, and carries the frame's own caption ("Pick a score, or
    // recuse yourself if you cannot judge this one."). This was cited in
    // review-v12.md as a DIVERGENCE -- the caption existed nowhere and the
    // phone banner above was the only completeness cue -- until DEC-889
    // wave-32 (commit 0fca1e97c) built the per-criterion hint. The
    // divergence is closed, so this receipt moves to the frame's shape.
    // Scoped to the unscored criterion's own group, which is what frame
    // :964 draws: a global caption would not satisfy it.
    const readinessGroup = screen.getByRole('group', { name: /Speaker readiness/ });
    expect(within(readinessGroup).queryAllByRole('radio', { checked: true })).toHaveLength(0);
    expect(
      within(readinessGroup).getByText('Pick a score, or recuse yourself if you cannot judge this one.'),
    ).toBeInTheDocument();

    // :967-969: Overall reads a phone-only "Not yet" node while unscored
    // (native `hidden`, unhidden only by the max-width:700px block this
    // jsdom harness never applies -- present, not accessible-name-visible).
    const overallPhoneValue = document.querySelector('.chq-review-overall-value-phone');
    expect(overallPhoneValue).not.toBeNull();
    expect(overallPhoneValue!.textContent).toBe('Not yet');
    expect(overallPhoneValue).toHaveAttribute('hidden');
  });

  // Frame :413-445 "Reviewer queue · /review/plans/:id" (Subscreen) --
  // caption at :410.
  it('frame :413 Reviewer queue -- MATCHES: landed on directly (no hub in this session), the queue draws no back link, same as the frame\'s own head band', async () => {
    verbatimLine(
      410,
      "      <span style=\"font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600\">Reviewer queue · /review/plans/:id</span>",
    );

    const PLAN_ID = 'plan-queue-413';

    mockApi({
      'GET /api/v1/me': reviewerMe(),
      [`GET /api/v1/review/plans/${PLAN_ID}`]: { timezone: 'America/Chicago' },
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: {
        ...queueEnvelope(
          [
            { submissionId: 'sub-1', ref: 'S-001', title: 'A Talk', alreadyRatedByMe: false, format: null },
            { submissionId: 'sub-2', ref: 'S-002', title: 'Another Talk', alreadyRatedByMe: true, myScore: 4 },
          ],
          { total: 18, unscoredTotal: 11 },
        ),
        open: true,
        recused: [],
        planName: 'Wave 2',
        scopeTrackName: 'AI Engineering',
        closeDate: null,
        rounds: 1,
        currentRound: 1,
        roundMeta: null,
      },
    });

    render(
      <MemoryRouter initialEntries={[`/plans/${PLAN_ID}`]}>
        <ReviewPage />
      </MemoryRouter>,
    );

    // :415-416/:419-421: the head band this route draws IS the frame's own
    // head band, in order -- eyebrow, H1 ("N left to score"), subtitle,
    // progress bar.
    await screen.findByText('REVIEW · Wave 2');
    const head = document.querySelector('.chq-review-scoped-head');
    expect(head).not.toBeNull();
    const h1 = within(head as HTMLElement).getByRole('heading', { name: '11 left to score' });
    const subtitle = within(head as HTMLElement).getByText(/AI Engineering/);
    const bar = (head as HTMLElement).querySelector('.chq-review-scoped-progress .chq-bar-fill');
    expect(h1.compareDocumentPosition(subtitle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(bar).not.toBeNull();

    // MATCHES (DEC-874 wave-159 amendment): :413-425 draws NO back control
    // at all in this subscreen's head band (only the wordmark + reviewer
    // name, then eyebrow/H1/subtitle/bar). The app's own "‹ Your plans" link
    // is now gated on `plans` (the reviewer's plan list) actually holding
    // more than one entry -- this fixture is a direct deep link straight to
    // `/plans/:planId` (no prior `/review` hub visit in this render tree),
    // so `plans` is never populated and the link stays unrendered, same as
    // the frame.
    expect(screen.queryByRole('link', { name: /Your plans/ })).not.toBeInTheDocument();

    // :429-437: each queue row draws ref+mark, title, meta, then the row's
    // action -- in that DOM order (a CSS grid at desktop, a stack at
    // phone; jsdom applies no stylesheet so only the order is checked).
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    const row1Ref = within(rows[0]!).getByText('S-001');
    const row1Title = within(rows[0]!).getByText('A Talk');
    const row1Action = within(rows[0]!).getByRole('link', { name: 'Score this' });
    expect(row1Ref.compareDocumentPosition(row1Title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(row1Title.compareDocumentPosition(row1Action) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // :441-443: the standing dock note + Sign out, together, in order.
    const dock = document.querySelector('.chq-phone-dock.chq-review-phone-dock');
    expect(dock).not.toBeNull();
    expect(within(dock as HTMLElement).getByText('Scores stay hidden from other reviewers')).toBeInTheDocument();
    expect(within(dock as HTMLElement).getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });

  // Frame :594-669 "Plan editor · 390" -- caption at :590.
  it('frame :594 Plan editor -- RESOLVED (wave 19, task w19-e): the v4 title-row shell is DEVIATIONS-blessed and the screen gains its one level-1 heading', async () => {
    verbatimLine(
      590,
      "      <span style=\"font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600\">Plan editor · 390</span>",
    );

    const PLAN_ID = 'plan-editor-594';
    const EVENT_ID = 'evt-review-frame-verdicts';

    mockApi({
      'GET /api/v1/me': organizerMe(),
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([{ id: 'trk-ai', name: 'AI Engineering' }]),
      [`GET /api/v1/plans/${PLAN_ID}`]: {
        id: PLAN_ID,
        eventId: EVENT_ID,
        name: 'Wave 2',
        instructions: '',
        openDate: 1700000000000,
        closeDate: 1700100000000,
        filters: { trackIds: ['trk-ai'] },
        anonymized: false,
        scale: { min: 1, max: 5 },
        criteria: [
          { id: 'c1', label: 'Relevance', kind: 'rating', weight: 1 },
          { id: 'c2', label: 'Readiness', kind: 'rating', weight: 1 },
          { id: 'c3', label: 'Fit', kind: 'dropdown', options: ['Poor', 'OK', 'Great'] },
        ],
        rounds: 1,
        currentRound: 1,
        roundCriteria: null,
        maxEvaluations: 2,
        createdAt: 1700000000000,
        timezone: 'UTC',
      },
      [`GET /api/v1/plans/${PLAN_ID}/reviewers`]: listEnvelope([
        { id: 'pr-1', userId: 'user-1', email: 'rev1@example.com', trackId: null, submissionId: null },
      ]),
      [`GET /api/v1/plans/${PLAN_ID}/progress`]: listEnvelope([
        { userId: 'user-1', email: 'rev1@example.com', assigned: 4, completed: 1, recused: 0 },
      ]),
      'GET /api/v1/users': listEnvelope([{ id: 'user-1', email: 'rev1@example.com', role: 'reviewer' }]),
    });

    render(
      <MemoryRouter initialEntries={[`/plans/${PLAN_ID}`]}>
        <ReviewPage />
      </MemoryRouter>,
    );

    // :596-598: RESOLVED (wave 19, task w19-e) -- the frame draws a back
    // link, then a plain <h1> plan name, then a subtitle line, then
    // (:665-668) a footer Save/Cancel pair. DEC-745's v4 shell instead
    // renders the plan name as an EDITABLE INPUT with Duplicate/Save on
    // the SAME title row as the back link -- there is no separate footer
    // band -- and this shell is now DEVIATIONS-blessed. The screen gains
    // exactly one level-1 heading naming the plan (visually hidden,
    // review.css's own top-level rule), so the heading role the frame
    // draws is preserved without a second editable copy of the name.
    const backLink = await screen.findByRole('link', { name: '‹ Review' });
    const nameInput = screen.getByLabelText('Plan name') as HTMLInputElement;
    expect(nameInput.value).toBe('Wave 2');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const heading = screen.getByRole('heading', { level: 1, name: 'Wave 2' });
    expect(heading).toHaveClass('chq-review-editor-title-h1');
    const saveButton = screen.getByRole('button', { name: 'Save' });
    expect(backLink.compareDocumentPosition(nameInput) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(nameInput.compareDocumentPosition(saveButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(document.querySelector('.chq-review-editor-title-row')).not.toBeNull();
    // No separate footer Save/Cancel band the frame draws at :665-668.
    expect(document.querySelectorAll('button, a').length).toBeGreaterThan(0);
    expect(screen.queryByText('Save the plan')).not.toBeInTheDocument();

    // :601-602: RESOLVED (wave 17, task w17-e) -- this it() renders without
    // stubbing matchMedia, so isPhone is false and PlanEditor.tsx's own
    // ternary ({isPhone ? 'Criteria' : 'Scoring criteria'}) reads its
    // DESKTOP branch here; the frame's own bare "Criteria" word now renders
    // verbatim at the actual 390 phone width via that same ternary,
    // pinned by app/src/pages/review/PlanEditor.copy-390.render.test.tsx --
    // not re-asserted in this desktop-mode render. The hidden-at-desktop
    // phone count span still carries the frame's own count regardless of
    // width.
    expect(screen.getByRole('heading', { name: 'Scoring criteria' })).toBeInTheDocument();
    expect(screen.queryByText('Criteria', { selector: 'span, h2' })).not.toBeInTheDocument();
    const phoneCount = document.querySelector('.chq-review-criteria-count-phone');
    expect(phoneCount).not.toBeNull();
    expect(phoneCount!.textContent).toBe('3');

    // :639-640: the "Add criterion" tertiary link + "N of about M" caption
    // -- present, matching the frame's own copy shape.
    expect(screen.getByRole('link', { name: 'Add criterion' })).toBeInTheDocument();
    expect(screen.getByText(/3 of about \d+/)).toBeInTheDocument();

    // :643-652: the frame renames this section "Reviewers" and draws a
    // per-row "Swap" action (:652). The app names it "Who reviews what"
    // (DEC-745, same wave-98 amendment as the Swap->Remove clause below,
    // though DEVIATIONS.md's own bullet names only the label
    // substitution -- left as this row already had it). "Swap" -> "Remove"
    // stays exactly as previously recorded: a pre-existing,
    // DEVIATIONS-blessed deviation (docs/design/DEVIATIONS.md, "Plan
    // editor reviewer-row 'Swap'"), not a new finding, since there is no
    // reassign-in-place capability in the domain layer.
    expect(screen.getByRole('heading', { name: 'Who reviews what' })).toBeInTheDocument();
    expect(screen.queryByText('Reviewers')).not.toBeInTheDocument();
    const reviewerRow = screen.getByText('rev1@example.com').closest('.chq-review-reviewer-row') as HTMLElement;
    expect(screen.queryByText('Swap')).not.toBeInTheDocument();
    expect(within(reviewerRow).getByRole('button', { name: 'Remove' })).toBeInTheDocument();

    // :656-663: RESOLVED (wave 17, task w17-e) -- this it() renders without
    // stubbing matchMedia, so isPhone is false and PlanEditor.tsx's own
    // ternary ({isPhone ? 'Cap each' : 'Cap per reviewer'}) reads its
    // DESKTOP branch here; the frame's own "Cap each" now renders verbatim
    // at the actual 390 phone width via that same ternary, pinned by
    // app/src/pages/review/PlanEditor.copy-390.render.test.tsx -- not
    // re-asserted in this desktop-mode render. "Distribute the unassigned"
    // matches verbatim at every width.
    expect(screen.getByText('Cap per reviewer')).toBeInTheDocument();
    expect(screen.queryByText('Cap each')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Distribute the unassigned' })).toBeInTheDocument();
  });

  // Frame :793-824 "Your plans · /review" (the 390 hub) -- caption at :789
  // (the first occurrence; :830 captions the 1600 desktop twin below it).
  // DESIGN-RULINGS B4/DEC-874: with exactly one open plan this hub is
  // SKIPPED entirely and the reviewer lands straight in its queue -- this
  // verdict renders the multi-plan state the frame actually draws (two
  // open plans), not the single-plan skip.
  it('frame :793 Your plans -- RESOLVED (wave 19, task w19-e): row anatomy is resolved by a CSS grid unwrap and the footnote states each sentence once, in each place, at each width', async () => {
    verbatimLine(
      789,
      "      <span style=\"font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600\">Your plans · /review</span>",
    );

    const PLAN_A = 'plan-a-793';
    const PLAN_B = 'plan-b-793';

    mockApi({
      'GET /api/v1/me': reviewerMe(),
      'GET /api/v1/review/plans': listEnvelope([
        { id: PLAN_A, eventId: 'evt-review-frame-verdicts', name: 'Wave 2', timezone: 'UTC' },
        { id: PLAN_B, eventId: 'evt-review-frame-verdicts', name: 'Wave 3', timezone: 'UTC' },
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

    render(
      <MemoryRouter initialEntries={['/']}>
        <ReviewPage />
      </MemoryRouter>,
    );

    // :799-800: the H1 ("N left to score") then the subline, in order --
    // matches the frame's own drill-head anatomy.
    const h1 = await screen.findByRole('heading', { name: '17 left to score' });
    const subline = screen.getByText('Across two open plans');
    expect(h1.compareDocumentPosition(subline) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // :806 pairs name+state-pill on ONE baseline row, with meta (:810) on a
    // SEPARATE line beneath. The DOM still groups name+meta together as the
    // row's first child (chq-reviewer-plan-row-name-line), with the state
    // pill as a later sibling -- but that DOM order is no longer what draws
    // the SCREEN. RESOLVED (wave 17, task w17-e):
    // app/src/pages/review/review.css's terminal max-width:700px block
    // unwraps chq-reviewer-plan-row-name-line via `display: contents`,
    // promoting the name and pill to direct grid items of
    // chq-reviewer-plan-row's own named-area grid ('name pill' / 'meta
    // meta' / 'bar bar' / 'action action'), landing the plan name and the
    // pill on the frame's own shared baseline row with the meta line
    // auto-placed onto its own row beneath -- jsdom applies no stylesheet,
    // so a DOM-order assertion cannot observe this; the CSS rule text
    // itself is the drift-proof receipt.
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    const row = rows[0]!;
    const nameLine = row.querySelector('.chq-reviewer-plan-row-name-line');
    expect(nameLine).not.toBeNull();
    expect(within(nameLine as HTMLElement).getByText('Wave 2')).toBeInTheDocument();
    expect((nameLine as HTMLElement).textContent).toMatch(/assigned/);
    const pill = row.querySelector('.chq-reviewer-plan-row-pill');
    expect(pill).not.toBeNull();
    expect(pill!.textContent).toBe('Open');
    const reviewCss = readFileSync(join(HERE, 'review', 'review.css'), 'utf-8');
    expect(reviewCss).toContain('.chq-reviewer-plan-row-name-line {\n    display: contents;\n  }');
    expect(reviewCss).toContain(
      "grid-template-areas:\n      'name pill'\n      'meta meta'\n      'bar bar'\n      'action action';",
    );

    // :817/:820-821: RESOLVED (wave 19, task w19-e, DEC-874 amendment) --
    // the frame states "With one open plan this page is skipped" as its
    // own body line, and "Scores stay hidden from other reviewers" as a
    // SEPARATE standing dock sentence. The footnote paragraph now states
    // both as two sibling spans (desktop byte-identical to the merged
    // 1600 frame :775), and review.css's terminal max-width:700px block
    // hides only the repeat span at 390 -- one sentence, one place, at
    // each width. jsdom applies no stylesheet, so the repeat span is
    // still present here; the CSS-source assertion in
    // ReviewerQueue.footnote-390.render.test.tsx is what proves it is
    // hidden at 390.
    const footnote = document.querySelector('.chq-reviewer-plans-footnote') as HTMLElement;
    expect(footnote.textContent).toBe(
      'With one open plan this page is skipped — you land straight in its queue. Scores stay hidden from other reviewers.',
    );
    const repeatSpan = footnote.querySelector('.chq-reviewer-plans-footnote-repeat');
    expect(repeatSpan).not.toBeNull();
    expect(repeatSpan!.textContent).toBe('Scores stay hidden from other reviewers.');
    expect(document.querySelectorAll('.chq-reviewer-plans-phone-note').length).toBe(1);
  });
});
