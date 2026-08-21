// w31-i (DEC-976 wave-31): the frame's FIRST markup-level verdict for
// "Reviewer scorecard · 390" (docs/design/Chautauqua Review.dc.html:280-345,
// caption ":280-350" -- "Reviewers only ever see this"). Until this file,
// the frame's only citers were scorecard-phone-frames.test.ts (CSS TEXT
// pins over scorecard.css / Scorecard.tsx source) plus product source
// itself -- 14 of 21 drawn literals asserted. This file renders the REAL
// /review/plans/:id/submissions/:id route the exact way
// Scorecard.render.test.tsx does -- copied verbatim, never a second mock
// stack (DEC-663) -- with a stubbed phone matchMedia (the pattern
// app/src/pages/contacts/DirectoryRail.phone390.render.test.tsx already
// uses) so Scorecard.tsx's own isPhone-gated branches are the ones that
// mount.
//
// DEC-967 wave-31: structural copy is graded by LITERAL; the frame's own
// sample data (submission titles, abstract prose, plan/track/round names,
// weight percentages) is graded by SHAPE only, never pinned to the frame's
// own strings ("Your AI Pair Programmer Is Lying to You", "7 of 18 done").
//
// Frame :934-1138 ("Scorecard · a criterion unscored") is a DIFFERENT
// frame owned by Scorecard.unscored390.render.test.tsx (v12m-w29-c) --
// this file never touches it and never re-verdicts it.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Scorecard } from './Scorecard';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Review.dc.html');

/** DEC-976: a citation that can never silently rot to a wrong line -- read
 * the ACTUAL design-file line and assert it byte-for-byte matches the
 * literal this file claims. Mirrors MergePage.frame390.render.test.tsx's
 * own `verbatimLine` (v12m-w29-a). */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

// Mirrors DirectoryRail.phone390.render.test.tsx's own stub -- jsdom has no
// matchMedia; useIsPhone (app/src/lib/useIsPhone.ts) reads `.matches` off
// whatever window.matchMedia(query) returns and treats an undefined
// matchMedia as desktop, so a fixed matches:true list is what puts
// Scorecard.tsx's isPhone-gated branches (the phone head counter, the
// phone answers disclosure, the phone dock) on the page.
class FakeMediaQueryList {
  matches = true;
  addEventListener() {}
  removeEventListener() {}
}

function stubPhoneMatchMedia() {
  vi.stubGlobal('matchMedia', () => new FakeMediaQueryList());
}

const PLAN_ID = 'plan-scorecard-390';
const SUBMISSION_ID = 'sub-scorecard-390';

function queueEnvelope(
  items: Array<{ submissionId: string; alreadyRatedByMe: boolean; [key: string]: unknown }>,
  overrides: Partial<{ total: number; unscoredTotal: number }> = {},
) {
  return {
    items,
    total: overrides.total ?? items.length,
    unscoredTotal: overrides.unscoredTotal ?? items.filter((i) => !i.alreadyRatedByMe).length,
    page: 1,
    perPage: 200,
    open: true,
    recused: [],
  };
}

function plan() {
  return {
    id: PLAN_ID,
    eventId: 'evt-390',
    name: 'AI Track',
    instructions: '',
    openDate: null,
    closeDate: null,
    filters: null,
    anonymized: false,
    scale: { min: 1, max: 5 },
    criteria: [
      { id: 'c1', label: 'Depth', kind: 'rating', weight: 2, guidance: 'Rate the technical depth of the content.' },
      { id: 'c2', label: 'Clarity', kind: 'rating', weight: 1, guidance: 'How clearly the talk is likely to land.' },
      { id: 'c3', label: 'Fit', kind: 'dropdown', options: ['Poor', 'OK', 'Great'] },
    ],
    rounds: 2,
    currentRound: 2,
    maxEvaluations: null,
    createdAt: 1700000000000,
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

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/review/plans/:planId/submissions/:submissionId" element={<Scorecard />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('v12 frame render verdict "Reviewer scorecard · 390" (docs/design/Chautauqua Review.dc.html:280-345, task w31-i, DEC-976 wave-31)', () => {
  it('renders every drawn body element from the real /review/plans/:id/submissions/:id route at phone width', async () => {
    // :283 back link, min-height:44px, '‹ Wave 2 queue' in the frame's own
    // sample data.
    verbatimLine(
      283,
      '          <a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Wave 2 queue</a>',
    );
    // :284 the right-flushed 'N of N done' counter beside the back link.
    verbatimLine(284, '          <span style="margin-left:auto; font-size:12px; font-weight:600; color:#565A4B">7 of 18 done</span>');
    // :286 the '<plan> · <track> · round <n>' eyebrow.
    verbatimLine(
      286,
      '        <span style="font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:#565A4B">Wave 2 · AI Engineering · round 1</span>',
    );
    // :287 the 21px submission title.
    verbatimLine(
      287,
      '        <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:21px; font-weight:600; letter-spacing:-0.025em; line-height:1.25">Your AI Pair Programmer Is Lying to You</span>',
    );
    // :288 the 'ref · format, duration · level' meta line.
    verbatimLine(288, '        <span style="font-size:12px; color:#565A4B">DFC-021 · talk, 30 min · advanced</span>');
    // :293 the Abstract eyebrow.
    verbatimLine(
      293,
      '          <span style="font-size:10px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#565A4B">Abstract</span>',
    );
    // :295 the 'Read the full submission' link, min-height:44px.
    verbatimLine(
      295,
      '          <a href="#" style="font-size:13px; font-weight:700; display:inline-flex; align-items:center; min-height:44px">Read the full submission</a>',
    );
    // :301 the per-criterion label; :302 the weight caption; :304 the hint.
    verbatimLine(
      301,
      '              <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:16px; font-weight:600; letter-spacing:-0.015em">{{ c.label }}</span>',
    );
    verbatimLine(302, '              <span style="font-size:11px; font-weight:600; color:#565A4B; white-space:nowrap">{{ c.weight }}</span>');
    verbatimLine(304, '            <span style="font-size:13px; color:#565A4B; line-height:1.5">{{ c.hint }}</span>');
    // :308 the rating scale's own pill value; :315 the Choice option label.
    verbatimLine(308, '                  <span style="{{ n.style }}">{{ n.value }}</span>');
    verbatimLine(315, '                  <span style="{{ o.style }}">{{ o.label }}</span>');
    // :342 'Submit and next', :343 'Save draft' -- the terminal dock, 46px.
    verbatimLine(
      342,
      '        <span style="flex:1; background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:46px; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700">Submit and next</span>',
    );
    verbatimLine(
      343,
      '        <span style="border:1px solid #BAB6A6; border-radius:6px; min-height:46px; display:flex; align-items:center; padding:0 16px; font-size:13px; font-weight:600">Save draft</span>',
    );

    stubPhoneMatchMedia();

    mockApi({
      'GET /api/v1/review/plans': listEnvelope([plan()]),
      [`GET /api/v1/review/submissions/${SUBMISSION_ID}`]: {
        id: SUBMISSION_ID,
        ref: 'S-390',
        title: 'Verification Patterns For AI-Generated Code',
        description:
          'Code generation is easy; trusting it is hard. This session covers verification patterns for AI-generated code.',
        format: 'talk_30',
        audienceLevel: 'advanced',
        sessionAnswers: [{ fieldId: 'f1', label: 'Talk length', kind: 'dropdown', value: '30 minutes' }],
        myEvaluation: undefined,
        criteria: plan().criteria,
      },
      [`GET /api/v1/review/plans/${PLAN_ID}/queue`]: queueEnvelope(
        [
          { submissionId: SUBMISSION_ID, alreadyRatedByMe: false },
          { submissionId: 'sub-other', alreadyRatedByMe: false },
        ],
        { total: 18, unscoredTotal: 11 },
      ),
    });

    renderAt(`/review/plans/${PLAN_ID}/submissions/${SUBMISSION_ID}`);

    // :287 -- exactly one <h1>, its text SHAPE-graded (never the frame's own
    // "Your AI Pair Programmer Is Lying to You" sample string).
    await waitFor(() => {
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    });
    const title = document.querySelector('.chq-review-scorecard-title');
    expect(title).not.toBeNull();
    expect(title!.textContent).toBe('Verification Patterns For AI-Generated Code');

    // :283 -- the back link: SHAPE '‹ <plan> queue', never the frame's own
    // 'Wave 2 queue'. Class-scoped so a matching CSS floor rule (asserted
    // separately, scorecard-phone-frames.test.ts) is known to target it.
    const backLink = document.querySelector('.chq-review-back');
    expect(backLink).not.toBeNull();
    expect(backLink!.textContent).toMatch(/^‹ .+ queue$/);

    // :284 -- the counter is a SEPARATE, right-flushed sibling of the back
    // link inside the same head row (never concatenated into the link's own
    // text), phone-only local node (never the desktop #chq-header-slot
    // portal -- that only mounts when isPhone is false). Class-scoped
    // rather than a bare text query, per this task's header-slot note: a
    // naive text match could otherwise silently pass against the wrong
    // (portalled) copy if the phone stub ever failed to take.
    const backRow = document.querySelector('.chq-review-scorecard-back-row');
    expect(backRow).not.toBeNull();
    const counter = backRow!.querySelector('.chq-review-scorecard-phone-progress');
    expect(counter).not.toBeNull();
    expect(counter!.textContent).toMatch(/^\d+ of \d+ done$/);
    // The counter never lands in the desktop portal target too -- exactly
    // one counter node exists in the whole document at phone width.
    expect(document.querySelectorAll('.chq-review-scoped-progress-caption')).toHaveLength(0);

    // :286 -- the eyebrow, SHAPE '<plan> · <track> · round <n>' (here
    // "AI Track · All tracks · Round 2"), never the frame's own literal.
    const eyebrow = document.querySelector('.chq-review-scorecard-head .chq-section-label');
    expect(eyebrow).not.toBeNull();
    expect(eyebrow!.textContent).toMatch(/^AI Track · .+ · Round \d+$/);

    // :288 -- the meta line, SHAPE 'ref · format, duration · level'.
    const meta = document.querySelector('.chq-review-scorecard-meta');
    expect(meta).not.toBeNull();
    expect(meta!.textContent).toMatch(/^S-390 · .+ · .+$/);

    // :293 -- the Abstract eyebrow is structural copy, graded by literal.
    expect(screen.getByRole('heading', { level: 2, name: 'Abstract' })).toBeInTheDocument();
    // -- the abstract body, SHAPE (the frame's own prose is sample data).
    const abstractBody = document.querySelector('.chq-review-scorecard-abstract');
    expect(abstractBody).not.toBeNull();
    expect(abstractBody!.textContent).toBe(
      'Code generation is easy; trusting it is hard. This session covers verification patterns for AI-generated code.',
    );

    // :295 -- 'Read the full submission', a literal control label (not
    // sample data), mounted only at phone, at its 44px floor via
    // .chq-review-answers-toggle (the class scorecard.css's terminal
    // max-width:700px block raises to min-height:44px, per
    // scorecard-phone-frames.test.ts's own CSS-text pin).
    const readLink = screen.getByText('Read the full submission');
    expect(readLink.tagName).toBe('LABEL');
    expect(readLink).toHaveClass('chq-review-answers-toggle');
    const toggleId = readLink.getAttribute('for');
    expect(toggleId).toBe('chq-review-answers-toggle');
    const checkbox = document.getElementById('chq-review-answers-toggle');
    expect(checkbox).not.toBeNull();
    expect(checkbox).toHaveClass('chq-review-answers-checkbox');
    expect(checkbox!.getAttribute('aria-controls')).toBe('chq-review-answers');

    // :301/:302/:304/:308 -- the rating criterion block: label (literal,
    // fixture-controlled), weight caption (SHAPE 'Weight N · NN%', never
    // the frame's own weight string), hint/guidance (literal,
    // fixture-controlled), and the scale's own pill row (SHAPE numeric
    // values, never the frame's own five-segment sample).
    const depthGroup = screen.getByRole('radiogroup', { name: 'Depth (c1)' });
    const depthFieldset = depthGroup.closest('fieldset')!;
    expect(within(depthFieldset).getByText('Depth')).toBeInTheDocument();
    const depthWeightCaption = depthFieldset.querySelector('.chq-review-criterion-weight-caption');
    expect(depthWeightCaption).not.toBeNull();
    expect(depthWeightCaption!.textContent).toMatch(/^Weight \d+ · \d+%$/);
    expect(within(depthFieldset).getByText('Rate the technical depth of the content.')).toBeInTheDocument();
    const depthRadios = within(depthGroup).getAllByRole('radio');
    expect(depthRadios).toHaveLength(5);
    expect(depthRadios.map((r) => r.textContent)).toEqual(['1', '2', '3', '4', '5']);

    // :304/:315 -- the Choice criterion block: hint present, and each
    // option prints its own {{ o.label }} as the visible row text (SHAPE --
    // never the frame's own 'Poor'/'OK'/'Great' pinned as THE only legal
    // set, just asserted present since this fixture chose them).
    const fitGroup = screen.getByRole('radiogroup', { name: 'Fit (c3)' });
    const fitFieldset = fitGroup.closest('fieldset')!;
    expect(within(fitFieldset).getByText('Fit')).toBeInTheDocument();
    const fitOptions = within(fitGroup).getAllByRole('radio');
    expect(fitOptions).toHaveLength(3);
    expect(screen.getByText('Poor')).toBeInTheDocument();
    expect(screen.getByText('OK')).toBeInTheDocument();
    expect(screen.getByText('Great')).toBeInTheDocument();

    // :341-:343 -- the terminal dock, hoisted past the rail: exactly two
    // buttons, 'Submit and next' (primary) then 'Save draft' (secondary),
    // in drawn order, at their 46px floor via .chq-review-scorecard-dock
    // .chq-btn (scorecard.css terminal block).
    const dock = document.querySelector('.chq-review-scorecard-dock');
    expect(dock).not.toBeNull();
    const dockButtons = within(dock as HTMLElement).getAllByRole('button');
    expect(dockButtons).toHaveLength(2);
    expect(dockButtons[0]).toHaveTextContent('Submit and next');
    expect(dockButtons[0]).toHaveClass('chq-btn-primary');
    expect(dockButtons[1]).toHaveTextContent('Save draft');
    expect(dockButtons[1]).toHaveClass('chq-btn-secondary');
    // The desktop actions row never co-mounts at phone -- exactly one pair
    // of Submit/Save controls exists in the whole document.
    expect(document.querySelectorAll('.chq-review-editor-actions')).toHaveLength(0);

    // DEC-561 regression bar.
    expect(document.body.textContent).not.toContain('undefined');
    expect(document.body.textContent).not.toContain('[object Object]');
  });
});
