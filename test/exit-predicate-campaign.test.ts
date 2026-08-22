// Unit tests for the DEC-069 wave-116 (task w5-ag) campaign section of
// scripts/exit-predicate.ts. Fixture strings only -- no fs, matching this
// module's "no I/O in an exported function" contract.
//
// These pin the DERIVATION mechanism, not today's measured numbers: the
// real campaign ratchet values move every wave (see docs/field-guide.md),
// and a test asserting a specific value here would turn every honest
// ratchet drop into a false red. Instead this fixture supplies its OWN
// synthetic set of file contents shaped exactly like the real corpus, so
// the assertions stay true regardless of what the real scan files measure.

import { describe, expect, it } from "vitest";
import {
  assertCampaignPopulationTotal,
  assertEveryGradedCeilingIsGated,
  buildCampaignReport,
  CAMPAIGN_CONSTANT_NAMES,
  type CampaignFile,
  findCampaignCeilingCandidates,
  findConstantDeclarations,
  formatCampaignReport,
  OUT_OF_CAMPAIGN_SCOPE,
  type SuiteEvidence,
} from "../scripts/exit-predicate";

// wave-132 (task w7-e, instrument integrity repair): buildCampaignReport now
// requires suite evidence as an explicit input (never discovered by the
// function itself). Tests that don't care about the suite-verification
// behaviour use this fixed "always verified" evidence so their pre-existing
// assertions about desktop/phone/tier2 stay unaffected.
const VERIFIED_EVIDENCE: SuiteEvidence = {
  productSha: "product-sha",
  suiteVerifiedAtSha: "suite-sha",
  isAncestor: () => true,
};

/**
 * A synthetic corpus shaped like the real one: two "ledger" files each
 * declaring their own population constant plus a CLAIMED_FLOOR, and one
 * file per Tier-2 ceiling. Values are arbitrary and deliberately NOT the
 * real campaign's current numbers.
 */
function baseFixture(): CampaignFile[] {
  return [
    {
      path: "test/desktop-frame-ledger.scan.test.ts",
      content: [
        "// fixture desktop ledger",
        "const EXPECTED_TOTAL_PRE_DEVIATION = 40;",
        "const EXPECTED_DEVIATION_DEFERRED = 2;",
        "export const CLAIMED_FLOOR = 30;",
        "// a repair-instruction line that must NOT be mistaken for a real",
        "// declaration, mirroring the real corpus's own template strings:",
        '`replacing the line:\\n  export const CLAIMED_FLOOR = ${CLAIMS.length};`',
      ].join("\n"),
    },
    {
      path: "test/phone-frame-ledger.scan.test.ts",
      content: [
        "// fixture phone ledger",
        "const EXPECTED_TOTAL = 20;",
        "export const CLAIMED_FLOOR = 20;",
      ].join("\n"),
    },
    {
      path: "app/src/control-font.scan.test.ts",
      content: "export const CEILING = 5;",
    },
    {
      path: "app/src/phone-tap-target.scan.test.ts",
      content: [
        "export const ANCHOR_FLOOR_OFFENDERS_CEILING = 4;",
        "export const SSR_TAP_FLOOR_OFFENDERS_CEILING = 0;",
        "export const SSR_UNFLOORED_TOKENS_CEILING = 1;",
        "export const SSR_CLASSLESS_ANCHOR_CEILING = 3;",
      ].join("\n"),
    },
    // wave-154 (task w10-na, DEC-180 amendment): SPA mirror of
    // SSR_CLASSLESS_ANCHOR_CEILING above, added on the same terms --
    // arbitrary value, faithful shape.
    {
      path: "app/src/phone-tap-target-spa-classless-control.scan.test.ts",
      content: "export const SPA_CLASSLESS_CONTROL_CEILING = 4;",
    },
    {
      path: "app/src/phone-horizontal-overflow.scan.test.ts",
      content: [
        "export const CROSS_BUNDLE_CITATION_CEILING = 0;",
        "export const OVERFLOW_OFFENDERS_CEILING = 3;",
      ].join("\n"),
    },
    {
      path: "app/src/phone-capability-removal.scan.test.ts",
      content: "export const PHONE_HIDDEN_UNRECEIPTED_CEILING = 2;",
    },
    {
      path: "app/src/frame-citation.scan.test.ts",
      content: [
        "const DESKTOP_UNRECEIPTED_CLAIM_CEILING = 6;",
        "const UNRECEIPTED_CLAIM_CEILING = 0;",
      ].join("\n"),
    },
    // wave-118 (task w7-b): the nine formerly-ungraded constants, added so
    // this fixture stays a faithful shape of the real corpus.
    {
      path: "app/src/phone-block-visibility.test.ts",
      content: "export const MARKUP_PHONE_UNHIDDEN_CEILING = 0;",
    },
    {
      path: "app/src/status-density-pairing.scan.test.ts",
      content: "const DIVERGENCE_CEILING = 0;",
    },
    {
      path: "app/src/phone-scaffold-orphan.scan.test.ts",
      content: "export const ORPHAN_CEILING = 0;",
    },
    {
      path: "test/phone-cascade-order.scan.test.ts",
      content: "export const SHADOWED_CEILING = 0;",
    },
    {
      path: "app/src/tautological-assertion.scan.test.ts",
      content: "const FRAME_RECEIPT_OFFENDER_CEILING = 0;",
    },
    {
      path: "test/decision-doc-citation.scan.test.ts",
      content: [
        "export const UNRESOLVED_CITATION_CEILING = 0;",
        "export const WIDENED_UNRESOLVED_CITATION_CEILING = 0;",
      ].join("\n"),
    },
    // wave-120 (task w9-l, DEC-367 PREDICATE REPAIR): the undeclared-height
    // tap-target lens, added so this fixture stays a faithful shape of the
    // real corpus.
    {
      path: "app/src/phone-tap-target-undeclared.scan.test.ts",
      content: "export const UNDECLARED_HEIGHT_OFFENDERS_CEILING = 7;",
    },
    // wave-121 (task w10-k): DEC-937's painted-face half of the
    // cancelled-padding lens.
    {
      path: "app/src/cancelled-padding-face.scan.test.ts",
      content: "export const PAINTED_CANCELLED_PADDING_CEILING = 8;",
    },
    // wave-121 (task w10-l): cancelled-padding companion-gap lens.
    {
      path: "app/src/cancelled-padding-gap.scan.test.ts",
      content: "export const CANCELLED_PADDING_GAP_CEILING = 7;",
    },
    // wave-128 (task w3-j, DEC-976/DEC-967): the frame control-label
    // ledger, added so this fixture stays a faithful shape of the real
    // corpus. Value is arbitrary and deliberately NOT the real ledger's
    // current measurement, per this fixture's header contract.
    {
      path: "test/frame-control-label.scan.test.ts",
      content: "export const FOOTER_LABEL_CEILING = 5;",
    },
    // wave-131 (task w6-b, DEC-919 amendment): the desktop (non-390)
    // control-label ledger, added so this fixture stays a faithful shape of
    // the real corpus. Value is arbitrary and deliberately NOT the real
    // ledger's current measurement, per this fixture's header contract.
    {
      path: "test/desktop-control-label.scan.test.ts",
      content: "export const DESKTOP_CONTROL_LABEL_CEILING = 4;",
    },
    // wave-133 (task w8-a, DEC-976): the frame caption/consequence ledger,
    // added on the same terms -- arbitrary value, faithful shape.
    {
      path: "test/frame-caption-ledger.scan.test.ts",
      content: "export const FRAME_CAPTION_UNMATCHED_CEILING = 6;",
    },
    // wave-136 (task w11-aa, DEC-967 doc-integrity lens widened to CODE
    // comments): added on the same terms -- arbitrary value, faithful shape.
    // Registered in CAMPAIGN_CONSTANT_NAMES/TIER2_CEILING_NAMES by the same
    // lane; without a fixture row here every buildCampaignReport case throws
    // resolveSingle's "no declaration was found" error.
    {
      path: "test/code-comment-citation.scan.test.ts",
      content: "export const CODE_COMMENT_CITATION_CEILING = 9;",
    },
    // wave-144/w19-c (task w19-c, DEC-976): phone dock membership ledger,
    // added on the same terms -- arbitrary value, faithful shape.
    {
      path: "test/phone-dock-ledger.scan.test.ts",
      content: "export const PHONE_DOCK_UNCLAIMED_CEILING = 3;",
    },
    // wave-146 (task w20-a, DEC-937): pack declaration vocabulary ratchet,
    // added on the same terms -- arbitrary value, faithful shape. Registered
    // in CAMPAIGN_CONSTANT_NAMES/TIER2_CEILING_NAMES by the same lane;
    // without a fixture row here every buildCampaignReport case throws
    // resolveSingle's "no declaration was found" error.
    {
      path: "test/pack-declaration-vocabulary.scan.test.ts",
      content: "export const PACK_VOCABULARY_OFFENDERS_CEILING = 2;",
    },
    // wave-146 (task w21-d, DEC-613/DEC-989 amendment): CSS_COMMENT_COPY_LEAK_CEILING
    // (the css-comment product-copy leak lens) landed in scripts/exit-predicate.ts's
    // CAMPAIGN_CONSTANT_NAMES/TIER2_CEILING_NAMES without its fixture row --
    // added on the same terms as its neighbours above, arbitrary value,
    // faithful shape.
    {
      path: "test/css-comment-copy-leak.scan.test.ts",
      content: "export const CSS_COMMENT_COPY_LEAK_CEILING = 6;",
    },
    // wave-149 (task w5-bf, DEC-919 amendment): STARVED_FLEX_TRACK_CEILING
    // (the starved flex-track ratchet) landed in scripts/exit-predicate.ts's
    // CAMPAIGN_CONSTANT_NAMES/TIER2_CEILING_NAMES in the same commit as this
    // fixture row -- arbitrary value, faithful shape.
    {
      path: "app/src/phone-overflow-scan/starved-track-ceiling.ts",
      content: "export const STARVED_FLEX_TRACK_CEILING = 2;",
    },
    // wave-26 (task w26-j, DEC-393/DEC-808 amendment): WIDTH_FLOOR_OFFENDERS_CEILING
    // (the width-half tap-floor ratchet, checked by
    // app/src/phone-tap-target-width-floor.scan.test.ts) landed in
    // scripts/exit-predicate.ts's CAMPAIGN_CONSTANT_NAMES/TIER2_CEILING_NAMES
    // without its fixture row -- added now (task w6-e, DEC-069) on the same
    // terms as its neighbours above, arbitrary value, faithful shape.
    {
      path: "app/src/phone-tap-target-width-floor.scan.test.ts",
      content: "export const WIDTH_FLOOR_OFFENDERS_CEILING = 3;",
    },
  ];
}

/**
 * `baseFixture()` with every floor at its target and every ceiling at 0 --
 * i.e. a corpus that is desktop-done, phone-done and tier2-done. Used by
 * the suite-verification tests (wave-132, task w7-e) so those tests can
 * isolate the effect of `suiteEvidence` from the ceiling/floor conditions.
 */
function allGreenFixture(): CampaignFile[] {
  return baseFixture().map((f) => {
    if (f.path === "test/desktop-frame-ledger.scan.test.ts") {
      return {
        ...f,
        content: f.content.replace(
          "export const CLAIMED_FLOOR = 30;",
          "export const CLAIMED_FLOOR = 38;",
        ),
      };
    }
    if (f.path === "app/src/control-font.scan.test.ts") return { ...f, content: "export const CEILING = 0;" };
    if (f.path === "app/src/phone-tap-target.scan.test.ts") {
      return {
        ...f,
        content: [
          "export const ANCHOR_FLOOR_OFFENDERS_CEILING = 0;",
          "export const SSR_TAP_FLOOR_OFFENDERS_CEILING = 0;",
          "export const SSR_UNFLOORED_TOKENS_CEILING = 0;",
          "export const SSR_CLASSLESS_ANCHOR_CEILING = 0;",
        ].join("\n"),
      };
    }
    if (f.path === "app/src/phone-tap-target-spa-classless-control.scan.test.ts") {
      return { ...f, content: "export const SPA_CLASSLESS_CONTROL_CEILING = 0;" };
    }
    if (f.path === "app/src/phone-horizontal-overflow.scan.test.ts") {
      return {
        ...f,
        content: [
          "export const CROSS_BUNDLE_CITATION_CEILING = 0;",
          "export const OVERFLOW_OFFENDERS_CEILING = 0;",
        ].join("\n"),
      };
    }
    if (f.path === "app/src/phone-capability-removal.scan.test.ts") {
      return { ...f, content: "export const PHONE_HIDDEN_UNRECEIPTED_CEILING = 0;" };
    }
    if (f.path === "app/src/frame-citation.scan.test.ts") {
      return {
        ...f,
        content: [
          "const DESKTOP_UNRECEIPTED_CLAIM_CEILING = 0;",
          "const UNRECEIPTED_CLAIM_CEILING = 0;",
        ].join("\n"),
      };
    }
    if (f.path === "app/src/cancelled-padding-face.scan.test.ts") {
      return { ...f, content: "export const PAINTED_CANCELLED_PADDING_CEILING = 0;" };
    }
    if (f.path === "app/src/cancelled-padding-gap.scan.test.ts") {
      return { ...f, content: "export const CANCELLED_PADDING_GAP_CEILING = 0;" };
    }
    if (f.path === "app/src/phone-tap-target-undeclared.scan.test.ts") {
      return { ...f, content: "export const UNDECLARED_HEIGHT_OFFENDERS_CEILING = 0;" };
    }
    if (f.path === "test/frame-control-label.scan.test.ts") {
      return { ...f, content: "export const FOOTER_LABEL_CEILING = 0;" };
    }
    if (f.path === "test/desktop-control-label.scan.test.ts") {
      return { ...f, content: "export const DESKTOP_CONTROL_LABEL_CEILING = 0;" };
    }
    if (f.path === "test/frame-caption-ledger.scan.test.ts") {
      return { ...f, content: "export const FRAME_CAPTION_UNMATCHED_CEILING = 0;" };
    }
    if (f.path === "test/code-comment-citation.scan.test.ts") {
      return { ...f, content: "export const CODE_COMMENT_CITATION_CEILING = 0;" };
    }
    if (f.path === "test/phone-dock-ledger.scan.test.ts") {
      return { ...f, content: "export const PHONE_DOCK_UNCLAIMED_CEILING = 0;" };
    }
    if (f.path === "test/pack-declaration-vocabulary.scan.test.ts") {
      return { ...f, content: "export const PACK_VOCABULARY_OFFENDERS_CEILING = 0;" };
    }
    if (f.path === "test/css-comment-copy-leak.scan.test.ts") {
      return { ...f, content: "export const CSS_COMMENT_COPY_LEAK_CEILING = 0;" };
    }
    if (f.path === "app/src/phone-overflow-scan/starved-track-ceiling.ts") {
      return { ...f, content: "export const STARVED_FLEX_TRACK_CEILING = 0;" };
    }
    if (f.path === "app/src/phone-tap-target-width-floor.scan.test.ts") {
      return { ...f, content: "export const WIDTH_FLOOR_OFFENDERS_CEILING = 0;" };
    }
    return f;
  });
}

// task w6-e (DEC-069, "this lane builds it"): the fixture corpus above is a
// HAND-TYPED mirror of CAMPAIGN_CONSTANT_NAMES -- exactly the topology the
// ruling calls out (WIDTH_FLOOR_OFFENDERS_CEILING joined the roster without
// a fixture row, and the fixture's own comments record four earlier
// instances of the identical failure). These two assertions make the next
// such omission fail LOUDLY here, at fixture-registration time, instead of
// silently downstream inside every resolveSingle call in buildCampaignReport.
// Both reuse findConstantDeclarations (the module's own declaration finder)
// rather than re-implementing a parser (DEC-613: never a second copy of a
// vocabulary), so the two directions are:
//   1. every CAMPAIGN_CONSTANT_NAMES entry has exactly one baseFixture() row
//      (a name in the roster with zero or >1 fixture rows), and
//   2. every declaration baseFixture() contains names a CAMPAIGN_CONSTANT_NAMES
//      member (a fixture row nobody in the roster asked for -- an orphan).
// CLAIMED_FLOOR is the one legitimate exception to "exactly one": it is
// declared twice by design (desktop + phone ledgers), pinned separately by
// the existing "resolves every campaign constant name" test above.
describe("baseFixture/allGreenFixture two-directional derivation (DEC-069 w6-e)", () => {
  function countByName(files: CampaignFile[]): Map<string, number> {
    const matches = findConstantDeclarations(files, new Set(CAMPAIGN_CONSTANT_NAMES));
    const counts = new Map<string, number>();
    for (const m of matches) counts.set(m.name, (counts.get(m.name) ?? 0) + 1);
    return counts;
  }

  it("baseFixture(): every CAMPAIGN_CONSTANT_NAMES entry has exactly one declaration (CLAIMED_FLOOR: exactly two)", () => {
    const counts = countByName(baseFixture());
    const missing: string[] = [];
    const wrongCount: string[] = [];
    for (const name of CAMPAIGN_CONSTANT_NAMES) {
      const expected = name === "CLAIMED_FLOOR" ? 2 : 1;
      const found = counts.get(name) ?? 0;
      if (found === 0) missing.push(name);
      else if (found !== expected) wrongCount.push(`${name} (found ${found}, expected ${expected})`);
    }
    expect(missing, `baseFixture() is missing a row for: ${missing.join(", ")}`).toEqual([]);
    expect(wrongCount, `baseFixture() has the wrong declaration count for: ${wrongCount.join(", ")}`).toEqual([]);
  });

  it("baseFixture(): no declared row names a constant outside CAMPAIGN_CONSTANT_NAMES (no orphan fixture rows)", () => {
    const roster = new Set(CAMPAIGN_CONSTANT_NAMES);
    const candidateNames = new Set(findCampaignCeilingCandidates(baseFixture()));
    // EXPECTED_TOTAL/EXPECTED_TOTAL_PRE_DEVIATION/EXPECTED_DEVIATION_DEFERRED
    // are floor-population constants, not _CEILING/_FLOOR-shaped names, and
    // fall outside findCampaignCeilingCandidates' own naming convention --
    // check those directly against CAMPAIGN_CONSTANT_NAMES instead.
    const nonCeilingShaped = ["CLAIMED_FLOOR", "EXPECTED_TOTAL", "EXPECTED_TOTAL_PRE_DEVIATION", "EXPECTED_DEVIATION_DEFERRED"];
    const orphans = [...candidateNames].filter((n) => !roster.has(n));
    expect(orphans, `baseFixture() declares candidate(s) absent from CAMPAIGN_CONSTANT_NAMES: ${orphans.join(", ")}`).toEqual([]);
    for (const name of nonCeilingShaped) {
      expect(roster.has(name), `${name} is declared in baseFixture() but absent from CAMPAIGN_CONSTANT_NAMES`).toBe(true);
    }
  });

  it("allGreenFixture(): every CAMPAIGN_CONSTANT_NAMES entry has exactly one declaration (CLAIMED_FLOOR: exactly two)", () => {
    const counts = countByName(allGreenFixture());
    const missing: string[] = [];
    const wrongCount: string[] = [];
    for (const name of CAMPAIGN_CONSTANT_NAMES) {
      const expected = name === "CLAIMED_FLOOR" ? 2 : 1;
      const found = counts.get(name) ?? 0;
      if (found === 0) missing.push(name);
      else if (found !== expected) wrongCount.push(`${name} (found ${found}, expected ${expected})`);
    }
    expect(missing, `allGreenFixture() is missing a row for: ${missing.join(", ")}`).toEqual([]);
    expect(wrongCount, `allGreenFixture() has the wrong declaration count for: ${wrongCount.join(", ")}`).toEqual([]);
  });

  it("allGreenFixture(): no declared row names a constant outside CAMPAIGN_CONSTANT_NAMES (no orphan fixture rows)", () => {
    const roster = new Set(CAMPAIGN_CONSTANT_NAMES);
    const candidateNames = new Set(findCampaignCeilingCandidates(allGreenFixture()));
    const orphans = [...candidateNames].filter((n) => !roster.has(n));
    expect(orphans, `allGreenFixture() declares candidate(s) absent from CAMPAIGN_CONSTANT_NAMES: ${orphans.join(", ")}`).toEqual([]);
  });
});

describe("findConstantDeclarations", () => {
  it("resolves every campaign constant name from the fixture corpus (positive control)", () => {
    const matches = findConstantDeclarations(baseFixture(), new Set(CAMPAIGN_CONSTANT_NAMES));
    const foundNames = new Set(matches.map((m) => m.name));
    for (const name of CAMPAIGN_CONSTANT_NAMES) {
      if (name === "CLAIMED_FLOOR") continue; // resolved twice, checked separately below
      expect(foundNames.has(name)).toBe(true);
    }
    expect(matches.filter((m) => m.name === "CLAIMED_FLOOR")).toHaveLength(2);
  });

  it("never matches a declaration embedded inside a template-literal repair instruction", () => {
    const matches = findConstantDeclarations(baseFixture(), new Set(["CLAIMED_FLOOR"]));
    // Exactly the two real declarations, not the interpolated repair line.
    expect(matches).toHaveLength(2);
    expect(matches.every((m) => m.value === 30 || m.value === 20)).toBe(true);
  });

  it("throws when a matched constant's value is not a plain integer literal (negative control)", () => {
    const files: CampaignFile[] = [
      { path: "app/src/control-font.scan.test.ts", content: "export const CEILING = 28.5;" },
    ];
    expect(() => findConstantDeclarations(files, new Set(["CEILING"]))).toThrow(/integer/);
  });

  it("throws on an interpolated (non-literal) value", () => {
    const files: CampaignFile[] = [
      {
        path: "app/src/control-font.scan.test.ts",
        content: "export const CEILING = someExpr.length;",
      },
    ];
    expect(() => findConstantDeclarations(files, new Set(["CEILING"]))).toThrow(/integer/);
  });
});

describe("buildCampaignReport", () => {
  it("builds all 10 rows and a correct verdict from the fixture corpus", () => {
    const report = buildCampaignReport(baseFixture(), VERIFIED_EVIDENCE);
    // Megabatch wave-120/121: three instruments landed together.
    // PAINTED_CANCELLED_PADDING_CEILING (DEC-937) and
    // CANCELLED_PADDING_GAP_CEILING (DEC-393 amendment) are both in
    // TIER2_CEILING_NAMES, so each adds one: 18 -> 20.
    // wave-122 (task w11-s, DEC-851 amendment): UNDECLARED_HEIGHT_OFFENDERS_CEILING
    // (task w9-l, DEC-367 PREDICATE REPAIR) was GRADED but not a Tier-2 row --
    // a declared knob with no reader. Now wired into TIER2_CEILING_NAMES: 20 -> 21.
    // wave-128 (task w3-j): FOOTER_LABEL_CEILING, the frame control-label
    // ledger, declared and wired into TIER2 in one commit: 21 -> 22.
    // Megabatch wave-131/133: two more ledgers landed together, each
    // declared in CAMPAIGN_CONSTANT_NAMES and wired into TIER2 in the same
    // commit -- DESKTOP_CONTROL_LABEL_CEILING (task w6-b, DEC-919) and
    // FRAME_CAPTION_UNMATCHED_CEILING (task w8-a, DEC-976): 22 -> 24.
    // wave-141 (task w16-ff, DEC-069 instrument repair): CODE_COMMENT_CITATION_CEILING
    // landed in scripts/exit-predicate.ts's CAMPAIGN_CONSTANT_NAMES/TIER2_CEILING_NAMES
    // without its fixture entry ever being added here -- fixture now carries it
    // (see baseFixture/allGreenFixture above): 24 -> 25.
    // wave-142 (task w17-c, DEC-808): SSR_CLASSLESS_ANCHOR_CEILING landed in
    // scripts/exit-predicate.ts's CAMPAIGN_CONSTANT_NAMES/TIER2_CEILING_NAMES
    // and in this file's baseFixture/allGreenFixture in the same commit, but
    // the row-count pin here was not bumped with them: 25 -> 26.
    // wave-143 (task w18-g, DEC-069/DEC-967 post-train instrument re-green):
    // wave-17-c wired SSR_CLASSLESS_ANCHOR_CEILING into both
    // CAMPAIGN_CONSTANT_NAMES and TIER2_CEILING_NAMES without touching this
    // assertion -- re-derived by running buildCampaignReport over
    // baseFixture() at HEAD (26 rows), not by self-comparing report.rows'
    // own length: 25 -> 26.
    // wave-144/w19-c (task w19-c, DEC-976): PHONE_DOCK_UNCLAIMED_CEILING
    // (the phone dock membership ledger) landed in
    // scripts/exit-predicate.ts's CAMPAIGN_CONSTANT_NAMES/TIER2_CEILING_NAMES
    // and in this file's baseFixture/allGreenFixture in the same commit: 26 -> 27.
    // wave-146 (task w20-a, DEC-937): PACK_VOCABULARY_OFFENDERS_CEILING (the
    // pack declaration vocabulary ratchet) landed in scripts/exit-predicate.ts's
    // CAMPAIGN_CONSTANT_NAMES/TIER2_CEILING_NAMES without its fixture row or
    // this pin -- merge train added both. Re-derived by running
    // buildCampaignReport over baseFixture() at HEAD (28 rows), not by
    // self-comparing report.rows' own length: 27 -> 28.
    // wave-146 (task w21-d, DEC-613/DEC-989 amendment): CSS_COMMENT_COPY_LEAK_CEILING
    // (the css-comment product-copy leak lens) landed in scripts/exit-predicate.ts's
    // CAMPAIGN_CONSTANT_NAMES/TIER2_CEILING_NAMES without its fixture row or
    // this pin -- added both above. Re-derived by running buildCampaignReport
    // over baseFixture() at HEAD (29 rows): 28 -> 29.
    // wave-149 (task w5-bf, DEC-919 amendment): STARVED_FLEX_TRACK_CEILING
    // (the starved flex-track ratchet) declared in CAMPAIGN_CONSTANT_NAMES/
    // TIER2_CEILING_NAMES and given its fixture row and this pin in the same
    // commit -- re-derived by running buildCampaignReport over baseFixture()
    // at HEAD (30 rows): 29 -> 30.
    // wave-154 (task w10-na, DEC-180 amendment): SPA_CLASSLESS_CONTROL_CEILING
    // (the SPA classless-control ratchet) declared in CAMPAIGN_CONSTANT_NAMES/
    // TIER2_CEILING_NAMES and given its fixture row and this pin in the same
    // commit -- re-derived by running buildCampaignReport over baseFixture()
    // at HEAD (31 rows): 30 -> 31.
    // wave-6 (task w6-e, DEC-069): WIDTH_FLOOR_OFFENDERS_CEILING (the
    // width-half tap-floor ratchet) landed in scripts/exit-predicate.ts's
    // CAMPAIGN_CONSTANT_NAMES/TIER2_CEILING_NAMES without its fixture row --
    // added above (baseFixture/allGreenFixture), re-derived by running
    // buildCampaignReport over baseFixture() at HEAD (32 rows): 31 -> 32.
    expect(report.rows).toHaveLength(32);

    const undeclaredHeight = report.rows.find((r) => r.label === "UNDECLARED_HEIGHT_OFFENDERS_CEILING");
    expect(undeclaredHeight).toMatchObject({ current: 7, target: 0, remaining: 7 });

    const desktop = report.rows.find((r) => r.label === "desktop CLAIMED_FLOOR");
    expect(desktop).toMatchObject({ current: 30, target: 38, remaining: 8 });

    const phone = report.rows.find((r) => r.label === "phone CLAIMED_FLOOR");
    expect(phone).toMatchObject({ current: 20, target: 20, remaining: 0 });

    const ceiling = report.rows.find((r) => r.label === "CEILING");
    expect(ceiling).toMatchObject({ current: 5, target: 0, remaining: 5 });

    expect(report.verdict.desktopDone).toBe(false); // 30 + 2 < 40
    expect(report.verdict.phoneDone).toBe(true); // 20 >= 20
    expect(report.verdict.tier2Done).toBe(false); // several ceilings > 0
    expect(report.verdict.campaignDone).toBe(false);
  });

  it("reports campaignDone true only once every floor meets its target and every ceiling is 0", () => {
    const files = allGreenFixture();
    const report = buildCampaignReport(files, VERIFIED_EVIDENCE);
    expect(report.verdict.campaignDone).toBe(true);
  });

  it("with every ceiling 0 and every floor met but suiteVerifiedAtSha null, campaignDone is false (DEC-069 w7-e)", () => {
    const files = allGreenFixture();
    const report = buildCampaignReport(files, {
      productSha: "product-sha",
      suiteVerifiedAtSha: null,
      isAncestor: () => true,
    });
    expect(report.verdict.tier2Done).toBe(true);
    expect(report.verdict.desktopDone).toBe(true);
    expect(report.verdict.phoneDone).toBe(true);
    expect(report.verdict.suiteVerifiedAtSha).toBeNull();
    expect(report.verdict.campaignDone).toBe(false);
  });

  it("with every ceiling 0 and every floor met and a suite sha the product sha is an ancestor of, campaignDone is true", () => {
    const files = allGreenFixture();
    const report = buildCampaignReport(files, {
      productSha: "product-sha",
      suiteVerifiedAtSha: "suite-sha",
      isAncestor: (ancestor, descendant) => ancestor === "product-sha" && descendant === "suite-sha",
    });
    expect(report.verdict.campaignDone).toBe(true);
  });

  it("with every ceiling 0 and every floor met but the suite sha is NOT a descendant of the product sha, campaignDone is false", () => {
    const files = allGreenFixture();
    const report = buildCampaignReport(files, {
      productSha: "product-sha",
      suiteVerifiedAtSha: "stale-suite-sha",
      isAncestor: () => false, // the suite-verified sha does not contain the product sha's changes
    });
    expect(report.verdict.campaignDone).toBe(false);
  });

  it("throws when a required constant is renamed out of existence (positive control)", () => {
    const files = baseFixture().map((f) =>
      f.path === "app/src/control-font.scan.test.ts"
        ? { ...f, content: "export const CEILING_RENAMED = 5;" }
        : f,
    );
    expect(() => buildCampaignReport(files, VERIFIED_EVIDENCE)).toThrow(/no declaration of CEILING/);
  });

  it("throws when CLAIMED_FLOOR is declared a third time (topology changed)", () => {
    const files = [
      ...baseFixture(),
      {
        path: "test/some-new-ledger.scan.test.ts",
        content: "export const CLAIMED_FLOOR = 1;",
      },
    ];
    expect(() => buildCampaignReport(files, VERIFIED_EVIDENCE)).toThrow(/expected exactly 2 declarations of CLAIMED_FLOOR/);
  });

  it("throws when CLAIMED_FLOOR is declared only once", () => {
    const files = baseFixture().filter((f) => f.path !== "test/phone-frame-ledger.scan.test.ts");
    expect(() => buildCampaignReport(files, VERIFIED_EVIDENCE)).toThrow(/expected exactly 2 declarations of CLAIMED_FLOOR/);
  });

  it("throws when a CLAIMED_FLOOR is not co-located with either population constant", () => {
    const files = baseFixture().map((f) =>
      f.path === "test/phone-frame-ledger.scan.test.ts"
        ? { ...f, content: "export const CLAIMED_FLOOR = 20;" } // EXPECTED_TOTAL dropped
        : f,
    );
    expect(() => buildCampaignReport(files, VERIFIED_EVIDENCE)).toThrow(/no declaration of EXPECTED_TOTAL/);
  });

  it("throws when the corpus declares a ratchet constant nobody graded (population made total, DEC-069 wave-118)", () => {
    const files = [
      ...baseFixture(),
      {
        path: "app/src/some-new-lane.scan.test.ts",
        content: "export const NEW_LANE_OFFENDERS_CEILING = 3;",
      },
    ];
    expect(() => buildCampaignReport(files, VERIFIED_EVIDENCE)).toThrow(/NEW_LANE_OFFENDERS_CEILING/);
  });
});

describe("findCampaignCeilingCandidates", () => {
  it("finds every _CEILING/_FLOOR (and bare CEILING) declaration in a *.test.ts corpus, deduped and sorted", () => {
    const files: CampaignFile[] = [
      { path: "app/src/a.scan.test.ts", content: "export const B_CEILING = 1;\nconst A_FLOOR = 2;" },
      { path: "app/src/b.scan.test.ts", content: "export const B_CEILING = 5;" }, // re-declared, deduped
      { path: "app/src/c.scan.test.ts", content: "export const CEILING = 9;" },
    ];
    expect(findCampaignCeilingCandidates(files)).toEqual(["A_FLOOR", "B_CEILING", "CEILING"]);
  });

  it("ignores names that don't end in _CEILING/_FLOOR and files that aren't *.test.ts(x)", () => {
    const files: CampaignFile[] = [
      { path: "app/src/a.scan.test.ts", content: "export const EXPECTED_TOTAL = 40;" },
      { path: "app/src/not-a-test.ts", content: "export const REAL_CEILING = 1;" },
    ];
    expect(findCampaignCeilingCandidates(files)).toEqual([]);
  });

  it("matches *.test.tsx paths too", () => {
    const files: CampaignFile[] = [
      { path: "app/src/widget.test.tsx", content: "export const WIDGET_CEILING = 0;" },
    ];
    expect(findCampaignCeilingCandidates(files)).toEqual(["WIDGET_CEILING"]);
  });
});

describe("assertCampaignPopulationTotal", () => {
  it("passes when every candidate is graded", () => {
    expect(() =>
      assertCampaignPopulationTotal([...CAMPAIGN_CONSTANT_NAMES].filter((n) => n !== "EXPECTED_TOTAL")),
    ).not.toThrow();
  });

  it("passes when every candidate is graded or excused", () => {
    expect(() =>
      assertCampaignPopulationTotal(["CEILING", ...Object.keys(OUT_OF_CAMPAIGN_SCOPE)]),
    ).not.toThrow();
  });

  it("throws and names the offender when a candidate is neither graded nor excused", () => {
    expect(() => assertCampaignPopulationTotal(["TOTALLY_NEW_CEILING"])).toThrow(
      /TOTALLY_NEW_CEILING/,
    );
  });

  it("names every offender, not just the first", () => {
    expect(() => assertCampaignPopulationTotal(["FIRST_CEILING", "SECOND_FLOOR"])).toThrow(
      /FIRST_CEILING.*SECOND_FLOOR|SECOND_FLOOR.*FIRST_CEILING/s,
    );
  });
});

describe("OUT_OF_CAMPAIGN_SCOPE", () => {
  it("every reason is a principle: no branch token, no schedule/'in flight'/'later wave' prose", () => {
    const bannedPattern = /\bv12m-w\d+|\bwave\s*\d+\b|\bin flight\b|\blater wave\b|\bbeing (converted|drained|worked)\b/i;
    for (const [name, reason] of Object.entries(OUT_OF_CAMPAIGN_SCOPE)) {
      expect(reason, `${name}'s OUT_OF_CAMPAIGN_SCOPE reason reads like a schedule note, not a principle: "${reason}"`).not.toMatch(
        bannedPattern,
      );
    }
  });

  it("UNCLAIMED_CEILING is excused (tsconfig coverage, not a v12 frame/DEC-069 ratchet)", () => {
    expect(OUT_OF_CAMPAIGN_SCOPE).toHaveProperty("UNCLAIMED_CEILING");
  });

  it("UNNOTED_REGISTRY_COLLISION_CEILING is excused (registry-integrity fact, not a v12 frame/390-geometry ratchet)", () => {
    expect(OUT_OF_CAMPAIGN_SCOPE).toHaveProperty("UNNOTED_REGISTRY_COLLISION_CEILING");
  });
});

describe("assertEveryGradedCeilingIsGated", () => {
  // Synthetic inputs throughout -- these must not read CAMPAIGN_CONSTANT_NAMES,
  // TIER2_CEILING_NAMES or OUT_OF_CAMPAIGN_SCOPE as their own evidence (DEC-967:
  // an assertion whose only check reads the same array it is grading is a
  // tautology). The two lists below are constructed by hand per-test, distinct
  // from the module's real exports.

  it("throws and names a graded ceiling that is neither reported nor excused (positive control)", () => {
    const graded = ["A_CEILING", "B_CEILING", "SOME_FLOOR"];
    const reported = ["A_CEILING"]; // B_CEILING is missing
    expect(() => assertEveryGradedCeilingIsGated(graded, reported, {})).toThrow(
      /B_CEILING/,
    );
  });

  it("ignores a bare CEILING name too: throws if it is graded but neither reported nor excused", () => {
    const graded = ["CEILING", "REPORTED_CEILING"];
    expect(() => assertEveryGradedCeilingIsGated(graded, ["REPORTED_CEILING"], {})).toThrow(
      /\bCEILING\b/,
    );
  });

  it("names every offender, not just the first", () => {
    const graded = ["FIRST_CEILING", "SECOND_CEILING"];
    expect(() => assertEveryGradedCeilingIsGated(graded, [], {})).toThrow(
      /FIRST_CEILING.*SECOND_CEILING|SECOND_CEILING.*FIRST_CEILING/s,
    );
  });

  it("does not throw when a graded ceiling is excused via OUT_OF_CAMPAIGN_SCOPE instead of reported (negative control)", () => {
    const graded = ["EXCUSED_CEILING"];
    expect(() =>
      assertEveryGradedCeilingIsGated(graded, [], { EXCUSED_CEILING: "measures something out of scope" }),
    ).not.toThrow();
  });

  it("does not throw when every graded ceiling is reported", () => {
    const graded = ["A_CEILING", "B_CEILING"];
    expect(() => assertEveryGradedCeilingIsGated(graded, graded, {})).not.toThrow();
  });

  it("excludes a floor/non-ceiling-shaped name by shape, not by a hand-list", () => {
    // A ledger-style name that is neither `CEILING` nor ends `_CEILING` must
    // never need to appear in either list.
    const graded = ["EXPECTED_TOTAL_PRE_DEVIATION", "CLAIMED_FLOOR", "SOME_FLOOR"];
    expect(() => assertEveryGradedCeilingIsGated(graded, [], {})).not.toThrow();
  });

});

// wave-132 (task w7-e, instrument integrity repair): the ceiling table's
// header column must never read CURRENT again -- that word invited the
// misreading that `ceilingRow`'s value is a live measurement rather than a
// parsed-out declaration.
describe("formatCampaignReport", () => {
  it("labels the ceiling table's third column DECLARED, never CURRENT", () => {
    const report = buildCampaignReport(baseFixture(), VERIFIED_EVIDENCE);
    const formatted = formatCampaignReport(report);
    expect(formatted).toMatch(/\bDECLARED\b/);
    expect(formatted).not.toMatch(/\bCURRENT\b/);
  });

  it("prints the tier-2 line as DECLARED ONLY -- NOT MEASURED when suiteVerifiedAtSha is null", () => {
    const report = buildCampaignReport(allGreenFixture(), {
      productSha: "product-sha",
      suiteVerifiedAtSha: null,
      isAncestor: () => true,
    });
    const formatted = formatCampaignReport(report);
    expect(formatted).toMatch(/tier-2:\s+DECLARED ONLY -- NOT MEASURED/);
    expect(formatted).toMatch(/CAMPAIGN: DECLARED ONLY -- NOT MEASURED/);
  });

  it("prints desktop and phone as DECLARED ONLY -- NOT MEASURED, with no DONE anywhere, when suiteVerifiedAtSha is null (DEC-069 w14-aa)", () => {
    const report = buildCampaignReport(allGreenFixture(), {
      productSha: "product-sha",
      suiteVerifiedAtSha: null,
      isAncestor: () => true,
    });
    const formatted = formatCampaignReport(report);
    expect(formatted).toMatch(/desktop:\s+DECLARED ONLY -- NOT MEASURED/);
    expect(formatted).toMatch(/phone:\s+DECLARED ONLY -- NOT MEASURED/);
    expect(formatted).not.toMatch(/\bDONE\b/);
  });

  it("still prints desktop and phone counts and DONE when suiteVerifiedAtSha is verified (DEC-069 w14-aa)", () => {
    const report = buildCampaignReport(allGreenFixture(), VERIFIED_EVIDENCE);
    const formatted = formatCampaignReport(report);
    expect(formatted).toMatch(/desktop:\s+\d+ claimed \+ \d+ deviation-deferred = \d+ \/ \d+ -- DONE/);
    expect(formatted).toMatch(/phone:\s+\d+ \/ \d+ -- DONE/);
  });

  // wave-137 (task w12-hh, DEC-069 amendment): the desktop/phone rows used
  // to compute their DONE/NOT DONE verdict straight off the DECLARED
  // constants regardless of suite verification -- only the tier-2 line
  // degraded honestly. These two cases pin the repair: neither row may
  // print the substring DONE (as part of the word DONE, not merely as a
  // substring of NOT DONE) without a verified suite, and both must print
  // their real verdicts once the suite is verified against an ancestor.
  // Driven entirely from an all-green synthetic fixture -- never a live
  // product count (field guide waves 124-127: a non-vacuity check over a
  // product number is itself a sentinel).
  it("with suiteVerifiedAtSha null, neither desktop nor phone row contains DONE -- both read DECLARED ONLY", () => {
    const report = buildCampaignReport(allGreenFixture(), {
      productSha: "product-sha",
      suiteVerifiedAtSha: null,
      isAncestor: () => true,
    });
    const formatted = formatCampaignReport(report);
    const desktopLine = formatted.split("\n").find((line) => line.startsWith("desktop:"));
    const phoneLine = formatted.split("\n").find((line) => line.startsWith("phone:"));
    expect(desktopLine).toBeDefined();
    expect(phoneLine).toBeDefined();
    expect(desktopLine).toContain("DECLARED ONLY -- NOT MEASURED");
    expect(phoneLine).toContain("DECLARED ONLY -- NOT MEASURED");
    expect(desktopLine).not.toMatch(/\bDONE\b/);
    expect(phoneLine).not.toMatch(/\bDONE\b/);
  });

  it("with suiteVerifiedAtSha an ancestor of productSha, desktop and phone rows print their real verdicts", () => {
    const report = buildCampaignReport(allGreenFixture(), {
      productSha: "product-sha",
      suiteVerifiedAtSha: "suite-sha",
      isAncestor: () => true,
    });
    const formatted = formatCampaignReport(report);
    const desktopLine = formatted.split("\n").find((line) => line.startsWith("desktop:"));
    const phoneLine = formatted.split("\n").find((line) => line.startsWith("phone:"));
    expect(desktopLine).toBeDefined();
    expect(phoneLine).toBeDefined();
    expect(desktopLine).not.toContain("DECLARED ONLY");
    expect(phoneLine).not.toContain("DECLARED ONLY");
    expect(desktopLine).toMatch(/\bDONE\b/);
    expect(phoneLine).toMatch(/\bDONE\b/);
    expect(formatted).toMatch(/CAMPAIGN: DONE/);
  });

  it("with suiteVerifiedAtSha NOT an ancestor of productSha (stale), rows degrade the same as unverified", () => {
    const report = buildCampaignReport(allGreenFixture(), {
      productSha: "product-sha",
      suiteVerifiedAtSha: "stale-suite-sha",
      isAncestor: () => false,
    });
    const formatted = formatCampaignReport(report);
    const desktopLine = formatted.split("\n").find((line) => line.startsWith("desktop:"));
    const phoneLine = formatted.split("\n").find((line) => line.startsWith("phone:"));
    expect(desktopLine).toContain("DECLARED ONLY -- NOT MEASURED");
    expect(phoneLine).toContain("DECLARED ONLY -- NOT MEASURED");
    expect(formatted).toMatch(/CAMPAIGN: NOT DONE/);
  });

  // w16-ff (wave-141, DEC-069 instrument repair): the legend paragraph
  // above the verdict lines used to spell out the literal word DONE in its
  // own explanatory prose ("...can print DONE without a --suite-verified-sha
  // ..."), so the FULL formatted report -- table, legend, and verdict lines
  // together -- printed that token unconditionally regardless of
  // suiteVerified. This is the whole-string negative/positive control:
  // for an unverified sha, no line ANYWHERE in the output (row labels,
  // legend prose, verdict lines) may contain the token; for a verified
  // one, the token must appear.
  it("the FULL formatted report -- table, legend, and verdicts -- contains no DONE token anywhere when unverified, and does contain one when verified (DEC-069 w16-ff)", () => {
    const unverified = formatCampaignReport(
      buildCampaignReport(allGreenFixture(), {
        productSha: "product-sha",
        suiteVerifiedAtSha: null,
        isAncestor: () => true,
      }),
    );
    expect(unverified).not.toMatch(/\bDONE\b/);

    const verified = formatCampaignReport(buildCampaignReport(allGreenFixture(), VERIFIED_EVIDENCE));
    expect(verified).toMatch(/\bDONE\b/);
  });
});
