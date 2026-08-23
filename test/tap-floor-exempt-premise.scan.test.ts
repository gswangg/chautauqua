// DEC-393 wave-30 amendment: "a tap-floor-exempt reason is a premise about
// the tree, and its verifier must be named in the receipt and executable by
// a scan." The tree carries ~50-100 `tap-floor-exempt:` receipts across
// src/routes/**, src/views/** and app/src/**, none of which any instrument
// checked before this file. Two dominant reason families -- `composition`
// ("this class never appears in markup without its already-floored
// companion") and `inline-*` ("a phrase inside a running sentence; a 44px
// box would break the line box") -- state ASSERTIONS ABOUT THE TREE that
// can rot silently the way an unchecked allowlist does (DEC-725). This scan
// makes both families' premises executable and rosters every receipt this
// wave cannot express a check for (never a silent pass, per the task's own
// clause (c)).
//
// Contention decomposition (custodian, wave 44): this file had accumulated
// 4 merge conflicts as a contention hotspot. Its population walk, receipt
// extraction, CSS floor-grammar primitives and the render-gate/element-type/
// self-scoped judging tiers now live in test/tap-floor-exempt-premise/*.ts
// (the same per-scan-directory shape test/citation-form-drift/ already
// uses) -- re-exported below so every public path this file used to expose
// (types, `allReceipts`, `judgeReceipt`, `judgeRenderGate`, `RenderGateDeps`,
// the two ceilings) is unchanged. No behavior change: logic moved, not
// rewritten.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEC_393 } from "../src/decisions";
import { cssRegionsOf, ruleChunks } from "./tap-floor-exempt-premise/css-grammar";
import { judgeReceipt } from "./tap-floor-exempt-premise/judge";
import { productFiles, REPO_ROOT } from "./tap-floor-exempt-premise/population";
import { allReceipts, extractReceipts } from "./tap-floor-exempt-premise/receipts";
import { judgeRenderGate } from "./tap-floor-exempt-premise/render-gate";
import type { Receipt } from "./tap-floor-exempt-premise/receipts";

export type { ProductFile } from "./tap-floor-exempt-premise/population";
export type { ReasonFamily, Receipt, RosterRow, Verdict } from "./tap-floor-exempt-premise/receipts";
export type { RenderGateDeps } from "./tap-floor-exempt-premise/render-gate";
export { allReceipts, extractReceipts, judgeReceipt, judgeRenderGate, productFiles };
import {
  isContainerAnchorAbsenceCandidate,
  judgeContainerAnchorAbsence,
} from "./tap-floor-exempt-premise/anchorless-container";
import type { MarkupFile } from "./tap-floor-exempt-premise/anchorless-container";

export type { MarkupFile } from "./tap-floor-exempt-premise/anchorless-container";
export { isContainerAnchorAbsenceCandidate, judgeContainerAnchorAbsence };

const FILES = productFiles();
const ALL_TEXT = FILES.map((f) => f.text).join("\n");
const ALL_CHUNKS = FILES.flatMap((f) => cssRegionsOf(f).flatMap((region) => ruleChunks(region)));
const RECEIPTS = allReceipts(FILES);
const ROSTER = RECEIPTS.map((r) => judgeReceipt(r, ALL_CHUNKS, ALL_TEXT));

// Ratchets (DEC-393 wave-30 amendment, task w30-b; re-measured wave-34,
// task w34-h; re-measured again wave-35, task w35-b). Seeded by measuring
// the real corpus once (98 receipts: 19 composition, 11 inline, 68 other) --
// docs/design/audit/tap-floor-exempt-premise-v12.md is the full roster.
// UNVERIFIABLE-PREMISE is expected to be large this wave (every `other`
// reason, and every composition/inline receipt this instrument's
// necessarily-narrow companion-name heuristic cannot resolve) -- it is a
// roster count, not a defect count, and is two-sided only so a future wave
// narrowing the instrument (or widening its grammar) re-measures honestly
// rather than drifting silently.
// FALSE-PREMISE is a real 44px defect count. Wave 30 found one instance
// (cards.css.ts:239, .chq-pub-headshot-fallback) and recorded it as a
// predicate-grammar mismatch rather than a missing CSS rule: a
// REPLACED-CONTENT companion (an img/fallback box filled by width/height)
// satisfies DESIGN-RULINGS' hit-box floor with no text to centre or pad
// around, which this instrument's flex+padding-only grammar could not see.
// Wave 34 gives the instrument a second, width/height-based floor-grammar
// tier for exactly that shape (a companion co-styled with an `img` element
// selector whose own width/height rules put both axes at >=44px) -- forced
// to -1 and re-measured, the row now resolves VERIFIED and the ceiling
// drops to 0.
//
// Wave 35 (task w35-b, DEC-393 wave-35 amendment): grounding the CFP
// intro-cta/identity-note inline links added two new `inline-in-prose`
// receipts -- src/routes/public/cfp.css.ts (one comment, two TOKEN-scoped
// empty rules for both anchors) and src/routes/tools.css.ts (one, for the
// docs /login reference) -- each a real, named exemption the
// SSR_UNFLOORED_TOKENS_CEILING scan (app/src/phone-tap-target-ssr.scan.test.ts)
// requires, but neither names a companion class (DEVIATIONS.md is the
// grounding authority for these three, not another floored control), so
// both resolve UNVERIFIABLE-PREMISE exactly like the population's `other`
// rows -- 98 receipts -> 100, 86 -> 88.
//
// Wave 36 (task w36-f, DEC-393 wave-36 amendment) gives three more of the
// UNVERIFIABLE-PREMISE receipts a real predicate: `modifier` (5),
// `scoped` (2) and `render-gate` (6), 13 receipts total, all previously
// filed under `other` purely because classifyFamily's first-word regex
// didn't recognise their reason's opening word. `modifier`/`scoped` route
// through the SAME unchanged companion floor-grammar tiers; `render-gate`
// gets its own two-tier predicate (named+existing receipt test, then
// falsified against both live 390 rosters). Forced to -1 and re-measured on
// its own branch: 10 of the 13 resolve VERIFIED (the 6 agenda.css
// render-gate receipts, the 2 docs-site.css.ts modifier receipts, the 2
// theme.ts modifier receipts); 2 stay UNVERIFIABLE-PREMISE
// (error-states.css.ts:46's modifier reason names element types --
// input/select/textarea/fieldset -- not a `.chq-*` companion class, so the
// companion predicate has nothing to resolve; submissions/detail.css:278's
// scoped reason names its OWN compound selector's own receipted class, not
// a distinct companion, for the same reason).
//
// One of the 13 -- contacts.css:596's `scoped` receipt -- resolves
// FALSE-PREMISE: it names .chq-contacts-drawer-actions as the container
// that "only ever renders <button> children", but that container itself
// declares no min-height/padding floor (it is a pure flex layout wrapper;
// the floor lives on its .chq-btn children, which the companion predicate
// does not follow transitively). This is a REAL 44px-floor-grammar defect
// in the receipt's premise, not an instrument bug -- recorded in
// docs/design/audit/tap-floor-exempt-premise-v12.md with the offending
// selector named, per that task's own instruction (do not repair product
// CSS in that lane). FALSE-PREMISE ceiling moves 0 -> 1.
//
// SUPERSEDED (DEC-393 wave-39, task w39-a): "do not repair product CSS in
// that lane" is retracted for this one row -- it was the campaign's last
// unowned non-zero exit-predicate ceiling, so this wave repairs the
// receipt in place (option (a): re-point the `scoped to` clause) rather
// than filing another roster row. The premise was false as written
// because it named `.chq-contacts-drawer-actions` (the pure flex
// wrapper, no floor of its own) as the floored companion; the real floor
// is `.chq-btn`, which carries a shared base rule (display:inline-flex;
// align-items:center; padding:10px 16px, app/src/styles.css) plus this
// file's own phone-media `.chq-contacts-drawer-actions-right .chq-btn`
// rule (min-height:48px; padding:0 16px). The receipt at contacts.css
// (immediately above `.chq-contacts-drawer-actions-right`) now names
// `.chq-btn` as the companion instead, and re-measuring resolves it
// VERIFIED. FALSE-PREMISE ceiling moves 1 -> 0.
//
// MEGABATCH COMPOSITION (wave-36 thunderdome): w35-b and w36-f both moved
// this constant from the same wave-34 base of 86, along disjoint axes --
// w35-b ADDED 2 rows to the roster (86 -> 88, two new inline-in-prose
// receipts in reason families w36-f never touches), w36-f REMOVED 11 from
// the roster (86 -> 75, the VERIFIED + FALSE-PREMISE rows that actually
// left). Neither branch's number is right for the merged tree: composing
// the two disjoint deltas gives 88 - 11 = 77. FALSE-PREMISE takes w36-f's
// 1 unchanged (w35-b introduced none; wave 34's replaced-content grammar
// tier had already resolved the population's only prior instance).
//
// Wave 40 (task w40-f, DEC-808): the two remaining named shapes get their
// own tiers. ELEMENT-TYPE (`judgeElementTypeReason`): a reason naming a
// `/`-joined list of bare HTML element types resolves VERIFIED only when
// EVERY named type is reached by a selector-list arm that IS that bare type
// (never a descendant chain merely containing it) declaring
// min-height:44px somewhere in the tree; falls back to UNVERIFIABLE-PREMISE,
// never a silent VERIFIED, the moment one named type is unreached.
// SELF-SCOPED (`judgeSelfScoped`): a `scoped` reason naming only a token
// already in its own `receiptedClasses` (no distinct companion) is checked
// against ALL of the receipted compound selector's own classes, not just
// the self-named one -- REFUTED to FALSE-PREMISE, not silently accepted,
// the moment none of them declare a floor anywhere.
//
// Forced to -1 and re-measured standalone (never by arithmetic on the
// wave-36 composition -- the exact trap this constant already fell into
// once): 76, down from 77 by exactly one row.
// - `error-states.css.ts:46` STAYS UNVERIFIABLE-PREMISE: `input`/`select`/
//   `textarea` are each reached by theme.ts's own bare-type phone-media
//   rule (`min-height: 44px`), but `fieldset` is reached by NO rule
//   anywhere in the tree at all (a fieldset is a grouping container, never
//   itself a tap target -- `.chq-settings-panel fieldset label` reaches
//   44px, but that 44px belongs to the LABEL, not the fieldset, and the arm
//   grammar correctly refuses to credit it). The reason's own premise is
//   broader than the tree supports; this is an honest gap, not an
//   instrument miss -- recorded in the audit doc below.
// - `submissions/detail.css:278` now resolves VERIFIED: its receipted
//   compound selector is `.chq-detail-participant-row-actions
//   .chq-link-button`, and while the reason names only the container
//   (already in `receiptedClasses`, so the OLD companion search found
//   nothing), the OTHER receipted class -- `.chq-link-button` -- carries a
//   real floor in `app/src/styles.css`'s phone-media block (`min-height:
//   44px; min-width: 44px; display: flex; align-items: center; padding: 0
//   6px;`), a sheet the receipt's own file never touches. The self-scoped
//   tier's "check ALL receipted classes, not just the named one" rule is
//   exactly what finds it.
// UNVERIFIABLE-PREMISE: 77 -> 76. FALSE-PREMISE: neither new tier touched
// that ceiling; it sits at 0 because the DEC-393 wave-39 repair above
// re-pointed contacts.css's `scoped` receipt at `.chq-btn`, which the
// self-scoped tier likewise resolves VERIFIED.
// v12m-w40-e (DEC-393): cfp.css.ts:147 got a new `tap-floor-exempt:
// composition` receipt on `.chq-cfp-option`, mirroring portal.css.ts:572's
// pre-existing identical receipt for the SAME shared class (a bare radio/
// checkbox input wrapped in `label class="chq-cfp-option"`, the label
// being the real click/tap surface). The new receipt names no distinct
// companion class (deliberately -- naming one it can't verify would read
// as a false claim), so it resolves UNVERIFIABLE-PREMISE, same as its
// portal.css.ts twin. Re-measured on this branch: 77 -> 78.
//
// MEGABATCH COMPOSITION (wave-40 thunderdome): w40-f and w40-e both moved
// UNVERIFIABLE-PREMISE from the same base of 77 along disjoint axes --
// w40-f's two new tiers RESOLVED one existing row (77 -> 76), w40-e ADDED
// one new receipt in a family neither new tier verifies (77 -> 78).
// Composing the two disjoint deltas gives 77 - 1 + 1 = 77. FALSE-PREMISE
// stays 0: w39-a's contacts.css repair is in this tree and neither wave-40
// lane touched that ceiling.
//
// Wave 44 (task w44-e, DEC-393 wave-44 clause (a)): the ANCHORLESS-
// CONTAINER tier (`judgeContainerAnchorAbsence`, gated by
// `isContainerAnchorAbsenceCandidate`). Bucketing the 55 `other`-family
// reasons by their OWN TEXT (never the family label alone, which every
// prior wave's tiers already outgrew) found 37 stating one checkable
// premise: the receipted container's real markup renders no bare anchor,
// only `.chq-btn`/`.chq-link-button`-classed ones (or none at all) -- the
// 32 the task named (content.css/review.css/submissions.css/styles.css/
// detail.css/comms.css/contacts.css/forms.css/scorecard.css) plus 5 more
// the same textual gate legitimately admits (contacts-panels.css:295/997,
// overview.css:608, settings.css:2583). This tier walks the real JSX/TSX
// markup corpus rather than a CSS selector -- locate the receipted class
// as a literal className word, walk it to its own balanced matching close
// tag (a hand-rolled brace/quote-aware tag scanner that recurses into
// every tag's OWN `attrsText`, so a render-prop idiom like ModalFrame's
// `actions={<>...</>}` -- real rendered JSX sitting inside a `{...}`
// attribute VALUE -- is still found, at any nesting depth), and inspects
// every `<a`/`<Link`/`<NavLink` inside. Forced to -1 and re-measured
// standalone (never by arithmetic on the wave-40 base, the exact trap
// DEC-808 warns against): all 37 candidates resolve VERIFIED, including
// forms.css's `.chq-forms-field-modal-actions-right`, reachable ONLY via
// the render-prop recursion above -- UNVERIFIABLE-PREMISE moves 77 -> 40.
// FALSE-PREMISE stays 0: no bare, unfloored anchor was found inside any of
// the 37 real containers this tier can now check -- the whole population
// it resolves was already a true premise, not a defect this wave
// discovered.
//
// Wave-53 megabatch note: task w53-a independently re-measured this
// population at 37 on a sha that predated task w51-b's bare-token
// companion tier, which actively drained it 40 -> 34. 34 is the value
// carried forward here; it is re-derived from the tree, never inherited
// (DEC-808).
export const TAP_FLOOR_EXEMPT_UNVERIFIABLE_PREMISE_CEILING = 34;
export const TAP_FLOOR_EXEMPT_FALSE_PREMISE_CEILING = 0;

describe("tap-floor-exempt receipt premises are executable (DEC-393 wave-30 amendment)", () => {


  it("this instrument is DEC-393's own wave-30 amendment build (durable decision doc, cited by directory per DEC-976 -- a DEC_NNN registry constant is mutable and asserts nothing durable)", () => {
    void DEC_393; // compile-checked dependency marker only; text assertions below target the durable doc.
    const ruling = readFileSync(join(REPO_ROOT, "src", "decisions-data", "DEC-393.md"), "utf8");
    expect(ruling).toContain(
      "## Amendment (wave 30): a tap-floor-exempt reason is a premise about the tree, and its verifier must be named in the receipt and executable by a scan",
    );
    expect(ruling).toContain(
      "a tap-floor-exempt reason is a premise about the tree, and its verifier must be named in the receipt and executable by a scan",
    );
  });

  it("population sanity: walked a non-trivial number of real receipts (vacuous-population tripwire, DEC-999)", () => {
    expect(RECEIPTS.length).toBeGreaterThanOrEqual(90);
  });

  it("positive control: a composition receipt whose named companion IS floored resolves VERIFIED", () => {
    const receipt: Receipt = {
      file: "synthetic.css",
      line: 1,
      reason: "composition -- .chq-fake-companion is floored",
      receiptedClasses: ["chq-fake-target"],
      family: "composition",
    };
    const chunks = [{ selector: ".chq-fake-companion", body: "display:flex; align-items:center; min-height:44px; padding:0 8px;" }];
    const verdict = judgeReceipt(receipt, chunks, '<a class="chq-fake-companion">x</a>');
    expect(verdict.verdict).toBe("VERIFIED");
  });

  it("negative control: a composition receipt whose named companion is NOT floored resolves FALSE-PREMISE", () => {
    const receipt: Receipt = {
      file: "synthetic.css",
      line: 1,
      reason: "composition -- .chq-fake-companion is floored",
      receiptedClasses: ["chq-fake-target"],
      family: "composition",
    };
    const chunks = [{ selector: ".chq-fake-companion", body: "color: red;" }];
    const verdict = judgeReceipt(receipt, chunks, '<a class="chq-fake-companion">x</a>');
    expect(verdict.verdict).toBe("FALSE-PREMISE");
  });

  // DEC-393 wave-51 (task w51-b): the desktop-control-floor scan
  // (src/routes/public/cfp.css.ts) forbids a dot-prefixed class name in
  // CSS-comment prose, so a composition receipt obeying that rule names its
  // companion as a BARE token -- these three controls exercise that tier.

  it("positive control (bare-token companion): a composition receipt naming its companion as a BARE token (no leading dot) whose companion IS floored resolves VERIFIED", () => {
    const receipt: Receipt = {
      file: "synthetic.css",
      line: 1,
      reason: "composition -- both children are floored chq-fake-bare-companion controls, no leading dot in this prose (desktop-control-floor scan grammar)",
      receiptedClasses: ["chq-fake-bare-target"],
      family: "composition",
    };
    const chunks = [{ selector: ".chq-fake-bare-companion", body: "display:flex; align-items:center; min-height:44px; padding:0 8px;" }];
    const verdict = judgeReceipt(receipt, chunks, '<a class="chq-fake-bare-companion">x</a>');
    expect(verdict.verdict).toBe("VERIFIED");
  });

  it("negative control (bare-token companion): a composition receipt naming a BARE-token companion that is NOT floored resolves FALSE-PREMISE", () => {
    const receipt: Receipt = {
      file: "synthetic.css",
      line: 1,
      reason: "composition -- both children are floored chq-fake-bare-unfloored controls, no leading dot in this prose (desktop-control-floor scan grammar)",
      receiptedClasses: ["chq-fake-bare-target-2"],
      family: "composition",
    };
    const chunks = [{ selector: ".chq-fake-bare-unfloored", body: "color: red;" }];
    const verdict = judgeReceipt(receipt, chunks, '<a class="chq-fake-bare-unfloored">x</a>');
    expect(verdict.verdict).toBe("FALSE-PREMISE");
  });

  it("guard (bare-token companion): a bare token that IS the receipt's own receipted class is never treated as its own companion", () => {
    const receipt: Receipt = {
      file: "synthetic.css",
      line: 1,
      reason: "composition -- chq-fake-self-bare-target is a self-contained control, chq-fake-self-bare-target carries its own floor",
      receiptedClasses: ["chq-fake-self-bare-target"],
      family: "composition",
    };
    const chunks = [{ selector: ".chq-fake-self-bare-target", body: "display:flex; align-items:center; min-height:44px; padding:0 8px;" }];
    const verdict = judgeReceipt(receipt, chunks, '<a class="chq-fake-self-bare-target">x</a>');
    expect(verdict.verdict).toBe("UNVERIFIABLE-PREMISE");
  });

  it("negative control: a receipt naming no companion class resolves UNVERIFIABLE-PREMISE, never a silent pass", () => {
    const receipt: Receipt = {
      file: "synthetic.css",
      line: 1,
      reason: "composition -- always paired with its parent, no class named",
      receiptedClasses: ["chq-fake-target"],
      family: "composition",
    };
    const verdict = judgeReceipt(receipt, [], "");
    expect(verdict.verdict).toBe("UNVERIFIABLE-PREMISE");
  });

  it("negative control: a receipt whose family has no predicate this wave (`other`) is UNVERIFIABLE-PREMISE, never VERIFIED by omission", () => {
    const receipt: Receipt = { file: "synthetic.css", line: 1, reason: "render-gate -- never mounts here", receiptedClasses: [], family: "other" };
    const verdict = judgeReceipt(receipt, [], "");
    expect(verdict.verdict).toBe("UNVERIFIABLE-PREMISE");
  });

  it("the worked example: agenda.css.ts's day-footer inline receipt now names its floored sibling and resolves VERIFIED", () => {
    const row = ROSTER.find((r) => r.file === "src/routes/public/css/agenda.css.ts" && r.reason.startsWith("inline-in-prose -- DEC-393 wave-30"));
    expect(row, "the rewritten day-footer receipt must still be in the swept population").toBeDefined();
    expect(row?.verdict).toBe("VERIFIED");
  });

  it("the wave-34 worked example: cards.css.ts's headshot-link composition receipt names its replaced-content companion and now resolves VERIFIED", () => {
    const row = ROSTER.find((r) => r.file === "src/routes/public/css/cards.css.ts" && r.receiptedClasses.includes("chq-pub-headshot-link"));
    expect(row, "the headshot-link receipt must still be in the swept population").toBeDefined();
    expect(row?.verdict).toBe("VERIFIED");
    expect(row?.detail).toMatch(/replaced-content/);
  });

  it("positive control (DEC-393 wave-34, second tier): a replaced-content companion (co-styled with an img selector) reaching >=44px on both axes resolves VERIFIED with no flex/padding at all", () => {
    const receipt: Receipt = {
      file: "synthetic.css",
      line: 1,
      reason: "composition -- .chq-fake-replaced-companion carries the box",
      receiptedClasses: ["chq-fake-target"],
      family: "composition",
    };
    const chunks = [{ selector: ".chq-fake-wrap img, .chq-fake-replaced-companion", body: "width:64px; height:64px; object-fit:cover;" }];
    const verdict = judgeReceipt(receipt, chunks, '<div class="chq-fake-replaced-companion"></div>');
    expect(verdict.verdict).toBe("VERIFIED");
  });

  it("negative control (i, DEC-393 wave-34): a replaced-content companion sized under 44px on an axis still resolves FALSE-PREMISE", () => {
    const receipt: Receipt = {
      file: "synthetic.css",
      line: 1,
      reason: "composition -- .chq-fake-small-replaced-companion carries the box",
      receiptedClasses: ["chq-fake-target"],
      family: "composition",
    };
    const chunks = [{ selector: ".chq-fake-wrap img, .chq-fake-small-replaced-companion", body: "width:40px; height:40px; object-fit:cover;" }];
    const verdict = judgeReceipt(receipt, chunks, '<div class="chq-fake-small-replaced-companion"></div>');
    expect(verdict.verdict).toBe("FALSE-PREMISE");
  });

  it("negative control (ii, DEC-393 wave-34): a TEXT-BEARING companion sized >=44px with no flex/padding and no img pairing still resolves FALSE-PREMISE -- the new tier never weakens the existing grammar for text controls", () => {
    const receipt: Receipt = {
      file: "synthetic.css",
      line: 1,
      reason: "composition -- .chq-fake-text-companion carries the box",
      receiptedClasses: ["chq-fake-target"],
      family: "composition",
    };
    const chunks = [{ selector: ".chq-fake-text-companion", body: "width:100px; height:100px; font-size:14px;" }];
    const verdict = judgeReceipt(receipt, chunks, '<a class="chq-fake-text-companion">Some label text</a>');
    expect(verdict.verdict).toBe("FALSE-PREMISE");
  });

  // DEC-393 wave-36 (task w36-f): three more reason families get a real
  // predicate. `modifier` and `scoped` are routed through the SAME
  // unchanged companion floor-grammar tiers exercised above -- these
  // controls prove the family label alone (not the reason text) is what
  // used to fall to `other`, and now doesn't. `render-gate` gets its own
  // two-tier predicate (judgeRenderGate), exercised via dependency
  // injection so no synthetic control ever touches a real file on disk.

  it("positive control (modifier): a modifier receipt whose named base class IS floored resolves VERIFIED", () => {
    const receipt: Receipt = {
      file: "synthetic.css",
      line: 1,
      reason: "modifier that composes onto .chq-fake-modifier-base, which already carries the 44px floor",
      receiptedClasses: ["chq-fake-modifier-target"],
      family: "modifier",
    };
    const chunks = [{ selector: ".chq-fake-modifier-base", body: "display:flex; align-items:center; min-height:44px; padding:0 8px;" }];
    const verdict = judgeReceipt(receipt, chunks, '<a class="chq-fake-modifier-base">x</a>');
    expect(verdict.verdict).toBe("VERIFIED");
  });

  it("negative control (modifier): a modifier receipt whose named base class is NOT floored resolves FALSE-PREMISE", () => {
    const receipt: Receipt = {
      file: "synthetic.css",
      line: 1,
      reason: "modifier that composes onto .chq-fake-unfloored-base, which already carries the 44px floor",
      receiptedClasses: ["chq-fake-modifier-target-2"],
      family: "modifier",
    };
    const chunks = [{ selector: ".chq-fake-unfloored-base", body: "color: red;" }];
    const verdict = judgeReceipt(receipt, chunks, '<a class="chq-fake-unfloored-base">x</a>');
    expect(verdict.verdict).toBe("FALSE-PREMISE");
  });

  it("positive control (scoped): a scoped receipt whose named container IS floored resolves VERIFIED", () => {
    const receipt: Receipt = {
      file: "synthetic.css",
      line: 1,
      reason: "scoped to .chq-fake-scoped-container, which only ever renders <button> children",
      receiptedClasses: ["chq-fake-scoped-target"],
      family: "scoped",
    };
    const chunks = [{ selector: ".chq-fake-scoped-container", body: "display:flex; align-items:center; min-height:44px; padding:0 8px;" }];
    const verdict = judgeReceipt(receipt, chunks, '<div class="chq-fake-scoped-container">x</div>');
    expect(verdict.verdict).toBe("VERIFIED");
  });

  it("negative control (scoped): naming a nonexistent container stays UNVERIFIABLE, never VERIFIED by omission", () => {
    const receipt: Receipt = {
      file: "synthetic.css",
      line: 1,
      reason: "scoped to .chq-fake-nonexistent-container, which only ever renders <button> children",
      receiptedClasses: ["chq-fake-scoped-target-2"],
      family: "scoped",
    };
    const verdict = judgeReceipt(receipt, [], "");
    expect(verdict.verdict).toBe("UNVERIFIABLE-PREMISE");
  });

  it("positive control (render-gate): a real test file mentioning the component, token absent from both rosters, resolves VERIFIED", () => {
    const receipt: Receipt = {
      file: "synthetic.css",
      line: 1,
      reason: "render-gate -- FakeGate.tsx never mounts at phone width; verified by fake/fake-render-gate.receipt.test.ts.",
      receiptedClasses: ["chq-fake-render-gate-target"],
      family: "render-gate",
    };
    const verdict = judgeRenderGate(receipt, {
      exists: () => true,
      read: () => "describe('FakeGate.tsx never mounts on phone', () => {});",
      rosterA: "some other selector .chq-unrelated-thing appears here",
      rosterB: "another unrelated roster body",
    });
    expect(verdict.verdict).toBe("VERIFIED");
  });

  it("negative control (render-gate): a real test file mentioning the component, but the token DOES appear in a live 390 roster, resolves FALSE-PREMISE", () => {
    const receipt: Receipt = {
      file: "synthetic.css",
      line: 1,
      reason: "render-gate -- FakeGate.tsx never mounts at phone width; verified by fake/fake-render-gate.receipt.test.ts.",
      receiptedClasses: ["chq-fake-render-gate-target"],
      family: "render-gate",
    };
    const verdict = judgeRenderGate(receipt, {
      exists: () => true,
      read: () => "describe('FakeGate.tsx never mounts on phone', () => {});",
      rosterA: "the 390 sweep found .chq-fake-render-gate-target rendered at phone width",
      rosterB: "another unrelated roster body",
    });
    expect(verdict.verdict).toBe("FALSE-PREMISE");
  });

  it("negative control (render-gate): a receipt test file that does not exist on disk stays UNVERIFIABLE, never VERIFIED by omission", () => {
    const receipt: Receipt = {
      file: "synthetic.css",
      line: 1,
      reason: "render-gate -- FakeGate.tsx never mounts at phone width; verified by fake/nonexistent.receipt.test.ts.",
      receiptedClasses: ["chq-fake-render-gate-target-3"],
      family: "render-gate",
    };
    const verdict = judgeRenderGate(receipt, { exists: () => false, read: () => "", rosterA: "", rosterB: "" });
    expect(verdict.verdict).toBe("UNVERIFIABLE-PREMISE");
  });

  it("the wave-36 worked example: all six agenda.css render-gate receipts (DayGrid/SessionCard) resolve VERIFIED against the real receipt test and the real live 390 rosters", () => {
    const rows = ROSTER.filter((r) => r.file === "app/src/pages/agenda/agenda.css" && r.family === "render-gate");
    expect(rows.length).toBe(6);
    for (const row of rows) {
      expect(row.verdict, `${row.file}:${row.line} -- ${row.detail}`).toBe("VERIFIED");
    }
  });

  // DEC-393 wave-40 (task w40-f): two more floor-grammar tiers, for the
  // exact two shapes the wave-36 comment named as un-resolvable.

  it("positive control (element-type): a modifier reason naming element types ALL reached by a min-height:44px rule resolves VERIFIED", () => {
    const receipt: Receipt = {
      file: "synthetic.css",
      line: 1,
      reason: "modifier that composes onto a real form control (input/select), which already carries its own height/floor -- a per-token text scan can't follow that composition (fake-citation.test.ts SOME_CEILING, task fake)",
      receiptedClasses: ["chq-fake-invalid"],
      family: "modifier",
    };
    const chunks = [
      { selector: "input[type=text], select", body: "padding: 0.4rem 0.6rem;" },
      { selector: "input[type=text], select", body: "min-height: 44px;" },
    ];
    const verdict = judgeReceipt(receipt, chunks, "");
    expect(verdict.verdict).toBe("VERIFIED");
  });

  it("negative control (element-type): a modifier reason naming a type NO rule reaches does not resolve -- stays UNVERIFIABLE, never VERIFIED by omission", () => {
    const receipt: Receipt = {
      file: "synthetic.css",
      line: 1,
      reason: "modifier that composes onto a real form control (input/select), which already carries its own height/floor -- a per-token text scan can't follow that composition (fake-citation.test.ts SOME_CEILING, task fake)",
      receiptedClasses: ["chq-fake-invalid-2"],
      family: "modifier",
    };
    const chunks = [{ selector: "input[type=text]", body: "min-height: 44px;" }]; // "select" is never reached
    const verdict = judgeReceipt(receipt, chunks, "");
    expect(verdict.verdict).toBe("UNVERIFIABLE-PREMISE");
    expect(verdict.detail).toMatch(/select/);
  });

  it("the worked example (element-type): error-states.css.ts's modifier reason names element types, not a companion class", () => {
    const row = ROSTER.find((r) => r.file === "src/views/error-states.css.ts" && r.family === "modifier");
    expect(row, "the element-type receipt must still be in the swept population").toBeDefined();
    // `fieldset` never gets a min-height:44px rule anywhere in the tree (a
    // fieldset is a grouping container, not itself a tap target) -- so this
    // tier honestly cannot resolve it, and it stays UNVERIFIABLE-PREMISE
    // rather than being forced to a verdict the tree does not support.
    expect(row?.verdict).toBe("UNVERIFIABLE-PREMISE");
    expect(row?.detail).toMatch(/element-type tier/);
  });

  it("positive control (self-scoped): a scoped reason naming its OWN receipted token resolves VERIFIED when that token's own merged rule declares the floor", () => {
    const receipt: Receipt = {
      file: "synthetic.css",
      line: 1,
      reason: "scoped to .chq-fake-self-scoped-target, which only ever renders <button> children",
      receiptedClasses: ["chq-fake-self-scoped-target"],
      family: "scoped",
    };
    const chunks = [{ selector: ".chq-fake-self-scoped-target", body: "display:flex; align-items:center; min-height:44px; padding:0 8px;" }];
    const verdict = judgeReceipt(receipt, chunks, '<div class="chq-fake-self-scoped-target">x</div>');
    expect(verdict.verdict).toBe("VERIFIED");
    expect(verdict.detail).toMatch(/self-scoped tier/);
  });

  it("positive control (self-scoped, compound): the OTHER class in the receipted compound selector carries the floor, even though the reason names only the self token", () => {
    const receipt: Receipt = {
      file: "synthetic.css",
      line: 1,
      reason: "scoped to .chq-fake-scoped-wrap, which only ever renders <button> children",
      receiptedClasses: ["chq-fake-scoped-wrap", "chq-fake-scoped-child"],
      family: "scoped",
    };
    const chunks = [
      { selector: ".chq-fake-scoped-wrap", body: "display:flex; gap:12px;" },
      { selector: ".chq-fake-scoped-wrap .chq-fake-scoped-child", body: "display:flex; align-items:center; min-height:44px; padding:0 6px;" },
    ];
    const verdict = judgeReceipt(receipt, chunks, '<button class="chq-fake-scoped-child">x</button>');
    expect(verdict.verdict).toBe("VERIFIED");
    expect(verdict.detail).toMatch(/chq-fake-scoped-child/);
  });

  it("negative control (self-scoped): none of the receipted selector's own classes declare a floor anywhere -- REFUTED to FALSE-PREMISE, never silently accepted", () => {
    const receipt: Receipt = {
      file: "synthetic.css",
      line: 1,
      reason: "scoped to .chq-fake-unfloored-scoped-target, which only ever renders <button> children",
      receiptedClasses: ["chq-fake-unfloored-scoped-target"],
      family: "scoped",
    };
    const chunks = [{ selector: ".chq-fake-unfloored-scoped-target", body: "display:flex; gap:12px;" }];
    const verdict = judgeReceipt(receipt, chunks, '<div class="chq-fake-unfloored-scoped-target">x</div>');
    expect(verdict.verdict).toBe("FALSE-PREMISE");
    expect(verdict.detail).toMatch(/self-scoped tier/);
  });

  it("the worked example (self-scoped): submissions/detail.css's scoped reason resolves VERIFIED via its compound selector's OTHER class (.chq-link-button, floored in app/src/styles.css)", () => {
    const row = ROSTER.find((r) => r.file === "app/src/pages/submissions/detail.css" && r.family === "scoped");
    expect(row, "the self-scoped receipt must still be in the swept population").toBeDefined();
    expect(row?.verdict).toBe("VERIFIED");
    expect(row?.detail).toMatch(/self-scoped tier/);
  });

  // ANCHORLESS-CONTAINER tier (DEC-393 wave-44, task w44-e): the
  // falsifiability pair every sibling tier above carries, run through the
  // REAL matcher (`judgeContainerAnchorAbsence`, dependency-injected with a
  // synthetic markup corpus) -- never a re-implementation.

  it("positive control (container-anchor): a container whose reason asserts anchor-absence and whose real markup holds only button children resolves VERIFIED", () => {
    const receipt: Receipt = {
      file: "synthetic.css",
      line: 1,
      reason: "FakeComponent.tsx's chq-fake-anchorless-actions row wraps button.chq-btn elements only, no anchor -- the anchor-floor scan's container-reach check can never see the .chq-btn descendants floor.",
      receiptedClasses: ["chq-fake-anchorless-actions"],
      family: "other",
    };
    expect(isContainerAnchorAbsenceCandidate(receipt.reason)).toBe(true);
    const files: MarkupFile[] = [
      {
        path: "fake/FakeComponent.tsx",
        text: '<div className="chq-fake-anchorless-actions"><button type="button" className="chq-btn">Approve</button></div>',
      },
    ];
    const verdict = judgeContainerAnchorAbsence(receipt, files);
    expect(verdict.verdict).toBe("VERIFIED");
    expect(verdict.detail).toMatch(/container-anchor tier/);
  });

  it("negative control (container-anchor): a container whose reason asserts anchor-absence but whose real markup holds a bare, unfloored anchor resolves FALSE-PREMISE -- a real 44px defect, never softened to UNVERIFIABLE", () => {
    const receipt: Receipt = {
      file: "synthetic.css",
      line: 1,
      reason: "FakeComponent.tsx's chq-fake-anchor-leak-actions row wraps button.chq-btn elements only, no anchor -- the anchor-floor scan's container-reach check can never see the .chq-btn descendants floor.",
      receiptedClasses: ["chq-fake-anchor-leak-actions"],
      family: "other",
    };
    expect(isContainerAnchorAbsenceCandidate(receipt.reason)).toBe(true);
    const files: MarkupFile[] = [
      {
        path: "fake/FakeComponent.tsx",
        text: '<div className="chq-fake-anchor-leak-actions"><button type="button" className="chq-btn">Approve</button><a href="/x">See more</a></div>',
      },
    ];
    const verdict = judgeContainerAnchorAbsence(receipt, files);
    expect(verdict.verdict).toBe("FALSE-PREMISE");
    expect(verdict.detail).toMatch(/bare <a>/);
  });

  it("negative control (container-anchor): a receipted class absent from the whole markup corpus stays UNVERIFIABLE, never VERIFIED by omission", () => {
    const receipt: Receipt = {
      file: "synthetic.css",
      line: 1,
      reason: "FakeComponent.tsx's chq-fake-nowhere-actions row wraps button.chq-btn elements only, no anchor.",
      receiptedClasses: ["chq-fake-nowhere-actions"],
      family: "other",
    };
    const verdict = judgeContainerAnchorAbsence(receipt, []);
    expect(verdict.verdict).toBe("UNVERIFIABLE-PREMISE");
  });

  it("the worked example (container-anchor, render-prop nesting): forms.css's .chq-forms-field-modal-actions-right resolves VERIFIED via the real markup corpus, even though it is only reachable by recursing into ModalFrame's own `actions={...}` render-prop attribute", () => {
    const row = ROSTER.find((r) => r.file === "app/src/pages/forms/forms.css" && r.receiptedClasses.includes("chq-forms-field-modal-actions-right"));
    expect(row, "the render-prop-nested receipt must still be in the swept population").toBeDefined();
    expect(row?.verdict).toBe("VERIFIED");
    expect(row?.detail).toMatch(/container-anchor tier/);
  });

  it(`FALSE-PREMISE ceiling: at most ${TAP_FLOOR_EXEMPT_FALSE_PREMISE_CEILING} receipt(s) claim a companion floor that isn't real`, () => {
    const offenders = ROSTER.filter((r) => r.verdict === "FALSE-PREMISE");
    if (offenders.length > TAP_FLOOR_EXEMPT_FALSE_PREMISE_CEILING) {
      throw new Error(
        `${offenders.length} FALSE-PREMISE receipt(s), above TAP_FLOOR_EXEMPT_FALSE_PREMISE_CEILING=` +
          `${TAP_FLOOR_EXEMPT_FALSE_PREMISE_CEILING}:\n` +
          offenders.map((o) => `  ${o.file}:${o.line} — ${o.detail}`).join("\n"),
      );
    }
    expect(offenders.length).toBeLessThanOrEqual(TAP_FLOOR_EXEMPT_FALSE_PREMISE_CEILING);
  });

  it("the FALSE-PREMISE ceiling is not stale (two-sided ratchet, DEC-808)", () => {
    const offenders = ROSTER.filter((r) => r.verdict === "FALSE-PREMISE");
    expect(offenders.length).toBe(TAP_FLOOR_EXEMPT_FALSE_PREMISE_CEILING);
  });

  it(`UNVERIFIABLE-PREMISE ceiling: exactly ${TAP_FLOOR_EXEMPT_UNVERIFIABLE_PREMISE_CEILING} receipt(s) are roster rows this wave's instrument cannot settle (two-sided ratchet)`, () => {
    const roster = ROSTER.filter((r) => r.verdict === "UNVERIFIABLE-PREMISE");
    expect(roster.length).toBe(TAP_FLOOR_EXEMPT_UNVERIFIABLE_PREMISE_CEILING);
  });

  it("every receipt in the population resolves to exactly one of the three verdicts (no receipt is silently dropped)", () => {
    expect(ROSTER.length).toBe(RECEIPTS.length);
    for (const row of ROSTER) {
      expect(["VERIFIED", "UNVERIFIABLE-PREMISE", "FALSE-PREMISE"]).toContain(row.verdict);
    }
  });
});
