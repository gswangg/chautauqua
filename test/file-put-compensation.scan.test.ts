// DEC-005 amendment (wave 50): the ONLY sanctioned single-object upload
// path is src/server/context.ts's putThenRecord — every other call site
// that writes an R2 object via a FileStore and then inserts/updates the row
// that names it must route through it, or the row write can throw AFTER
// the object landed and leak bytes nothing references.
//
// This scans every src/**/*.{ts,tsx} file (except src/server/context.ts,
// which owns the FileStore port and putThenRecord's own internals) for a
// variable assigned from `makeFileStore(...)` and then asserts that
// variable's `.put(` is called ONLY from a one-line ledger below.
// src/routes/public/submit-post.tsx (split out of submit.tsx purely to
// reduce merge contention; no behavior change) keeps its own multi-object
// batch rollback (DEC-005 amendment) rather than routing through
// putThenRecord, so it is the sole ledgered exception.
//
// Two-directional, same shape as test/serial-write-scan.test.ts: an
// unlisted offender (a bare `store.put(...)` call outside the helper) fails
// naming file:line; a ledger line that no longer matches any `.put(` call
// on a makeFileStore-derived variable ALSO fails, with an explicit
// "delete this line" message.

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..");
const SCAN_DIR = "src";
const SKIP_DIRS = new Set(["node_modules", "dist", ".wrangler", "build", ".git"]);
const EXEMPT_FILE = "src/server/context.ts";

interface PutHit {
  file: string; // repo-relative path
  line: number; // 1-indexed
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

const MAKE_FILE_STORE_ASSIGN = /\b(?:const|let)\s+(\w+)\s*=\s*makeFileStore\s*\(/g;

/** For every file (excluding EXEMPT_FILE), finds every local variable bound
 * to `makeFileStore(...)`, then finds every `<var>.put(` call on that
 * variable name in the same file. This is the same "bind then track the
 * name" shape as the serial-write scan's chunk-helper check — a lightweight
 * text scan, not a parser. */
function scanForFileStorePuts(): PutHit[] {
  const files: string[] = [];
  walk(join(ROOT, SCAN_DIR), files);

  const hits: PutHit[] = [];
  for (const file of files) {
    const relPath = relative(ROOT, file).split("\\").join("/");
    if (relPath === EXEMPT_FILE) continue;
    const src = readFileSync(file, "utf8");

    const varNames = new Set<string>();
    let assignMatch: RegExpExecArray | null;
    MAKE_FILE_STORE_ASSIGN.lastIndex = 0;
    while ((assignMatch = MAKE_FILE_STORE_ASSIGN.exec(src))) {
      if (assignMatch[1]) varNames.add(assignMatch[1]);
    }
    if (varNames.size === 0) continue;

    for (const varName of varNames) {
      const putRe = new RegExp(`\\b${varName}\\s*\\.\\s*put\\s*\\(`, "g");
      let putMatch: RegExpExecArray | null;
      while ((putMatch = putRe.exec(src))) {
        const lineIdx = src.slice(0, putMatch.index).split("\n").length - 1;
        hits.push({ file: relPath, line: lineIdx + 1 });
      }
    }
  }
  return hits;
}

// The ledger. Every hit at this branch point must have exactly one entry
// here (matched on file + line). A hit with no matching entry fails the
// scan; an entry matching no hit fails as a stale ledger line.
const KNOWN_FILE_STORE_PUTS: { file: string; line: number; reason: string }[] = [
  {
    file: "src/routes/public/submit-post.tsx",
    line: 392,
    reason:
      "Multi-object batch upload: N attachments are staged before the DB write phase, which on ANY throw deletes every object it wrote (and the submission row) in its own catch block at :455-485 -- a single delete-on-throw doesn't cover N objects, so this keeps its own rollback rather than routing through putThenRecord. Per DEC-530 (amended wave 26) the staging puts fan out via Promise.allSettled(minted.map(...)) rather than a serial for loop or Promise.all: every r2Key is minted up front (:385-390) so the full key set is known no matter which promises settle, and on any rejection the fan-out deletes every minted key itself (:411) before rethrowing the first rejection unmodified. Both rollback paths still cover every object the batch could have written, so the exemption is unchanged in substance.",
  },
];

describe("file-store put compensation scan (DEC-005 amendment, wave 50)", () => {
  it("the scan itself finds files under src (not vacuous)", () => {
    const files: string[] = [];
    walk(join(ROOT, SCAN_DIR), files);
    expect(files.length).toBeGreaterThan(0);
  });

  it("every makeFileStore-derived .put( call is either inside putThenRecord or ledgered", () => {
    const hits = scanForFileStorePuts();
    const offenders = hits.filter(
      (hit) => !KNOWN_FILE_STORE_PUTS.some((entry) => entry.file === hit.file && entry.line === hit.line),
    );

    expect(
      offenders,
      offenders
        .map(
          (o) =>
            `${o.file}:${o.line} -- a FileStore .put( call outside src/server/context.ts's putThenRecord. ` +
            `Route it through putThenRecord(store, key, data, contentType, record), or add a ` +
            `{ file, line, reason } entry to KNOWN_FILE_STORE_PUTS in ` +
            `test/file-put-compensation.scan.test.ts naming why this one keeps its own rollback.`,
        )
        .join("\n"),
    ).toEqual([]);
  });

  it("every KNOWN_FILE_STORE_PUTS ledger entry still matches a real hit (no stale lines)", () => {
    const hits = scanForFileStorePuts();
    const stale = KNOWN_FILE_STORE_PUTS.filter(
      (entry) => !hits.some((hit) => hit.file === entry.file && hit.line === entry.line),
    );

    expect(
      stale,
      stale
        .map(
          (entry) =>
            `${entry.file}:${entry.line}: stale ledger entry -- delete this line ` +
            `(test/file-put-compensation.scan.test.ts) -- no matching .put( call was found.`,
        )
        .join("\n"),
    ).toEqual([]);
  });
});
