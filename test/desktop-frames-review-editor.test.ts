// Desktop-frame parity, Review PLAN-EDITOR cluster (v12 mobile campaign,
// DEC-976/DEC-967; task v12m-w7-i). test/desktop-frame-ledger.scan.test.ts
// (DEC-976 wave-99 amendment) established that the desktop half of the
// campaign has never been measured -- 102 desktop frames across the pack,
// most with no claim. This file claims the three unclaimed Plan-editor
// desktop frames named in this wave's charter, all from
// docs/design/Chautauqua Review.dc.html and all implemented by
// app/src/pages/review/PlanEditor.tsx + app/src/pages/review/review.css:
//
//   :451 "Plan editor · /review/plans/:id"  -- the base editor
//   :675 "Plan editor · criteria frozen"    -- locked-round state
//   :875 "Plan editor · save rejected"      -- two-error refusal state
//
// RECEIPT SHAPE (DEC-976 wave-87/102, DEC-967 wave-99, DEC-808 proximity
// rule in app/src/frame-citation.scan.test.ts): each it() below carries, in
// its own comment, the strict citation
// `docs/design/Chautauqua Review.dc.html:<line>` immediately followed by a
// backtick-quoted literal copied verbatim from that exact frame line, with a
// real expect() about the TREE (an app source file, read via readFileSync)
// within six source lines beneath the citation -- never the design file
// compared to itself. Explanatory notes therefore live in THIS header, not
// beside the individual citations, to keep every citation's own comment
// short enough for its expect() to land inside the proximity window.
//
// (a) THE HEAD ROW, NOT THE BODY (field guide, wave 110): the criteria
// table's head row at :493 spells SIX cells --
// `<span></span><span>Criterion</span><span>Guidance for reviewers ·
// optional</span><span>Type</span><span>Weight</span><span></span>`. On
// this branch PlanEditor.tsx already renders all six (the drag-handle
// column, Criterion, Guidance, Type, Weight, and the trailing delete-button
// column) -- see the :493 assertion below, which reads the head-row block
// and counts six `<span` opens.
//
// (b) TWO DEVIATIONS-BLESSED DEPARTURES exist in this frame FILE (both
// documented in docs/design/DEVIATIONS.md section 3/6, DEC-941/DEC-745
// wave-98 amendment) but NEITHER falls inside the three frames this file
// claims:
//   - the reviewer-row "Swap" label DEVIATIONS.md describes is drawn at
//     Chautauqua Review.dc.html:652, inside the PHONE frame "Plan editor ·
//     390" (:590 extent) -- a different, unclaimed-here frame. The :451
//     desktop frame this file DOES claim draws "Remove" itself, at line 570
//     (`<a href="#" ...>Remove</a>`), which is exactly what
//     PlanEditor.tsx's reviewer row renders (behind ConfirmDialog, per
//     DEC-941). The :570 assertion below is therefore a DIRECT literal
//     match, not an assertion over the ruled departure -- documented here so
//     a future reader does not mistake one for the other.
//   - the phone-dock "Save the plan"/"Cancel" captioning DEVIATIONS.md
//     describes is drawn at :665-667, also inside the phone frame -- out of
//     scope for this desktop-only file.
//
// (c) :875 is a REFUSAL state (DESIGN-RULINGS error rules): the :889
// assertion below anchors on the two-error ("kept") sentence the app
// actually ships for the criteria+closeAt double-error case, not on a
// generic error string.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, '..');
const REVIEW_DIR = join(REPO_ROOT, 'app', 'src', 'pages', 'review');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Review.dc.html');

function read(relPath: string): string {
  return readFileSync(join(REVIEW_DIR, relPath), 'utf-8');
}

describe('desktop frame parity: Review plan-editor cluster (v12m-w7-i)', () => {
  it('the design file exists and is non-trivial (sanity check on the population this file claims against)', () => {
    const design = readFileSync(DESIGN_FILE, 'utf-8');
    expect(design.split('\n').length).toBeGreaterThan(900);
  });

  // docs/design/Chautauqua Review.dc.html:451
  // `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Plan editor · /review/plans/:id</span>`
  it('PlanEditor.tsx renders the base plan-editor title row (:451)', () => {
    const src = read('PlanEditor.tsx');
    expect(src).toMatch(/className="chq-review-editor-title-row"/);
  });

  // docs/design/Chautauqua Review.dc.html:493 -- see file header note (a)
  // `<span></span><span>Criterion</span><span>Guidance for reviewers · optional</span><span>Type</span><span>Weight</span><span></span>`
  it('PlanEditor.tsx\'s criteria head row names all six cells the frame spells (:493)', () => {
    const src = read('PlanEditor.tsx');
    const m = src.match(/chq-review-criteria-head-row[\s\S]{0,900}?<\/div>/);
    expect(m).not.toBeNull();
    expect((m![0].match(/<span/g) ?? []).length).toBeGreaterThanOrEqual(6);
  });

  // docs/design/Chautauqua Review.dc.html:570 -- see file header note (b)
  // `<a href="#" style="font-size:12px; font-weight:700; color:#565A4B">Remove</a>`
  it('PlanEditor.tsx\'s reviewer roster row offers "Remove" behind a confirm dialog (:451 extent)', () => {
    const src = read('PlanEditor.tsx');
    expect(src).toMatch(/setPendingUnassignReviewer\(\{ id: r\.id, displayName \}\)/);
    expect(src).toMatch(/confirmLabel="Remove reviewer"/);
  });

  // docs/design/Chautauqua Review.dc.html:675
  // `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Plan editor · criteria frozen</span>`
  it('PlanEditor.tsx renders a locked-criteria notice once a round has scored reviews (:675)', () => {
    const src = read('PlanEditor.tsx');
    expect(src).toMatch(/chq-review-criteria-locked-notice/);
  });

  // docs/design/Chautauqua Review.dc.html:705
  // `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:15px; font-weight:700">Changing these would rescore work already done</span>`
  it('PlanEditor.tsx\'s locked-criteria reason opens with the frame\'s exact headline (:675 extent)', () => {
    const src = read('PlanEditor.tsx');
    expect(src).toMatch(/Changing these would rescore work already done\./);
  });

  // docs/design/Chautauqua Review.dc.html:708
  // `<span style="margin-left:auto; background:#4E5C31; color:#F7F9F0; border-radius:4px; min-height:46px; display:flex; align-items:center; padding:0 18px; font-size:14px; font-weight:700; white-space:nowrap">Start a new wave</span>`
  it('PlanEditor.tsx offers "Start a new wave" as the escape from a locked round (:675 extent)', () => {
    const src = read('PlanEditor.tsx');
    expect(src).toMatch(/startingWave \? 'Starting…' : 'Start a new wave'/);
  });

  // docs/design/Chautauqua Review.dc.html:875
  // `<span style="font-size:11px; font-weight:700; letter-spacing:0.1em; background:#4E5C31; color:#F7F9F0; padding:5px 10px; border-radius:4px">1600</span>`
  it('PlanEditor.tsx renders a top-of-form ErrorSummary once Save fails validation (:875)', () => {
    const src = read('PlanEditor.tsx');
    expect(src).toMatch(/saveAttempted && Object\.keys\(errors\)\.length > 0/);
    expect(src).toMatch(/<ErrorSummary/);
  });

  // docs/design/Chautauqua Review.dc.html:889 -- see file header note (c)
  // `<span style="font-size:14px; line-height:1.55; color:#3F4237">A plan with no criteria has nothing for reviewers to score, and the window has to run forwards.</span>`
  it('PlanEditor.tsx keeps the frame\'s two-clause refusal sentence for the criteria+closeAt double error (:875 extent)', () => {
    const src = read('PlanEditor.tsx');
    expect(src).toMatch(/A plan with no criteria has nothing for reviewers to score, and the window has to run forwards\./);
  });

  // docs/design/Chautauqua Review.dc.html:901
  // `<span style="font-size:13px; font-weight:600; line-height:1.5; color:#1B1D17">This is before the plan opens. Pick a date after 2 September.</span>`
  it('PlanEditor.tsx anchors the closeAt field error to a real problem entry the ErrorSummary can link to (:875 extent)', () => {
    const src = read('PlanEditor.tsx');
    expect(src).toMatch(/planErrorSummaryProblems\(errors\)/);
    expect(src).toMatch(/closeAt:/);
  });
});
