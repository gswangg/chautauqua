// Unit tests for scripts/exit-predicate.ts. Fixture strings only -- no fs,
// matching the module's own "no fs in any exported function" contract.

import { describe, expect, it } from "vitest";
import {
  classifyScope,
  formatPredicateTable,
  gradePredicate,
  parseLogSections,
  type LogSection,
  REQUIRED_SCOPES,
} from "../scripts/exit-predicate";

describe("parseLogSections", () => {
  it("parses a single well-formed section, capturing the closing RESULT:/OPEN ITEMS: lines", () => {
    const md = [
      "# Verification Log",
      "Append-only. One dated section per run.",
      "",
      "## 2026-08-15 task-w99-a — build+test+bundle @ abc1234",
      "",
      "some prose here.",
      "",
      "RESULT: PASS (all green)",
      "OPEN ITEMS: 0",
      "",
    ].join("\n");

    const sections = parseLogSections(md);
    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({
      date: "2026-08-15",
      branch: "task-w99-a",
      scope: "build+test+bundle",
      sha: "abc1234",
      result: "PASS (all green)",
      openItems: 0,
      qualifying: false,
    });
  });

  it("captures the LAST RESULT:/OPEN ITEMS: line when a section restates them", () => {
    const md = [
      "## 2026-08-15 task-w99-b — walkthrough @ def5678",
      "draft RESULT: FAIL — will retry",
      "OPEN ITEMS: 3",
      "retried and it passed.",
      "RESULT: PASS",
      "OPEN ITEMS: 0",
    ].join("\n");

    const sections = parseLogSections(md);
    expect(sections[0]?.result).toBe("PASS");
    expect(sections[0]?.openItems).toBe(0);
  });

  it("detects the QUALIFYING label as a standalone body line", () => {
    const md = [
      "## 2026-08-15 task-w99-c — perf-smoke @ 1122334",
      "",
      "QUALIFYING",
      "",
      "INVALIDATED BY: src/** app/src/** migrations/** package.json",
      "RESULT: PASS",
      "OPEN ITEMS: 0",
    ].join("\n");

    const sections = parseLogSections(md);
    expect(sections[0]?.qualifying).toBe(true);
  });

  it("does not treat malformed headers (e.g. `## QUALIFYING (task-w29-c)`) as their own section", () => {
    const md = [
      "## 2026-08-15 task-w99-d — spec-audit @ 9988776",
      "",
      "## QUALIFYING (task-w29-c)",
      "some stray body content that belongs to task-w99-d",
      "RESULT: PASS",
      "OPEN ITEMS: 0",
    ].join("\n");

    const sections = parseLogSections(md);
    expect(sections).toHaveLength(1);
    expect(sections[0]?.branch).toBe("task-w99-d");
    expect(sections[0]?.result).toBe("PASS");
  });

  it("splits multiple sections in document order", () => {
    const md = [
      "## 2026-08-15 task-w99-a — build+test @ aaa1111",
      "RESULT: PASS",
      "OPEN ITEMS: 0",
      "## 2026-08-16 task-w99-b — walkthrough @ bbb2222",
      "RESULT: FAIL — nope",
      "OPEN ITEMS: 2",
    ].join("\n");

    const sections = parseLogSections(md);
    expect(sections.map((s) => s.branch)).toEqual(["task-w99-a", "task-w99-b"]);
  });

  it("returns null result/openItems when the section carries neither line", () => {
    const md = ["## 2026-08-15 task-w99-e — render-sweep @ ccc3333", "prose only, no verdict."].join(
      "\n",
    );
    const sections = parseLogSections(md);
    expect(sections[0]?.result).toBeNull();
    expect(sections[0]?.openItems).toBeNull();
  });
});

describe("classifyScope", () => {
  it.each<[string, ReturnType<typeof classifyScope>]>([
    ["build+test+bundle", "build-test-bundle"],
    ["build/test/bundle/render-sweep", "build-test-bundle"],
    ["build+test confirm", "build-test-bundle"],
    ["J1-J12 persona walkthrough (`npm run walkthrough`), stage-1 close", "walkthrough"],
    ["walkthrough confirm", "walkthrough"],
    ["perf-smoke", "perf-smoke"],
    ["perf smoke", "perf-smoke"],
    // DEC-099 w45: only the whole-token "perf-smoke"/"perf smoke" forms
    // classify -- a colon separator is not a canonical form and a bare
    // "perf" substring (e.g. real "onboarding grid TIER-0 perf" /
    // "files library headshot join perf" corpus scopes) must NOT claim
    // the slot.
    ["perf:smoke", null],
    ["onboarding grid TIER-0 perf", null],
    ["files library headshot join perf", null],
    ["perf-smoke + render-sweep", "perf-smoke"],
    ["spec-audit §6/§7/§8/§9", "spec-audit"],
    ["spec audit confirm", "spec-audit"],
    ["triage closure", "triage-closure"],
    ["triage-closure confirm", "triage-closure"],
    ["render-sweep clip probe", null],
    ["wave-2 closeout", null],
    ["coldstart/zero-secrets", null],
  ])("classifies %j as %j", (scope, expected) => {
    expect(classifyScope(scope)).toBe(expected);
  });

  it("prefers the most specific keyword when a scope names multiple slots", () => {
    // "triage" wins over "build"/"test" if both appear.
    expect(classifyScope("build+test triage-closure confirm")).toBe("triage-closure");
  });
});

describe("gradePredicate", () => {
  const PRODUCT = "product-sha";

  function section(overrides: Partial<LogSection>): LogSection {
    return {
      header: "## fixture",
      date: "2026-08-15",
      branch: "task-fixture",
      scope: "build+test",
      sha: "0000000",
      result: null,
      openItems: null,
      // Default to a QUALIFYING candidate: these fixtures exercise ranking
      // (staleness/ancestry/append-order), not the DEC-099 w45 qualifying
      // gate itself, which has its own dedicated tests below.
      qualifying: true,
      ...overrides,
    };
  }

  it("grades all five slots MISSING when no sections are present", () => {
    const rows = gradePredicate([], PRODUCT, () => true);
    expect(rows).toHaveLength(REQUIRED_SCOPES.length);
    expect(rows.every((r) => r.status === "MISSING")).toBe(true);
  });

  it("grades PASS when a slot has a PASS section whose sha is a valid ancestor", () => {
    const sections: LogSection[] = [
      section({ scope: "build+test+bundle", sha: "aaa", result: "PASS" }),
      section({ scope: "walkthrough", sha: "bbb", result: "PASS" }),
      section({ scope: "perf-smoke", sha: "ccc", result: "PASS" }),
      section({ scope: "spec-audit", sha: "ddd", result: "PASS" }),
      section({ scope: "triage-closure", sha: "eee", openItems: 0 }),
    ];
    const rows = gradePredicate(sections, PRODUCT, () => true);
    expect(rows.every((r) => r.status === "PASS")).toBe(true);
  });

  it("grades FAIL when the most recent valid-ancestry section reads RESULT: FAIL", () => {
    const sections: LogSection[] = [
      section({ scope: "build+test", sha: "aaa", result: "FAIL — build broke" }),
    ];
    const rows = gradePredicate(sections, PRODUCT, () => true);
    const row = rows.find((r) => r.slot === "build-test-bundle");
    expect(row?.status).toBe("FAIL");
  });

  it("grades triage-closure FAIL when OPEN ITEMS > 0, PASS when 0", () => {
    const open = [section({ scope: "triage closure", sha: "aaa", openItems: 3 })];
    const closed = [section({ scope: "triage closure", sha: "bbb", openItems: 0 })];
    expect(
      gradePredicate(open, PRODUCT, () => true).find((r) => r.slot === "triage-closure")?.status,
    ).toBe("FAIL");
    expect(
      gradePredicate(closed, PRODUCT, () => true).find((r) => r.slot === "triage-closure")
        ?.status,
    ).toBe("PASS");
  });

  it("grades VOID when the only verdict-bearing section for a slot is ancestry-stale", () => {
    const sections: LogSection[] = [
      section({ scope: "perf-smoke", sha: "stale-sha", result: "PASS" }),
    ];
    const rows = gradePredicate(sections, PRODUCT, () => false);
    expect(rows.find((r) => r.slot === "perf-smoke")?.status).toBe("VOID");
  });

  it("prefers the most recent (last-appended) valid section over an earlier stale one", () => {
    const sections: LogSection[] = [
      section({ scope: "spec-audit", sha: "old", result: "FAIL — stale" }),
      section({ scope: "spec-audit", sha: "new", result: "PASS" }),
    ];
    const rows = gradePredicate(sections, PRODUCT, (_ancestor, descendant) => descendant === "new");
    const row = rows.find((r) => r.slot === "spec-audit");
    expect(row?.status).toBe("PASS");
    expect(row?.section?.sha).toBe("new");
  });

  it("skips sections with no usable verdict line and keeps looking", () => {
    const sections: LogSection[] = [
      section({ scope: "walkthrough", sha: "no-verdict", result: null }),
      section({ scope: "walkthrough", sha: "has-verdict", result: "PASS" }),
    ];
    const rows = gradePredicate(sections, PRODUCT, () => true);
    const row = rows.find((r) => r.slot === "walkthrough");
    expect(row?.status).toBe("PASS");
    expect(row?.section?.sha).toBe("has-verdict");
  });

  // DEC-099 w44 instrument repair: rank ancestry-valid candidates by newest
  // MEASURED TREE, not by append order. Each test below is a universal with
  // a real negative control -- it demonstrably fails if the discard step is
  // removed (i.e. if gradePredicate reverts to picking the last-appended
  // ancestry-valid, verdict-bearing candidate outright).

  it("[negative control] discards a lower-sequence-but-newer-tree candidate's older sibling: the newer tree decides, not append order", () => {
    // "s-new" is appended FIRST (lower index/sequence) but measured a
    // strictly NEWER tree than "s-old", which is appended SECOND (higher
    // index/sequence) and is a proper ancestor of "s-new".
    const sections: LogSection[] = [
      section({ scope: "triage closure", sha: "s-new", openItems: 0 }), // PASS, newer tree, appended first
      section({ scope: "triage closure", sha: "s-old", openItems: 3 }), // FAIL, older tree, appended last
    ];
    const isAncestor = (ancestor: string, descendant: string): boolean => {
      if (ancestor === PRODUCT) return true; // both are ancestry-valid against product
      if (ancestor === "s-old" && descendant === "s-new") return true; // s-old is a proper ancestor of s-new
      return false;
    };

    const winner = gradePredicate(sections, PRODUCT, isAncestor).find(
      (r) => r.slot === "triage-closure",
    );
    // Fixed behavior: the newer-tree section ("s-new") decides the slot.
    expect(winner?.section?.sha).toBe("s-new");
    expect(winner?.status).toBe("PASS");

    // Negative control: confirm what the OLD (pre-fix) last-appended-wins
    // rule would have produced, so this test would fail if the discard
    // step were removed -- it would have picked "s-old" (FAIL) instead.
    const oldRuleWinnerSha = sections
      .filter((s) => isAncestor(PRODUCT, s.sha))
      .slice()
      .reverse()[0]?.sha;
    expect(oldRuleWinnerSha).toBe("s-old");
    expect(oldRuleWinnerSha).not.toBe(winner?.section?.sha);
  });

  it("falls back to append order when neither candidate's sha is an ancestor of the other", () => {
    const sections: LogSection[] = [
      section({ scope: "walkthrough", sha: "unrelated-a", result: "FAIL — early run" }),
      section({ scope: "walkthrough", sha: "unrelated-b", result: "PASS" }),
    ];
    // No ancestry relation at all between unrelated-a and unrelated-b --
    // both are ancestry-valid against product, but neither is a proper
    // ancestor of the other, so nothing is discarded.
    const isAncestor = (ancestor: string, descendant: string): boolean => ancestor === PRODUCT;

    const row = gradePredicate(sections, PRODUCT, isAncestor).find((r) => r.slot === "walkthrough");
    expect(row?.section?.sha).toBe("unrelated-b"); // last-appended still wins
    expect(row?.status).toBe("PASS");
  });

  it("still excludes a candidate that is ancestry-invalid against the product sha, regardless of tree relations", () => {
    const sections: LogSection[] = [
      section({ scope: "perf-smoke", sha: "valid", result: "PASS" }),
      section({ scope: "perf-smoke", sha: "invalid-but-newer", result: "FAIL — noise" }),
    ];
    const isAncestor = (ancestor: string, descendant: string): boolean => {
      if (ancestor === PRODUCT) return descendant === "valid"; // "invalid-but-newer" fails ancestry
      return false;
    };

    const row = gradePredicate(sections, PRODUCT, isAncestor).find((r) => r.slot === "perf-smoke");
    expect(row?.section?.sha).toBe("valid");
    expect(row?.status).toBe("PASS");
  });

  it("[stale-PASS mirror] an older-tree PASS must not outrank a newer-tree FAIL", () => {
    // Mirror image of the newer-tree-wins test above, with outcomes
    // swapped: the newer-tree section reads FAIL and the older-tree
    // section (appended after it) reads PASS. The newer tree must still
    // decide, proving the fix is content-independent (it demotes a stale
    // PASS exactly as readily as it demotes a stale FAIL).
    const sections: LogSection[] = [
      section({ scope: "spec-audit", sha: "s-new-fail", result: "FAIL — regression" }), // newer tree, appended first
      section({ scope: "spec-audit", sha: "s-old-pass", result: "PASS" }), // older tree, appended last
    ];
    const isAncestor = (ancestor: string, descendant: string): boolean => {
      if (ancestor === PRODUCT) return true;
      if (ancestor === "s-old-pass" && descendant === "s-new-fail") return true;
      return false;
    };

    const winner = gradePredicate(sections, PRODUCT, isAncestor).find(
      (r) => r.slot === "spec-audit",
    );
    expect(winner?.section?.sha).toBe("s-new-fail");
    expect(winner?.status).toBe("FAIL");

    // Negative control: the old last-appended-wins rule would have picked
    // the stale PASS instead.
    const oldRuleWinnerSha = sections
      .filter((s) => isAncestor(PRODUCT, s.sha))
      .slice()
      .reverse()[0]?.sha;
    expect(oldRuleWinnerSha).toBe("s-old-pass");
    expect(oldRuleWinnerSha).not.toBe(winner?.section?.sha);
  });

  it("all-stale still yields VOID, and no-classifying-section still yields MISSING", () => {
    const staleOnly: LogSection[] = [
      section({ scope: "build+test+bundle", sha: "stale-1", result: "PASS" }),
      section({ scope: "build+test+bundle", sha: "stale-2", result: "FAIL — old" }),
    ];
    const voidRow = gradePredicate(staleOnly, PRODUCT, () => false).find(
      (r) => r.slot === "build-test-bundle",
    );
    expect(voidRow?.status).toBe("VOID");
    expect(voidRow?.section).toBeUndefined();

    const noClassifying: LogSection[] = [section({ scope: "render-sweep clip probe", sha: "x" })];
    const missingRow = gradePredicate(noClassifying, PRODUCT, () => true).find(
      (r) => r.slot === "build-test-bundle",
    );
    expect(missingRow?.status).toBe("MISSING");
    expect(missingRow?.section).toBeUndefined();
  });

  // DEC-099 w45 instrument repair: a section must be BOTH `qualifying`
  // AND whole-token-classified to decide a slot. Either test alone,
  // fixed shape, real corpus-derived scopes.

  it("a non-QUALIFYING section with a perfect scope match must not decide the slot (MISSING, not FAIL)", () => {
    const sections: LogSection[] = [
      section({ scope: "perf-smoke", sha: "aaa", result: "FAIL — noise", qualifying: false }),
    ];
    const row = gradePredicate(sections, PRODUCT, () => true).find(
      (r) => r.slot === "perf-smoke",
    );
    expect(row?.status).toBe("MISSING");
    expect(row?.section).toBeUndefined();
  });

  it("a QUALIFYING section scoped 'onboarding grid TIER-0 perf' must not claim perf-smoke (real corpus shape, task-w29-a)", () => {
    const sections: LogSection[] = [
      section({
        scope: "onboarding grid TIER-0 perf",
        sha: "bbb",
        result: "PASS",
        qualifying: true,
      }),
    ];
    const row = gradePredicate(sections, PRODUCT, () => true).find(
      (r) => r.slot === "perf-smoke",
    );
    expect(row?.status).toBe("MISSING");
    expect(row?.section).toBeUndefined();
  });

  it("a QUALIFYING section scoped exactly 'perf-smoke' must claim the slot", () => {
    const sections: LogSection[] = [
      section({ scope: "perf-smoke", sha: "ccc", result: "PASS", qualifying: true }),
    ];
    const row = gradePredicate(sections, PRODUCT, () => true).find(
      (r) => r.slot === "perf-smoke",
    );
    expect(row?.status).toBe("PASS");
    expect(row?.section?.sha).toBe("ccc");
  });
});

describe("formatPredicateTable", () => {
  it("renders one row per slot with padded columns", () => {
    const rows = gradePredicate([], "product-sha", () => true);
    const table = formatPredicateTable(rows);
    const lines = table.split("\n");
    expect(lines).toHaveLength(rows.length + 1); // header + 5 slots
    expect(lines[0]).toMatch(/^SLOT/);
    for (const slot of REQUIRED_SCOPES) {
      expect(table).toContain(slot);
    }
    expect(table).toContain("MISSING");
  });
});
