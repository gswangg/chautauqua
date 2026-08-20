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
  buildCampaignReport,
  CAMPAIGN_CONSTANT_NAMES,
  type CampaignFile,
  findCampaignCeilingCandidates,
  findConstantDeclarations,
  OUT_OF_CAMPAIGN_SCOPE,
} from "../scripts/exit-predicate";

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
      ].join("\n"),
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
  ];
}

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
    const report = buildCampaignReport(baseFixture());
    // Megabatch wave-120/121: three instruments landed together.
    // UNDECLARED_HEIGHT_OFFENDERS_CEILING (task w9-l, DEC-367 PREDICATE
    // REPAIR) is GRADED but is not a Tier-2 row, so it adds no row.
    // PAINTED_CANCELLED_PADDING_CEILING (DEC-937) and
    // CANCELLED_PADDING_GAP_CEILING (DEC-393 amendment) are both in
    // TIER2_CEILING_NAMES, so each adds one: 18 -> 20.
    expect(report.rows).toHaveLength(20);

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
    const files = baseFixture().map((f) => {
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
          ].join("\n"),
        };
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
      return f;
    });
    const report = buildCampaignReport(files);
    expect(report.verdict.campaignDone).toBe(true);
  });

  it("throws when a required constant is renamed out of existence (positive control)", () => {
    const files = baseFixture().map((f) =>
      f.path === "app/src/control-font.scan.test.ts"
        ? { ...f, content: "export const CEILING_RENAMED = 5;" }
        : f,
    );
    expect(() => buildCampaignReport(files)).toThrow(/no declaration of CEILING/);
  });

  it("throws when CLAIMED_FLOOR is declared a third time (topology changed)", () => {
    const files = [
      ...baseFixture(),
      {
        path: "test/some-new-ledger.scan.test.ts",
        content: "export const CLAIMED_FLOOR = 1;",
      },
    ];
    expect(() => buildCampaignReport(files)).toThrow(/expected exactly 2 declarations of CLAIMED_FLOOR/);
  });

  it("throws when CLAIMED_FLOOR is declared only once", () => {
    const files = baseFixture().filter((f) => f.path !== "test/phone-frame-ledger.scan.test.ts");
    expect(() => buildCampaignReport(files)).toThrow(/expected exactly 2 declarations of CLAIMED_FLOOR/);
  });

  it("throws when a CLAIMED_FLOOR is not co-located with either population constant", () => {
    const files = baseFixture().map((f) =>
      f.path === "test/phone-frame-ledger.scan.test.ts"
        ? { ...f, content: "export const CLAIMED_FLOOR = 20;" } // EXPECTED_TOTAL dropped
        : f,
    );
    expect(() => buildCampaignReport(files)).toThrow(/no declaration of EXPECTED_TOTAL/);
  });

  it("throws when the corpus declares a ratchet constant nobody graded (population made total, DEC-069 wave-118)", () => {
    const files = [
      ...baseFixture(),
      {
        path: "app/src/some-new-lane.scan.test.ts",
        content: "export const NEW_LANE_OFFENDERS_CEILING = 3;",
      },
    ];
    expect(() => buildCampaignReport(files)).toThrow(/NEW_LANE_OFFENDERS_CEILING/);
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
});
