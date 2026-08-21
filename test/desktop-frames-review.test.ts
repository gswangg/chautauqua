// Desktop-frame claims: Review cluster (DEC-976, v12 mobile campaign wave
// 103/104, task w4-desktop-review).
//
// test/desktop-frame-ledger.scan.test.ts enumerates 102 desktop frames
// across the pack and reads a floor of claimed coverage for most of them;
// Review was deliberately deferred out of wave 21's six lanes because
// v12m-w2-p was moving the criterion row from 5 to 6 tracks (merged at
// ab3d2753) -- claiming Review desktop frames before that landed risked
// citing a criterion-row shape that was about to change under this file.
// That merge is in, so the six Review desktop frames this task claims are:
//
//   docs/design/Chautauqua Review.dc.html (line 183)  Reviewer scorecard · /review/plans/:id/submissions/:id
//   docs/design/Chautauqua Review.dc.html (line 351)  Reviewer queue · /review/plans/:id
//   docs/design/Chautauqua Review.dc.html (line 451)  Plan editor · /review/plans/:id
//   docs/design/Chautauqua Review.dc.html (line 675)  Plan editor · criteria frozen
//   docs/design/Chautauqua Review.dc.html (line 830)  Your plans · /review
//   docs/design/Chautauqua Review.dc.html (line 875)  Plan editor · save rejected
//
// Each `it()` below carries the strict citation
// `docs/design/Chautauqua Review.dc.html:<line>`, a backtick-quoted literal
// copied VERBATIM from that exact BODY line (never the label line) inside
// that frame's extent, and a real `expect(` within 6 source lines beneath
// the citation comment -- the three-part receipt shape DEC-976's wave-87
// amendment made executable (app/src/frame-citation.scan.test.ts) for phone
// frames, and the shape this ledger's own header
// (test/desktop-frame-ledger.scan.test.ts) asks desktop claims to follow.
//
// DESKTOP IS FROZEN: this file is node-tier (readFileSync over sources, no
// jsdom, no render) and asserts on SOURCE CONTENT only -- no CSS, no TSX,
// no markup changed anywhere in this task. Every assertion below anchors on
// file CONTENT (a class name, a literal string) never an app-file LINE
// NUMBER, because other lanes are moving lines in review.css this same wave.
//
// Expected values are TYPED as literals here, never read back out of
// docs/design and compared to itself (the tautology
// app/src/tautological-assertion.scan.test.ts guards against).
//
// HONESTY RULE (DEC-976 w103): every frame below is claimed only because the
// app tree already carries the frame's cited literal verbatim. No divergence
// was found among these six frames, so no row was appended to
// docs/design/audit/desktop-frame-ledger-v12.md for this task.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, "..");

function readSrc(relPath: string): string {
  return readFileSync(join(REPO_ROOT, relPath), "utf-8");
}

describe("desktop frame claims: Review cluster (docs/design/Chautauqua Review.dc.html)", () => {
  it("Reviewer scorecard discloses anonymisation with the frame's own sentence (docs/design/Chautauqua Review.dc.html:224)", () => {
    // Frame :224 `<span style="display:block; padding:14px 0 0; font-size:13px; color:#565A4B">The speaker's name and company are hidden while this plan is anonymised</span>`
    // -- the anonymised-plan notice on the reviewer's reading column.
    const src = readSrc("app/src/pages/review/Scorecard.tsx");
    expect(src).toContain("The speaker's name and company are hidden while this plan is anonymised.");
    expect(src).toContain('submission.anonymized === true');
  });

  it("Reviewer queue footnote tells the reviewer their scores stay hidden from peers (docs/design/Chautauqua Review.dc.html:401)", () => {
    // Frame :401 `<span style="margin-left:auto; font-size:13px; color:#565A4B">Your scores stay hidden from other reviewers</span>`
    // -- the desktop queue's footer note, right of "Show all N".
    const src = readSrc("app/src/pages/review/ReviewerQueue.tsx");
    expect(src).toContain('Your scores stay hidden from other reviewers');
    expect(src).toContain("chq-review-queue-footer-note");
  });

  it("Plan editor's rating-scale field carries the frame's plan-wide caption (docs/design/Chautauqua Review.dc.html:483)", () => {
    // Frame :483 `<span style="font-size:12px; color:#565A4B; line-height:1.45">Applies to every criterion in this plan</span>`
    // -- the caption under the Rating scale field in the plan summary grid.
    const src = readSrc("app/src/pages/review/PlanEditor.tsx");
    expect(src).toContain("Applies to every criterion in this plan");
    expect(src).toContain("chq-review-field-caption");
  });

  it("Plan editor with reviews in explains why criteria are locked, in the frame's own wording (docs/design/Chautauqua Review.dc.html:705-706)", () => {
    // Frame :705 `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:15px; font-weight:700">Changing these would rescore work already done</span>`
    // Frame :706 `<span style="font-size:13px; color:#3F4237; line-height:1.55">Wording, weights and the scale are fixed for the rest of this wave. To score differently, open a new wave — the reviews already in stay attached to this one.</span>`
    // -- two separate registers (headline, then body); asserted individually and verbatim, never joined.
    const src = readSrc("app/src/pages/review/PlanEditor.tsx");
    expect(src).toContain("Changing these would rescore work already done");
    // DEC-882 (v12m-w9-gg) split this card into the frame's TWO registers --
    // headline span (:705), reason span (:706) -- so the claim pins both
    // literals, not the pre-split collapsed string that dropped the headline.
    // v12m-w12-bb additionally pins the reason span as ONE unbroken sentence
    // pair across its source line wrap, so a future re-split cannot silently
    // drop the second clause while still satisfying the substring check.
    expect(src).toMatch(
      /Wording, weights and the scale are fixed for the rest of this wave\. To score differently,\s+open a new wave — the reviews already in stay attached to this one\./,
    );
    expect(src).toContain("open a new wave — the reviews already in stay attached to this one.");
    expect(src).toContain("Start a new wave");
    expect(src).toContain("chq-review-criteria-locked-notice");
  });

  it("Your-plans hub footnote states the single-plan skip and the hidden-scores rule together (docs/design/Chautauqua Review.dc.html:866)", () => {
    // Frame :866 `<div style="padding:15px 0 0; font-size:13px; color:#565A4B; line-height:1.5">With one open plan this page is skipped — you land straight in its queue. Scores stay hidden from other reviewers.</div>`
    // -- the desktop (1600) multi-plan hub's own closing line, distinct from
    // the phone frame's split two-region version of the same two sentences.
    const src = readSrc("app/src/pages/review/ReviewerQueue.tsx");
    expect(src).toContain("With one open plan this page is skipped — you land straight in its queue.");
    // DEC-874 wave-19 amendment: the app splits this into two sibling
    // <span>s (desktop rendered text stays byte-identical, reading order
    // unchanged) so the second sentence alone can be hidden at 390 -- the
    // source literal is now two separate strings, not one contiguous run.
    // The note sits BELOW the first assertion on purpose: app/src/
    // frame-citation.scan.test.ts requires a real expect( within
    // EXPECT_PROXIMITY_LINES of the citation in the it() title above, so a
    // growing preamble would unreceipt the claim it explains.
    expect(src).toContain("Scores stay hidden from other reviewers.");
    expect(src).toContain("chq-reviewer-plans-footnote");
    expect(src).toContain("chq-reviewer-plans-footnote-repeat");
  });

  it("Plan editor save-rejected state names both blockers with the frame's combined sentence (docs/design/Chautauqua Review.dc.html:889)", () => {
    // Frame :889 `<span style="font-size:14px; line-height:1.55; color:#3F4237">A plan with no criteria has nothing for reviewers to score, and the window has to run forwards.</span>`
    // -- the two-clause summary shown only when both a criteria error and a
    // closeAt error fire together.
    const src = readSrc("app/src/pages/review/PlanEditor.tsx");
    expect(src).toContain(
      "A plan with no criteria has nothing for reviewers to score, and the window has to run forwards.",
    );
    expect(src).toContain("errors.criteria && errors.closeAt");
  });
});
