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
    ["perf:smoke", "perf-smoke"],
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
  function section(overrides: Partial<LogSection>): LogSection {
    return {
      header: "## fixture",
      date: "2026-08-15",
      branch: "task-fixture",
      scope: "build+test",
      sha: "0000000",
      result: null,
      openItems: null,
      qualifying: false,
      ...overrides,
    };
  }

  it("grades all five slots MISSING when no sections are present", () => {
    const rows = gradePredicate([], () => true);
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
    const rows = gradePredicate(sections, () => true);
    expect(rows.every((r) => r.status === "PASS")).toBe(true);
  });

  it("grades FAIL when the most recent valid-ancestry section reads RESULT: FAIL", () => {
    const sections: LogSection[] = [
      section({ scope: "build+test", sha: "aaa", result: "FAIL — build broke" }),
    ];
    const rows = gradePredicate(sections, () => true);
    const row = rows.find((r) => r.slot === "build-test-bundle");
    expect(row?.status).toBe("FAIL");
  });

  it("grades triage-closure FAIL when OPEN ITEMS > 0, PASS when 0", () => {
    const open = [section({ scope: "triage closure", sha: "aaa", openItems: 3 })];
    const closed = [section({ scope: "triage closure", sha: "bbb", openItems: 0 })];
    expect(gradePredicate(open, () => true).find((r) => r.slot === "triage-closure")?.status).toBe(
      "FAIL",
    );
    expect(
      gradePredicate(closed, () => true).find((r) => r.slot === "triage-closure")?.status,
    ).toBe("PASS");
  });

  it("grades VOID when the only verdict-bearing section for a slot is ancestry-stale", () => {
    const sections: LogSection[] = [
      section({ scope: "perf-smoke", sha: "stale-sha", result: "PASS" }),
    ];
    const rows = gradePredicate(sections, () => false);
    expect(rows.find((r) => r.slot === "perf-smoke")?.status).toBe("VOID");
  });

  it("prefers the most recent (last-appended) valid section over an earlier stale one", () => {
    const sections: LogSection[] = [
      section({ scope: "spec-audit", sha: "old", result: "FAIL — stale" }),
      section({ scope: "spec-audit", sha: "new", result: "PASS" }),
    ];
    const rows = gradePredicate(sections, (sha) => sha === "new");
    const row = rows.find((r) => r.slot === "spec-audit");
    expect(row?.status).toBe("PASS");
    expect(row?.section?.sha).toBe("new");
  });

  it("skips sections with no usable verdict line and keeps looking", () => {
    const sections: LogSection[] = [
      section({ scope: "walkthrough", sha: "no-verdict", result: null }),
      section({ scope: "walkthrough", sha: "has-verdict", result: "PASS" }),
    ];
    const rows = gradePredicate(sections, () => true);
    const row = rows.find((r) => r.slot === "walkthrough");
    expect(row?.status).toBe("PASS");
    expect(row?.section?.sha).toBe("has-verdict");
  });
});

describe("formatPredicateTable", () => {
  it("renders one row per slot with padded columns", () => {
    const rows = gradePredicate([], () => true);
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
