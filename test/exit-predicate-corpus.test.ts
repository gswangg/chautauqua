// DEC-099 w40: derives the verification-log header population from the real
// corpus (docs/verification-log.md + docs/verification-log/index/*.md) and
// gives it a negative control. scripts/exit-predicate.ts:36's HEADER_RE
// requires an EM DASH (U+2014) and a trailing `@ <sha>`; a section header
// typed with an ASCII hyphen is not parsed as a section at all -- it is
// silently absorbed as body text of the PREVIOUS section, and the DEC-069
// slot it was meant to fill reads MISSING with no error anywhere.
// test/exit-predicate.test.ts only exercises fixture strings; this file
// measures the real corpus instead.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  classifyScope,
  gradePredicate,
  parseLogSections,
  REQUIRED_SCOPES,
  type LogSection,
} from "../scripts/exit-predicate";
import { duplicateSequences } from "../scripts/assemble-verification-log";

const ROOT = join(__dirname, "..");
const LOG_FILE = join(ROOT, "docs", "verification-log.md");
const INDEX_DIR = join(ROOT, "docs", "verification-log", "index");

// Same header contract as scripts/exit-predicate.ts:36 -- kept as a literal
// copy (not re-imported) so this test independently re-derives conformance
// rather than trusting the module under test to grade itself.
const HEADER_RE = /^## (\d{4}-\d{2}-\d{2}) (\S+) — (.+) @ (\S+)\s*$/;

function entryFiles(): string[] {
  return readdirSync(INDEX_DIR)
    .filter((f) => /^\d{4}-.*\.md$/.test(f))
    .sort();
}

function firstLine(file: string): string {
  const content = readFileSync(join(INDEX_DIR, file), "utf8");
  return content.split("\n")[0] ?? "";
}

// RATCHET, not allowlist (DEC-099 w37/w39): this list may only SHRINK as
// non-conformant index files are fixed. Adding a NEW non-conformant file
// (e.g. a future lane that types an ASCII hyphen instead of an em dash, or
// omits the trailing `@ <sha>`) must fail this test at merge time -- do not
// add entries here to make a new file pass; fix the file's header instead.
const FROZEN_NON_CONFORMANT: readonly string[] = [
  "0140-2026-08-12-task-w12-a-render-sweep-mobile-overflow-instrument-correction.md",
  "0142-2026-08-12-task-w13-c-j1-j12-persona-walkthrough-npm-run-walkthrough-sta.md",
  "0143-2026-08-12-task-w13-f-stage-1-completion-ledger-dec-423.md",
  "0144-2026-08-12-task-w13-g-rubric-coverage-audit-all-7-docs-eval-rubric-yaml.md",
  "0145-2026-08-12-task-w13-a-dec-430-contrast-fixes-dec-431-render-sweep-flip.md",
  "0146-2026-08-12-task-w13-d-perf-smoke-2-000-submission-seed-dec-419-dec-432-b.md",
  "0147-2026-08-12-task-w15-e-build-test-bundle-render-sweep-evidence-lane-first.md",
  "0148-2026-08-12-task-w17-e-evidence-reconciliation-across-stage-1-waves-13-16.md",
  "0149-2026-08-12-task-w17-d-perf-smoke-2-000-submission-seed-dec-449-acceptanc.md",
  "0150-2026-08-12-task-w17-f-admin-list-pagination-audit-dec-453.md",
  "0151-2026-08-12-task-w21-c-build-test-evidence-wave-21-dec-472-dec-438-dec-44.md",
  "0152-2026-08-12-task-w20-f-list-envelope-enumeration-stage-1-dec-459-466.md",
  "0153-2026-08-12-task-w21-b-list-envelope-enumeration-artifact-dec-473.md",
  "0154-2026-08-12-task-w21-e-perf-smoke-dec-469-measurability-audit-stage-1-clo.md",
  "0157-2026-08-12-task-w25-f-stage-1-completion-ledger-e5f41c6-dec-496.md",
  "0164-2026-08-15-task-w27-b-build-test-bundle-ceda66f2-diagnostic.md",
  "0165-2026-08-15-task-w27-e-spec-audit-6-7-8-9-ceda66f2-diagnostic.md",
  "0166-2026-08-15-task-w27-d-perf-smoke-render-sweep-ceda66f2-diagnostic.md",
  "0167-2026-08-15-task-w27-c-walkthrough-ceda66f2-diagnostic.md",
  "0168-2026-08-15-task-w27-g-tier-1-fidelity-re-check-ceda66f2-diagnostic.md",
  "0176-2026-08-15-task-w29-a-onboarding-grid-perf-1d274c8b.md",
  "0177-2026-08-15-task-w29-f-void-gate-finding-f62af3ce.md",
  "0178-2026-08-15-task-w29-c-render-sweep-6aa4a438.md",
  "0180-2026-08-15-task-w29-e-review-perf-b7060152.md",
  "0181-2026-08-15-task-w31-d-perf-profile-fixtures-9119a01a.md",
  "0182-2026-08-15-task-w31-b-reviewer-queue-perf-66123630.md",
  "0183-2026-08-15-task-w31-c-plan-results-perf-7581aa3b.md",
  "0184-2026-08-15-task-w31-a-files-library-perf-39634fe8.md",
  "0185-2026-08-15-task-w32-c-perf-coverage-e5774e56.md",
  "0187-2026-08-15-task-w32-b-reviewer-queue-hydration-74c6377a.md",
  "0193-2026-08-15-task-w36-c-perf-smoke-f5783479.md",
];

describe("verification-log header population (real corpus, DEC-099 w40)", () => {
  const files = entryFiles();
  const conformant = files.filter((f) => HEADER_RE.test(firstLine(f)));
  const nonConformant = files.filter((f) => !HEADER_RE.test(firstLine(f)));
  const markdown = readFileSync(LOG_FILE, "utf8");
  const sections = parseLogSections(markdown);

  it("has a non-empty corpus", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("every conformant index file's header contributes exactly one section to parseLogSections", () => {
    expect(conformant.length).toBe(sections.length);
    const parsedHeaders = new Set(sections.map((s) => s.header));
    for (const f of conformant) {
      expect(parsedHeaders.has(firstLine(f))).toBe(true);
    }
  });

  it("non-conformant files match a frozen list that may only shrink (RATCHET, not allowlist)", () => {
    expect(nonConformant.slice().sort()).toEqual(FROZEN_NON_CONFORMANT.slice().sort());
    // Shrink-only: every currently non-conformant file must already be on
    // the frozen list -- a NEW offender is not on the list and fails here.
    for (const f of nonConformant) {
      expect(FROZEN_NON_CONFORMANT).toContain(f);
    }
  });

  it("has no duplicate 4-digit sequence prefix (DEC-068)", () => {
    expect(duplicateSequences(files)).toEqual([]);
  });
});

describe("negative controls (DEC-099 w40): the contract must actually bite", () => {
  it("an ASCII hyphen in place of the em dash yields zero sections", () => {
    const good =
      "## 2026-08-15 task-w99-x — build+test+bundle @ abc1234\nRESULT: PASS\nOPEN ITEMS: 0\n";
    expect(parseLogSections(good)).toHaveLength(1);

    const asciiHyphen = good.replace("—", "-");
    expect(parseLogSections(asciiHyphen)).toHaveLength(0);
  });

  it("a header missing the trailing `@ <sha>` yields zero sections", () => {
    const noSha = "## 2026-08-15 task-w99-y — walkthrough\nRESULT: PASS\nOPEN ITEMS: 0\n";
    expect(parseLogSections(noSha)).toHaveLength(0);
  });

  it("classifyScope('render-sweep') is null", () => {
    expect(classifyScope("render-sweep")).toBeNull();
  });

  it("the five required scope strings classify to five distinct, non-colliding slots", () => {
    const scopeStrings = [
      "build+test+bundle",
      "walkthrough",
      "perf-smoke",
      "spec-audit",
      "triage-closure",
    ] as const;
    const classified = scopeStrings.map((s) => classifyScope(s));
    expect(classified).toEqual(REQUIRED_SCOPES);
    expect(new Set(classified).size).toBe(REQUIRED_SCOPES.length);
  });

  it("a section whose RESULT line reads exactly QUALIFYING grades FAIL, not PASS (wave-36 trap, DEC-069 w40)", () => {
    const section: LogSection = {
      header: "## fixture",
      date: "2026-08-15",
      branch: "task-fixture",
      scope: "build+test+bundle",
      sha: "abc1234",
      result: "QUALIFYING",
      openItems: null,
      qualifying: false,
    };
    const rows = gradePredicate([section], "product-sha", () => true);
    const row = rows.find((r) => r.slot === "build-test-bundle");
    expect(row?.status).toBe("FAIL");
  });
});
