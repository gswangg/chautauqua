// DEC-099 wave-41 amendment: the exit-verdict contract (RESULT token +
// scope literal + header shape) made machine-checked over the REAL
// verification-log corpus, not just fixture strings.
//
// This file is the SOLE owner of test/verification-log-verdict-contract.test.ts
// (DEC-069/DEC-099 wave-41). It deliberately does NOT touch
// test/verification-log-assemble.test.ts or scripts/exit-predicate.ts --
// a wave-40 lane owns the header-population side and the log assembler
// itself; this file covers verdict tokens and scope literals only, reusing
// the already-unit-tested parseLogSections/classifyScope/gradePredicate
// exports from scripts/exit-predicate.ts (see test/exit-predicate.test.ts
// for the fixture-string coverage this file does not duplicate).

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  classifyScope,
  gradePredicate,
  parseLogSections,
  REQUIRED_SCOPES,
} from "../scripts/exit-predicate";
// DEC-068 wave-46 (task-w46-b): the assembler's synthetic-header derivation,
// imported rather than re-implemented so this round-trip check cannot drift
// from the rule the assembler actually applies.
import { deriveSyntheticHeader } from "../scripts/assemble-verification-log";

const ROOT = join(import.meta.dirname, "..");
const INDEX_DIR = join(ROOT, "docs", "verification-log", "index");
const LOG_FILE = join(ROOT, "docs", "verification-log.md");

// Byte-identical to scripts/exit-predicate.ts's HEADER_RE (DEC-068 header
// contract, U+2014 em dash). Duplicated here deliberately: this file must
// be able to detect the exact ASCII-hyphen failure mode even if the
// production regex were ever accidentally loosened, and it must not
// import a non-exported constant from another lane's file this wave.
const HEADER_RE = /^## (\d{4}-\d{2}-\d{2}) (\S+) — (.+) @ (\S+)\s*$/;
const ASCII_HYPHEN_HEADER_RE = /^## (\d{4}-\d{2}-\d{2}) (\S+) - (.+) @ (\S+)\s*$/;

function indexFiles(): string[] {
  return readdirSync(INDEX_DIR)
    .filter((f) => /^\d{4}-.*\.md$/.test(f))
    .sort();
}

function readIndexFile(name: string): string {
  return readFileSync(join(INDEX_DIR, name), "utf8");
}

function firstLine(content: string): string {
  return content.split("\n")[0] ?? "";
}

// ---------------------------------------------------------------------
// 1. DEC-068 header contract, real corpus, offenders reported by filename.
//
// This corpus predates strict enforcement (many pre-wave-37 evidence-lane
// entries use informal headers: no trailing `@ sha`, bracket suffixes like
// `[DIAGNOSTIC]`/`[QUALIFYING]`, colon-style `task-w29-a: ...`, or the
// literal `## QUALIFYING (task-w29-c)` marker that scripts/exit-predicate.ts
// is deliberately tested to swallow as body text, not a section of its
// own). Those are legacy, not the ASCII-hyphen bug this DEC amendment is
// about, so this is a SHRINK-ONLY ratchet (DEC-099 wave-40/41), never an
// allowlist: any new file must conform, and any name here may only be
// removed (by fixing the header), never added to.
// ---------------------------------------------------------------------

// task-w45-f (DEC-068 wave-45 ruling (b)) fixed the first line of 0176,
// 0180-0185 (7 files) -- shrinking this ratchet by exactly those 7 entries.
// A broader legacy set (15 files dated 2026-08-12, pre-dating DEC-068's own
// wave-37 introduction, e.g. 0140-0157) carries no sha anywhere in filename
// or body and is NOT repairable by the "date/branch/sha from the filename"
// method; those remain here, unfixed, filed as a separate wave-46+ finding.
const LEGACY_HEADER_VIOLATIONS: readonly string[] = [
  "docs/verification-log/index/0140-2026-08-12-task-w12-a-render-sweep-mobile-overflow-instrument-correction.md",
  "docs/verification-log/index/0142-2026-08-12-task-w13-c-j1-j12-persona-walkthrough-npm-run-walkthrough-sta.md",
  "docs/verification-log/index/0143-2026-08-12-task-w13-f-stage-1-completion-ledger-dec-423.md",
  "docs/verification-log/index/0144-2026-08-12-task-w13-g-rubric-coverage-audit-all-7-docs-eval-rubric-yaml.md",
  "docs/verification-log/index/0145-2026-08-12-task-w13-a-dec-430-contrast-fixes-dec-431-render-sweep-flip.md",
  "docs/verification-log/index/0146-2026-08-12-task-w13-d-perf-smoke-2-000-submission-seed-dec-419-dec-432-b.md",
  "docs/verification-log/index/0147-2026-08-12-task-w15-e-build-test-bundle-render-sweep-evidence-lane-first.md",
  "docs/verification-log/index/0148-2026-08-12-task-w17-e-evidence-reconciliation-across-stage-1-waves-13-16.md",
  "docs/verification-log/index/0149-2026-08-12-task-w17-d-perf-smoke-2-000-submission-seed-dec-449-acceptanc.md",
  "docs/verification-log/index/0150-2026-08-12-task-w17-f-admin-list-pagination-audit-dec-453.md",
  "docs/verification-log/index/0151-2026-08-12-task-w21-c-build-test-evidence-wave-21-dec-472-dec-438-dec-44.md",
  "docs/verification-log/index/0152-2026-08-12-task-w20-f-list-envelope-enumeration-stage-1-dec-459-466.md",
  "docs/verification-log/index/0153-2026-08-12-task-w21-b-list-envelope-enumeration-artifact-dec-473.md",
  "docs/verification-log/index/0154-2026-08-12-task-w21-e-perf-smoke-dec-469-measurability-audit-stage-1-clo.md",
  "docs/verification-log/index/0157-2026-08-12-task-w25-f-stage-1-completion-ledger-e5f41c6-dec-496.md",
  "docs/verification-log/index/0164-2026-08-15-task-w27-b-build-test-bundle-ceda66f2-diagnostic.md",
  "docs/verification-log/index/0165-2026-08-15-task-w27-e-spec-audit-6-7-8-9-ceda66f2-diagnostic.md",
  "docs/verification-log/index/0166-2026-08-15-task-w27-d-perf-smoke-render-sweep-ceda66f2-diagnostic.md",
  "docs/verification-log/index/0167-2026-08-15-task-w27-c-walkthrough-ceda66f2-diagnostic.md",
  "docs/verification-log/index/0168-2026-08-15-task-w27-g-tier-1-fidelity-re-check-ceda66f2-diagnostic.md",
  "docs/verification-log/index/0177-2026-08-15-task-w29-f-void-gate-finding-f62af3ce.md",
  "docs/verification-log/index/0178-2026-08-15-task-w29-c-render-sweep-6aa4a438.md",
  "docs/verification-log/index/0187-2026-08-15-task-w32-b-reviewer-queue-hydration-74c6377a.md",
  "docs/verification-log/index/0193-2026-08-15-task-w36-c-perf-smoke-f5783479.md",
] as const;

describe("DEC-068 header contract over the real corpus (shrink-only ratchet)", () => {
  it("reports today's non-conformant index files by name and permits no NEW offender", () => {
    const offenders = indexFiles()
      .filter((f) => !HEADER_RE.test(firstLine(readIndexFile(f))))
      .map((f) => `docs/verification-log/index/${f}`);

    expect(new Set(offenders)).toEqual(new Set(LEGACY_HEADER_VIOLATIONS));
  });

  it("every index file NOT in the ratchet has a conformant first line", () => {
    for (const f of indexFiles()) {
      const path = `docs/verification-log/index/${f}`;
      if (LEGACY_HEADER_VIOLATIONS.includes(path)) continue;
      expect(HEADER_RE.test(firstLine(readIndexFile(f)))).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------
// 2. Round-trip: docs/verification-log.md is the assembled concatenation
// of docs/verification-log/index/*.md (scripts/assemble-verification-log.ts).
// EVERY index file must appear as its OWN section (never swallowed as a
// previous section's body -- the ASCII-hyphen failure mode) in filename
// order.
//
// DEC-068 wave-46 amendment (task-w46-b), reconciled here by the wave-46
// merge train: this check used to be scoped to CONFORMANT files only,
// because a non-conformant index file was swallowed into the preceding
// section's body. The assembler no longer allows that -- assembleEntry()
// prepends a SYNTHETIC, HEADER_RE-conforming header derived from the
// filename to any entry whose own first line does not conform (keeping the
// original first line as the section's first body line, and never editing
// the index file itself). So the assembled output now yields one section
// per index file, conformant or not, and the swallowing hazard task-w45-f
// documented -- a swallowed entry silently donating its RESULT:/OPEN ITEMS:
// lines to the preceding section and overwriting that section's verdict --
// is structurally gone. This assertion is correspondingly STRONGER than the
// one it replaces: it now covers all 224 entries rather than 200.
// ---------------------------------------------------------------------

describe("round-trip: assembled log has exactly one section per index file, in order", () => {
  it("parseLogSections(docs/verification-log.md) has no silently-swallowed section", () => {
    const files = indexFiles();
    const assembled = parseLogSections(readFileSync(LOG_FILE, "utf8"));

    expect(assembled).toHaveLength(files.length);
    for (let i = 0; i < files.length; i++) {
      const name = files[i] as string;
      const own = firstLine(readIndexFile(name));
      // Conformant entries keep their own first line verbatim; the rest are
      // headed by the assembler's synthetic line, re-derived here from the
      // filename rather than copied from the assembled output.
      const expectedHeader = HEADER_RE.test(own) ? own : deriveSyntheticHeader(name);
      expect(assembled[i]?.header).toBe(expectedHeader);
    }
  });

  it("every assembled section header conforms to the DEC-068 header contract", () => {
    const assembled = parseLogSections(readFileSync(LOG_FILE, "utf8"));
    for (const section of assembled) {
      expect(HEADER_RE.test(`## ${section.header.replace(/^## /, "")}`)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------
// 3. RESULT token / scope literal contract, per index file (read
// individually, not through the merged docs/verification-log.md -- a
// section's body can extend across swallowed follow-on files whose own
// RESULT: lines are not this file's verdict, so grading must happen on
// each file's own content). For every file that parses to a section at
// all (i.e. its own first line is a conformant header), and whose LAST
// RESULT: line is present, the first whitespace-delimited token of that
// line must be exactly PASS or FAIL. triage-closure-scoped sections
// additionally require an OPEN ITEMS: <n> line.
// ---------------------------------------------------------------------

function verdictToken(result: string): string {
  return result.trim().split(/\s+/)[0] as string;
}

function computeVerdictViolations(): string[] {
  const violations: string[] = [];
  for (const f of indexFiles()) {
    const sections = parseLogSections(readIndexFile(f));
    if (sections.length === 0) continue; // no conformant header at all; covered by check 1
    const section = sections[0] as ReturnType<typeof parseLogSections>[number];
    let bad = false;
    if (section.result !== null) {
      const token = verdictToken(section.result);
      if (token !== "PASS" && token !== "FAIL") bad = true;
    }
    if (classifyScope(section.scope) === "triage-closure" && section.openItems === null) {
      bad = true;
    }
    if (bad) violations.push(`docs/verification-log/index/${f}`);
  }
  return violations;
}

// Shrink-only RATCHET (DEC-099 wave-41), never an allowlist: this array is
// re-derived by computeVerdictViolations() above and asserted for exact set
// equality below, so no NEW violation can land un-noticed -- only removal
// (by fixing the offending file's RESULT:/OPEN ITEMS: line) shrinks it.
// task-w45-f repaired 7 of LEGACY_HEADER_VIOLATIONS's entries' first lines
// (DEC-068 wave-45 ruling (b)), which makes each fixed file parse to its
// OWN section here for the first time. Two of them (0176, 0184) turn out to
// already carry a pre-existing RESULT: line whose first token is not
// PASS/FAIL (`RESULT: onboarding grid PASS (was FAIL); ...` and
// `RESULT: files library (page 1) BEFORE ... FAIL -> AFTER ... PASS`,
// exactly the 0184 defect DEC-068's wave-45 amendment already named) --
// a genuine, previously-invisible verdict-contract defect the header
// repair surfaces, not a new one it introduces. task-w45-f only fixed
// FIRST LINES (per its task's scope) so these two are added here rather
// than silently swallowed again.
//
// wave-45 merge train: task-w45-g narrowed classifyScope() so each slot name
// must match as a WHOLE TOKEN (`\btriage[-\s]closure\b`, not a bare `triage`
// substring). 0002's scope is "commit-body triage", which is NOT a
// triage-closure section, so the "triage-closure must carry OPEN ITEMS:"
// rule no longer applies to it and it drops out of this ratchet -- the
// permitted shrink direction. 0098/0117/0129, whose scope really is
// "triage-closure", still classify and remain below.
const LEGACY_VERDICT_VIOLATIONS: readonly string[] = [
  "docs/verification-log/index/0098-2026-08-10-task-w8-g-triage-closure-38860f9.md",
  "docs/verification-log/index/0117-2026-08-10-task-w13-f-triage-closure-7f7477e.md",
  "docs/verification-log/index/0129-2026-08-10-task-w20-f-triage-closure-6807b67.md",
  "docs/verification-log/index/0156-2026-08-12-task-w21-f-stage-1-completion-ledger-889dffc.md",
  "docs/verification-log/index/0162-2026-08-15-task-w25-a-render-sweep-clip-probe-1950921d.md",
  "docs/verification-log/index/0176-2026-08-15-task-w29-a-onboarding-grid-perf-1d274c8b.md",
  "docs/verification-log/index/0184-2026-08-15-task-w31-a-files-library-perf-39634fe8.md",
  "docs/verification-log/index/0192-2026-08-15-task-w36-d-spec-audit-f5783479.md",
  "docs/verification-log/index/0195-2026-08-15-task-w36-f-aie-scale-3b3b56c7.md",
  // wave 49: this lane's own 0250 (instrument ledger closure) ends
  // `RESULT: NOT QUALIFYING -- ...`, the same wave-36-trap shape, for the
  // same reason -- a docs+test closure section, not a five-slot gate.
  "docs/verification-log/index/0250-2026-08-15-task-w49-e-instrument-ledger-closure-8adffaa4.md",
] as const;

describe("RESULT/OPEN ITEMS verdict contract over the real corpus (shrink-only ratchet)", () => {
  it("includes today's known offenders and permits no NEW violation", () => {
    const violations = computeVerdictViolations();

    // Required examples this DEC amendment names explicitly.
    expect(violations).toContain(
      "docs/verification-log/index/0192-2026-08-15-task-w36-d-spec-audit-f5783479.md",
    );
    expect(violations).toContain(
      "docs/verification-log/index/0156-2026-08-12-task-w21-f-stage-1-completion-ledger-889dffc.md",
    );

    expect(new Set(violations)).toEqual(new Set(LEGACY_VERDICT_VIOLATIONS));
  });

  it("every file NOT in the ratchet, that parses and carries a RESULT: line, ends PASS or FAIL", () => {
    for (const f of indexFiles()) {
      const path = `docs/verification-log/index/${f}`;
      if (LEGACY_VERDICT_VIOLATIONS.includes(path)) continue;
      const sections = parseLogSections(readIndexFile(f));
      if (sections.length === 0) continue;
      const section = sections[0] as ReturnType<typeof parseLogSections>[number];
      if (section.result === null) continue;
      expect(["PASS", "FAIL"]).toContain(verdictToken(section.result));
    }
  });
});

// ---------------------------------------------------------------------
// Negative controls -- fixture STRINGS only, never the real corpus. Each
// one proves the corresponding assertion above can actually fail.
// ---------------------------------------------------------------------

describe("negative controls (fixture strings)", () => {
  it("a header written with an ASCII hyphen parses to zero sections", () => {
    const md = "## 2026-08-15 task-fixture - build+test+bundle @ abc1234\nRESULT: PASS\n";
    expect(ASCII_HYPHEN_HEADER_RE.test(firstLine(md))).toBe(true);
    expect(HEADER_RE.test(firstLine(md))).toBe(false);
    expect(parseLogSections(md)).toHaveLength(0);
  });

  // wave-45 merge train: task-w45-g made `section.qualifying === true` a
  // precondition for a section to be a gate candidate at all, so this
  // fixture carries the bare `QUALIFYING` body line -- without it the
  // section is skipped entirely and the slot reads MISSING rather than
  // exercising the verdict logic this control is here to prove.
  it("a section ending RESULT: QUALIFYING grades FAIL through gradePredicate", () => {
    const md =
      "## 2026-08-15 task-fixture — spec-audit @ abc1234\nQUALIFYING\nRESULT: QUALIFYING\n";
    const [section] = parseLogSections(md);
    expect(section?.result).toBe("QUALIFYING");
    expect(section?.qualifying).toBe(true);
    const rows = gradePredicate(parseLogSections(md), "product-sha", () => true);
    const row = rows.find((r) => r.slot === "spec-audit");
    expect(row?.status).toBe("FAIL");
  });

  it("scope 'stage-1 exit ledger' returns null from classifyScope, leaving its slot MISSING", () => {
    expect(classifyScope("stage-1 exit ledger")).toBeNull();
    const md = "## 2026-08-15 task-fixture — stage-1 exit ledger @ abc1234\nRESULT: PASS\n";
    const rows = gradePredicate(parseLogSections(md), "product-sha", () => true);
    // Nothing classifies to any of the five required slots, so all remain MISSING.
    expect(rows.every((r) => r.status === "MISSING")).toBe(true);
  });

  it("each of the five canonical scope literals classifies to its own slot", () => {
    const canonical: Record<(typeof REQUIRED_SCOPES)[number], string> = {
      "build-test-bundle": "build+test+bundle",
      walkthrough: "walkthrough",
      "perf-smoke": "perf-smoke",
      "spec-audit": "spec-audit",
      "triage-closure": "triage-closure",
    };
    for (const slot of REQUIRED_SCOPES) {
      expect(classifyScope(canonical[slot])).toBe(slot);
    }
  });

  it("scope 'render-sweep' classifies to null by design", () => {
    expect(classifyScope("render-sweep")).toBeNull();
  });
});
