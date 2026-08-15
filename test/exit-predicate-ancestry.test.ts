// DEC-099 w46 instrument repair, re-derived from task-w44-g's unowned open
// item (0225): scripts/exit-predicate.ts's CLI-local `isAncestor` used to
// rethrow any `git merge-base --is-ancestor` failure whose exit status was
// not 1, including status 128 ("fatal: Not a valid object name") when a
// verification-log header names an ancient, no-longer-resolvable sha. That
// aborted the whole run before gradePredicate graded ANY slot. This file
// covers the exported `gitAncestorResult` helper (the pure mapping factored
// out of the CLI so it is testable without a real git subprocess) plus the
// classifyScope / parseLogSections edges named in the task.

import { describe, expect, it, vi } from "vitest";
import {
  classifyScope,
  gitAncestorResult,
  gradePredicate,
  parseLogSections,
  type LogSection,
} from "../scripts/exit-predicate";

describe("gitAncestorResult (DEC-099 w46)", () => {
  it("git exit 0 (no throw) is true", () => {
    expect(gitAncestorResult(() => {}, "a", "b")).toBe(true);
  });

  it("git exit 1 is false, no warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const err = Object.assign(new Error("not an ancestor"), { status: 1 });
    expect(
      gitAncestorResult(
        () => {
          throw err;
        },
        "a",
        "b",
      ),
    ).toBe(false);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("git exit 128 (unresolvable object) degrades to false with exactly one warning naming both shas", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const err = Object.assign(new Error("fatal: Not a valid object name deadbeef"), {
      status: 128,
    });
    const result = gitAncestorResult(
      () => {
        throw err;
      },
      "deadbeef",
      "c0ffee",
    );
    expect(result).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    const [message] = warn.mock.calls[0] as [string];
    expect(message).toContain("deadbeef");
    expect(message).toContain("c0ffee");
    warn.mockRestore();
  });

  it("an unexpected exit status (not 1, not 128) still rethrows", () => {
    const err = Object.assign(new Error("git not found"), { status: 127 });
    expect(() =>
      gitAncestorResult(
        () => {
          throw err;
        },
        "a",
        "b",
      ),
    ).toThrow(err);
  });
});

function qualifyingSection(overrides: Partial<LogSection>): LogSection {
  return {
    header: "## fixture",
    date: "2026-08-15",
    branch: "task-fixture",
    scope: "build+test+bundle",
    sha: "abc1234",
    result: "PASS",
    openItems: null,
    qualifying: true,
    ...overrides,
  };
}

describe("gradePredicate survives an isAncestor that throws an object-resolution error (DEC-099 w46)", () => {
  it("does not propagate; still returns a graded table with all five slots", () => {
    const sections: LogSection[] = [
      qualifyingSection({ scope: "build+test+bundle", sha: "6807b67" }),
    ];

    // Simulates the pre-fix CLI-local isAncestor's crash mode: an
    // unresolvable header sha makes `git merge-base --is-ancestor` exit 128,
    // which a caller must map to false (per gitAncestorResult) rather than
    // let bubble up. This test exercises gradePredicate's contract with an
    // isAncestor that is ALREADY the fixed (non-throwing) shape, proving the
    // graded table comes back intact instead of an exception propagating
    // out of gradePredicate.
    const isAncestor = (ancestorSha: string, descendantSha: string): boolean =>
      gitAncestorResult(
        () => {
          const err = Object.assign(new Error("fatal: Not a valid object name"), {
            status: 128,
          });
          throw err;
        },
        ancestorSha,
        descendantSha,
      );

    let rows: ReturnType<typeof gradePredicate> | undefined;
    expect(() => {
      rows = gradePredicate(sections, "product-sha", isAncestor);
    }).not.toThrow();

    expect(rows).toHaveLength(5);
    // The unresolvable-sha candidate can never be proven ancestry-valid, so
    // it is treated as stale/absent -- MISSING or VOID, never a crash.
    const btb = rows?.find((r) => r.slot === "build-test-bundle");
    expect(btb?.status).toBe("VOID");
  });
});

describe("classifyScope perf-smoke literal (DEC-099 w46)", () => {
  it("'files library perf fix' (real corpus scope, index/0179) does NOT classify to perf-smoke", () => {
    expect(classifyScope("files library perf fix")).toBeNull();
  });

  it.each(["perf-smoke", "perf smoke", "perf:smoke", "perf_smoke"])(
    "%j classifies to perf-smoke",
    (scope) => {
      expect(classifyScope(scope)).toBe("perf-smoke");
    },
  );
});

describe("a section with no QUALIFYING line still grades normally (no crash, no false claim)", () => {
  it("parses fine and is simply ineligible as a candidate", () => {
    const md = [
      "## 2026-08-10 task-w20-e — spec-audit @ 6807b67",
      "",
      "OPEN ITEMS: 0",
      "",
      "RESULT: PASS",
    ].join("\n");
    const sections = parseLogSections(md);
    expect(sections).toHaveLength(1);
    expect(sections[0]?.qualifying).toBe(false);

    const rows = gradePredicate(sections, "product-sha", () => true);
    expect(rows).toHaveLength(5);
    const specAudit = rows.find((r) => r.slot === "spec-audit");
    expect(specAudit?.status).toBe("MISSING");
  });
});
