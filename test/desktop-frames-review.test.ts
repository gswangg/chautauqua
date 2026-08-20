// Desktop-frame parity, Review cluster (v12 mobile campaign, DEC-967/DEC-976;
// task v12m-w7-h). test/desktop-frame-ledger.scan.test.ts (DEC-976 wave-99
// amendment) established that the desktop half of the campaign has never
// been measured -- 108 desktop frames across the pack with no claim, no
// ledger, no floor. Wave-110/111 found the Review cluster the one unowned
// block of six; this file claims three of them, all from
// docs/design/Chautauqua Review.dc.html:
//
//   :183 "Reviewer scorecard · /review/plans/:id/submissions/:id" (1600)
//        -- app/src/pages/review/Scorecard.tsx
//   :351 "Reviewer queue · /review/plans/:id" (1600)
//        -- app/src/pages/review/ReviewerQueue.tsx
//   :830 "Your plans · /review" (1600)
//        -- see the note below: NOT PlanList.tsx.
//
// ROUTING CORRECTION (DEC-967, "claim only what the app really carries
// rather than asserting a fiction"): the charter for this task named
// PlanList.tsx as the implementer of :830. app/src/pages/Review.tsx's own
// role switch shows that is wrong -- a reviewer landing on "/" (bare
// /review, exactly what :830's "Your plans · /review" route caption names)
// gets <ReviewerQueue /> (Review.tsx:49-51), not <PlanList />. PlanList is
// mounted at "/" only for the ORGANISER role (Review.tsx:59-60) and renders
// a completely different page (H1 "Review", an admin table with Progress/
// Results/Edit links, no "N left to score" figure, no Open/Closed pill, no
// "Across N open plans" line). Frame :830's drawn content -- "17 left to
// score", "Across two open plans", a Plan/State/Your progress head row, and
// the verbatim footnote "With one open plan this page is skipped — you land
// straight in its queue. Scores stay hidden from other reviewers." -- is the
// reviewer-facing multi-plan hub inside ReviewerQueue.tsx's own
// `plans.length > 1` branch (ReviewerQueue.tsx:772-838), which this file
// claims :830 against instead. This file does not touch, and makes no claim
// about, PlanList.tsx.
//
// RECEIPT SHAPE (DEC-976 wave-87/102, DEC-967 wave-99): each it() below
// carries, in its own comment, the strict citation
// `docs/design/Chautauqua Review.dc.html:<line>` and a backtick-quoted
// literal copied verbatim from that exact frame line, with a real expect()
// about the TREE (an app source file, read via readFileSync -- never the
// design file compared to itself) within six source lines beneath.
//
// This is a measurement lane: it does not modify Scorecard.tsx,
// ReviewerQueue.tsx, PlanList.tsx, review.css or scorecard.css.
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

describe('desktop frame parity: Review cluster (v12m-w7-h)', () => {
  it('the design file exists and is non-trivial (sanity check on the population this file claims against)', () => {
    const design = readFileSync(DESIGN_FILE, 'utf-8');
    expect(design.split('\n').length).toBeGreaterThan(1000);
  });

  // ---- :183 Reviewer scorecard · /review/plans/:id/submissions/:id (1600) ----

  // docs/design/Chautauqua Review.dc.html:183
  // `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Reviewer scorecard · /review/plans/:id/submissions/:id</span>`
  it('Review.tsx routes plans/:planId/submissions/:submissionId to Scorecard (:183)', () => {
    const src = readFileSync(join(REPO_ROOT, 'app', 'src', 'pages', 'Review.tsx'), 'utf-8');
    expect(src).toMatch(/path="plans\/:planId\/submissions\/:submissionId"\s+element=\{<Scorecard \/>\}/);
  });

  // docs/design/Chautauqua Review.dc.html:209
  // `<span style="display:block; padding:14px 0 0; font-size:13px; color:#565A4B">The speaker's name and company are hidden while this plan is anonymised</span>`
  it('Scorecard.tsx discloses anonymisation with the frame\'s exact sentence (:209)', () => {
    const src = read('Scorecard.tsx');
    expect(src).toMatch(/The speaker's name and company are hidden while this plan is anonymised\./);
  });

  // docs/design/Chautauqua Review.dc.html:216
  // `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase">Form answers</span>`
  it('Scorecard.tsx titles the answers section "Form answers" (:216)', () => {
    const src = read('Scorecard.tsx');
    expect(src).toMatch(/<h2 className="chq-section-label">Form answers<\/h2>/);
  });

  // docs/design/Chautauqua Review.dc.html:246
  // `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:12px; font-weight:700">Overall</span>`
  it('Scorecard.tsx labels the blended score "Overall" (:246)', () => {
    const src = read('Scorecard.tsx');
    expect(src).toMatch(/<span className="chq-section-label">Overall<\/span>/);
  });

  // docs/design/Chautauqua Review.dc.html:249
  // `<span style="display:block; padding:9px 0 0; font-size:12px; color:#565A4B; line-height:1.5">Averaged by weight · not editable. A plain average of 5, 4, 4 would be 4.33.</span>`
  it('Scorecard.tsx composes the plain-average reconciliation sentence the frame states (:249)', () => {
    const src = read('Scorecard.tsx');
    expect(src).toMatch(/Averaged by weight, not editable/);
    expect(src).toMatch(/would be \$\{formatScore\(plainAverage/);
  });

  // docs/design/Chautauqua Review.dc.html:254
  // `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:12px; font-weight:700">Comment to the committee</span>`
  it('Scorecard.tsx labels the free-text field "Comment to the committee" (:254)', () => {
    const src = read('Scorecard.tsx');
    expect(src).toMatch(/Comment to the committee/);
  });

  // docs/design/Chautauqua Review.dc.html:259
  // `              Recuse me from this one`
  it('Scorecard.tsx offers the bare recusal checkbox "Recuse me from this one" (:259)', () => {
    const src = read('Scorecard.tsx');
    expect(src).toMatch(/Recuse me from this one/);
  });

  // docs/design/Chautauqua Review.dc.html:262
  // `<span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; min-height:48px; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700">Submit and next</span>`
  it('Scorecard.tsx submits the primary action as "Submit and next" (:262)', () => {
    const src = read('Scorecard.tsx');
    expect(src).toMatch(/onClick=\{\(\) => void submitAndAdvance\(\)\}>\s+Submit and next/);
  });

  // docs/design/Chautauqua Review.dc.html:263
  // `<span style="border:1px solid #CFC7B7; border-radius:4px; background:#EFEBDF; min-height:46px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600; color:#2E2A24">Save draft</span>`
  it('Scorecard.tsx offers the secondary action "Save draft" (:263)', () => {
    const src = read('Scorecard.tsx');
    expect(src).toMatch(/onClick=\{\(\) => void saveOnly\(\)\}>\s+Save draft/);
  });

  // ---- :351 Reviewer queue · /review/plans/:id (1600) ----

  // docs/design/Chautauqua Review.dc.html:351
  // `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Reviewer queue · /review/plans/:id</span>`
  it('Review.tsx routes plans/:planId to ReviewerQueue for a reviewer (:351)', () => {
    const src = readFileSync(join(REPO_ROOT, 'app', 'src', 'pages', 'Review.tsx'), 'utf-8');
    expect(src).toMatch(/path="plans\/:planId"\s+element=\{<ReviewerQueue \/>\}/);
  });

  // docs/design/Chautauqua Review.dc.html:371
  // `<h1 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:36px; font-weight:700; letter-spacing:-0.04em; line-height:1">11 left to score</h1>`
  it('ReviewerQueue.tsx titles the scoped queue "N left to score" from scoreLeft (:371)', () => {
    const src = read('ReviewerQueue.tsx');
    expect(src).toMatch(/<h1 className="chq-page-title">\{`\$\{scoreLeft\} left to score`\}<\/h1>/);
  });

  // docs/design/Chautauqua Review.dc.html:374
  // `<span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; min-height:48px; display:flex; align-items:center; padding:0 20px; font-size:15px; font-weight:700; white-space:nowrap">Score the next one</span>`
  it('ReviewerQueue.tsx offers the primary action "Score the next one" in the title row (:374)', () => {
    const src = read('ReviewerQueue.tsx');
    expect(src).toMatch(/className="chq-btn chq-btn-primary chq-review-scoped-title-action"\s*>\s+Score the next one/);
  });

  // docs/design/Chautauqua Review.dc.html:399
  // `<span style="font-size:13px; color:#565A4B">Showing 5 of 18</span>`
  it('ReviewerQueue.tsx footer prints "Showing 5 of N" from totalRows (:399)', () => {
    const src = read('ReviewerQueue.tsx');
    expect(src).toMatch(/\{`Showing 5 of \$\{totalRows\}`\}/);
  });

  // docs/design/Chautauqua Review.dc.html:400
  // `<a href="#" style="font-size:13px; font-weight:700">Show all 18</a>`
  it('ReviewerQueue.tsx footer offers "Show all N" from totalRows (:400)', () => {
    const src = read('ReviewerQueue.tsx');
    expect(src).toMatch(/\{`Show all \$\{totalRows\}`\}/);
  });

  // docs/design/Chautauqua Review.dc.html:401
  // `<span style="margin-left:auto; font-size:13px; color:#565A4B">Your scores stay hidden from other reviewers</span>`
  it('ReviewerQueue.tsx footer states "Your scores stay hidden from other reviewers" verbatim (:401)', () => {
    const src = read('ReviewerQueue.tsx');
    expect(src).toMatch(/<span className="chq-review-queue-footer-note">Your scores stay hidden from other reviewers<\/span>/);
  });

  // ---- :830 Your plans · /review (1600) ----

  // docs/design/Chautauqua Review.dc.html:830
  // `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Your plans · /review</span>`
  it('Review.tsx routes bare "/" to ReviewerQueue for a reviewer, the "Your plans" landing (:830)', () => {
    const src = readFileSync(join(REPO_ROOT, 'app', 'src', 'pages', 'Review.tsx'), 'utf-8');
    expect(src).toMatch(/<Route path="\/" element=\{<ReviewerQueue \/>\} \/>/);
  });

  // docs/design/Chautauqua Review.dc.html:843
  // `<h1 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:36px; font-weight:700; letter-spacing:-0.04em; line-height:1">17 left to score</h1>`
  it('ReviewerQueue.tsx hub titles "N left to score" from leftTotal (:843)', () => {
    const src = read('ReviewerQueue.tsx');
    expect(src).toMatch(/<h1 className="chq-page-title">\{`\$\{leftTotal\} left to score`\}<\/h1>/);
  });

  // docs/design/Chautauqua Review.dc.html:844
  // `<span style="font-size:14px; color:#565A4B">Across two open plans</span>`
  it('ReviewerQueue.tsx hub sub-line composes "Across N open plan(s)" (:844)', () => {
    const src = read('ReviewerQueue.tsx');
    expect(src).toMatch(/\{`Across \$\{spellCount\(openCount\)\} open \$\{plural\(/);
  });

  // docs/design/Chautauqua Review.dc.html:849
  // `<span>Plan</span><span>State</span><span>Your progress</span><span></span>`
  it('ReviewerQueue.tsx hub head row names Plan/State/Your progress (:849)', () => {
    const src = read('ReviewerQueue.tsx');
    expect(src).toMatch(/<span>Plan<\/span>\s+<span>State<\/span>\s+<span>Your progress<\/span>\s+<span><\/span>/);
  });

  // docs/design/Chautauqua Review.dc.html:866
  // `<div style="padding:15px 0 0; font-size:13px; color:#565A4B; line-height:1.5">With one open plan this page is skipped — you land straight in its queue. Scores stay hidden from other reviewers.</div>`
  it('ReviewerQueue.tsx hub prints the frame\'s exact skip-footnote sentence (:866)', () => {
    const src = read('ReviewerQueue.tsx');
    expect(src).toMatch(
      /With one open plan this page is skipped — you land straight in its queue\. Scores stay hidden from other\s+reviewers\./,
    );
  });
});
