// DEC-518 (wave-41 amendment): docs/clarifications.md sits at the TOP of
// docs/README.md's precedence chain -- it overrides the brief, the
// Sessionboard reference and SPEC.md itself where they differ -- yet had no
// executable instrument at all before this file. Modeled directly on
// test/rubric-coverage-enumeration.scan.test.ts's derived-population +
// transcribed-ledger + two-directional-assertion shape, and on
// test/audit-claims.test.ts's DEC-642 absence-marker resolution for the
// "scope reduction" rows (skip Accelevents, no ticketing/registration).
//
// Population: every top-level bullet under docs/clarifications.md's
// "## Scope reductions" and "## Scope confirmations" headings whose bold
// lead-in starts the bullet (`- **<lead-in>**...`), re-derived at test time,
// never hand-listed. A bullet whose bold span does not open the bullet (the
// lone "Calendar invites: **no video link...**" line under Scope
// confirmations) is deliberately NOT a population member -- its content
// (no video link) is prose about a UI detail, not a separately-cited
// requirement, and its parent bullet (the .ics-is-sufficient one) already
// carries the ledger's citation for that whole clarification.
//
// Ledger verdicts:
//   - "honored": the cited file exists, contains the cited literal, and the
//     cited test file exists.
//   - "absent-by-design": the clarification is a scope REDUCTION proved by
//     an artifact's absence -- the named term must not appear anywhere
//     under src/** or app/src/**.
//   - "gap": the tree does not honor the clarification. None found this
//     wave -- KNOWN_GAPS is the shrink-only ratchet, see below.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const CLARIFICATIONS_PATH = join(ROOT, "docs", "clarifications.md");

// ---------------------------------------------------------------------------
// Population -- derived at test time from docs/clarifications.md, never
// hardcoded.
// ---------------------------------------------------------------------------
interface DerivedBullet {
  key: string;
  leadIn: string;
  heading: string;
}

const HEADINGS = ["## Scope reductions", "## Scope confirmations"];
const BULLET_RE = /^- \*\*(.+?)\*\*/;

/** Slugifies a bold lead-in into a stable, deterministic key: lowercase,
 * curly/straight quotes stripped, every run of non-alphanumeric characters
 * collapsed to one hyphen, no leading/trailing hyphen. Pure function of the
 * lead-in text -- never hand-assigned. */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/["“”'’`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Extracts the lines belonging to a `## <heading>` section, stopping at the
 * next `## ` heading or end of file. */
function extractSection(markdown: string, heading: string): string {
  const lines = markdown.split("\n");
  const startIdx = lines.findIndex((l) => l.trim() === heading);
  if (startIdx === -1) {
    throw new Error(`docs/clarifications.md has no "${heading}" section`);
  }
  const rest = lines.slice(startIdx + 1);
  const endIdx = rest.findIndex((l) => l.startsWith("## "));
  return (endIdx === -1 ? rest : rest.slice(0, endIdx)).join("\n");
}

function deriveBullets(): DerivedBullet[] {
  const text = readFileSync(CLARIFICATIONS_PATH, "utf8");
  const out: DerivedBullet[] = [];
  for (const heading of HEADINGS) {
    const section = extractSection(text, heading);
    for (const line of section.split("\n")) {
      const m = BULLET_RE.exec(line);
      if (!m) continue;
      const leadIn = m[1]!;
      out.push({ key: slugify(leadIn), leadIn, heading });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Ledger -- transcribed by hand once, then checked against the derived
// population and the tree on every run.
// ---------------------------------------------------------------------------
interface HonoredCite {
  file: string;
  literal: string;
  testFile: string;
}

interface AbsentCite {
  /** Case-insensitive substring that must not appear anywhere in any
   * .ts/.tsx file under src/** or app/src/**. */
  term: string;
}

interface LedgerEntry {
  key: string;
  status: "honored" | "absent-by-design" | "gap";
  reason: string;
  honored?: HonoredCite;
  absent?: AbsentCite;
}

const LEDGER: LedgerEntry[] = [
  {
    key: "accelevents-integration-skip-it",
    status: "absent-by-design",
    reason: "swyx: \"skip accelevents its fine\" -- no Accelevents integration anywhere in the product.",
    absent: { term: "accelevent" },
  },
  {
    key: "calendar-invites-a-standards-compliant-ics-email-is-sufficient",
    status: "honored",
    reason: ".ics-with-room-later: invite UPDATES (same UID, bumped SEQUENCE) are the flow that matters.",
    honored: {
      file: "src/server/repo/ics-sequence.ts",
      literal: "export async function bumpIcsSequences",
      testFile: "test/ics-sequence-bump.test.ts",
    },
  },
  {
    key: "conditional-form-logic-conditional-fine-for-now",
    status: "honored",
    reason: "basic show/hide conditional field logic.",
    honored: {
      file: "src/forms/rule-match.ts",
      literal: "export function ruleMatches",
      testFile: "test/forms-rule-match.test.ts",
    },
  },
  {
    key: "category-routing-means-tracks",
    status: "honored",
    reason: "\"category routing\" means tracks -- talks submit to one or more tracks.",
    honored: {
      file: "src/lib/submit-core.ts",
      literal: "export function validateTrackChoice",
      testFile: "test/submission-tracks-are-a-set.test.ts",
    },
  },
  {
    key: "minimum-review-workflow",
    status: "honored",
    reason: "no verdict recorded -> approve/maybe/deny is the minimum review workflow status ladder.",
    honored: {
      file: "src/domain/status.ts",
      literal: "export const SUBMISSION_STATUSES",
      testFile: "test/status-bulk-full-match.test.ts",
    },
  },
  {
    key: "schedule",
    status: "honored",
    reason: "day/room views + drag-and-drop + conflict detection is enough.",
    honored: {
      file: "src/lib/overlap-lanes.ts",
      literal: "export function assignLanes",
      testFile: "test/overlap-lanes.test.ts",
    },
  },
  {
    key: "airtable-nice-to-have-not-a-minus-if-unused",
    status: "honored",
    reason: "Airtable is read-only, never the primary DB -- a one-way sync out of Chautauqua.",
    honored: {
      file: "src/sync/airtable.ts",
      literal: "export async function runAirtableSync",
      testFile: "test/airtable-sync.test.ts",
    },
  },
  {
    key: "open-source-is-not-a-hard-requirement",
    status: "absent-by-design",
    reason:
      "Compound bullet: \"open source not required\" is a business statement about the competition, not code-testable -- the only falsifiable half of this bullet is \"Ticketing/registration: not wanted\", proved here by the artifact's absence. No ticketing/registration feature exists anywhere in the product.",
    absent: { term: "ticket" },
  },
  {
    key: "admin-ui-first-agentic-interface-is-bonus",
    status: "honored",
    reason: "admin UI first; agentic interface is bonus (never required).",
    honored: {
      file: "app/src/App.tsx",
      literal: "export function App()",
      testFile: "app/src/admin-first-paint.render.test.tsx",
    },
  },
  {
    key: "emails-must-actually-send-on-an-mvp-basis",
    status: "honored",
    reason: "emails actually send (against a dev sink in stage 1; DEC-clarified as not stubbed).",
    honored: {
      file: "src/mail/render.ts",
      literal: "export const MERGE_FIELDS",
      testFile: "test/mail.test.ts",
    },
  },
  {
    key: "acceptance-auto-creates",
    status: "honored",
    reason: "acceptance auto-creates the speaker record, the session, and the onboarding tasks.",
    honored: {
      file: "src/domain/acceptance.ts",
      literal: "export function planAcceptance",
      testFile: "test/domain.test.ts",
    },
  },
  {
    key: "must-have-onboarding-tasks",
    status: "honored",
    reason: "hotel stay requirement form + flight reimbursement form are the must-have onboarding tasks.",
    honored: {
      file: "src/domain/acceptance.ts",
      literal: "Hotel stay requirement form",
      testFile: "test/acceptance-form-tasks.test.ts",
    },
  },
  {
    key: "accepted-speakers-can-keep-editing-their-submission",
    status: "honored",
    reason: "accepted speakers can keep editing their submission; close-date edit locks exist but are not enforced by default.",
    honored: {
      file: "src/domain/edit-lock.ts",
      literal: "export function canEditSubmission",
      testFile: "test/edit-lock.test.ts",
    },
  },
  {
    key: "single-cfp-form-with-track-options",
    status: "honored",
    reason: "single CFP form with track options is right; multiple forms creatable after.",
    honored: {
      file: "app/src/pages/settings/CallForPapersPanel.tsx",
      literal: "toggleTrack",
      testFile: "test/submission-tracks-are-a-set.test.ts",
    },
  },
];

// Shrink-only ratchet (DEC-518/DEC-099): a clarification the tree does NOT
// honor is recorded here by key, with detail in
// docs/mandates/w41-clarifications-ledger.md, and this array may only
// shrink as gaps are fixed -- never grow silently.
const KNOWN_GAPS: string[] = [];

// ---------------------------------------------------------------------------
// Resolution helpers
// ---------------------------------------------------------------------------

function honoredFileContains(cite: HonoredCite): boolean {
  const path = join(ROOT, cite.file);
  const text = readFileSync(path, "utf8");
  return text.includes(cite.literal);
}

/** Every .ts/.tsx file under `dir`, recursively. */
function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkTsFiles(full));
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const ABSENCE_ROOTS = ["src", "app/src"];

/** True if `term` (case-insensitive) appears anywhere under src/** or
 * app/src/**. */
function termAppearsInTree(term: string): boolean {
  const needle = term.toLowerCase();
  for (const root of ABSENCE_ROOTS) {
    const dir = join(ROOT, root);
    for (const file of walkTsFiles(dir)) {
      const text = readFileSync(file, "utf8").toLowerCase();
      if (text.includes(needle)) return true;
    }
  }
  return false;
}

/** Pure classifier: given the derived population and the ledger, returns the
 * list of problems found -- named by key, never just a count. Exported so
 * the negative-control tests below can feed it synthetic violations
 * directly. Both directions are asserted: every derived bullet has exactly
 * one ledger row, and every ledger row names a live derived key. */
export function findClarificationsProblems(
  derived: DerivedBullet[],
  ledger: LedgerEntry[],
  gaps: string[],
  resolvers: { fileContains: (c: HonoredCite) => boolean; termInTree: (t: string) => boolean; fileExists: (p: string) => boolean },
): string[] {
  const problems: string[] = [];

  const derivedKeySet = new Map<string, DerivedBullet>();
  for (const d of derived) {
    if (derivedKeySet.has(d.key)) {
      problems.push(`duplicate derived key (broken population, not a ledger issue): ${d.key}`);
      continue;
    }
    derivedKeySet.set(d.key, d);
  }

  const ledgerKeyCounts = new Map<string, number>();
  for (const entry of ledger) {
    ledgerKeyCounts.set(entry.key, (ledgerKeyCounts.get(entry.key) ?? 0) + 1);
  }

  // (1) every derived bullet has exactly one ledger row
  for (const d of derived) {
    const count = ledgerKeyCounts.get(d.key) ?? 0;
    if (count === 0) problems.push(`derived bullet with no ledger row: ${d.key}`);
    else if (count > 1) problems.push(`derived bullet with ${count} ledger rows (must be exactly 1): ${d.key}`);
  }

  // (2) every ledger row names a live derived key (no stale rows)
  for (const entry of ledger) {
    if (!derivedKeySet.has(entry.key)) problems.push(`stale ledger row citing a non-existent key: ${entry.key}`);
  }

  // (3) honored rows: cited file exists, contains the literal, cited test exists
  for (const entry of ledger) {
    if (entry.status !== "honored") continue;
    if (!entry.honored) {
      problems.push(`honored row ${entry.key} has no honored citation`);
      continue;
    }
    if (!resolvers.fileExists(entry.honored.file)) {
      problems.push(`honored row ${entry.key} cites a nonexistent file: ${entry.honored.file}`);
      continue;
    }
    if (!resolvers.fileContains(entry.honored)) {
      problems.push(`honored row ${entry.key} cites ${entry.honored.file} but it does not contain "${entry.honored.literal}"`);
    }
    if (!resolvers.fileExists(entry.honored.testFile)) {
      problems.push(`honored row ${entry.key} cites a nonexistent test file: ${entry.honored.testFile}`);
    }
  }

  // (4) absent-by-design rows: the named term must NOT appear in the tree
  for (const entry of ledger) {
    if (entry.status !== "absent-by-design") continue;
    if (!entry.absent) {
      problems.push(`absent-by-design row ${entry.key} has no absence citation`);
      continue;
    }
    if (resolvers.termInTree(entry.absent.term)) {
      problems.push(`absent-by-design row ${entry.key} claims absence of "${entry.absent.term}" but it appears in the tree`);
    }
  }

  // (5) gap rows: every ledger row marked "gap" must be in KNOWN_GAPS, and
  // vice versa (both directions, so a fixed gap must be removed from the
  // ratchet, not left stale).
  const gapRowKeys = ledger.filter((e) => e.status === "gap").map((e) => e.key);
  for (const k of gapRowKeys) {
    if (!gaps.includes(k)) problems.push(`ledger row ${k} is marked "gap" but is not in KNOWN_GAPS`);
  }
  for (const g of gaps) {
    if (!gapRowKeys.includes(g)) problems.push(`KNOWN_GAPS names ${g} but no ledger row with that key is marked "gap"`);
  }

  return problems;
}

const realResolvers = {
  fileContains: honoredFileContains,
  termInTree: termAppearsInTree,
  fileExists: (p: string) => {
    try {
      readFileSync(join(ROOT, p), "utf8");
      return true;
    } catch {
      return false;
    }
  },
};

describe("clarifications-ledger.scan (DEC-518 wave-41 amendment)", () => {
  const derived = deriveBullets();

  it("tripwire: derived bullet population is non-empty and every key is stable/derived (never hardcoded)", () => {
    expect(derived.length).toBeGreaterThan(0);
    for (const d of derived) {
      expect(d.key.length, `bullet "${d.leadIn}" produced an empty key`).toBeGreaterThan(0);
      expect(d.key).toBe(slugify(d.leadIn));
    }
  });

  it("both sections contribute at least one bullet each (a broken heading match would silently zero one out)", () => {
    const bySection = new Map<string, number>();
    for (const d of derived) bySection.set(d.heading, (bySection.get(d.heading) ?? 0) + 1);
    for (const heading of HEADINGS) {
      expect(bySection.get(heading) ?? 0, `"${heading}" contributed 0 bullets`).toBeGreaterThan(0);
    }
  });

  it("every derived bullet has exactly one ledger row, and every ledger row names a live derived key", () => {
    const problems = findClarificationsProblems(derived, LEDGER, KNOWN_GAPS, realResolvers).filter(
      (p) => p.includes("no ledger row") || p.includes("ledger rows (must be exactly 1)") || p.includes("stale ledger row") || p.includes("duplicate derived key"),
    );
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("every honored row's citation resolves: file exists, contains the literal, and the test file exists", () => {
    const problems = findClarificationsProblems(derived, LEDGER, KNOWN_GAPS, realResolvers).filter(
      (p) => p.includes("honored row"),
    );
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("every absent-by-design row's term genuinely does not appear anywhere in src/** or app/src/**", () => {
    const problems = findClarificationsProblems(derived, LEDGER, KNOWN_GAPS, realResolvers).filter(
      (p) => p.includes("absent-by-design row"),
    );
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("KNOWN_GAPS is a shrink-only ratchet exactly matching the ledger's gap rows (may only shrink over time, never hand-grow)", () => {
    expect(KNOWN_GAPS).toEqual([]);
    const problems = findClarificationsProblems(derived, LEDGER, KNOWN_GAPS, realResolvers).filter(
      (p) => p.includes("KNOWN_GAPS") || p.includes('marked "gap"'),
    );
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("no problems at all -- the ledger is exact in both directions against the current tree", () => {
    const problems = findClarificationsProblems(derived, LEDGER, KNOWN_GAPS, realResolvers);
    expect(problems, problems.join("\n")).toEqual([]);
  });
});

describe("findClarificationsProblems negative controls (DEC-099: every scan ships one)", () => {
  const baseDerived: DerivedBullet[] = [{ key: "zzz-01", leadIn: "ZZZ", heading: "## Scope reductions" }];
  const baseLedger: LedgerEntry[] = [
    { key: "zzz-01", status: "honored", reason: "test", honored: { file: "src/decisions.ts", literal: "export", testFile: "test/clarifications-ledger.scan.test.ts" } },
  ];
  const fakeResolvers = {
    fileContains: (c: HonoredCite) => c.file === "src/decisions.ts" && c.literal === "export",
    termInTree: (t: string) => t === "present-term",
    fileExists: (p: string) => p === "src/decisions.ts" || p === "test/clarifications-ledger.scan.test.ts",
  };

  it("compliant ledger against its matching population reports nothing (proves the scan can pass)", () => {
    expect(findClarificationsProblems(baseDerived, baseLedger, [], fakeResolvers)).toEqual([]);
  });

  it("a derived bullet with no ledger row IS reported (direction: population -> ledger)", () => {
    const extraDerived: DerivedBullet[] = [...baseDerived, { key: "zzz-99-unledgered", leadIn: "ZZZ99", heading: "## Scope reductions" }];
    const problems = findClarificationsProblems(extraDerived, baseLedger, [], fakeResolvers);
    expect(problems.some((p) => p.includes("zzz-99-unledgered"))).toBe(true);
  });

  it("a stale ledger row citing a dead key IS reported (direction: ledger -> population)", () => {
    const staleLedger: LedgerEntry[] = [...baseLedger, { key: "zzz-dead", status: "honored", reason: "x", honored: { file: "src/decisions.ts", literal: "export", testFile: "test/clarifications-ledger.scan.test.ts" } }];
    const problems = findClarificationsProblems(baseDerived, staleLedger, [], fakeResolvers);
    expect(problems.some((p) => p.includes("zzz-dead"))).toBe(true);
  });

  it("a ledger row citing a nonexistent path fails the resolver", () => {
    const badLedger: LedgerEntry[] = [{ key: "zzz-01", status: "honored", reason: "x", honored: { file: "src/does-not-exist.ts", literal: "export", testFile: "test/clarifications-ledger.scan.test.ts" } }];
    const problems = findClarificationsProblems(baseDerived, badLedger, [], fakeResolvers);
    expect(problems.some((p) => p.includes("src/does-not-exist.ts"))).toBe(true);
  });

  it("a ledger row whose cited file exists but does not contain the literal IS reported", () => {
    const badLiteral: LedgerEntry[] = [{ key: "zzz-01", status: "honored", reason: "x", honored: { file: "src/decisions.ts", literal: "definitely-not-present", testFile: "test/clarifications-ledger.scan.test.ts" } }];
    const problems = findClarificationsProblems(baseDerived, badLiteral, [], fakeResolvers);
    expect(problems.some((p) => p.includes("definitely-not-present"))).toBe(true);
  });

  it("an absence row whose symbol exists in the tree IS reported", () => {
    const badAbsence: LedgerEntry[] = [{ key: "zzz-01", status: "absent-by-design", reason: "x", absent: { term: "present-term" } }];
    const problems = findClarificationsProblems(baseDerived, badAbsence, [], fakeResolvers);
    expect(problems.some((p) => p.includes("present-term"))).toBe(true);
  });

  it("an absence row whose term genuinely does not appear is accepted", () => {
    const goodAbsence: LedgerEntry[] = [{ key: "zzz-01", status: "absent-by-design", reason: "x", absent: { term: "totally-absent-term" } }];
    expect(findClarificationsProblems(baseDerived, goodAbsence, [], fakeResolvers)).toEqual([]);
  });

  it("a gap row not present in KNOWN_GAPS IS reported, and a KNOWN_GAPS entry with no gap row IS reported", () => {
    const gapLedger: LedgerEntry[] = [{ key: "zzz-01", status: "gap", reason: "x" }];
    const problemsMissingRatchet = findClarificationsProblems(baseDerived, gapLedger, [], fakeResolvers);
    expect(problemsMissingRatchet.some((p) => p.includes("not in KNOWN_GAPS"))).toBe(true);

    const problemsStaleRatchet = findClarificationsProblems(baseDerived, baseLedger, ["zzz-01"], fakeResolvers);
    expect(problemsStaleRatchet.some((p) => p.includes("no ledger row"))).toBe(true);
  });
});
