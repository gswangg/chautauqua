// DEC-967 (wave 100 amendment, extended wave 31): docs/design/DEVIATIONS.md
// is the third authority the v12 mobile-campaign goal names (frames,
// DESIGN-RULINGS.md, DEVIATIONS.md). Every entry in it asserts something
// about the tree -- "the app keeps the recorded A20 ruling", "the Sort
// <select>'s phone display:none was DELETED", ".chq-submissions-columnpicker's
// phone display:none STANDS", "NO STATUS CODE CHANGED" -- and fidelity
// audits are told to cite this file INSTEAD of re-flagging, so a stale
// entry silently suppresses a real finding. Modeled BYTE-FOR-BYTE on
// test/clarifications-ledger.scan.test.ts and
// test/design-rulings-ledger.scan.test.ts's derived-population +
// transcribed-ledger + two-directional-assertion idiom -- same shape, same
// falsifiability controls, no invention.
//
// DEC-967 wave-31 amendment: the original wave-100 build graded only FOUR of
// the file's NINE "## " headings (a hand-listed `INCLUDED_HEADINGS` literal
// array, with a matching hand-listed `EXCLUDED_HEADINGS`). That hard-codes
// the population DEC-180 forbids. This wave replaces both arrays with
// `LEDGER_SECTIONS`, derived at test time from every `^## ` heading the file
// actually contains -- so a heading added or removed from
// docs/design/DEVIATIONS.md changes this test's population automatically,
// never by hand-editing a list here.
//
// The two headings the wave-100 build's header comment gave reasons to
// skip were BOTH stale by wave 31, and this file no longer repeats either
// reason because neither reason is true any more:
//   - "## v12 frame errata" was cited as "an in-flight branch (v12m-w14-b)
//     is actively deleting it". That branch landed; the heading is GONE
//     from docs/design/DEVIATIONS.md (confirmed: `grep -c '^## ' ...` finds
//     nine headings, none of them errata). A derivation from real headings
//     can never re-invent a deleted one, so no special-case is needed to
//     keep skipping it.
//   - "## 5. Pending adjudication" was cited as "stale prose, its one entry
//     is answered by ## 6's Adjudications". The section's OWN TEXT has
//     since been rewritten to say exactly that in the document itself: "No
//     adjudication is currently open. ... was verdicted by the G13 srv1
//     adjudication and is recorded, resolved, in §6's 'Adjudications
//     recorded'." A section whose only content is a statement that nothing
//     is open still asserts something about the tree -- so it is now
//     GRADED, not skipped, as a single divider-style row (see "Divider
//     rows" below) rather than a bulleted one, because it draws zero
//     top-level bullets of its own.
//
// Population: every top-level bullet entry under EVERY "## " heading in
// docs/design/DEVIATIONS.md, re-derived at test time, never hand-listed. A
// "top-level" bullet is a line starting with "- " at column 0 (no leading
// whitespace) -- this naturally excludes nested sub-bullets (e.g. under the
// "Submissions 390 phone head" entry, section 3), which are indented and so
// never match the top-level pattern; their text is still folded into their
// parent bullet's joined text (harmless -- it only ever appears after the
// parent's own lead-in has already been extracted).
//
// Divider rows: a heading that draws ZERO top-level bullets (only "## 5.
// Pending adjudication" currently qualifies -- confirmed by running the
// same bullet-deriving function against all nine headings) still asserts
// something about the tree via its own prose, so it still contributes
// exactly ONE derived population entry, keyed off the HEADING TITLE itself
// rather than off any bullet lead-in. This is the identical reasoning
// test/design-rulings-ledger.scan.test.ts already applies to its own
// section-divider headings ("## A. Extensions", "## B. Uncovered
// surfaces") -- a divider or an empty-by-design section names no single
// artifact of its own, so it is recorded "gap", never force-fit to a
// borrowed citation from a sibling section. "## 4. Voice" is the second
// case that reaches "gap", but for a different structural reason: it DOES
// draw one top-level bullet (so it IS bullet-derived, normally), but that
// bullet's claim -- "docs prose follows the STE-derived house rules" -- is
// a broad style/voice policy governing all docs prose, not a fact any
// single file discharges; the bullet mentions one real supporting file
// (the technical-names glossary), but citing that file as though it proved
// the WHOLE policy would be exactly the force-fit this scan's own "gap"
// verdict exists to avoid. Both are flagged here as the narrowest
// reasonable reading of "genuinely artifact-free prose" per the task's own
// instruction to name a design gap rather than force a citation.
//
// Lead-in extraction, in priority order, applied to a bullet's full joined
// text (its first line plus every continuation line up to the next
// top-level bullet, heading, or bold paragraph-header line) -- unchanged
// from the wave-100 build and verified by reading (not assumed) to also
// cover sections 4a, 7 and 8's bullet shapes, all of which open on a bold
// span like sections 1/2/3:
//   1. If the joined text opens with a bold span ("**...**"), the lead-in
//      is that span's contents (the bold span may itself span multiple
//      source lines, e.g. the Speakers write-failed entry, which is why
//      extraction runs on the JOINED text, not the bullet's first line
//      alone).
//   2. Otherwise (every bullet under "## 6", none of which opens on a bold
//      span -- confirmed by grep), the lead-in is the text before the
//      first " — " (em dash) or ": " (colon-space), whichever occurs
//      first.
//   3. Otherwise (no delimiter found), the lead-in is the whole joined text
//      with a trailing "." stripped.
//
// Ledger verdicts:
//   - "honored": the tree keeps the claim. Two sub-kinds, both under the
//     "honored" status (the task specifies three verdicts, not four, and a
//     "ruled omission" IS a kept claim -- compliance is the artifact's
//     absence, not its presence):
//       - present: a cited file exists, contains the cited literal
//         verbatim, and a cited test file exists.
//       - absent: a cited term must not appear anywhere under src/** or
//         app/src/** (a deliberately-not-built control, DEC-941-style).
//   - "superseded": a LATER section of docs/design/DEVIATIONS.md itself
//     records the adjudication -- the cited literal must appear verbatim in
//     DEVIATIONS.md's own bytes, at or after the citing entry's own
//     section. (One real case: section 1's Speakers write-failed pill
//     entry is superseded by section 6's "Speakers status vocabulary under
//     write-failure (DEC-730, wave-90 amendment)" adjudication -- the same
//     finding, recorded twice, the second time as the resolved word.)
//   - "gap": recorded openly, never faked with a citation that doesn't
//     resolve. Section 6's "Unbuilt features" and "Reworks larger than the
//     freeze window" bullets are legitimately "gap" -- the document's own
//     words say these are deferred, not built, not disguised as done. The
//     wave-31 divider rows ("## 5" itself, and "## 4"'s one bullet) are
//     "gap" for the reason given above.
//
// Both directions are asserted: every derived bullet has exactly one ledger
// row, and every ledger row names a live derived key -- so neither a new
// DEVIATIONS.md entry nor a removed one drifts silently. On failure the
// test prints the exact problem list, never just a count.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { DEC_967 } from "../src/decisions";
import { deriveBullets, deriveLedgerSections, slugify } from "./deviations-ledger/derive";
import { LEDGER } from "./deviations-ledger/ledger";
import { bulletAssertsNonBuild, fileContains, fileExists, literalAppearsInDeviations, termAppearsInTree } from "./deviations-ledger/resolvers";
import { findDeviationsProblems } from "./deviations-ledger/find-problems";
import type { DerivedBullet, LedgerEntry } from "./deviations-ledger/types";

// DEC-967 wave-38 amendment: this file was decomposed into
// test/deviations-ledger/{types,derive,resolvers,find-problems,ledger}.ts
// (contention decomposition -- test/deviations-ledger.scan.test.ts had been
// involved in four merge conflicts, mostly from unrelated waves each
// adding a row to the same giant LEDGER array). No behavior changed: the
// population-derivation functions, the resolvers, and findDeviationsProblems
// are byte-identical logic, just relocated; LEDGER is the same data, moved
// verbatim into its own file so a new ledger row no longer collides with a
// change to this scan's machinery. findDeviationsProblems is re-exported
// here so any external importer of this test file keeps working.
export { findDeviationsProblems };

// DEC-967 is a compile-checked dependency of this file's population and
// verdict logic (see the header above): referencing the constant here
// means a rename/removal of DEC-967's decisions-data entry breaks this
// file's build, not just its runtime.
void DEC_967;

const ROOT = resolve(__dirname, "..");
const DEVIATIONS_PATH = join(ROOT, "docs", "design", "DEVIATIONS.md");
const DEVIATIONS_TEXT = readFileSync(DEVIATIONS_PATH, "utf8");

/** DEC-967 wave-31 amendment: every `## ` heading the file actually
 * contains, in document order -- never a hand-listed array. */
const LEDGER_SECTIONS: string[] = deriveLedgerSections(DEVIATIONS_TEXT);

const realResolvers = {
  fileExists: (p: string) => fileExists(ROOT, p),
  fileContains: (file: string, literal: string) => fileContains(ROOT, file, literal),
  termInTree: (t: string) => termAppearsInTree(ROOT, t),
  literalInDoc: (l: string) => literalAppearsInDeviations(DEVIATIONS_TEXT, l),
};

describe("deviations-ledger.scan (DEC-967 wave-100 amendment, wave-31 population extension)", () => {
  const derived = deriveBullets(DEVIATIONS_TEXT, LEDGER_SECTIONS);

  it("tripwire: derived bullet population is non-empty and every key is stable/derived (never hardcoded)", () => {
    expect(derived.length).toBeGreaterThan(0);
    for (const d of derived) {
      expect(d.key.length, `bullet "${d.leadIn}" produced an empty key`).toBeGreaterThan(0);
      expect(d.key).toBe(slugify(d.leadIn));
    }
  });

  it("LEDGER_SECTIONS is derived from the live file, not a literal array, and finds all ten real headings", () => {
    expect(LEDGER_SECTIONS.length).toBe(10);
    for (const heading of LEDGER_SECTIONS) {
      expect(DEVIATIONS_TEXT.includes(heading), `expected DEVIATIONS.md to contain "${heading}"`).toBe(true);
    }
  });

  it("vacuous-population tripwire: exact entry count per section (re-measured wave-31, all nine headings now graded)", () => {
    const bySection = new Map<string, number>();
    for (const d of derived) bySection.set(d.heading, (bySection.get(d.heading) ?? 0) + 1);
    expect(bySection.get("## 1. Ruled omissions")).toBe(3);
    expect(bySection.get("## 2. State-layer additions (frames draw no row/selection states)")).toBe(6);
    expect(bySection.get("## 3. Interpretations where the frames underspecify")).toBe(22);
    expect(bySection.get("## 4. Voice")).toBe(1);
    expect(bySection.get("## 4a. Docs screenshots: tall frames, prepared states, and focus (USER RULINGS 2026-08-16 / 2026-08-17)")).toBe(4);
    expect(bySection.get("## 5. Pending adjudication (not yet blessed — sweep should verdict)")).toBe(1);
    expect(bySection.get("## 6. Deferred post-deadline (USER RULING 2026-08-16, G13 sweep)")).toBe(22);
    expect(bySection.get("## 7. Settled frame divergences (wave 16 amendment, DEC-663)")).toBe(18);
    expect(bySection.get("## 8. Wave 9 rulings (DEC-976 / DEC-781 wave-9 amendments)")).toBe(4);
    expect(bySection.get("## 9. Wave 34 rulings (DEC-021 wave-34 amendment)")).toBe(1);
    expect(derived.length).toBe(82);
  });

  it("'## 5. Pending adjudication' derives exactly one DIVIDER row (its own heading), never re-deriving ## 6's 'tracks-and-rooms-save-model' bullet -- no key collision between the two sections", () => {
    const fromFive = derived.filter((d) => d.heading === "## 5. Pending adjudication (not yet blessed — sweep should verdict)");
    expect(fromFive).toHaveLength(1);
    expect(fromFive[0]!.key).toBe("5-pending-adjudication-not-yet-blessed-sweep-should-verdict");
    const trsmBullets = derived.filter((d) => d.key === "tracks-and-rooms-save-model");
    expect(trsmBullets).toHaveLength(1);
    expect(trsmBullets[0]!.heading).toBe("## 6. Deferred post-deadline (USER RULING 2026-08-16, G13 sweep)");
  });

  it("every derived bullet has exactly one ledger row, and every ledger row names a live derived key", () => {
    const problems = findDeviationsProblems(derived, LEDGER, realResolvers).filter(
      (p) => p.includes("no ledger row") || p.includes("ledger rows (must be exactly 1)") || p.includes("stale ledger row") || p.includes("duplicate derived key"),
    );
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("every honored row's citation resolves (present: file exists + contains literal + test exists; absent: term genuinely absent from src/** and app/src/**)", () => {
    const problems = findDeviationsProblems(derived, LEDGER, realResolvers).filter((p) => p.includes("honored"));
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("every superseded row's cited literal genuinely appears in DEVIATIONS.md", () => {
    const problems = findDeviationsProblems(derived, LEDGER, realResolvers).filter((p) => p.includes("superseded row"));
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("no gap row carries a fake citation", () => {
    const problems = findDeviationsProblems(derived, LEDGER, realResolvers).filter((p) => p.includes("gap row"));
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("no problems at all -- the ledger is exact in both directions against the current tree", () => {
    const problems = findDeviationsProblems(derived, LEDGER, realResolvers);
    expect(problems, problems.join("\n")).toEqual([]);
  });

  // DEC-808 wave-20 amendment: this file's DEC-996 bullet names the
  // Settings frame from inside the file's header block (above the first
  // describe(), naming shorthand only) -- the header-block exemption's
  // companion rule requires at least one fully-receipted, non-header
  // citation into that same frame elsewhere in the file to pay for it.
  // This is that citation: a backtick quote read verbatim from the frame
  // line, immediately followed by a real expect(...).toBe(...) pinning it
  // (DEC-967 verbatimLine idiom).
  // docs/design/Chautauqua Settings.dc.html:1047 `              <h1 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:30px; font-weight:700; letter-spacing:-0.04em; line-height:1">AI track sessions</h1>`
  it("DEC-996 citation is verbatim: the Settings frame's :1047 h1 draws the literal this ledger's bullet cites", () => {
    const settingsDesignFile = join(ROOT, "docs", "design", "Chautauqua Settings.dc.html");
    const lines = readFileSync(settingsDesignFile, "utf8").split("\n");
    const line = lines[1047 - 1];
    expect(line).toBe(
      "              <h1 style=\"margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:30px; font-weight:700; letter-spacing:-0.04em; line-height:1\">AI track sessions</h1>",
    );
  });
});

describe("findDeviationsProblems negative controls (DEC-099: every scan ships one)", () => {
  const baseDerived: DerivedBullet[] = [{ key: "zzz-01", leadIn: "ZZZ", heading: "## 1. Ruled omissions" }];
  const baseLedger: LedgerEntry[] = [
    { key: "zzz-01", status: "honored", reason: "test", honored: { kind: "present", file: "src/decisions.ts", literal: "export", testFile: "test/deviations-ledger.scan.test.ts" } },
  ];
  const fakeResolvers = {
    fileExists: (p: string) => p === "src/decisions.ts" || p === "test/deviations-ledger.scan.test.ts",
    fileContains: (f: string, l: string) => f === "src/decisions.ts" && l === "export",
    termInTree: (t: string) => t === "present-term",
    literalInDoc: (l: string) => l === "real-doc-literal",
  };

  it("compliant ledger against its matching population reports nothing (proves the scan can pass)", () => {
    expect(findDeviationsProblems(baseDerived, baseLedger, fakeResolvers)).toEqual([]);
  });

  it("a derived bullet with no ledger row IS reported (direction: population -> ledger)", () => {
    const extraDerived: DerivedBullet[] = [...baseDerived, { key: "zzz-99-unledgered", leadIn: "ZZZ99", heading: "## 1. Ruled omissions" }];
    const problems = findDeviationsProblems(extraDerived, baseLedger, fakeResolvers);
    expect(problems.some((p) => p.includes("zzz-99-unledgered"))).toBe(true);
  });

  it("a stale ledger row citing a dead key IS reported (direction: ledger -> population)", () => {
    const staleLedger: LedgerEntry[] = [...baseLedger, { key: "zzz-dead", status: "honored", reason: "x", honored: { kind: "present", file: "src/decisions.ts", literal: "export", testFile: "test/deviations-ledger.scan.test.ts" } }];
    const problems = findDeviationsProblems(baseDerived, staleLedger, fakeResolvers);
    expect(problems.some((p) => p.includes("zzz-dead"))).toBe(true);
  });

  it("a present-honored row citing a nonexistent path fails the resolver", () => {
    const badLedger: LedgerEntry[] = [{ key: "zzz-01", status: "honored", reason: "x", honored: { kind: "present", file: "src/does-not-exist.ts", literal: "export", testFile: "test/deviations-ledger.scan.test.ts" } }];
    const problems = findDeviationsProblems(baseDerived, badLedger, fakeResolvers);
    expect(problems.some((p) => p.includes("src/does-not-exist.ts"))).toBe(true);
  });

  it("a present-honored row whose cited file exists but does not contain the literal IS reported", () => {
    const badLiteral: LedgerEntry[] = [{ key: "zzz-01", status: "honored", reason: "x", honored: { kind: "present", file: "src/decisions.ts", literal: "definitely-not-present", testFile: "test/deviations-ledger.scan.test.ts" } }];
    const problems = findDeviationsProblems(baseDerived, badLiteral, fakeResolvers);
    expect(problems.some((p) => p.includes("definitely-not-present"))).toBe(true);
  });

  it("an absent-honored row whose term exists in the tree IS reported", () => {
    const badAbsence: LedgerEntry[] = [{ key: "zzz-01", status: "honored", reason: "x", honored: { kind: "absent", term: "present-term" } }];
    const problems = findDeviationsProblems(baseDerived, badAbsence, fakeResolvers);
    expect(problems.some((p) => p.includes("present-term"))).toBe(true);
  });

  it("an absent-honored row whose term genuinely does not appear is accepted", () => {
    const goodAbsence: LedgerEntry[] = [{ key: "zzz-01", status: "honored", reason: "x", honored: { kind: "absent", term: "totally-absent-term" } }];
    expect(findDeviationsProblems(baseDerived, goodAbsence, fakeResolvers)).toEqual([]);
  });

  it("a superseded row whose literal is not in DEVIATIONS.md IS reported", () => {
    const badSuperseded: LedgerEntry[] = [{ key: "zzz-01", status: "superseded", reason: "x", superseded: { literal: "not-in-doc" } }];
    const problems = findDeviationsProblems(baseDerived, badSuperseded, fakeResolvers);
    expect(problems.some((p) => p.includes("not-in-doc"))).toBe(true);
  });

  it("a superseded row whose literal genuinely appears in DEVIATIONS.md is accepted", () => {
    const goodSuperseded: LedgerEntry[] = [{ key: "zzz-01", status: "superseded", reason: "x", superseded: { literal: "real-doc-literal" } }];
    expect(findDeviationsProblems(baseDerived, goodSuperseded, fakeResolvers)).toEqual([]);
  });

  it("a gap row carrying a citation IS reported (a gap must never be faked as resolved)", () => {
    const fakedGap: LedgerEntry[] = [{ key: "zzz-01", status: "gap", reason: "x", honored: { kind: "absent", term: "present-term" } }];
    const problems = findDeviationsProblems(baseDerived, fakedGap, fakeResolvers);
    expect(problems.some((p) => p.includes("gap row zzz-01"))).toBe(true);
  });

  it("a clean gap row with no citation is accepted", () => {
    const cleanGap: LedgerEntry[] = [{ key: "zzz-01", status: "gap", reason: "x" }];
    expect(findDeviationsProblems(baseDerived, cleanGap, fakeResolvers)).toEqual([]);
  });

  // DEC-967 wave-145: array-of-Cite support and the generalised non-build
  // check, both proved on synthetic fixtures this test OWNS -- never on a
  // real product offender's identity (a sentinel anchored to a live row
  // dies the moment that row is fixed; DEC-967 waves 100/123/143).
  it("an honored row's citation array requires EVERY element to resolve -- one bad element among good ones IS reported", () => {
    const mixedArray: LedgerEntry[] = [
      {
        key: "zzz-01",
        status: "honored",
        reason: "x",
        honored: [
          { kind: "present", file: "src/decisions.ts", literal: "export", testFile: "test/deviations-ledger.scan.test.ts" },
          { kind: "absent", term: "present-term" },
        ],
      },
    ];
    const problems = findDeviationsProblems(baseDerived, mixedArray, fakeResolvers);
    expect(problems.some((p) => p.includes("present-term"))).toBe(true);
  });

  it("an honored row's citation array where every element resolves is accepted", () => {
    const goodArray: LedgerEntry[] = [
      {
        key: "zzz-01",
        status: "honored",
        reason: "x",
        honored: [
          { kind: "present", file: "src/decisions.ts", literal: "export", testFile: "test/deviations-ledger.scan.test.ts" },
          { kind: "absent", term: "totally-absent-term" },
        ],
      },
    ];
    expect(findDeviationsProblems(baseDerived, goodArray, fakeResolvers)).toEqual([]);
  });

  it("bulletAssertsNonBuild: matches the document's own non-build phrasing, not arbitrary prose", () => {
    expect(bulletAssertsNonBuild("no phone dock is minted")).toBe(true);
    expect(bulletAssertsNonBuild("Contacts Pipeline keeps its landed head action; no phone dock is minted (DEC-576 wave-120/124)")).toBe(true);
    expect(bulletAssertsNonBuild('"Archive this event" must not appear anywhere')).toBe(true);
    expect(bulletAssertsNonBuild("Contacts Pipeline · 390 dock IS minted")).toBe(false);
    expect(bulletAssertsNonBuild("Tracks/rooms drag-handle reordering")).toBe(false);
  });

  it("a non-build bullet whose honored row carries ONLY a present citation IS reported (the exact hole DEC-967 wave-145 closes)", () => {
    const nonBuildDerived: DerivedBullet[] = [{ key: "zzz-nb", leadIn: "no synthetic widget is minted", heading: "## 1. Ruled omissions" }];
    const presentOnly: LedgerEntry[] = [
      { key: "zzz-nb", status: "honored", reason: "x", honored: { kind: "present", file: "src/decisions.ts", literal: "export", testFile: "test/deviations-ledger.scan.test.ts" } },
    ];
    const problems = findDeviationsProblems(nonBuildDerived, presentOnly, fakeResolvers);
    expect(problems.some((p) => p.includes("zzz-nb") && p.includes("no absent-kind citation"))).toBe(true);
  });

  it("a non-build bullet whose honored row also carries an absent citation is accepted", () => {
    const nonBuildDerived: DerivedBullet[] = [{ key: "zzz-nb", leadIn: "no synthetic widget is minted", heading: "## 1. Ruled omissions" }];
    const both: LedgerEntry[] = [
      {
        key: "zzz-nb",
        status: "honored",
        reason: "x",
        honored: [
          { kind: "present", file: "src/decisions.ts", literal: "export", testFile: "test/deviations-ledger.scan.test.ts" },
          { kind: "absent", term: "totally-absent-term" },
        ],
      },
    ];
    expect(findDeviationsProblems(nonBuildDerived, both, fakeResolvers)).toEqual([]);
  });

  it("a non-build bullet whose row is 'superseded' (not 'honored') is exempt from the absent-clause requirement -- supersession, not a live non-build claim, resolves it", () => {
    const nonBuildDerived: DerivedBullet[] = [{ key: "zzz-nb", leadIn: "no synthetic widget is minted", heading: "## 1. Ruled omissions" }];
    const superseded: LedgerEntry[] = [{ key: "zzz-nb", status: "superseded", reason: "x", superseded: { literal: "real-doc-literal" } }];
    expect(findDeviationsProblems(nonBuildDerived, superseded, fakeResolvers)).toEqual([]);
  });
});
