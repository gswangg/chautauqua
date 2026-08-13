// DEC-948 amendment (wave 49): a serial per-row D1 write is a SCANNED class,
// not a per-wave rediscovery. Waves 46, 47 and 48 each independently found a
// different loop that batched its READ half but left one write per
// iteration ("BATCHING LANDS ON THE READ NOT THE WRITE", twice). This scans
// every for/while under src/routes/** and src/server/repo/** whose body
// awaits db.insert(/db.update(/db.delete(, and classifies each hit as
// EITHER (a) EXEMPT because the loop iterates a chunk helper (chunkIds /
// chunkRowsForInsert / chunkRows — the already-correct O(chunks) shape) OR
// (b) LEDGERED in KNOWN_SERIAL_WRITES below with a one-line reason.
//
// Two-directional, same shape as test/contact-reference-manifest.test.ts's
// hand-listed-manifest-that-cannot-desync: an unlisted, unexempt hit fails
// naming file:line (batch it, or ledger it with a reason); a ledger entry
// that matches no hit ALSO fails ("stale ledger entry -- delete this
// line"), so a lane that fixes a ledgered loop must delete its line here,
// not leave it to rot.
//
// Deliberately a lightweight brace-matching text scan (this repo already
// does text scans of source elsewhere, e.g. test/no-conflict-markers.test.ts)
// -- no parser dependency added.

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..");
const SCAN_DIRS = ["src/routes", "src/server/repo"];
const SKIP_DIRS = new Set(["node_modules", "dist", ".wrangler", "build", ".git"]);

const EXEMPT_CHUNK_HELPERS = ["chunkIds", "chunkRowsForInsert", "chunkRows"];

interface SerialWriteHit {
  file: string; // repo-relative path
  line: number; // 1-indexed line of the `for`/`while` keyword
  functionOrNearestExport: string;
}

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, out);
    } else if (stat.isFile() && /\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
}

interface LoopBlock {
  start: number; // index of the `for`/`while` keyword
  header: string; // the parenthesized `(...)` part, for the chunk-helper check
  bodyStart: number; // index of the body's opening `{`
  bodyEnd: number; // index just past the body's closing `}`
}

/** Locates every `for (...)`/`while (...)` block in `src` (header +
 * brace-matched body span, NOT the body text itself -- a nested loop's
 * await is contained within every ancestor loop's body span too, so
 * classification below picks the INNERMOST enclosing block per await
 * occurrence rather than flagging every ancestor). Skips any loop whose
 * header isn't followed by a `{` block (no such loops exist in this
 * codebase's repo/route layer; a bare-statement loop would just be
 * invisible to this scan rather than a false positive). */
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
const CHUNK_HELPER_ITERATION = new RegExp(`\\bof\\s+(${EXEMPT_CHUNK_HELPERS.join("|")})\\s*\\(`);

/** Nearest enclosing `function name(` / `export ... function name(`
 * declaration ABOVE the loop -- used as the ledger key alongside file, so
 * ledger entries survive line-number drift from unrelated edits. */
const FUNCTION_DECL = /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(/;

function nearestEnclosingFunction(lines: string[], loopLineIdx: number): string {
  for (let i = loopLineIdx; i >= 0; i--) {
    const match = FUNCTION_DECL.exec(lines[i] ?? "");
    if (match?.[1]) return match[1];
  }
  return "(module scope)";
}

/** Walks every .ts/.tsx file under SCAN_DIRS. For every `await db.insert/
 * update/delete(` occurrence, finds its INNERMOST enclosing for/while loop
 * (smallest body span containing it) and, unless that loop's header
 * iterates one of the EXEMPT_CHUNK_HELPERS, records one SerialWriteHit for
 * it (deduped -- a loop with two awaits in its body yields one hit, not
 * two). An await not inside any loop (a one-off write) is not a "serial"
 * write and is skipped. */
function scanForSerialWrites(): SerialWriteHit[] {
  const files: string[] = [];
  for (const dir of SCAN_DIRS) {
    const abs = join(ROOT, dir);
    try {
      statSync(abs);
    } catch {
      continue;
    }
    walk(abs, files);
  }

  const hits: SerialWriteHit[] = [];
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    const lines = src.split("\n");
    const blocks = findLoopBlocks(src);
    const seenBlockStarts = new Set<number>();

    let awaitMatch: RegExpExecArray | null;
    AWAIT_DB_WRITE.lastIndex = 0;
    while ((awaitMatch = AWAIT_DB_WRITE.exec(src))) {
      const pos = awaitMatch.index;
      let innermost: LoopBlock | null = null;
      for (const block of blocks) {
        if (pos < block.bodyStart || pos >= block.bodyEnd) continue;
        if (!innermost || block.bodyEnd - block.bodyStart < innermost.bodyEnd - innermost.bodyStart) {
          innermost = block;
        }
      }
      if (!innermost) continue; // one-off write, not inside any loop
      if (seenBlockStarts.has(innermost.start)) continue;
      if (CHUNK_HELPER_ITERATION.test(innermost.header)) continue; // exempt
      seenBlockStarts.add(innermost.start);

      const lineIdx = src.slice(0, innermost.start).split("\n").length - 1;
      hits.push({
        file: relative(ROOT, file).split("\\").join("/"),
        line: lineIdx + 1,
        functionOrNearestExport: nearestEnclosingFunction(lines, lineIdx),
      });
    }
  }
  return hits;
}

// The ledger. Every non-exempt hit the scan finds at this branch point must
// have exactly one entry here (matched on file + functionOrNearestExport,
// which is stable across line-number drift from unrelated edits). A hit
// with no matching entry fails the scan; an entry matching no hit fails as
// a stale ledger line.
const KNOWN_SERIAL_WRITES: { file: string; functionOrNearestExport: string; reason: string }[] = [
  {
    file: "src/server/repo/contacts/merge.ts",
    functionOrNearestExport: "mergeOnePair",
    reason:
      "DEC-282 generic FK-repoint step: each op names a DIFFERENT target table (participant, task_assignment, email_log, user, file, file_comment, pipeline_entry), so the writes cannot share one statement shape -- bounded by CONTACT_FK_TABLES' fixed length (~7), not by contact/row count.",
  },
  {
    file: "src/server/repo/forms.ts",
    functionOrNearestExport: "deleteFieldCascade",
    reason:
      "DEC-300 declared cascade: clears each dependent sibling field's rule (ruleJson: null) one row at a time -- bounded by the deleted field's own dependent count, a small fan-out off a single form, not a bulk/import path.",
  },
  {
    file: "src/server/repo/submissions/status.ts",
    functionOrNearestExport: "getOrCreateFormTaskForm",
    reason:
      "DEC-111 form-task self-heal: inserts one form_field row per FORM_TASK_FIELD_SPECS entry on first creation of a task's backing form -- bounded by a fixed template's field count (single digits), not by any table's row count.",
  },
  {
    file: "src/server/repo/import/sessionboard.ts",
    functionOrNearestExport: "applySessionboardPlans",
    reason:
      "Per-plan-row insert/update across contacts/submissions/tracks/participants during a Sessionboard CSV import -- concurrent lane w49-e is removing this loop's serial writes in this same file; if this ledger line still matches at merge time, the correct resolution is deleting this line, not re-adding the loop.",
  },
  {
    file: "src/server/repo/forms.ts",
    functionOrNearestExport: "reorderFields",
    reason:
      "Persists a drag-and-drop reorder as one UPDATE per field position; each row commonly gets a distinct `position` value, so it isn't a shared-predicate set update -- bounded by one form's field count (a UI-driven list, not a bulk/import path).",
  },
];

describe("serial per-row D1 write scan (DEC-948 amendment, wave 49)", () => {
  it("the scan itself finds loop bodies under src/routes and src/server/repo (not vacuous)", () => {
    const files: string[] = [];
    for (const dir of SCAN_DIRS) walk(join(ROOT, dir), files);
    expect(files.length).toBeGreaterThan(0);
  });

  it("every unexempt for/while loop awaiting a db write is either a chunk-helper iteration or ledgered", () => {
    const hits = scanForSerialWrites();
    const offenders = hits.filter(
      (hit) =>
        !KNOWN_SERIAL_WRITES.some(
          (entry) => entry.file === hit.file && entry.functionOrNearestExport === hit.functionOrNearestExport,
        ),
    );

    expect(
      offenders,
      offenders
        .map(
          (o) =>
            `${o.file}:${o.line} (in ${o.functionOrNearestExport}) -- serial per-row db write inside a ` +
            `for/while loop that doesn't iterate a chunk helper (chunkIds/chunkRowsForInsert/chunkRows). ` +
            `Batch the write, or add a { file, functionOrNearestExport, reason } line to KNOWN_SERIAL_WRITES ` +
            `in test/serial-write-scan.test.ts naming why this one is bounded.`,
        )
        .join("\n"),
    ).toEqual([]);
  });

  it("every KNOWN_SERIAL_WRITES ledger entry still matches a real hit (no stale lines)", () => {
    const hits = scanForSerialWrites();
    const stale = KNOWN_SERIAL_WRITES.filter(
      (entry) => !hits.some((hit) => hit.file === entry.file && hit.functionOrNearestExport === entry.functionOrNearestExport),
    );

    expect(
      stale,
      stale
        .map(
          (entry) =>
            `${entry.file} / ${entry.functionOrNearestExport}: stale ledger entry -- delete this line ` +
            `(test/serial-write-scan.test.ts) -- no matching loop was found by the scan.`,
        )
        .join("\n"),
    ).toEqual([]);
  });
});
