// DEC-528 (wave-16 amendment, rooted at `src` wave-18): `.values(rows)` binds
// one parameter per COLUMN per row, not one per row -- ID_CHUNK_SIZE (sized
// for inArray's one-bind-per-id) is the wrong budget for a multi-row INSERT.
// Every `.insert(...).values(...)` call over an unbounded/multi-row set MUST
// iterate chunkRowsForInsert batches. This scan mirrors
// test/inarray-chunk-scan.test.ts's shape: it reads every *.ts/*.tsx file
// under `src` -- the WHOLE tree, not two hand-named subdirectories someone
// remembered -- as text at run time (never a hand-maintained file list),
// strips `//` and `/* */` comments first (so a DEC citation inside a JSDoc
// block is never mistaken for a query), extracts every remaining
// `.values(...)` call that is directly chained off an `.insert(...)` call
// (never Map#values()/Object.values(), which take zero or one unrelated
// argument and are not D1 bind sites), and requires each call site's
// argument to be:
//   (a) an inline object literal (`{...}`) -- a single-row insert, exactly
//       one row's worth of bound params, never unbounded,
//   (b) an identifier bound by a same-file
//       `for (const <id> of chunkRowsForInsert(...))` loop, or
//   (c) named in BOUNDED_INSERT_CALLSITES below with a reviewable reason.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const REPO_ROOT = join(__dirname, "..");
const SCAN_ROOTS = ["src"];

// Each entry: [file path relative to repo root, the .values(...) call's
// argument's leading identifier, reason that call site's row set is bounded
// and therefore exempt from chunkRowsForInsert]. Keyed by (file, identifier)
// -- every `.insert(...).values(...)` call site in `file` whose argument's
// leading identifier is `identifier` is covered by one entry, since a
// reviewed reason for a name covers every call site using that same bounded
// value.
const BOUNDED_INSERT_CALLSITES: Array<[file: string, identifier: string, reason: string]> = [];

const allowlistByFileAndId = new Map(
  BOUNDED_INSERT_CALLSITES.map(([file, identifier, reason]) => [`${file}::${identifier}`, reason]),
);

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listTsFiles(full));
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

const scannedFiles = SCAN_ROOTS.flatMap((root) => listTsFiles(join(REPO_ROOT, root))).map((f) =>
  relative(REPO_ROOT, f),
);

interface InsertValuesSite {
  file: string;
  line: number;
  leadingIdentifier: string;
  argPreview: string;
}

/** Extracts every `.insert(...).values(...)` call's argument, at run time,
 * from file text -- a balanced-paren/bracket/brace scan (not a naive regex)
 * so a multi-line-chained `.insert(schema.x)\n.values({...})` or a nested
 * `.values(chunk)` resolves the FULL argument correctly rather than
 * stopping at the first inner paren/brace. Only `.values(` calls directly
 * preceded (modulo whitespace/comments) by a closed `.insert(...)` call are
 * treated as D1 bind sites -- this is what excludes unrelated `.values()`
 * calls (Map#values(), Object.values(x)) from the scan. */
function extractInsertValuesSites(relFile: string, src: string): InsertValuesSite[] {
  const sites: InsertValuesSite[] = [];
  // `.insert(<simple-arg-no-nested-parens>)` immediately (modulo whitespace/
  // newlines) followed by `.values(`. Every real insert call site in this
  // codebase passes a bare `schema.xxx` table reference to .insert(...), so
  // a no-nested-parens argument class is sufficient and deliberately can't
  // match Map#values()/Object.values(x), which have no preceding .insert(.
  const callRe = /\.insert\(([^()]*)\)\s*\.values\(/g;
  let m: RegExpExecArray | null;
  while ((m = callRe.exec(src))) {
    const argsStart = m.index + m[0].length;
    let depth = 0;
    let end = -1;
    for (let j = argsStart; j < src.length; j++) {
      const c = src[j];
      if (c === "(" || c === "[" || c === "{") depth++;
      else if (c === ")" || c === "]" || c === "}") {
        if (depth === 0) {
          end = j;
          break;
        }
        depth--;
      }
    }
    if (end === -1) continue;
    const arg = src.slice(argsStart, end).trim();
    const idMatch = arg.match(/^[A-Za-z_$][A-Za-z0-9_$]*/);
    const leadingIdentifier = idMatch ? idMatch[0] : arg.slice(0, 1);
    const line = src.slice(0, argsStart).split("\n").length;
    sites.push({ file: relFile, line, leadingIdentifier, argPreview: arg.slice(0, 60) });
  }
  return sites;
}

function isChunkLoopBound(src: string, identifier: string): boolean {
  const re = new RegExp(
    `for\\s*\\(\\s*const\\s+${identifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+of\\s+chunkRowsForInsert\\(`,
  );
  return re.test(src);
}

/** Strips `//` line comments and `/* ... *\/` block comments from source
 * text before call-site extraction, so a DEC citation inside a JSDoc block
 * (e.g. a prose mention of `.insert(...).values(...)`) is never mistaken
 * for a real query. Deliberately naive (no string/template-literal
 * awareness) -- this codebase never puts `//` or `/*` inside a string on
 * the same line as a real .values( call, and a false stripped comment can
 * only make the scan MISS a site, never wrongly clear one, since a
 * genuinely commented-out call site would never bind at runtime anyway. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""))
    .replace(/\/\/[^\n]*/g, "");
}

function isInlineObjectLiteral(argPreview: string): boolean {
  return argPreview.startsWith("{");
}

describe("DEC-528 repo-wide .insert(...).values(...)/chunkRowsForInsert scan (per call site)", () => {
  it("scanned at least the wave-11 planning-time file count (tripwire against a vacuous scan)", () => {
    expect(scannedFiles.length).toBeGreaterThan(100);
  });

  it("scanned at least 60 files under the whole `src` tree (tripwire against the root narrowing back to two subdirectories)", () => {
    expect(scannedFiles.length).toBeGreaterThanOrEqual(60);
  });

  it("every allowlisted BOUNDED_INSERT_CALLSITES entry is a real file that was actually scanned", () => {
    for (const [file] of BOUNDED_INSERT_CALLSITES) {
      expect(scannedFiles).toContain(file);
    }
  });

  it("chunkRowsForInsert has exactly one definition site (src/lib/chunk.ts) -- justifies treating any same-file `for (const x of chunkRowsForInsert(` as the canonical chunker", () => {
    const allSrcFiles = listTsFiles(join(REPO_ROOT, "src"));
    const definitionSites = allSrcFiles.filter((f) =>
      /export function chunkRowsForInsert[<(]/.test(readFileSync(f, "utf8")),
    );
    expect(definitionSites.map((f) => relative(REPO_ROOT, f))).toEqual(["src/lib/chunk.ts"]);
  });

  const allSites = scannedFiles.flatMap((relFile) => {
    const absFile = join(REPO_ROOT, relFile);
    const rawSrc = readFileSync(absFile, "utf8");
    const src = stripComments(rawSrc);
    if (!src.includes(".insert(")) return [];
    return extractInsertValuesSites(relFile, src).map((site) => ({ site, src }));
  });

  it("found at least 20 .insert(...).values(...) call sites -- tripwire against a regex that silently matches nothing", () => {
    expect(allSites.length).toBeGreaterThanOrEqual(20);
  });

  it("found at least 20 .insert(...).values(...) call sites once the scan is rooted at `src` -- tripwire against the root narrowing back to two subdirectories", () => {
    expect(allSites.length).toBeGreaterThanOrEqual(20);
  });

  it("found at least one chunkRowsForInsert-bound call site -- tripwire against a scan that never exercises rule (b)", () => {
    const chunkBoundCount = allSites.filter(({ site, src }) => isChunkLoopBound(src, site.leadingIdentifier)).length;
    expect(chunkBoundCount).toBeGreaterThanOrEqual(1);
  });

  it("every BOUNDED_INSERT_CALLSITES entry still matches a real hit (no stale lines)", () => {
    // DEC-078 wave-21 amendment: the previous check above only proved the
    // named FILE exists and was scanned -- it never checked that the
    // (file, identifier) pair still names a live .insert(...).values(...)
    // call site. An entry whose call site was chunked, renamed, or deleted
    // would keep passing forever and silently pre-clear any FUTURE call
    // site that reuses that same (file, identifier) pair. This asserts, in
    // the other direction, that every allowlist entry matches at least one
    // hit found by allSites (the same extraction the per-call-site test
    // below uses). Currently vacuous (BOUNDED_INSERT_CALLSITES is empty),
    // but stays live so the first entry ever added is checked both ways.
    const staleEntries = BOUNDED_INSERT_CALLSITES.filter(
      ([file, identifier]) => !allSites.some(({ site }) => site.file === file && site.leadingIdentifier === identifier),
    );
    expect(
      staleEntries,
      staleEntries
        .map(([file, identifier]) => `${file} :: ${identifier}: stale entry -- delete this line (test/insert-chunk-scan.test.ts BOUNDED_INSERT_CALLSITES) -- no matching .insert(...).values(${identifier}) call site was found in ${file}.`)
        .join("\n"),
    ).toEqual([]);
  });

  for (const { site, src } of allSites) {
    it(`${site.file}:${site.line}: .insert(...).values(${site.leadingIdentifier}) is an inline object literal, chunk-bound, or allowlisted (DEC-528)`, () => {
      const inlineObject = isInlineObjectLiteral(site.argPreview);
      const chunkBound = isChunkLoopBound(src, site.leadingIdentifier);
      const allowlisted = allowlistByFileAndId.has(`${site.file}::${site.leadingIdentifier}`);
      if (!inlineObject && !chunkBound && !allowlisted) {
        throw new Error(
          `${site.file}:${site.line} calls .insert(...).values(${site.leadingIdentifier}) which is neither an ` +
            `inline object literal (single-row insert), bound by a same-file ` +
            `\`for (const ${site.leadingIdentifier} of chunkRowsForInsert(...))\` loop, nor listed in ` +
            `BOUNDED_INSERT_CALLSITES — DEC-528 requires every multi-row .values(...) call to iterate ` +
            `chunkRowsForInsert batches. Either chunk the row list or add a reviewed allowlist entry naming what ` +
            `bounds it.`,
        );
      }
      expect(inlineObject || chunkBound || allowlisted).toBe(true);
    });
  }
});
