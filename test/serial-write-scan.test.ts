// DEC-948 amendment (wave 19): a serial per-row D1 write is a SCANNED class,
// not a per-wave rediscovery. Waves 46, 47 and 48 each independently found a
// different loop that batched its READ half but left one write per
// iteration ("BATCHING LANDS ON THE READ NOT THE WRITE", twice). This scans
// every for/while under src/** (minus EXCLUDED_ROOTS below) whose body
// awaits db.insert(/db.update(/db.delete(, and classifies each hit as
// EITHER (a) EXEMPT because the loop iterates a chunk helper (chunkIds /
// chunkRowsForInsert / chunkRows — the already-correct O(chunks) shape) OR
// (b) LEDGERED in KNOWN_SERIAL_WRITES below with a one-line reason.
//
// Wave 19 finding: the scan previously hard-coded SCAN_DIRS = ["src/routes",
// "src/server/repo"] and its own describe title advertised that as the
// class boundary — so src/server/auth-session.ts, src/server/context.ts,
// src/server/scheduled.ts, src/sync/**, src/domain/**, src/auth/**,
// src/mail/**, src/lib/** and src/forms/** were never in frame for this
// guard even though every one of them is inside the pure-core/composition
// layers that can issue db writes. The fix walks ALL of src/ (see walkSrc
// below); EXCLUDED_ROOTS is the only escape hatch, and every entry in it
// must name its reason. A test below asserts every top-level entry under
// src/ is either walked or named in EXCLUDED_ROOTS, so a future directory
// added under src/ cannot silently fall outside the guard's claim the way
// the six directories above did.
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
// -- no parser dependency added. Comments (// and /* */) are stripped
// before matching (see stripComments) so a DEC citation or an example
// snippet inside a JSDoc block is never counted as a loop or an await hit.

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..");
const SRC_ROOT = join(ROOT, "src");
const SKIP_DIRS = new Set(["node_modules", "dist", ".wrangler", "build", ".git"]);

// The ONLY sanctioned way to keep a top-level src/ directory out of this
// scan's walk. Every entry must name why it can never contain a for/while
// loop awaiting a db write -- "src/routes and src/server/repo scan only
// those" (the wave-19 bug) is not an acceptable reason.
const EXCLUDED_ROOTS: { name: string; reason: string }[] = [
  {
    name: "decisions-data",
    reason:
      "Scribe-maintained constant DEC_* string data (src/decisions.ts registry, regenerated each wave) -- plain string exports, no loops, no db calls.",
  },
];
const EXCLUDED_ROOT_NAMES = new Set(EXCLUDED_ROOTS.map((e) => e.name));

const EXEMPT_CHUNK_HELPERS = ["chunkIds", "chunkRowsForInsert", "chunkRows"];

interface SerialWriteHit {
  file: string; // repo-relative path
  line: number; // 1-indexed line of the `for`/`while` keyword
  functionOrNearestExport: string;
}

/** Walks every .ts/.tsx file under src/, skipping SKIP_DIRS everywhere and
 * EXCLUDED_ROOTS only at depth 0 (a nested directory that happens to share
 * a name with an excluded root, if one ever exists, is NOT exempted --
 * exclusion is a top-level-only escape hatch). */
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

/** Strips `//` line comments and `/* *\/` block comments from `src`,
 * preserving every newline (so downstream line-number math stays correct)
 * and preserving the contents of string/template literals (so a URL like
 * "https://example.com" inside a string is never mistaken for a line
 * comment). Deliberately simple -- doesn't track `${...}` interpolation
 * inside template literals as re-entering code, which is fine here since
 * no loop header or db-write call in this codebase lives inside a template
 * literal expression. */
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
 * codebase's scanned layers; a bare-statement loop would just be
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

/** Walks every .ts/.tsx file under src/ (minus EXCLUDED_ROOTS). For every
 * `await db.insert/update/delete(` occurrence (after comment-stripping),
 * finds its INNERMOST enclosing for/while loop (smallest body span
 * containing it) and, unless that loop's header iterates one of the
 * EXEMPT_CHUNK_HELPERS, records one SerialWriteHit for it (deduped -- a
 * loop with two awaits in its body yields one hit, not two). An await not
 * inside any loop (a one-off write) is not a "serial" write and is
 * skipped. */
function scanForSerialWrites(): SerialWriteHit[] {
  const files: string[] = [];
  walkSrc(SRC_ROOT, files, 0);

  const hits: SerialWriteHit[] = [];
  for (const file of files) {
    const raw = readFileSync(file, "utf8");
    const src = stripComments(raw);
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
    file: "src/server/repo/forms.ts",
    functionOrNearestExport: "reorderFields",
    reason:
      "Persists a drag-and-drop reorder as one UPDATE per field position; each row commonly gets a distinct `position` value, so it isn't a shared-predicate set update -- bounded by one form's field count (a UI-driven list, not a bulk/import path).",
  },
];

describe("serial per-row D1 write scan (DEC-948 amendment, wave 19: walks all of src/, not just src/routes + src/server/repo)", () => {
  it("walks every top-level entry under src/ -- each is either scanned or named in EXCLUDED_ROOTS with a reason", () => {
    const topLevelEntries = readdirSync(SRC_ROOT).filter((e) => !SKIP_DIRS.has(e));
    const files: string[] = [];
    walkSrc(SRC_ROOT, files, 0);
    const scannedTopLevel = new Set(files.map((f) => relative(SRC_ROOT, f).split("/")[0]));

    const unaccounted = topLevelEntries.filter((e) => !scannedTopLevel.has(e) && !EXCLUDED_ROOT_NAMES.has(e));

    expect(
      unaccounted,
      unaccounted
        .map(
          (e) =>
            `src/${e}: contains no scanned .ts/.tsx files and isn't in EXCLUDED_ROOTS -- either it's dead, or it ` +
            `needs an EXCLUDED_ROOTS entry naming why it can never contain a serial db-write loop.`,
        )
        .join("\n"),
    ).toEqual([]);
  });

  it("the scan is not vacuous: walks a large, multi-directory file set and finds at least as many hits as the ledger", () => {
    const files: string[] = [];
    walkSrc(SRC_ROOT, files, 0);
    expect(files.length).toBeGreaterThan(150);

    const hits = scanForSerialWrites();
    expect(hits.length).toBeGreaterThanOrEqual(KNOWN_SERIAL_WRITES.length);
  });

  it("every unexempt for/while loop awaiting a db write, anywhere under src/, is either a chunk-helper iteration or ledgered", () => {
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
