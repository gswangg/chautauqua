// DEC-068 wave-45 ruling (a): a verification-log index entry whose FIRST
// LINE does not match `## <date> <branch> — <scope> @ <sha>` (EM DASH
// U+2014, nothing trailing the sha) is invisible to
// scripts/exit-predicate.ts's parseLogSections as its own section, and
// silently donates its RESULT:/OPEN ITEMS: lines to whichever preceding
// conforming section's body it falls into -- overwriting that section's
// verdict. This test exercises scripts/assemble-verification-log.ts's
// nonConformingHeaders against fixture strings only: no filesystem, no
// process spawn (task-w45-f).

import { describe, expect, it } from "vitest";
import { nonConformingHeaders } from "../scripts/assemble-verification-log";

describe("nonConformingHeaders (DEC-068 header contract)", () => {
  it("passes a conforming header line", () => {
    expect(
      nonConformingHeaders([
        {
          file: "0001-2026-08-10-task-w1-a-build-test-abc1234.md",
          firstLine: "## 2026-08-10 task-w1-a — build+test @ abc1234",
        },
      ]),
    ).toEqual([]);
  });

  it("passes a conforming header whose scope itself contains an em dash", () => {
    expect(
      nonConformingHeaders([
        {
          file: "0002-2026-08-10-task-w1-b-x.md",
          firstLine: "## 2026-08-10 task-w1-b — perf coverage — plan progress @ def5678",
        },
      ]),
    ).toEqual([]);
  });

  it("flags a missing date (e.g. `## task-w1-a: scope (...)` legacy shape)", () => {
    expect(
      nonConformingHeaders([
        {
          file: "0003-x.md",
          firstLine: "## task-w1-a: some scope (DEC-1)",
        },
      ]),
    ).toEqual(["0003-x.md"]);
  });

  it("flags a trailing suffix after the sha (e.g. ` [QUALIFYING]`)", () => {
    expect(
      nonConformingHeaders([
        {
          file: "0004-x.md",
          firstLine: "## 2026-08-15 task-w1-c — review perf @ b7060152 [QUALIFYING]",
        },
      ]),
    ).toEqual(["0004-x.md"]);
  });

  it("flags a hyphen used in place of the em dash", () => {
    expect(
      nonConformingHeaders([
        {
          file: "0005-x.md",
          firstLine: "## 2026-08-15 task-w1-d - build+test @ cafe123",
        },
      ]),
    ).toEqual(["0005-x.md"]);
  });

  it("flags a header with no scope/sha section at all (e.g. `## QUALIFYING (task-w1-e)`)", () => {
    expect(
      nonConformingHeaders([
        {
          file: "0006-x.md",
          firstLine: "## QUALIFYING (task-w1-e)",
        },
      ]),
    ).toEqual(["0006-x.md"]);
  });

  it("reports every offending file, in order, alongside conforming ones", () => {
    expect(
      nonConformingHeaders([
        { file: "0007-ok.md", firstLine: "## 2026-08-15 task-w1-f — walkthrough @ 1234abc" },
        { file: "0008-bad.md", firstLine: "## task-w1-g: legacy scope" },
        { file: "0009-ok.md", firstLine: "## 2026-08-15 task-w1-h — perf-smoke @ 5678def" },
        { file: "0010-bad.md", firstLine: "## 2026-08-15 task-w1-i — perf @ 90abcde [DIAGNOSTIC]" },
      ]),
    ).toEqual(["0008-bad.md", "0010-bad.md"]);
  });

  it("returns empty for an empty entry list", () => {
    expect(nonConformingHeaders([])).toEqual([]);
  });
});
