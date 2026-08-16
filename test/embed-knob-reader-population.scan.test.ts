// DEC-851 (wave-55 amendment): a declared knob with no reader is a lie. This
// scan derives every (surface, knob) pair EMBED_KNOB_TABLE declares (via
// knobsForSurface/EMBED_SURFACES, never a hand-copied list) and asserts a
// transcribed ledger names, for each pair, the reader file that honors it --
// existence-checked paths, the exact shape of
// test/rubric-coverage-enumeration.scan.test.ts's findRubricCoverageProblems.
// `accent` is exempted in writing: it is a shell-level knob honored once by
// EmbedShell's `accentOverride` (src/routes/public/shell.tsx), not a
// per-surface reader, so no (surface, 'accent') pair needs its own ledger row.

import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { EMBED_SURFACES, knobsForSurface, type EmbedKnob, type EmbedSurface } from "../src/lib/embed-knobs";

const ROOT = join(__dirname, "..");

// ---------------------------------------------------------------------------
// Population -- derived at test time from EMBED_KNOB_TABLE via the exported
// accessors, never hardcoded here. `accent` is dropped from the population
// this ledger covers (see file header) because it has exactly one honest
// answer for every surface (EmbedShell), not a per-surface reader.
// ---------------------------------------------------------------------------
interface KnobPair {
  surface: EmbedSurface;
  knob: EmbedKnob;
}

function derivePairs(): KnobPair[] {
  const out: KnobPair[] = [];
  for (const surface of EMBED_SURFACES) {
    for (const knob of knobsForSurface(surface)) {
      if (knob === "accent") continue; // exempted -- see file header
      out.push({ surface, knob });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Ledger -- transcribed by hand against the current tree. Every entry names
// the ONE file that parses/threads/renders the knob for that surface. Where
// a single dispatcher function handles every filter-mode knob for a surface
// (sessions/speakers/gallery/schedule's day+q), that dispatcher file is the
// reader. agenda's trackId is the one HIGHLIGHT-mode exception: it's read by
// AgendaContent in agenda.tsx, not by dispatch.tsx's parsing (dispatch.tsx
// only parses the param; agenda.tsx's props.highlightTrackId is what
// actually changes the render).
// ---------------------------------------------------------------------------
interface LedgerEntry {
  surface: EmbedSurface;
  knob: EmbedKnob;
  reader: string;
}

const KNOB_READER_LEDGER: LedgerEntry[] = [
  { surface: "sessions", knob: "trackId", reader: "src/routes/public/dispatch.tsx" },
  { surface: "sessions", knob: "format", reader: "src/routes/public/dispatch.tsx" },
  { surface: "sessions", knob: "roomId", reader: "src/routes/public/dispatch.tsx" },
  { surface: "sessions", knob: "day", reader: "src/routes/public/dispatch.tsx" },
  { surface: "sessions", knob: "q", reader: "src/routes/public/dispatch.tsx" },
  { surface: "sessions", knob: "limit", reader: "src/routes/public/dispatch.tsx" },
  { surface: "sessions", knob: "fields", reader: "src/lib/card-fields.ts" },

  { surface: "speakers", knob: "trackId", reader: "src/routes/public/dispatch.tsx" },
  { surface: "speakers", knob: "q", reader: "src/routes/public/dispatch.tsx" },
  { surface: "speakers", knob: "limit", reader: "src/routes/public/dispatch.tsx" },

  { surface: "gallery", knob: "trackId", reader: "src/routes/public/dispatch.tsx" },
  { surface: "gallery", knob: "q", reader: "src/routes/public/dispatch.tsx" },
  { surface: "gallery", knob: "limit", reader: "src/routes/public/dispatch.tsx" },

  // agenda: trackId is a render-level HIGHLIGHT honored by AgendaContent
  // (src/routes/public/agenda.tsx), not a dispatch.tsx SQL predicate.
  { surface: "agenda", knob: "trackId", reader: "src/routes/public/agenda.tsx" },
  { surface: "agenda", knob: "day", reader: "src/routes/public/dispatch.tsx" },
  { surface: "agenda", knob: "q", reader: "src/routes/public/dispatch.tsx" },

  // schedule: no trackId row at all (DEC-851 wave-55 amendment) -- only
  // day/q remain, both parsed and threaded by dispatch.tsx.
  { surface: "schedule", knob: "day", reader: "src/routes/public/dispatch.tsx" },
  { surface: "schedule", knob: "q", reader: "src/routes/public/dispatch.tsx" },
];

/** Pure, exported classifier mirroring
 * test/rubric-coverage-enumeration.scan.test.ts's findRubricCoverageProblems
 * shape: both directions (every derived pair has exactly one ledger row;
 * every ledger row names a live derived pair) plus reader-file existence.
 * Exported so the negative-control unit tests below can feed it synthetic
 * violations directly. */
export function findEmbedKnobReaderProblems(pairs: KnobPair[], ledger: LedgerEntry[]): string[] {
  const problems: string[] = [];
  const key = (p: { surface: string; knob: string }) => `${p.surface}:${p.knob}`;

  const pairKeys = new Map<string, KnobPair>();
  for (const p of pairs) {
    if (pairKeys.has(key(p))) {
      problems.push(`duplicate derived pair (broken population, not a ledger issue): ${key(p)}`);
      continue;
    }
    pairKeys.set(key(p), p);
  }

  const ledgerCounts = new Map<string, number>();
  for (const entry of ledger) {
    ledgerCounts.set(key(entry), (ledgerCounts.get(key(entry)) ?? 0) + 1);
  }

  // (1) every derived pair has exactly one ledger row
  for (const p of pairs) {
    const count = ledgerCounts.get(key(p)) ?? 0;
    if (count === 0) problems.push(`derived pair with no ledger row: ${key(p)}`);
    else if (count > 1) problems.push(`derived pair with ${count} ledger rows (must be exactly 1): ${key(p)}`);
  }

  // (2) every ledger row names a live derived pair (no stale rows)
  for (const entry of ledger) {
    if (!pairKeys.has(key(entry))) problems.push(`stale ledger row citing a non-existent pair: ${key(entry)}`);
  }

  // (3) every ledger reader path exists on disk
  for (const entry of ledger) {
    if (!existsSync(join(ROOT, entry.reader))) {
      problems.push(`ledger row ${key(entry)} cites a nonexistent reader: ${entry.reader}`);
    }
  }

  return problems;
}

describe("embed-knob-reader-population.scan (DEC-851 wave-55 amendment)", () => {
  const pairs = derivePairs();

  it("tripwire: the derived (surface, knob) population is non-empty and never hardcoded", () => {
    expect(pairs.length).toBeGreaterThan(0);
    // sessions alone contributes 7 non-accent knobs; a silently-empty walk
    // would mean knobsForSurface/EMBED_SURFACES broke.
    expect(pairs.filter((p) => p.surface === "sessions").length).toBe(7);
  });

  it("schedule carries no trackId pair at all (DEC-851 wave-55 amendment)", () => {
    expect(pairs.some((p) => p.surface === "schedule" && p.knob === "trackId")).toBe(false);
  });

  it("every derived pair has exactly one ledger row, and every ledger row names a live derived pair", () => {
    const problems = findEmbedKnobReaderProblems(pairs, KNOB_READER_LEDGER).filter(
      (p) => p.includes("no ledger row") || p.includes("ledger rows (must be exactly 1)") || p.includes("stale ledger row") || p.includes("duplicate derived pair"),
    );
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("every ledger reader file exists on disk", () => {
    const problems = findEmbedKnobReaderProblems(pairs, KNOB_READER_LEDGER).filter((p) => p.includes("nonexistent reader"));
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("no problems at all -- the ledger is exact in both directions against the current tree", () => {
    const problems = findEmbedKnobReaderProblems(pairs, KNOB_READER_LEDGER);
    expect(problems, problems.join("\n")).toEqual([]);
  });
});

describe("findEmbedKnobReaderProblems negative controls (every scan ships one)", () => {
  const basePairs: KnobPair[] = [{ surface: "sessions", knob: "q" }];
  const baseLedger: LedgerEntry[] = [{ surface: "sessions", knob: "q", reader: "src/decisions.ts" }];

  it("compliant ledger against its matching population reports nothing (proves the scan can pass)", () => {
    expect(findEmbedKnobReaderProblems(basePairs, baseLedger)).toEqual([]);
  });

  it("a ledger row citing a nonexistent reader IS reported (direction: reader existence)", () => {
    const badLedger: LedgerEntry[] = [{ surface: "sessions", knob: "q", reader: "src/does-not-exist.ts" }];
    const problems = findEmbedKnobReaderProblems(basePairs, badLedger);
    expect(problems.some((p) => p.includes("src/does-not-exist.ts"))).toBe(true);
  });

  it("a derived pair with no ledger row IS reported (direction: population -> ledger)", () => {
    const pairsWithExtra: KnobPair[] = [...basePairs, { surface: "sessions", knob: "limit" }];
    const problems = findEmbedKnobReaderProblems(pairsWithExtra, baseLedger);
    expect(problems.some((p) => p.includes("sessions:limit"))).toBe(true);
  });

  it("a stale ledger row citing a dead pair IS reported (direction: ledger -> population)", () => {
    const staleLedger: LedgerEntry[] = [...baseLedger, { surface: "schedule", knob: "trackId" as EmbedKnob, reader: "src/decisions.ts" }];
    const problems = findEmbedKnobReaderProblems(basePairs, staleLedger);
    expect(problems.some((p) => p.includes("stale ledger row citing a non-existent pair: schedule:trackId"))).toBe(true);
  });

  it("a duplicated ledger row for the same pair IS reported", () => {
    const dupLedger: LedgerEntry[] = [...baseLedger, { surface: "sessions", knob: "q", reader: "src/decisions.ts" }];
    const problems = findEmbedKnobReaderProblems(basePairs, dupLedger);
    expect(problems.some((p) => p.includes("2 ledger rows"))).toBe(true);
  });
});
