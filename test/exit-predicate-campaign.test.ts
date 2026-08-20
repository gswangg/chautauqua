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
  buildCampaignReport,
  CAMPAIGN_CONSTANT_NAMES,
  type CampaignFile,
  findConstantDeclarations,
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
      content: "const DESKTOP_UNRECEIPTED_CLAIM_CEILING = 6;",
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
    expect(report.rows).toHaveLength(10);

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
        return { ...f, content: "const DESKTOP_UNRECEIPTED_CLAIM_CEILING = 0;" };
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
});
