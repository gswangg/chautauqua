// DEC-530 amendment (wave 53): "no KV/R2 await inside a fan-out loop" has
// been re-litigated four times as a REMEMBERED rule instead of a SCANNED
// one -- wave 42 migrated comms.ts, wave 46 content-notes.ts, and waves
// 50/51 caught bulk-email.ts and tasks/reminders.ts which the wave-42 sweep
// had missed. This scans every for/while loop under src/routes and
// src/server whose body awaits either (a) a KV/R2 handle method
// (`<ident>.get|put|delete|deleteMany|list(` where `<ident>` matches
// /(^|[a-z])(kv|store)$/i -- this codebase's handles are always named `kv`,
// `claimKv`, `draftKv` or `store`) or (b) one of the async KV/R2-backed
// helpers exported from src/auth/claim.ts, src/lib/draft.ts,
// src/server/repo/portal-link.ts and src/server/pubcache.ts (enumerated
// from those files' source at scan time -- NOT hand-listed, so a new
// helper can't silently desync the scan).
//
// IMPORTANT: `Promise.all(list.map(async (x) => ...await kv/helper...))` and
// `Promise.allSettled(...)` are the CORRECT batched shape and are
// deliberately NOT flagged by this scan -- that is exactly what
// resolvePortalLinks (src/server/repo/portal-link.ts:51) and the archive
// fetch (src/routes/files.ts:386) already do. This scan only looks at
// `for (...) { }` / `while (...) { }` loop bodies, which is a serial
// fan-out shape; a `.map(async ...)` callback body is never itself a
// for/while loop, so it is structurally invisible to this scan. Don't
// "fix" a Promise.all/allSettled site to satisfy this test -- it's already
// the correct shape.
//
// Two-directional, same shape as test/serial-write-scan.test.ts (read
// first for the walk/findLoopBlocks/nearestEnclosingFunction machinery,
// reused verbatim here): an unlisted, unexempt hit fails naming file:line
// (batch it, or ledger it with a reason); a ledger entry matching no hit
// ALSO fails ("stale ledger entry -- delete this line").

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..");
const SCAN_DIRS = ["src/routes", "src/server"];
const SKIP_DIRS = new Set(["node_modules", "dist", ".wrangler", "build", ".git"]);

const EXEMPT_CHUNK_HELPERS = ["chunkIds", "chunkRowsForInsert", "chunkRows"];

// Files whose exported `export async function <name>(` declarations are the
// KV/R2-backed helpers this scan treats as case (b) hits. Enumerated from
// source below, not hand-listed.
const HELPER_SOURCE_FILES = [
  "src/auth/claim.ts",
  "src/lib/draft.ts",
  "src/server/repo/portal-link.ts",
  "src/server/pubcache.ts",
];

interface KvR2Hit {
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
 * header isn't followed by a `{` block. */
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

/** Enumerates the exported async KV/R2-backed helper names from the source
 * of HELPER_SOURCE_FILES by regexing their `export async function <name>(`
 * declarations. Not hand-listed -- a helper added to one of these files is
 * picked up automatically the next time the scan runs. */
function enumerateKvR2Helpers(): string[] {
  const names: string[] = [];
  const re = /^export\s+async\s+function\s+([A-Za-z0-9_]+)\s*\(/gm;
  for (const relPath of HELPER_SOURCE_FILES) {
    const src = readFileSync(join(ROOT, relPath), "utf8");
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(src))) {
      if (m[1]) names.push(m[1]);
    }
  }
  return names;
}

/** Builds the case-(a)/(b) await regex: either `await <ident>.get|put|
 * delete|deleteMany|list(` where `<ident>` matches /(^|[a-z])(kv|store)$/i,
 * or `await <helperName>(` for one of the enumerated helpers. */
function buildKvR2AwaitRegex(helperNames: string[]): RegExp {
  const helperAlt = helperNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  // Case (a): `await <ident>.method(` where ident ends in kv/store
  // (case-insensitively), e.g. kv, claimKv, draftKv, store.
  const handlePattern = String.raw`await\s+([A-Za-z_$][\w$]*)\s*\.\s*(?:get|put|delete|deleteMany|list)\s*\(`;
  // Case (b): `await <helperName>(`.
  const helperPattern = helperAlt.length > 0 ? String.raw`await\s+(?:${helperAlt})\s*\(` : null;
  const combined = helperPattern ? `(?:${handlePattern})|(?:${helperPattern})` : handlePattern;
  return new RegExp(combined, "g");
}

const KV_STORE_IDENT = /(^|[a-z])(kv|store)$/i;

/** Walks every .ts/.tsx file under SCAN_DIRS. For every case-(a)/(b) KV/R2
 * await occurrence, finds its INNERMOST enclosing for/while loop and,
 * unless that loop's header iterates one of the EXEMPT_CHUNK_HELPERS,
 * records one KvR2Hit for it (deduped -- a loop with multiple such awaits
 * in its body yields one hit, not several). An await not inside any loop
 * (a one-off call, or inside a `.map(async ...)` callback -- which is not a
 * for/while loop) is not a "fan-out loop" await and is skipped. */
function scanForKvR2LoopAwaits(): KvR2Hit[] {
  const helperNames = enumerateKvR2Helpers();
  const awaitRe = buildKvR2AwaitRegex(helperNames);

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

  const hits: KvR2Hit[] = [];
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    const lines = src.split("\n");
    const blocks = findLoopBlocks(src);
    const seenBlockStarts = new Set<number>();

    let awaitMatch: RegExpExecArray | null;
    awaitRe.lastIndex = 0;
    while ((awaitMatch = awaitRe.exec(src))) {
      const pos = awaitMatch.index;
      // Case (a) capture group 1 holds the handle identifier; if present,
      // it must match the kv/store naming convention. Case (b) matches
      // have no capture group 1 (helper-name alternation has no group).
      const handleIdent = awaitMatch[1];
      if (handleIdent !== undefined && !KV_STORE_IDENT.test(handleIdent)) continue;

      let innermost: LoopBlock | null = null;
      for (const block of blocks) {
        if (pos < block.bodyStart || pos >= block.bodyEnd) continue;
        if (!innermost || block.bodyEnd - block.bodyStart < innermost.bodyEnd - innermost.bodyStart) {
          innermost = block;
        }
      }
      if (!innermost) continue; // one-off await, not inside any loop
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
// a stale ledger line. Starts EMPTY: DEC-530's four prior offenders
// (comms.ts, content-notes.ts, bulk-email.ts, tasks/reminders.ts) have all
// already been migrated to batch resolvePortalLinks/etc ABOVE their send
// loops, so nothing should land here yet -- only genuinely
// fixed-small-constant-bounded per-iteration IO belongs in this ledger, per
// the same discipline as KNOWN_SERIAL_WRITES.
const KNOWN_SERIAL_IO: { file: string; functionOrNearestExport: string; reason: string }[] = [];

describe("KV/R2 await-inside-fan-out-loop scan (DEC-530 amendment, wave 53)", () => {
  it("the scan itself finds files under src/routes and src/server (not vacuous)", () => {
    const files: string[] = [];
    for (const dir of SCAN_DIRS) walk(join(ROOT, dir), files);
    expect(files.length).toBeGreaterThan(0);
  });

  it("every unexempt for/while loop awaiting a KV/R2 handle or helper is either a chunk-helper iteration or ledgered", () => {
    const hits = scanForKvR2LoopAwaits();
    const offenders = hits.filter(
      (hit) =>
        !KNOWN_SERIAL_IO.some(
          (entry) => entry.file === hit.file && entry.functionOrNearestExport === hit.functionOrNearestExport,
        ),
    );

    expect(
      offenders,
      offenders
        .map(
          (o) =>
            `${o.file}:${o.line} (in ${o.functionOrNearestExport}) -- serial KV/R2 await inside a for/while ` +
            `loop that doesn't iterate a chunk helper (chunkIds/chunkRowsForInsert/chunkRows). Batch it (e.g. ` +
            `Promise.all(list.map(async (x) => ...)) the way resolvePortalLinks does), or add a { file, ` +
            `functionOrNearestExport, reason } line to KNOWN_SERIAL_IO in test/kv-r2-loop.scan.test.ts naming ` +
            `the fixed small constant that bounds this loop's per-iteration IO.`,
        )
        .join("\n"),
    ).toEqual([]);
  });

  it("every KNOWN_SERIAL_IO ledger entry still matches a real hit (no stale lines)", () => {
    const hits = scanForKvR2LoopAwaits();
    const stale = KNOWN_SERIAL_IO.filter(
      (entry) => !hits.some((hit) => hit.file === entry.file && hit.functionOrNearestExport === entry.functionOrNearestExport),
    );

    expect(
      stale,
      stale
        .map(
          (entry) =>
            `${entry.file} / ${entry.functionOrNearestExport}: stale ledger entry -- delete this line ` +
            `(test/kv-r2-loop.scan.test.ts) -- no matching loop was found by the scan.`,
        )
        .join("\n"),
    ).toEqual([]);
  });
});
