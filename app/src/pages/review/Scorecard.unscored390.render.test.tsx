// v12 design pack -- FIRST markup-level verdict for
// docs/design/Chautauqua Review.dc.html:934-979 ("Scorecard · a criterion
// unscored"), task w29-c (DEC-976, DEC-967, DEC-385, DEC-874).
//
// docs/design/audit/review-v12.md already carries a "MATCHES" row for this
// frame (task rh, wave-157), but its only receipt --
// app/src/pages/Review.frame-verdicts.render.test.tsx -- cites line :930
// (the caption line ABOVE the frame's own 934-979 span), never a line
// STRICTLY inside it, and never checked the "Speaker readiness" criterion's
// own recuse-hint caption (:964) at all. Per DEC-976 a citation outside the
// frame's own extent is not a receipt for that frame, so this file is the
// first markup-level verdict actually anchored inside :934-979. A new
// section is appended to review-v12.md recording what this file finds
// (including one real divergence the earlier row never surfaced) -- the
// earlier row is left untouched, never edited, per this task's contract.
//
// HARNESS: mounts app/src/pages/review/Scorecard.tsx directly through
// react-router (mirrors Scorecard.overall-390.render.test.tsx), seeded so
// exactly one of three rating criteria is unscored -- the frame's own
// state (":942 One criterion still needs a score" / ":943 ...until all
// three are scored."), never a fully-scored mount, which verdicts a
// different screen. matchMedia is stubbed phone-true (mirrors
// Review.frame-verdicts.render.test.tsx's stubPhoneMatchMedia) since the
// unscored banner and the docked actions only mount when useIsPhone()
// reads true.
//
// DEC-874 (wave-29): Scorecard.tsx spells both dock labels TWICE -- once
// in the desktop `.chq-review-editor-actions` block (mounted only when
// !isPhone, so it does not mount here) and once in the phone
// `.chq-review-scorecard-dock` block. Every dock query below is still
// scoped to `.chq-review-scorecard-dock` and asserts the scoped COUNT is
// exactly one per label, never a bare screen.getByRole.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Scorecard } from './Scorecard';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';
import { stripCssComments } from '../../../../test/helpers/strip-css-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const DESIGN_FILE = join(HERE, '../../../../docs/design/Chautauqua Review.dc.html');

/** Copied verbatim from app/src/pages/review/Scorecard.overall-390.render.test.tsx
 * (itself citing Settings.frame-verdicts.render.test.tsx's own `verbatimLine`). */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

// FakeMediaQueryList/stubPhoneMatchMedia pair, copied verbatim from
// app/src/pages/Review.frame-verdicts.render.test.tsx.
class FakeMediaQueryList {
  matches = true;
  addEventListener() {}
  removeEventListener() {}
}
function stubPhoneMatchMedia(): void {
  vi.stubGlobal('matchMedia', () => new FakeMediaQueryList());
}

const REVIEW_CSS = stripCssComments(readFileSync(join(HERE, 'review.css'), 'utf-8'));

/** Mirrors scorecard-phone-frames.test.ts's phoneLayer: brace-matched
 * concatenation of every `@media (max-width: …)` block's body. */
function phoneLayer(css: string): string {
  const out: string[] = [];
  const opener = /@media\s*\(max-width:\s*\d+px\)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = opener.exec(css)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') depth -= 1;
      i += 1;
    }
    if (depth !== 0) throw new Error('unbalanced @media block');
    out.push(css.slice(start, i - 1));
  }
  if (out.length === 0) throw new Error('no max-width media block found');
  return out.join('\n');
}

/** A single rule's declaration body, by selector, inside the phone layer --
 * selectors matched as WHOLE members of the rule's comma-separated
 * selector list, never by substring (mirrors scorecard-phone-frames.
 * test.ts's phoneRule). */
function phoneRule(css: string, selector: string): string {
  const layer = phoneLayer(css);
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = rule.exec(layer)) !== null) {
    const selectors = m[1]!
      .split(',')
      .map((s) => s.trim().replace(/\s+/g, ' '))
      .filter(Boolean);
    if (selectors.includes(selector)) return m[2]!;
  }
  throw new Error(`no phone rule for ${selector}`);
}

const PLAN_ID = 'plan-unscored-390';
const SUBMISSION_ID = 'sub-unscored-390';

function plan() {
  return {
    id: PLAN_ID,
    eventId: 'evt-unscored-390',
    // The frame's own back-link literal is "‹ Wave 2 queue" (:936) --
    // Scorecard.tsx composes it as `&lsaquo; {plan.name} queue`, so the
    // plan name is the frame's own literal fixture, not a placeholder.
    name: 'Wave 2',
    instructions: '',
    openDate: null,
    closeDate: null,
    filters: null,
    anonymized: false,
    scale: { min: 1, max: 5 },
    criteria: criteria(),
    rounds: 1,
    currentRound: 1,
    maxEvaluations: null,
    createdAt: 1700000000000,
  };
}

// Three rating criteria -- the frame's own state (:942/:943): exactly one
// unscored, "until all three are scored." The frame's viewport only draws
// two criterion cards (Relevance to the track :947, Speaker readiness
// :958) before the fold; the third exists only so the banner's own
// spelled-out denominator ("three") matches the frame's literal copy
// exactly, per this task's HARNESS instruction.
function criteria() {
  return [
    { id: 'c1', label: 'Relevance to the track', kind: 'rating' as const, weight: 1 },
    { id: 'c2', label: 'Speaker readiness', kind: 'rating' as const, weight: 1 },
    { id: 'c3', label: 'Audience fit', kind: 'rating' as const, weight: 1 },
  ];
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

function mountUnscored() {
  stubPhoneMatchMedia();
  mockApi({
    'GET /api/v1/review/plans': listEnvelope([plan()]),
    [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: {
      id: SUBMISSION_ID,
      ref: 'S-390',
      title: 'Your AI Pair Programmer Is Lying to You',
      sessionAnswers: [],
      // c1 and c3 scored, c2 ("Speaker readiness") left unscored -- exactly
      // one criterion of three, matching the frame's own state.
      myEvaluation: { scores: { c1: 5, c3: 4 }, comment: '' },
      criteria: criteria(),
    },
  });

  return render(
    <MemoryRouter initialEntries={[`/review/plans/${PLAN_ID}/submissions/${SUBMISSION_ID}`]}>
      <Routes>
        <Route path="/review/plans/:planId/submissions/:submissionId" element={<Scorecard />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('frame :934-979 "Scorecard · a criterion unscored" -- first markup-level verdict (task w29-c)', () => {
  it(':936/:937 the phone head band draws the plan-scoped back link then the submission title', async () => {
    // w16-qi (DEC-998): pay for this file's header-block scope citation
    // into docs/design/Chautauqua Review.dc.html (the file-header comment
    // at :2) with a non-header, fully-receipted citation of the same
    // frame -- backtick quote right here plus the `verbatimLine` call
    // immediately below it, which itself asserts `expect(...).toBe(...)`.
    // docs/design/Chautauqua Review.dc.html:936 `        <a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Wave 2 queue</a>`
    verbatimLine(936, '        <a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Wave 2 queue</a>');
    verbatimLine(
      937,
      '        <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:20px; font-weight:600; letter-spacing:-0.025em; line-height:1.25">Your AI Pair Programmer Is Lying to You</span>',
    );

    mountUnscored();

    expect(await screen.findByRole('heading', { name: 'Your AI Pair Programmer Is Lying to You' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '‹ Wave 2 queue' })).toBeInTheDocument();
  });

  // docs/design/Chautauqua Review.dc.html:942 `          <span style="font-size:14px; font-weight:700; line-height:1.4">One criterion still needs a score</span>`
  // -- a fully-receipted in-body citation paying for the :934-979
  // header-block scope declared above (DEC-808): the `verbatimLine(942, ...)`
  // call two lines below reads the design file itself and fails this
  // OWNING test if the frame is re-cut, which the comment quote alone
  // cannot do (DEC-976 wave-107 helper-credit shape).
  it(':942/:943 the unscored refusal band renders both the heading and the explanation sentence, byte-for-byte off the frame\'s own copy', async () => {
    verbatimLine(942, '          <span style="font-size:14px; font-weight:700; line-height:1.4">One criterion still needs a score</span>');
    verbatimLine(
      943,
      '          <span style="font-size:13px; line-height:1.55; color:#3F4237">The weighted total cannot be worked out until all three are scored.</span>',
    );

    mountUnscored();
    await screen.findByRole('heading', { name: 'Your AI Pair Programmer Is Lying to You' });

    const banner = document.querySelector('.chq-review-scorecard-unscored-banner');
    expect(banner).not.toBeNull();
    expect(within(banner as HTMLElement).getByText('One criterion still needs a score')).toBeInTheDocument();
    expect(
      within(banner as HTMLElement).getByText('The weighted total cannot be worked out until all three are scored.'),
    ).toBeInTheDocument();
  });

  it(':947-953 the scored "Relevance to the track" criterion exposes five score controls with the fixture value selected', async () => {
    verbatimLine(947, '          <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:16px; font-weight:600">Relevance to the track</span>');

    mountUnscored();
    await screen.findByRole('heading', { name: 'Your AI Pair Programmer Is Lying to You' });

    const relevanceGroup = screen.getByRole('group', { name: /Relevance to the track/ });
    const pills = within(relevanceGroup).getAllByRole('radio');
    expect(pills).toHaveLength(5);
    const selected = within(relevanceGroup).getByRole('radio', { checked: true });
    expect(selected).toHaveTextContent('5');
  });

  it(':958-964 the unscored "Speaker readiness" criterion exposes five score controls, none selected, and carries the frame\'s own recuse hint (:964) -- the w29-c divergence, since CLOSED by DEC-889 wave-32', async () => {
    verbatimLine(958, '          <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:16px; font-weight:600">Speaker readiness</span>');
    verbatimLine(
      964,
      '          <span style="font-size:13px; font-weight:600; line-height:1.5; color:#1B1D17">Pick a score, or recuse yourself if you cannot judge this one.</span>',
    );

    mountUnscored();
    await screen.findByRole('heading', { name: 'Your AI Pair Programmer Is Lying to You' });

    const readinessGroup = screen.getByRole('group', { name: /Speaker readiness/ });
    const pills = within(readinessGroup).getAllByRole('radio');
    expect(pills).toHaveLength(5);
    expect(within(readinessGroup).queryAllByRole('radio', { checked: true })).toHaveLength(0);

    // w29-c recorded this as a DIVERGENCE (Scorecard.tsx rendered the
    // sentence nowhere -- not per-criterion, not as a global caption) and
    // left it as a finding rather than a fix, the task's budget being
    // CSS-only. DEC-889 wave-32 then BUILT it (commit 0fca1e97c, "review:
    // build the per-criterion recuse hint at Review 390"), so the
    // divergence is closed and the old `not.toBeInTheDocument()` is a
    // stale receipt. It moves to the frame's shape rather than being
    // deleted: the same line :964 the frame draws is now asserted PRESENT,
    // and scoped to this unscored criterion's own fieldset so a global
    // caption (which the frame does not draw) would still fail.
    //
    // Deliberately NOT a duplicate of Scorecard.recuseHint390.render.test.
    // tsx: that file owns the hint's own contract (exactly one node, the
    // hidden attribute, zero nodes in scored fieldsets, the terminal
    // phone-block CSS register). This one only re-verdicts frame
    // :934-979's markup in the unscored state, which is what it is for.
    const HINT_TEXT = 'Pick a score, or recuse yourself if you cannot judge this one.';
    expect(within(readinessGroup).getByText(HINT_TEXT)).toBeInTheDocument();
  });

  it(':967-969 Overall reads the phone "Not yet" node, reached in this exact unscored state (not merely present in source)', async () => {
    verbatimLine(968, '          <span style="font-size:11px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#565A4B">Overall</span>');
    verbatimLine(969, '          <span style="font-size:14px; font-weight:600; color:#565A4B">Not yet</span>');

    mountUnscored();
    await screen.findByRole('heading', { name: 'Your AI Pair Programmer Is Lying to You' });

    const overallPhoneValue = document.querySelector('.chq-review-overall-value-phone');
    expect(overallPhoneValue).not.toBeNull();
    expect(overallPhoneValue!.textContent).toBe('Not yet');
    // Present in the DOM behind a native `hidden` attribute (jsdom applies
    // no stylesheet, so the terminal max-width:700px unhide never fires
    // here) -- same idiom the wave-17 :280 row already documents; not a
    // divergence, an unverifiable-in-jsdom limit.
    expect(overallPhoneValue).toHaveAttribute('hidden');
  });

  it(':974/:975 the dock renders exactly one "Submit and next" then one "Save draft", scoped to the phone dock container (DEC-874)', async () => {
    verbatimLine(
      974,
      '        <span style="flex:1; background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:46px; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700">Submit and next</span>',
    );
    verbatimLine(
      975,
      '        <span style="border:1px solid #BAB6A6; border-radius:6px; min-height:46px; display:flex; align-items:center; padding:0 16px; font-size:13px; font-weight:600">Save draft</span>',
    );

    mountUnscored();
    await screen.findByRole('heading', { name: 'Your AI Pair Programmer Is Lying to You' });

    const dock = document.querySelector('.chq-review-scorecard-dock');
    expect(dock).not.toBeNull();

    // DEC-874: Scorecard.tsx spells both labels a second time in the
    // desktop `.chq-review-editor-actions` block, which the `!isPhone`
    // guard keeps out of this mount entirely -- but every query here is
    // still scoped to the dock container, never a bare screen.getByRole,
    // so this receipt does not depend on that guard alone.
    const submitButtons = within(dock as HTMLElement).getAllByRole('button', { name: 'Submit and next' });
    const saveButtons = within(dock as HTMLElement).getAllByRole('button', { name: 'Save draft' });
    expect(submitButtons).toHaveLength(1);
    expect(saveButtons).toHaveLength(1);

    const dockButtons = within(dock as HTMLElement).getAllByRole('button');
    expect(dockButtons).toHaveLength(2);
    expect(dockButtons[0]).toHaveTextContent('Submit and next');
    expect(dockButtons[1]).toHaveTextContent('Save draft');
  });
});

describe('frame :988/:989 (dc-script SCORE_ON/SCORE_OFF) -- the score-button 44px floor at 390', () => {
  it('the score pills meet the 44px floor at <=700px -- the rule lives in review.css\'s own terminal phone block (not scorecard.css, which restates only radius/type-size for this selector), pinned read-only since review.css is owned by w29-e this wave', () => {
    verbatimLine(
      988,
      "const SCORE_ON = 'flex:1; min-height:44px; display:flex; align-items:center; justify-content:center; background:#4E5C31; color:#F7F9F0; border-radius:6px; font-family:\\'Familjen Grotesk\\', sans-serif; font-size:16px; font-weight:700';",
    );
    verbatimLine(
      989,
      "const SCORE_OFF = 'flex:1; min-height:44px; display:flex; align-items:center; justify-content:center; border:1px solid #BAB6A6; border-radius:6px; font-family:\\'Familjen Grotesk\\', sans-serif; font-size:16px; font-weight:600; color:#3F4237';",
    );

    const rule = phoneRule(REVIEW_CSS, '.chq-review-rating-btn');
    // The frame's own script constants declare min-height:44px; the shipped
    // rule declares a fixed height:44px for the same selector -- both
    // forbid the control from ever reading below the 44px floor, so this
    // matches the SCORE_ON/SCORE_OFF floor exactly (never a sub-44px
    // authored min-height).
    expect(rule).toMatch(/(?:min-)?height:\s*44px/);
  });
});
