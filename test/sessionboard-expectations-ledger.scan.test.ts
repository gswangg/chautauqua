// DEC-518 (wave-5, sha ee8ceffa amendment): docs/sessionboard-reference sits
// at rank (3) in docs/README.md's precedence chain -- above the rubric
// corpus -- yet was the only vendored source with no executable instrument
// at all (grepping test/ for "sessionboard-reference" returned nothing).
// Modeled directly on test/clarifications-ledger.scan.test.ts's derived-
// population + transcribed-ledger + two-directional-assertion shape: same
// idiom, extended with a third verdict ("superseded") for the one heading
// where this build deliberately diverges from the Sessionboard behavior by
// a recorded ruling, instead of "absent-by-design" (which proves a scope
// REDUCTION by an artifact's absence -- not the right shape for a positive
// divergence backed by its own decision file).
//
// Population: every `### 5.N <title>` heading under
// `## 5. Cross-cutting expectations for clones` in
// docs/sessionboard-reference/00-how-sessionboard-works.md, re-derived at
// test time, never hand-listed.
//
// Ledger verdicts:
//   - "honored": the cited src/**/app/src/** file exists, contains the
//     cited literal, and the cited test/** file exists.
//   - "superseded": the build genuinely diverges from the Sessionboard
//     expectation by a recorded ruling -- the cited decisions/*.md file
//     exists and contains the cited literal naming the divergence.
//   - "gap": the tree does not honor the expectation. None found this wave
//     -- KNOWN_GAPS is the shrink-only ratchet, see below.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const REFERENCE_PATH = join(ROOT, "docs", "sessionboard-reference", "00-how-sessionboard-works.md");

// ---------------------------------------------------------------------------
// Population -- derived at test time from the Sessionboard reference doc,
// never hardcoded.
// ---------------------------------------------------------------------------
interface DerivedHeading {
  key: string;
  title: string;
}

const SECTION_HEADING = "## 5. Cross-cutting expectations for clones";
const SUBHEADING_RE = /^### 5\.(\d+) (.+)$/;

/** Slugifies a heading title into a stable, deterministic key: lowercase,
 * curly/straight quotes and arrows stripped, every run of non-alphanumeric
 * characters collapsed to one hyphen, no leading/trailing hyphen. Pure
 * function of the title text -- never hand-assigned. */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/["“”'’`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Extracts the lines belonging to `## 5. Cross-cutting expectations for
 * clones`, stopping at the next `## ` heading or end of file. */
function extractSection(markdown: string): string {
  const lines = markdown.split("\n");
  const startIdx = lines.findIndex((l) => l.trim() === SECTION_HEADING);
  if (startIdx === -1) {
    throw new Error(`docs/sessionboard-reference/00-how-sessionboard-works.md has no "${SECTION_HEADING}" section`);
  }
  const rest = lines.slice(startIdx + 1);
  const endIdx = rest.findIndex((l) => l.startsWith("## "));
  return (endIdx === -1 ? rest : rest.slice(0, endIdx)).join("\n");
}

function deriveHeadings(): DerivedHeading[] {
  const text = readFileSync(REFERENCE_PATH, "utf8");
  const section = extractSection(text);
  const out: DerivedHeading[] = [];
  for (const line of section.split("\n")) {
    const m = SUBHEADING_RE.exec(line.trim());
    if (!m) continue;
    const title = m[2]!;
    out.push({ key: slugify(title), title });
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

interface SupersededCite {
  /** Path relative to decisions/, e.g. "DEC-571.md". */
  decFile: string;
  literal: string;
}

interface LedgerEntry {
  key: string;
  status: "honored" | "superseded" | "gap";
  reason: string;
  honored?: HonoredCite;
  superseded?: SupersededCite;
}

const LEDGER: LedgerEntry[] = [
  {
    key: "multi-persona-authentication-and-role-separation",
    status: "honored",
    reason: "organizer/reviewer/speaker role guards plus the unauthenticated public surface are enumerated by the route-authz scan.",
    honored: {
      file: "src/server/middleware.ts",
      literal: "export const requireOrganizer = requireRole(\"organizer\");",
      testFile: "test/route-authz-enumeration.scan.test.ts",
    },
  },
  {
    key: "event-scoped-data",
    status: "honored",
    reason: "sessions are org-keyed at the session-identity layer, and every db.update/.delete under src/** must carry a .where() scoping it, checked by the write-scoping invariant scan.",
    honored: {
      file: "src/server/middleware.ts",
      literal: "orgId: string;",
      testFile: "test/write-scoping-invariant.scan.test.ts",
    },
  },
  {
    key: "the-contact-speaker-public-speaker-ladder",
    status: "honored",
    reason: "a participant row's visible bit is the per-speaker public-embed toggle -- addCoPresenter records visible=false and the public gate's own generated SQL predicate is proven to exclude it.",
    honored: {
      file: "src/server/repo/public/gates.ts",
      literal: "export function visibleSubmissionConditions",
      testFile: "test/public-copresenter-visibility.test.ts",
    },
  },
  {
    key: "decisions-never-auto-notify",
    status: "honored",
    reason: "the bare content/submission status routes are structurally mailer-free (\"MUST NEVER import a mailer\"); DEC-720 is the one sanctioned exception, where the note+status+mail is one deliberate organizer action behind its own endpoint, not an auto-send on a bare status flip.",
    honored: {
      file: "src/routes/files.ts",
      literal: "MUST NEVER import a mailer.",
      testFile: "test/status-change-mail-ledger.scan.test.ts",
    },
  },
  {
    key: "notifications-and-transactional-email-surface",
    status: "honored",
    reason: "bulk/transactional sends route through the comms send app and are logged per recipient into a batched history the SPA reads back.",
    honored: {
      file: "src/routes/comms/send.ts",
      literal: "export const sendRoutes = new Hono<AppEnv>();",
      testFile: "test/email-log-batches.test.ts",
    },
  },
  {
    key: "deadlines-change-behavior",
    status: "honored",
    reason: "a passed form close date blocks editing except for accepted speakers, and track edits lock at close regardless of status -- both gated on the same closeDate/now/timeZone inputs.",
    honored: {
      file: "src/domain/edit-lock.ts",
      literal: "export function canEditSubmission",
      testFile: "test/edit-lock.test.ts",
    },
  },
  {
    key: "the-public-private-boundary",
    status: "honored",
    reason: "reviewer-facing anonymization strips speaker identity from evaluation reads, word-boundary-anchored so it can never leak a fragment.",
    honored: {
      file: "src/domain/evaluation/anonymization.ts",
      literal: "export function anonymizeForReviewer",
      testFile: "test/redact-identity-boundary.test.ts",
    },
  },
  {
    key: "filled-state-fidelity",
    status: "superseded",
    reason: "DEC-571 deliberately removes the Sessionboard reference's color-coded-by-track agenda block as a distinct requirement: the admin agenda grid carries track identity by name in text, never by a color swatch, so a clone that color-codes agenda blocks would be reverting a ruling, not honoring a gap.",
    superseded: {
      decFile: "DEC-571.md",
      literal: "the track is named in text on the card",
    },
  },
];

// Shrink-only ratchet (DEC-518/DEC-099): a Sessionboard expectation the tree
// does NOT honor is recorded here by key, and this array may only shrink as
// gaps are fixed -- never grow silently. Nothing found this wave.
const KNOWN_GAPS: string[] = [];

// ---------------------------------------------------------------------------
// Resolution helpers
// ---------------------------------------------------------------------------

function honoredFileContains(cite: HonoredCite): boolean {
  const path = join(ROOT, cite.file);
  const text = readFileSync(path, "utf8");
  return text.includes(cite.literal);
}

function supersededDecContains(cite: SupersededCite): boolean {
  const path = join(ROOT, "decisions", cite.decFile);
  const text = readFileSync(path, "utf8");
  return text.includes(cite.literal);
}

/** Pure classifier: given the derived population and the ledger, returns the
 * list of problems found -- named by key, never just a count. Exported so
 * the negative-control tests below can feed it synthetic violations
 * directly. Both directions are asserted: every derived heading has exactly
 * one ledger row, and every ledger row names a live derived key. */
export function findSessionboardProblems(
  derived: DerivedHeading[],
  ledger: LedgerEntry[],
  gaps: string[],
  resolvers: {
    fileContains: (c: HonoredCite) => boolean;
    decContains: (c: SupersededCite) => boolean;
    fileExists: (p: string) => boolean;
    decExists: (p: string) => boolean;
  },
): string[] {
  const problems: string[] = [];

  const derivedKeySet = new Map<string, DerivedHeading>();
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

  // (1) every derived heading has exactly one ledger row
  for (const d of derived) {
    const count = ledgerKeyCounts.get(d.key) ?? 0;
    if (count === 0) problems.push(`derived heading with no ledger row: ${d.key}`);
    else if (count > 1) problems.push(`derived heading with ${count} ledger rows (must be exactly 1): ${d.key}`);
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

  // (4) superseded rows: cited decisions/*.md file exists and contains the literal
  for (const entry of ledger) {
    if (entry.status !== "superseded") continue;
    if (!entry.superseded) {
      problems.push(`superseded row ${entry.key} has no superseded citation`);
      continue;
    }
    if (!resolvers.decExists(entry.superseded.decFile)) {
      problems.push(`superseded row ${entry.key} cites a nonexistent decision file: ${entry.superseded.decFile}`);
      continue;
    }
    if (!resolvers.decContains(entry.superseded)) {
      problems.push(`superseded row ${entry.key} cites decisions/${entry.superseded.decFile} but it does not contain "${entry.superseded.literal}"`);
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
  decContains: supersededDecContains,
  fileExists: (p: string) => {
    try {
      readFileSync(join(ROOT, p), "utf8");
      return true;
    } catch {
      return false;
    }
  },
  decExists: (p: string) => {
    try {
      readFileSync(join(ROOT, "decisions", p), "utf8");
      return true;
    } catch {
      return false;
    }
  },
};

describe("sessionboard-expectations-ledger.scan (DEC-518 wave-5 amendment)", () => {
  const derived = deriveHeadings();

  it("tripwire: derived heading population is non-trivial and every key is stable/derived (never hardcoded)", () => {
    expect(derived.length).toBeGreaterThan(1);
    for (const d of derived) {
      expect(d.key.length, `heading "${d.title}" produced an empty key`).toBeGreaterThan(0);
      expect(d.key).toBe(slugify(d.title));
    }
  });

  it("every derived heading has exactly one ledger row, and every ledger row names a live derived key", () => {
    const problems = findSessionboardProblems(derived, LEDGER, KNOWN_GAPS, realResolvers).filter(
      (p) => p.includes("no ledger row") || p.includes("ledger rows (must be exactly 1)") || p.includes("stale ledger row") || p.includes("duplicate derived key"),
    );
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("every honored row's citation resolves: file exists, contains the literal, and the test file exists", () => {
    const problems = findSessionboardProblems(derived, LEDGER, KNOWN_GAPS, realResolvers).filter((p) => p.includes("honored row"));
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("every superseded row's decision file exists and contains the cited literal", () => {
    const problems = findSessionboardProblems(derived, LEDGER, KNOWN_GAPS, realResolvers).filter((p) => p.includes("superseded row"));
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("KNOWN_GAPS is a shrink-only ratchet exactly matching the ledger's gap rows (may only shrink over time, never hand-grow)", () => {
    expect(KNOWN_GAPS).toEqual([]);
    const problems = findSessionboardProblems(derived, LEDGER, KNOWN_GAPS, realResolvers).filter(
      (p) => p.includes("KNOWN_GAPS") || p.includes('marked "gap"'),
    );
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("no problems at all -- the ledger is exact in both directions against the current tree", () => {
    const problems = findSessionboardProblems(derived, LEDGER, KNOWN_GAPS, realResolvers);
    expect(problems, problems.join("\n")).toEqual([]);
  });
});

describe("findSessionboardProblems negative controls (DEC-099: every scan ships one)", () => {
  const baseDerived: DerivedHeading[] = [{ key: "zzz-01", title: "ZZZ" }];
  const baseLedger: LedgerEntry[] = [
    { key: "zzz-01", status: "honored", reason: "test", honored: { file: "src/decisions.ts", literal: "export", testFile: "test/sessionboard-expectations-ledger.scan.test.ts" } },
  ];
  const fakeResolvers = {
    fileContains: (c: HonoredCite) => c.file === "src/decisions.ts" && c.literal === "export",
    decContains: (c: SupersededCite) => c.decFile === "DEC-571.md" && c.literal === "present-literal",
    fileExists: (p: string) => p === "src/decisions.ts" || p === "test/sessionboard-expectations-ledger.scan.test.ts",
    decExists: (p: string) => p === "DEC-571.md",
  };

  it("compliant ledger against its matching population reports nothing (proves the scan can pass)", () => {
    expect(findSessionboardProblems(baseDerived, baseLedger, [], fakeResolvers)).toEqual([]);
  });

  it("a derived heading with no ledger row IS reported (direction: population -> ledger)", () => {
    const extraDerived: DerivedHeading[] = [...baseDerived, { key: "zzz-99-unledgered", title: "ZZZ99" }];
    const problems = findSessionboardProblems(extraDerived, baseLedger, [], fakeResolvers);
    expect(problems.some((p) => p.includes("zzz-99-unledgered"))).toBe(true);
  });

  it("a stale ledger row citing a dead key IS reported (direction: ledger -> population)", () => {
    const staleLedger: LedgerEntry[] = [...baseLedger, { key: "zzz-dead", status: "honored", reason: "x", honored: { file: "src/decisions.ts", literal: "export", testFile: "test/sessionboard-expectations-ledger.scan.test.ts" } }];
    const problems = findSessionboardProblems(baseDerived, staleLedger, [], fakeResolvers);
    expect(problems.some((p) => p.includes("zzz-dead"))).toBe(true);
  });

  it("a ledger row citing a nonexistent path fails the resolver", () => {
    const badLedger: LedgerEntry[] = [{ key: "zzz-01", status: "honored", reason: "x", honored: { file: "src/does-not-exist.ts", literal: "export", testFile: "test/sessionboard-expectations-ledger.scan.test.ts" } }];
    const problems = findSessionboardProblems(baseDerived, badLedger, [], fakeResolvers);
    expect(problems.some((p) => p.includes("src/does-not-exist.ts"))).toBe(true);
  });

  it("a ledger row whose cited file exists but does not contain the literal IS reported", () => {
    const badLiteral: LedgerEntry[] = [{ key: "zzz-01", status: "honored", reason: "x", honored: { file: "src/decisions.ts", literal: "definitely-not-present", testFile: "test/sessionboard-expectations-ledger.scan.test.ts" } }];
    const problems = findSessionboardProblems(baseDerived, badLiteral, [], fakeResolvers);
    expect(problems.some((p) => p.includes("definitely-not-present"))).toBe(true);
  });

  it("a superseded row whose decision file doesn't contain the cited literal IS reported", () => {
    const badSuperseded: LedgerEntry[] = [{ key: "zzz-01", status: "superseded", reason: "x", superseded: { decFile: "DEC-571.md", literal: "not-actually-there" } }];
    const problems = findSessionboardProblems(baseDerived, badSuperseded, [], fakeResolvers);
    expect(problems.some((p) => p.includes("not-actually-there"))).toBe(true);
  });

  it("a superseded row whose decision file genuinely contains the literal is accepted", () => {
    const goodSuperseded: LedgerEntry[] = [{ key: "zzz-01", status: "superseded", reason: "x", superseded: { decFile: "DEC-571.md", literal: "present-literal" } }];
    expect(findSessionboardProblems(baseDerived, goodSuperseded, [], fakeResolvers)).toEqual([]);
  });

  it("a gap row not present in KNOWN_GAPS IS reported, and a KNOWN_GAPS entry with no gap row IS reported", () => {
    const gapLedger: LedgerEntry[] = [{ key: "zzz-01", status: "gap", reason: "x" }];
    const problemsMissingRatchet = findSessionboardProblems(baseDerived, gapLedger, [], fakeResolvers);
    expect(problemsMissingRatchet.some((p) => p.includes("not in KNOWN_GAPS"))).toBe(true);

    const problemsStaleRatchet = findSessionboardProblems(baseDerived, baseLedger, ["zzz-01"], fakeResolvers);
    expect(problemsStaleRatchet.some((p) => p.includes("no ledger row"))).toBe(true);
  });
});
