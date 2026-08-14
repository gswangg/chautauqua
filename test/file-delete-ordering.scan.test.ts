// DEC-713 amendment (wave 51): the R2-delete/row-delete ORDERING (row commits
// FIRST, then the R2 object is deleted in a try/catch that logs and swallows
// -- "the committed-delete shape", established wave 50 in src/routes/files.ts
// and src/routes/api/submissions.ts, and converted a third time this wave in
// src/routes/api/portal-config.ts) is now a SCANNED class, not a per-wave
// rediscovery. This scans every `store.delete(`/`store.deleteMany(`
// occurrence under src/routes/** and src/server/**, and classifies each hit
// as EITHER (a) auto-pass because it sits inside a try block whose matching
// catch does not rethrow (the committed-delete shape -- a swallowed
// store.delete/deleteMany failure after a row commit) OR (b) EXEMPT (two
// fixed, named exceptions in src/server/context.ts: putThenRecord's own
// compensation delete-on-throw, which runs BEFORE any row write and so is
// exempt from this row-first rule by construction, and makeFileStore's own
// `delete` method implementation, which is not a caller of the store at all
// -- it IS the store) OR (c) LEDGERED in KNOWN_BYTES_BEFORE_ROW below with a
// one-line reason for any future object-before-row delete that is
// deliberately NOT in the committed-delete shape.
//
// Two-directional, same shape as test/serial-write-scan.test.ts: an
// unledgered, unexempt, non-committed-delete-shape hit fails naming
// file:line (reorder it to the committed-delete shape, or ledger it with a
// reason); a ledger entry that matches no hit ALSO fails ("stale ledger
// entry -- delete this line"), so a lane that fixes a ledgered hit must
// delete its line here, not leave it to rot.
//
// Deliberately a lightweight brace-matching text scan (this repo already
// does text scans of source elsewhere, e.g. test/serial-write-scan.test.ts)
// -- no parser dependency added.

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..");
const SRC_ROOT = "src";
// WAVE-19 amendment (DEC-713): the RECEIVER is part of the call shape -- the
// scan used to require the literal identifier `store` and only walked
// src/routes + src/server, which silently missed both a renamed local
// binding (`fileStore.delete(...)`) and any store call sitting under a
// different top-level src/ directory. Every top-level entry under src/ must
// now be either scanned (implicitly, by SRC_ROOT covering it) or listed here
// with a stated reason it's structurally exempt from ever holding a store
// delete call site.
const EXCLUDED_ROOTS: { name: string; reason: string }[] = [];
const SKIP_DIRS = new Set(["node_modules", "dist", ".wrangler", "build", ".git"]);

interface DeleteHit {
  file: string; // repo-relative path
  line: number; // 1-indexed line of the `store.delete(`/`store.deleteMany(` call
  functionOrNearestExport: string;
  committedShape: boolean; // true if inside a try whose catch doesn't rethrow
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

/** Strips `//` line comments and `/* *\/` block comments, replacing every
 * stripped character with a space (newlines preserved verbatim) so the
 * output has EXACTLY the same length -- and therefore the same character
 * offsets and line numbers -- as `src`. String/template literals are
 * tracked so a `//` or `/*` inside a string (e.g. a URL) is never mistaken
 * for the start of a comment. Deliberately still a lightweight text pass,
 * not a real lexer -- good enough for this repo's existing comment style. */
function stripComments(src: string): string {
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const c2 = i + 1 < n ? src[i + 1] : "";
    if (c === "/" && c2 === "/") {
      while (i < n && src[i] !== "\n") {
        out += " ";
        i++;
      }
      continue;
    }
    if (c === "/" && c2 === "*") {
      out += "  ";
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) {
        out += src[i] === "\n" ? "\n" : " ";
        i++;
      }
      if (i < n) {
        out += "  ";
        i += 2;
      }
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
        out += src[i];
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

/** Brace-matches a `{` at `openIdx` (the index OF the `{`) to its closing
 * `}`, returning the index just past it. */
function matchBrace(src: string, openIdx: number): number {
  let depth = 1;
  let i = openIdx + 1;
  while (i < src.length && depth > 0) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") depth--;
    i++;
  }
  return i;
}

interface TryCatchBlock {
  tryBodyStart: number;
  tryBodyEnd: number;
  catchHasThrow: boolean;
  hasCatch: boolean;
}

/** Locates every `try { ... } catch (...) { ... }` structure in `src`
 * (header + brace-matched try body, then -- if immediately followed by a
 * `catch` clause -- its brace-matched body too). A `try` with no `catch`
 * clause at all (e.g. try/finally only) is recorded with hasCatch: false so
 * it never counts as the committed-delete shape (that shape specifically
 * requires a swallowing catch, not just "inside a try"). */
function findTryCatchBlocks(src: string): TryCatchBlock[] {
  const out: TryCatchBlock[] = [];
  const re = /\btry\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const openIdx = m.index + m[0].length - 1;
    const tryBodyStart = openIdx + 1;
    const tryBodyEnd = matchBrace(src, openIdx) - 1;

    let j = tryBodyEnd + 1;
    while (j < src.length && /\s/.test(src[j] ?? "")) j++;
    const catchMatch = /^catch\s*(\([^)]*\))?\s*\{/.exec(src.slice(j));
    if (!catchMatch) {
      out.push({ tryBodyStart, tryBodyEnd, catchHasThrow: true, hasCatch: false });
      continue;
    }
    const catchOpenIdx = j + catchMatch[0].length - 1;
    const catchBodyStart = catchOpenIdx + 1;
    const catchBodyEnd = matchBrace(src, catchOpenIdx) - 1;
    const catchBody = src.slice(catchBodyStart, catchBodyEnd);
    out.push({ tryBodyStart, tryBodyEnd, catchHasThrow: /\bthrow\b/.test(catchBody), hasCatch: true });
  }
  return out;
}

/** Named scope ("function name(" declaration, allowing generics -- `function
 * name<T>(` -- or an object-literal-style method like `async delete(key) {`)
 * with its brace-matched body span, for proper (nesting-aware) enclosing-
 * scope lookup below -- textually-nearest-line-above is NOT enough: an
 * object literal with sibling methods (`put`, `get`, `delete`,
 * `deleteMany`) has each sibling's declaration line textually above a hit
 * in a LATER sibling despite not enclosing it at all. */
const FUNCTION_DECL = /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*(?:<[^>]*>)?\s*\(/;
// Reserved words that can precede `(...) {` without being a named
// declaration (control-flow keywords), excluded so e.g. `if (x) {` is never
// misread as a method literally named "if".
const RESERVED_METHOD_NAMES = new Set(["if", "for", "while", "switch", "catch", "function", "try", "else"]);
const METHOD_DECL = /^\s*(?:export\s+)?(?:async\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*\(.*\)\s*(?::\s*[^{]+)?\{\s*$/;

interface NamedScope {
  name: string;
  bodyStart: number;
  bodyEnd: number;
}

function findNamedScopes(src: string): NamedScope[] {
  const out: NamedScope[] = [];
  const lines = src.split("\n");
  let offset = 0;
  const lineOffsets: number[] = [];
  for (const line of lines) {
    lineOffsets.push(offset);
    offset += line.length + 1;
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const fn = FUNCTION_DECL.exec(line);
    const method = fn ? null : METHOD_DECL.exec(line);
    const name = fn?.[1] ?? method?.[1];
    if (!name || RESERVED_METHOD_NAMES.has(name)) continue;
    // Find this declaration's opening `{` -- for a FUNCTION_DECL match it's
    // beyond the matched prefix on this (or a later) line; for a
    // METHOD_DECL match the regex already anchors the line ending in `{`.
    const lineStart = lineOffsets[i] ?? 0;
    const searchFrom = lineStart + (fn ? fn[0].length - 1 : line.length - 1);
    const openIdx = src.indexOf("{", Math.max(lineStart, searchFrom));
    if (openIdx === -1) continue;
    const bodyStart = openIdx + 1;
    const bodyEnd = matchBrace(src, openIdx) - 1;
    out.push({ name, bodyStart, bodyEnd });
  }
  return out;
}

/** Innermost-first, up to two levels of named enclosing scope for `pos`,
 * joined "outer.inner" so ledger/exempt entries stay descriptive even when
 * the hit sits inside a returned object literal's method nested in a
 * factory function. */
function nearestEnclosingFunction(scopes: NamedScope[], pos: number): string {
  const enclosing = scopes
    .filter((s) => pos >= s.bodyStart && pos < s.bodyEnd)
    .sort((a, b) => a.bodyEnd - a.bodyStart - (b.bodyEnd - b.bodyStart));
  if (enclosing.length === 0) return "(module scope)";
  const picked = enclosing.slice(0, 2).reverse();
  return picked.map((s) => s.name).join(".");
}

// WAVE-19 amendment (DEC-713): the RECEIVER is part of the call shape. This
// used to require the literal identifier `store`, which missed a renamed
// local binding like `fileStore.delete(...)`. Now matches any identifier
// ENDING in "store" (case-insensitive, so `fileStore`, `FileStore`,
// `attachmentStore`, or the bare `store` itself all match) immediately
// followed by `.delete(` or `.deleteMany(` -- a renamed local binding can no
// longer hide a call site from this scan.
const DELETE_CALL = /\b\w*store\s*\.\s*(delete|deleteMany)\s*\(/gi;

/** EXEMPT hits: known-by-file+function, not by silence. Neither of these is
 * a caller of the store performing a delete-before-row-commit -- one runs
 * BEFORE any row write exists (so "row-first" doesn't apply), the other IS
 * the store's own implementation, not a call site. */
const EXEMPT_HITS: { file: string; functionOrNearestExport: string; reason: string }[] = [
  {
    file: "src/server/context.ts",
    functionOrNearestExport: "putThenRecord",
    reason:
      "This is putThenRecord's own compensation delete-on-throw: it runs when `record()` (the row write) FAILS, deleting the just-written object so it isn't orphaned. There is no committed row here to order after -- the row write never succeeded, so DEC-713's row-first rule doesn't apply.",
  },
  {
    file: "src/server/context.ts",
    functionOrNearestExport: "makeFileStore.delete",
    reason: "This is the FileStore.delete method's own implementation (delegates to deleteMany) -- it IS the store, not a caller of it, so it has no row to order against.",
  },
];

/** Every top-level entry directly under src/ (files AND directories) that is
 * actually scanned -- i.e. not named in EXCLUDED_ROOTS. Used both to build
 * the file list and to back the "nothing under src/ silently escapes" test
 * below. */
function scannedTopLevelEntries(): string[] {
  const excluded = new Set(EXCLUDED_ROOTS.map((e) => e.name));
  return readdirSync(join(ROOT, SRC_ROOT)).filter((name) => !SKIP_DIRS.has(name) && !excluded.has(name));
}

function scanForDeleteHits(): DeleteHit[] {
  const files: string[] = [];
  for (const name of scannedTopLevelEntries()) {
    const abs = join(ROOT, SRC_ROOT, name);
    const stat = statSync(abs);
    if (stat.isDirectory()) {
      walk(abs, files);
    } else if (stat.isFile() && /\.(ts|tsx)$/.test(name)) {
      files.push(abs);
    }
  }

  const hits: DeleteHit[] = [];
  for (const file of files) {
    const rawSrc = readFileSync(file, "utf8");
    const src = stripComments(rawSrc);
    const tryCatchBlocks = findTryCatchBlocks(src);
    const namedScopes = findNamedScopes(src);

    let match: RegExpExecArray | null;
    DELETE_CALL.lastIndex = 0;
    while ((match = DELETE_CALL.exec(src))) {
      const pos = match.index;
      let innermost: TryCatchBlock | null = null;
      for (const block of tryCatchBlocks) {
        if (pos < block.tryBodyStart || pos >= block.tryBodyEnd) continue;
        if (!innermost || block.tryBodyEnd - block.tryBodyStart < innermost.tryBodyEnd - innermost.tryBodyStart) {
          innermost = block;
        }
      }
      const committedShape = innermost !== null && innermost.hasCatch && !innermost.catchHasThrow;

      const lineIdx = src.slice(0, pos).split("\n").length - 1;
      hits.push({
        file: relative(ROOT, file).split("\\").join("/"),
        line: lineIdx + 1,
        functionOrNearestExport: nearestEnclosingFunction(namedScopes, pos),
        committedShape,
      });
    }
  }
  return hits;
}

// The ledger for any deliberate object-before-row delete (a hit that is NOT
// in the committed-delete shape and is not one of the two fixed EXEMPT_HITS
// above). Three real call sites (files.ts, submissions.ts, portal-config.ts)
// are in the committed-delete shape as of wave 50/51. One deliberate
// exception, found wave 19 once the RECEIVER-aware regex could see it:
const KNOWN_BYTES_BEFORE_ROW: { file: string; functionOrNearestExport: string; reason: string }[] = [
  {
    file: "src/routes/public/submit.tsx",
    functionOrNearestExport: "(module scope)",
    reason:
      "This is the anonymous public CFP submit handler's own N-object rollback (see the comment directly above it, and src/server/context.ts's putThenRecord doc comment: 'Multi-object batch uploads (src/routes/public/submit.tsx) keep their own rollback because a single delete-on-throw doesn't cover N objects'). It runs inside the catch of the DB-write try block, AFTER createSubmission() has already committed a submission row, and it deletes the just-uploaded R2 objects BEFORE commitSubmissionDelete() removes that row two lines later -- object-before-row, not the committed-delete shape. This is not the same situation the committed-delete shape guards against: this is a full transaction rollback (both the row and its R2 objects are being discarded together because a later step in the same request failed), not a steady-state row update that leaves R2 objects referenced by a row that no longer exists. The catch also rethrows (`throw err`), which alone disqualifies it from the committed-delete shape (that shape specifically requires a swallowing catch). Reordering this path (row-delete first, R2-delete second, swallowed) is a genuine behaviour change on the anonymous public CFP write path and deserves its own wave, not a drive-by fix inside this scan-widening task.",
  },
];

describe("R2 delete-before-row-commit ordering scan (DEC-713 amendment, wave 19/51)", () => {
  it("the scan finds store.delete/deleteMany call sites across all of src/ (not vacuous, and not just the pre-wave-19 6)", () => {
    const hits = scanForDeleteHits();
    // Before wave 19 this scan found 6 hits (context.ts x2, files.ts,
    // submissions.ts, portal-config.ts, portal/tasks.tsx) because its
    // literal `\bstore\.` regex couldn't see a renamed receiver like
    // `fileStore`. This threshold requires the 7th (submit.tsx:610's
    // `fileStore.delete(...)`) to be found too, so a future regression back
    // to a bare `store` match is caught here, not rediscovered by hand.
    expect(hits.length).toBeGreaterThanOrEqual(7);
  });

  it("finds the renamed-receiver call site (fileStore.delete) that the pre-wave-19 literal `store.` regex missed", () => {
    const hits = scanForDeleteHits();
    const hit = hits.find((h) => h.file === "src/routes/public/submit.tsx" && h.line === 610);
    expect(hit, "expected a hit at src/routes/public/submit.tsx:610 (fileStore.delete) -- the receiver-aware regex regressed").toBeDefined();
  });

  it("every top-level entry under src/ is either scanned or listed in EXCLUDED_ROOTS with a reason", () => {
    const excludedNames = new Set(EXCLUDED_ROOTS.map((e) => e.name));
    for (const entry of EXCLUDED_ROOTS) {
      expect(entry.reason.length, `EXCLUDED_ROOTS entry "${entry.name}" has no stated reason`).toBeGreaterThan(0);
    }
    const topLevel = readdirSync(join(ROOT, SRC_ROOT)).filter((name) => !SKIP_DIRS.has(name));
    const unaccounted = topLevel.filter((name) => !excludedNames.has(name) && !scannedTopLevelEntries().includes(name));
    expect(
      unaccounted,
      unaccounted.map((name) => `src/${name}: neither scanned nor listed in EXCLUDED_ROOTS -- it can silently hide a store.delete/deleteMany call site.`).join("\n"),
    ).toEqual([]);
  });

  it("every store.delete/deleteMany hit is either in the committed-delete shape, EXEMPT, or ledgered", () => {
    const hits = scanForDeleteHits();
    const offenders = hits.filter((hit) => {
      if (hit.committedShape) return false;
      if (EXEMPT_HITS.some((e) => e.file === hit.file && e.functionOrNearestExport === hit.functionOrNearestExport)) return false;
      if (KNOWN_BYTES_BEFORE_ROW.some((e) => e.file === hit.file && e.functionOrNearestExport === hit.functionOrNearestExport)) return false;
      return true;
    });

    expect(
      offenders,
      offenders
        .map(
          (o) =>
            `${o.file}:${o.line} (in ${o.functionOrNearestExport}) -- store.delete/deleteMany not in the ` +
            `committed-delete shape (row-delete must commit first, then this call wrapped in a try whose ` +
            `catch logs and swallows, never rethrows). Reorder it to match src/routes/files.ts:519-524, or ` +
            `add a { file, functionOrNearestExport, reason } line to KNOWN_BYTES_BEFORE_ROW in ` +
            `test/file-delete-ordering.scan.test.ts naming why this one deletes the object before the row.`,
        )
        .join("\n"),
    ).toEqual([]);
  });

  it("every EXEMPT_HITS / KNOWN_BYTES_BEFORE_ROW entry still matches a real hit (no stale lines)", () => {
    const hits = scanForDeleteHits();
    const staleExempt = EXEMPT_HITS.filter((entry) => !hits.some((hit) => hit.file === entry.file && hit.functionOrNearestExport === entry.functionOrNearestExport));
    const staleLedger = KNOWN_BYTES_BEFORE_ROW.filter(
      (entry) => !hits.some((hit) => hit.file === entry.file && hit.functionOrNearestExport === entry.functionOrNearestExport),
    );
    const stale = [...staleExempt, ...staleLedger];

    expect(
      stale,
      stale
        .map((entry) => `${entry.file} / ${entry.functionOrNearestExport}: stale entry -- delete this line (test/file-delete-ordering.scan.test.ts) -- no matching hit was found by the scan.`)
        .join("\n"),
    ).toEqual([]);
  });
});
