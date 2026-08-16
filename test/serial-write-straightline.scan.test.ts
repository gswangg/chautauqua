// DEC-155 wave-72: the sibling scan (test/serial-write-scan.test.ts, DEC-948
// amendment wave 19) classifies every `await db.insert|update|delete(` by
// its INNERMOST enclosing for/while block and explicitly SKIPS any write
// that isn't inside a loop ("if (!innermost) continue; // one-off write,
// not inside any loop"). That skip is correct for the sibling's class (a
// per-row loop that should batch) but leaves an entire sibling class
// invisible: a FLAT run of independent awaited writes in a straight line,
// with no loop at all -- the exact shape DEC-155's own wave-68 amendment
// found in `PATCH /submissions/:id` and DEC-530's wave-70 amendment found
// five times on the send side. This file scans for THAT class.
//
// walkSrc, SKIP_DIRS, EXCLUDED_ROOTS, stripComments, findLoopBlocks and
// nearestEnclosingFunction below are copied VERBATIM from
// test/serial-write-scan.test.ts (same wave-19 walk-all-of-src/ rationale,
// same comment-stripping rationale, same brace-matched loop-block finder --
// re-used here only to test membership, i.e. "is this await NOT inside any
// loop block", which is the opposite half of the sibling's test). A shared
// test-helper module was considered and rejected: these are two independent
// scans looking for two different (deliberately disjoint) write shapes, and
// factoring out ~150 lines of matching logic into a third file two tests
// both import is not worth the coupling -- if one scan's helper needs a fix
// for its own class, it should never risk silently changing the other
// scan's results. This file does NOT edit the sibling file, so their
// ledgers and their failure output stay independent.
//
// This file changes NO PRODUCT CODE. It adds one test file and nothing
// else (DEC-155 wave-72 mandate) -- do not restructure, batch or
// parallelize any route or repo function from here; the ledger below is
// only a record of what already exists, so a later wave that DOES batch or
// restructure one of these functions can diff against it.
//
// Threshold: a function is reported once it holds N or more non-loop
// `await db.insert|update|delete(` occurrences. Measured against src/ at
// wave-72 plan time, N=3 already reports exactly 4 functions (well under
// the ~15-hit ceiling that would have forced N=4), so N stays 3.
//
// Two-directional, exactly like the sibling: an unledgered hit fails
// naming file:line (in fn) with instructions; a ledger entry matching no
// hit fails as a stale line to delete.

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..");
const SRC_ROOT = join(ROOT, "src");
const SKIP_DIRS = new Set(["node_modules", "dist", ".wrangler", "build", ".git"]);

// Copied verbatim from test/serial-write-scan.test.ts (see file header).
const EXCLUDED_ROOTS: { name: string; reason: string }[] = [
  {
    name: "decisions-data",
    reason:
      "Scribe-maintained constant DEC_* string data (src/decisions.ts registry, regenerated each wave) -- plain string exports, no loops, no db calls.",
  },
];
const EXCLUDED_ROOT_NAMES = new Set(EXCLUDED_ROOTS.map((e) => e.name));

// Copied verbatim from test/serial-write-scan.test.ts.
function walkSrc(dir: string, out: string[], depth: number): void {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    if (depth === 0 && EXCLUDED_ROOT_NAMES.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walkSrc(full, out, depth + 1);
    } else if (stat.isFile() && /\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
}

// Copied verbatim from test/serial-write-scan.test.ts.
function stripComments(src: string): string {
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const c2 = src[i + 1];
    if (c === "/" && c2 === "/") {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && c2 === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) {
        out += src[i] === "\n" ? "\n" : " ";
        i++;
      }
      i += 2; // skip closing */
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      out += c;
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === "\\" && i + 1 < n) {
          out += (src[i] ?? "") + (src[i + 1] ?? "");
          i += 2;
          continue;
        }
        out += src[i] ?? "";
        i++;
      }
      if (i < n) {
        out += src[i];
        i++;
      }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

interface LoopBlock {
  start: number; // index of the `for`/`while` keyword
  header: string; // the parenthesized `(...)` part
  bodyStart: number; // index of the body's opening `{`
  bodyEnd: number; // index just past the body's closing `}`
}

// Copied verbatim from test/serial-write-scan.test.ts.
function findLoopBlocks(src: string): LoopBlock[] {
  const out: LoopBlock[] = [];
  const re = /\b(?:for|while)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const parenStart = re.lastIndex - 1; // index of the '('
    let depth = 1;
    let i = parenStart + 1;
    while (i < src.length && depth > 0) {
      if (src[i] === "(") depth++;
      else if (src[i] === ")") depth--;
      i++;
    }
    const header = src.slice(parenStart, i);
    let j = i;
    while (j < src.length && /\s/.test(src[j] ?? "")) j++;
    if (src[j] !== "{") continue;
    let bodyDepth = 1;
    let k = j + 1;
    while (k < src.length && bodyDepth > 0) {
      if (src[k] === "{") bodyDepth++;
      else if (src[k] === "}") bodyDepth--;
      k++;
    }
    out.push({ start: m.index, header, bodyStart: j, bodyEnd: k });
  }
  return out;
}

const AWAIT_DB_WRITE = /await\s+[\w.]*db\s*\.\s*(insert|update|delete)\s*\(/g;

/** Nearest enclosing `function name(` / `export ... function name(`
 * declaration ABOVE the await -- used as the ledger key alongside file, so
 * ledger entries survive line-number drift. Copied verbatim from
 * test/serial-write-scan.test.ts. */
const FUNCTION_DECL = /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(/;

function nearestEnclosingFunction(lines: string[], lineIdx: number): string {
  for (let i = lineIdx; i >= 0; i--) {
    const match = FUNCTION_DECL.exec(lines[i] ?? "");
    if (match?.[1]) return match[1];
  }
  return "(module scope)";
}

interface StraightLineHit {
  file: string; // repo-relative path
  functionOrNearestExport: string;
  lines: number[]; // 1-indexed lines of every non-loop await in this function, ascending
}

/** Walks every .ts/.tsx file under src/ (minus EXCLUDED_ROOTS). For every
 * `await db.insert/update/delete(` occurrence (after comment-stripping)
 * that is NOT inside any for/while loop body (that class belongs to the
 * sibling scan), groups it by (file, nearestEnclosingFunction) and returns
 * one StraightLineHit per group whose await count reaches THRESHOLD. */
function scanForStraightLineWrites(threshold: number): StraightLineHit[] {
  const files: string[] = [];
  walkSrc(SRC_ROOT, files, 0);

  const byKey = new Map<string, { file: string; fn: string; lines: number[] }>();

  for (const file of files) {
    const raw = readFileSync(file, "utf8");
    const src = stripComments(raw);
    const lines = src.split("\n");
    const blocks = findLoopBlocks(src);
    const relFile = relative(ROOT, file).split("\\").join("/");

    let awaitMatch: RegExpExecArray | null;
    AWAIT_DB_WRITE.lastIndex = 0;
    while ((awaitMatch = AWAIT_DB_WRITE.exec(src))) {
      const pos = awaitMatch.index;
      const insideLoop = blocks.some((block) => pos >= block.bodyStart && pos < block.bodyEnd);
      if (insideLoop) continue; // that class belongs to the sibling scan

      const lineIdx = src.slice(0, pos).split("\n").length - 1;
      const fn = nearestEnclosingFunction(lines, lineIdx);
      const key = `${relFile} :: ${fn}`;
      const entry = byKey.get(key) ?? { file: relFile, fn, lines: [] };
      entry.lines.push(lineIdx + 1);
      byKey.set(key, entry);
    }
  }

  const hits: StraightLineHit[] = [];
  for (const { file, fn, lines: ls } of byKey.values()) {
    if (ls.length >= threshold) {
      hits.push({ file, functionOrNearestExport: fn, lines: [...ls].sort((a, b) => a - b) });
    }
  }
  return hits;
}

const THRESHOLD = 3;

// The ledger. Every function reported at THRESHOLD or above must have
// exactly one entry here (matched on file + functionOrNearestExport, stable
// across line-number drift). A hit with no matching entry fails the scan;
// an entry matching no hit fails as a stale ledger line.
const KNOWN_STRAIGHTLINE_WRITES: { file: string; functionOrNearestExport: string; reason: string }[] = [
  {
    file: "src/server/repo/contacts/crud.ts",
    functionOrNearestExport: "deleteContact",
    reason:
      "DEC-979/DEC-770 contact-delete pipeline: each statement names a DIFFERENT target table (pipeline_entry, task_assignment, dismissal-cascade call, email_log, file, file_comment, contact) -- bounded by the contact schema's own fixed FK-owner count, not by any table's row count.",
  },
  {
    file: "src/server/repo/contacts/merge.ts",
    functionOrNearestExport: "mergeOnePair",
    reason:
      "DEC-282/DEC-725 merge pipeline steps (b)-(g): contact field update, pipeline_activity repoint, pipeline_entry stage update, pipeline_entry delete, generic FK-repoint loop's fixed table ladder, user.email cascade, and the final contact delete -- each statement is a distinct named pipeline step, bounded by the pipeline's own step count (a fixed handful), not by row count.",
  },
  {
    file: "src/server/repo/files-versions-delete.ts",
    functionOrNearestExport: "deleteFileVersion",
    reason:
      "DEC-244/573/926 version-delete repoint: each statement targets a different table in the fixed version-chain teardown (file successor repoint, file_comment repoint-or-delete, the removed-version audit comment insert, task_assignment repoint-or-reopen, and the file row delete) -- bounded by the chain's own fixed step count, not by row count, and only one of the repoint-or-delete branches executes per call.",
  },
  {
    file: "src/server/repo/review/plans.ts",
    functionOrNearestExport: "deletePlan",
    reason:
      "DEC-929 declared four-table cascade (plan_reviewer, evaluation, review_recusal, evaluation_plan) -- each statement names a different table in a fixed, documented list matched exactly by the sibling countPlanDeleteImpact tally, not a per-row write.",
  },
];

describe("straight-line serial write scan (DEC-155 wave-72: the loop scan's blind spot -- non-loop writes)", () => {
  it("walks a large, multi-directory file set (not vacuous)", () => {
    const files: string[] = [];
    walkSrc(SRC_ROOT, files, 0);
    expect(files.length).toBeGreaterThan(150);
  });

  it("every function with >= THRESHOLD non-loop db writes, anywhere under src/, is ledgered in KNOWN_STRAIGHTLINE_WRITES", () => {
    const hits = scanForStraightLineWrites(THRESHOLD);
    const offenders = hits.filter(
      (hit) =>
        !KNOWN_STRAIGHTLINE_WRITES.some(
          (entry) => entry.file === hit.file && entry.functionOrNearestExport === hit.functionOrNearestExport,
        ),
    );

    expect(
      offenders,
      offenders
        .map(
          (o) =>
            `${o.file}:${o.lines[0]} (in ${o.functionOrNearestExport}) -- ${o.lines.length} straight-line db writes ` +
            `(lines ${o.lines.join(",")}) outside any for/while loop. Add a { file, functionOrNearestExport, reason } ` +
            `line to KNOWN_STRAIGHTLINE_WRITES in test/serial-write-straightline.scan.test.ts naming why this run is ` +
            `bounded, or restructure the writes (out of scope for this ledger-only lane).`,
        )
        .join("\n"),
    ).toEqual([]);
  });

  it("every KNOWN_STRAIGHTLINE_WRITES ledger entry still matches a real hit (no stale lines)", () => {
    const hits = scanForStraightLineWrites(THRESHOLD);
    const stale = KNOWN_STRAIGHTLINE_WRITES.filter(
      (entry) => !hits.some((hit) => hit.file === entry.file && hit.functionOrNearestExport === entry.functionOrNearestExport),
    );

    expect(
      stale,
      stale
        .map(
          (entry) =>
            `${entry.file} / ${entry.functionOrNearestExport}: stale ledger entry -- delete this line ` +
            `(test/serial-write-straightline.scan.test.ts) -- no matching function was found by the scan.`,
        )
        .join("\n"),
    ).toEqual([]);
  });

  describe("synthetic control", () => {
    const SYNTHETIC_THREE_WRITE_FN = `
async function fabricatedThreeWriteRun(db: Db, id: string): Promise<void> {
  await db.update(schema.foo).set({ a: 1 }).where(eq(schema.foo.id, id));
  await db.insert(schema.bar).values({ id });
  await db.delete(schema.baz).where(eq(schema.baz.id, id));
}
`;
    const SYNTHETIC_SINGLE_WRITE_FN = `
async function fabricatedSingleWrite(db: Db, id: string): Promise<void> {
  await db.delete(schema.foo).where(eq(schema.foo.id, id));
}
`;
    const SYNTHETIC_LOOP_WRITE_FN = `
async function fabricatedLoopWrite(db: Db, ids: string[]): Promise<void> {
  for (const id of ids) {
    await db.update(schema.foo).set({ a: 1 }).where(eq(schema.foo.id, id));
    await db.insert(schema.bar).values({ id });
    await db.delete(schema.baz).where(eq(schema.baz.id, id));
  }
}
`;

    /** Runs the same classification scanForStraightLineWrites uses, but
     * against an in-memory synthetic source string instead of walking
     * src/, so the detector's logic is proven without depending on any
     * real file's current shape. */
    function classifySynthetic(src: string, threshold: number): number {
      const stripped = stripComments(src);
      const lines = stripped.split("\n");
      const blocks = findLoopBlocks(stripped);
      const byFn = new Map<string, number>();

      let awaitMatch: RegExpExecArray | null;
      AWAIT_DB_WRITE.lastIndex = 0;
      while ((awaitMatch = AWAIT_DB_WRITE.exec(stripped))) {
        const pos = awaitMatch.index;
        const insideLoop = blocks.some((block) => pos >= block.bodyStart && pos < block.bodyEnd);
        if (insideLoop) continue;
        const lineIdx = stripped.slice(0, pos).split("\n").length - 1;
        const fn = nearestEnclosingFunction(lines, lineIdx);
        byFn.set(fn, (byFn.get(fn) ?? 0) + 1);
      }
      return [...byFn.values()].filter((count) => count >= threshold).length;
    }

    it("flags a fabricated three straight-line writes as one hit", () => {
      expect(classifySynthetic(SYNTHETIC_THREE_WRITE_FN, THRESHOLD)).toBe(1);
    });

    it("does not flag a single straight-line write", () => {
      expect(classifySynthetic(SYNTHETIC_SINGLE_WRITE_FN, THRESHOLD)).toBe(0);
    });

    it("does not flag writes inside a for loop (that class belongs to the sibling scan)", () => {
      expect(classifySynthetic(SYNTHETIC_LOOP_WRITE_FN, THRESHOLD)).toBe(0);
    });
  });
});
