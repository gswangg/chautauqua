// Code-comment citation contract (DEC-967 doc-integrity lens widened to
// CODE comments, task w11-aa). Field-guide wave-136 named this the
// campaign's own blind spot: "the UNINSTRUMENTED CORPUS IS ALWAYS THE ONE
// YOU WRITE IN. Code comments are where this campaign records its
// reasoning and nothing has ever graded them: 8 dead anchors, and 11 of 12
// quoted anchors drifted." This file is that instrument.
//
// SHARED PRIMITIVES (DEC-613: a second copy of a vocabulary is a trap with
// a delay fuse). Read test/decision-doc-citation.scan.test.ts first, per
// this task's own instruction, before writing a line of this file. Reused
// verbatim from test/frame-source-corpus.ts:
//   - enumerateSourceFiles(root) -- the *.ts/*.tsx/*.css enumeration
//     (recursive readdirSync, `.test.` paths excluded). Called once per
//     population root (src/, app/src/) rather than reimplemented, per this
//     task's explicit instruction.
// NOT reused, with reasons:
//   - decision-doc-citation.scan.test.ts's findCitations/resolvePath/
//     quoteAfter/checkCitations walk a document's FULL prose text -- every
//     character is candidate citation text. This scan's population is CODE
//     files where the overwhelming majority of bytes are not comments at
//     all, and a citation grammar run over raw source would pick up
//     `path:line`-shaped text sitting inside string literals, JSX, or CSS
//     values that is not a comment and was never meant to be a citation.
//     The task requires "a citation is `<path>:<line>` ... appearing
//     inside a comment" -- decision-doc-citation's functions have no
//     comment/non-comment distinction to reuse (their population, decision
//     docs and audit markdown, IS prose start to finish, so they never
//     needed one). A comment-only extractor is therefore new work, not a
//     duplicate of anything upstream.
//   - frame-source-corpus.ts's own stripComments() runs the opposite
//     direction from what this file needs: it DISCARDS comments and keeps
//     code, replacing each comment with a single space, specifically so
//     label-matching ledgers can search the CODE for rendered text.
//     Reusing it here would require re-deriving comment text as "whatever
//     stripComments removed", which is not information stripComments
//     exposes (it never records which bytes it discarded or their line
//     numbers) -- the task also directs "reuse ... rather than re-typing
//     ... a second string-aware comment walker", so extractCommentLines
//     below reuses stripComments's exact string/template-literal-aware
//     STATE MACHINE (normal/single/double/template/line/block, backslash
//     escapes skipped) rather than re-deriving that design from scratch,
//     inverted only in what it keeps: comment text with per-line
//     attribution instead of stripped code. This avoids
//     decision-doc-citation.scan.test.ts's own sibling `commentLines()`
//     bug class -- that helper has NO string-literal awareness, so a `//`
//     or `/*` token sitting inside a string in this population (unlike
//     decisions-data prose, code genuinely contains such tokens, e.g. URL
//     literals, regex source, template strings) would be misread as a
//     comment opener or closer.
//   - resolvePath here implements the task's own explicitly-specified
//     5-step resolution ladder (citing file's own directory, then repo
//     root, then src/, then app/src/, then docs/design/) -- a shape
//     decision-doc-citation's resolvePath does not have at all (it only
//     ever resolves repo-root-relative or by unique basename, because
//     decision docs never write a citing-file-relative `./x.tsx` path).
//     The verified example the task supplies
//     (src/routes/public/saved-embed.tsx:48 citing `./index.tsx:61`)
//     requires directory-relative resolution to work at all.
import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { enumerateSourceFiles } from "./frame-source-corpus";

const ROOT = resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Comment extraction: reuses stripComments's exact string-aware state
// machine (see header), inverted to KEEP comment text with per-line
// attribution instead of discarding it.
// ---------------------------------------------------------------------------

export interface CommentLine {
  /** 1-based physical line number. */
  line: number;
  /** The comment-only text found on that physical line (code and string
   * contents are never included). */
  text: string;
}

type ScanState = "normal" | "single" | "double" | "template" | "line" | "block";

/** Extracts every physical line's comment-only content, string/template-
 * literal aware (a `//` or `/*` inside a string or template literal never
 * opens a comment). Mirrors frame-source-corpus.ts's stripComments state
 * machine exactly, but instead of replacing comment spans with a single
 * space and keeping code, it keeps ONLY comment spans, one entry per
 * physical line that carries any. A block comment spanning several lines
 * contributes one entry per line it touches, matching
 * decision-doc-citation.scan.test.ts's own `commentLines()` output shape
 * (so this file's downstream citation grammar can stay close to that
 * scan's, per the task's reuse instruction) while fixing its missing
 * string-literal awareness. */
export function extractCommentLines(src: string): CommentLine[] {
  const out: CommentLine[] = [];
  let state: ScanState = "normal";
  let currentLine = 1;
  let buf = "";
  const n = src.length;
  let i = 0;

  function flush(): void {
    if (buf.length > 0) {
      out.push({ line: currentLine, text: buf });
      buf = "";
    }
  }

  while (i < n) {
    const c = src[i]!;
    const c2 = i + 1 < n ? src[i + 1] : undefined;

    if (c === "\n") {
      flush();
      currentLine += 1;
      if (state === "line") state = "normal";
      i += 1;
      continue;
    }

    if (state === "normal") {
      if (c === "/" && c2 === "/") {
        state = "line";
        i += 2;
        continue;
      }
      if (c === "/" && c2 === "*") {
        state = "block";
        i += 2;
        continue;
      }
      if (c === "'" || c === '"' || c === "`") {
        state = c === "'" ? "single" : c === '"' ? "double" : "template";
        i += 1;
        continue;
      }
      i += 1;
      continue;
    }

    if (state === "line") {
      buf += c;
      i += 1;
      continue;
    }

    if (state === "block") {
      if (c === "*" && c2 === "/") {
        state = "normal";
        i += 2;
        continue;
      }
      buf += c;
      i += 1;
      continue;
    }

    // state is 'single' | 'double' | 'template': inside a string/template.
    const quoteChar = state === "single" ? "'" : state === "double" ? '"' : "`";
    if (c === "\\") {
      i += c2 !== undefined ? 2 : 1;
      continue;
    }
    if (c === quoteChar) {
      state = "normal";
      i += 1;
      continue;
    }
    i += 1;
    continue;
  }
  flush();
  return out;
}

/** Joins extracted comment lines into one search blob per file, WITHOUT
 * gluing unrelated comment runs together: two comment-bearing physical
 * lines that are themselves consecutive (line N, line N+1 -- a wrapped `//`
 * run, or a multi-line block comment) are joined with a single space so a
 * drifted-quote window can cross the line break the way real short code
 * comments do; any other gap (a comment separated from the next one by a
 * code line, a blank line, or more) is joined with a run of NUL bytes far
 * longer than the citation grammar's own drift window, which cannot appear
 * in any real match, so a citation in one comment run can never be paired
 * with a quote from a wholly unrelated comment run elsewhere in the file.
 * `lineAt[i]` gives the physical line number that produced blob
 * character `i`. */
function buildCommentBlob(lines: CommentLine[]): { blob: string; lineAt: number[] } {
  const GAP = " ".repeat(64);
  let blob = "";
  const lineAt: number[] = [];
  let prevLine: number | null = null;
  for (const { line, text } of lines) {
    if (prevLine !== null) {
      const sep = line === prevLine + 1 ? " " : GAP;
      for (const ch of sep) {
        blob += ch;
        lineAt.push(line);
      }
    }
    for (const ch of text) {
      blob += ch;
      lineAt.push(line);
    }
    prevLine = line;
  }
  return { blob, lineAt };
}

// ---------------------------------------------------------------------------
// Citation grammar: `<path>:<line>` (optionally `<line>-<line>`) inside a
// comment. Extension alternation tries the LONGEST extension first (tsx
// before ts) for the same reason decision-doc-citation.scan.test.ts's own
// CITATION_RE does: JS regex alternation does not backtrack for a longer
// overall match, so `ts|tsx` would truncate every `.tsx` citation to `.ts`.
// `.dc.html` frame citations (`Speakers.dc.html:263` and its many
// siblings, measured ~400+ occurrences across src/** and app/src/**
// comments) are DELIBERATELY OUT OF SCOPE, mirroring
// decision-doc-citation.scan.test.ts's own exclusion and for the same
// concrete reason: every one of these is a BARE basename with no directory
// (`Speakers.dc.html`, never `docs/design/Speakers.dc.html`), and the
// real frame files on disk are named e.g. `docs/design/Chautauqua
// Speakers.dc.html` -- a leading "Chautauqua " prefix and a literal space
// no in-comment citation ever spells. Treating every one of these as a
// resolvable path would require a basename-search rung this task's own
// 5-step resolution ladder does not specify (and decision-doc-citation's
// scan, which DOES have a basename-search rung, explicitly declines to
// extend it to `.dc.html` for the quoting-convention reason above) --
// while treating them as literal dead anchors would manufacture ~400
// offenders out of a naming SHORTHAND, not a broken citation, drowning the
// real defects this ratchet exists to surface. Extensions checked here are
// therefore exactly `.ts`/`.tsx`/`.css`/`.md` -- real repo-relative or
// citing-file-relative code/doc paths, the shapes the task's own examples
// use (`cfp.css.ts:253`, `src/views/form-render.tsx:278`, `app/src/styles
// .css:2182-2261`, `submit-views.tsx:202-204`). A leading `./` or `../` is
// admitted (the verified example `./index.tsx:61`) and stays part of the
// captured path so directory-
// relative resolution can use it. The negative lookbehind (rather than a
// bare `\b`) is load-bearing for that same leading-dot form: `\b` never
// fires between a space and a `.` (neither is a word character, so there
// is no boundary to match there), which silently dropped every `./`-
// prefixed citation during authoring -- caught by this file's own
// non-vacuity fixture below. Mirrors decision-doc-citation.scan.test.ts's
// BARE_PATH_RE lookbehind reasoning: a genuine citation is prose text (no
// word/path/backtick character) immediately before the match start.
// ---------------------------------------------------------------------------

const CITATION_RE =
  /(?<![\w./*`-])((?:\.{1,2}\/)?(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.(?:tsx|css|ts|md))(?<!\.dc\.html):(\d+)((?:-\d+)?)/g;

export interface CodeCitation {
  file: string;
  /** Physical line the citation itself sits on. */
  line: number;
  rawPath: string;
  firstLine: number;
  matchText: string;
  /** Blob index immediately after the citation match -- where the drifted-
   * quote window search begins. */
  blobIndexAfter: number;
}

function findCitationsInBlob(file: string, blob: string, lineAt: number[]): CodeCitation[] {
  const out: CodeCitation[] = [];
  CITATION_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CITATION_RE.exec(blob))) {
    const end = m.index + m[0].length;
    out.push({
      file,
      line: lineAt[m.index] ?? 1,
      rawPath: m[1]!,
      firstLine: Number(m[2]),
      matchText: m[0],
      blobIndexAfter: end,
    });
  }
  return out;
}

/** The first backtick-delimited quote within `gapWindow` characters after a
 * citation, or null. The window is a straightforward character count (not
 * "non-backtick characters [before the opening backtick]" tracked
 * separately) -- the two are equivalent for this population, since the
 * connective prose between a citation and its receipt never itself
 * contains a stray backtick before the intended opener. */
function quoteAfter(blob: string, index: number, gapWindow: number, maxQuoteLen = 400): string | null {
  const gapSlice = blob.slice(index, index + gapWindow);
  const openRel = gapSlice.indexOf("`");
  if (openRel === -1) return null;
  const openAbs = index + openRel + 1;
  const closeAbs = blob.indexOf("`", openAbs);
  if (closeAbs === -1 || closeAbs - openAbs > maxQuoteLen) return null;
  return blob.slice(openAbs, closeAbs).replace(/\\/g, "");
}

const DRIFT_WINDOW = 12;

function normalise(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Resolution ladder (task-specified, order matters -- see header re: why
// this differs from decision-doc-citation's resolvePath): citing file's own
// directory, then repo root, then src/, then app/src/, then docs/design/.
// ---------------------------------------------------------------------------

export interface Resolution {
  ok: boolean;
  absPath?: string;
  relPath?: string;
}

function tryResolve(candidateAbs: string): string | null {
  try {
    if (statSync(candidateAbs).isFile()) return candidateAbs;
  } catch {
    // ENOENT is the expected "does not resolve here" outcome for a
    // resolution-ladder probe -- not a system boundary failure to hide,
    // just "try the next rung".
  }
  return null;
}

const RESOLUTION_ROOT_EXCLUDED_DIRS = new Set(["node_modules", ".git", "dist", "build", ".wrangler"]);

/** Every file under `dirAbs`, recursively, as absolute paths -- basis for
 * rungs 3-5's basename search. Measured while building this scan: the vast
 * majority of comment citations to a file OUTSIDE the citing file's own
 * directory (e.g. `overview.css`'s "Overview.tsx:314" citing
 * `app/src/pages/Overview.tsx`, one level above its own `overview/`
 * subdirectory) name a bare basename with no directory at all, not a full
 * repo-relative path -- so rungs 3-5 must search their subtree for that
 * basename, not literal-concatenate it onto the subtree root (which would
 * only ever match a file sitting directly at that subtree's top level). A
 * basename matching more than one file in a subtree is left unresolved
 * (ambiguous) rather than guessed at -- same discipline as
 * decision-doc-citation.scan.test.ts's own resolvePath. */
function listFilesRecursive(dirAbs: string): string[] {
  const out: string[] = [];
  function walk(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (RESOLUTION_ROOT_EXCLUDED_DIRS.has(entry.name)) continue;
        walk(join(dir, entry.name));
      } else if (entry.isFile()) {
        out.push(join(dir, entry.name));
      }
    }
  }
  walk(dirAbs);
  return out;
}

function buildBasenameIndex(dirAbs: string): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const abs of listFilesRecursive(dirAbs)) {
    const base = abs.slice(abs.lastIndexOf("/") + 1);
    const list = index.get(base);
    if (list) list.push(abs);
    else index.set(base, [abs]);
  }
  return index;
}

const SRC_BASENAME_INDEX = buildBasenameIndex(join(ROOT, "src"));
const APP_SRC_BASENAME_INDEX = buildBasenameIndex(join(ROOT, "app", "src"));
const DOCS_DESIGN_BASENAME_INDEX = buildBasenameIndex(join(ROOT, "docs", "design"));

function resolveViaBasenameIndex(rawPath: string, index: Map<string, string[]>): string | null {
  const base = rawPath.slice(rawPath.lastIndexOf("/") + 1);
  const matches = index.get(base);
  if (!matches || matches.length !== 1) return null;
  return matches[0]!;
}

export function resolveCitationPath(rawPath: string, citingFileAbs: string): Resolution {
  const directCandidates = [join(dirname(citingFileAbs), rawPath), join(ROOT, rawPath)];
  for (const cand of directCandidates) {
    const hit = tryResolve(cand);
    if (hit) return { ok: true, absPath: hit, relPath: hit.slice(ROOT.length + 1) };
  }
  for (const index of [SRC_BASENAME_INDEX, APP_SRC_BASENAME_INDEX, DOCS_DESIGN_BASENAME_INDEX]) {
    const hit = resolveViaBasenameIndex(rawPath, index);
    if (hit) return { ok: true, absPath: hit, relPath: hit.slice(ROOT.length + 1) };
  }
  return { ok: false };
}

// ---------------------------------------------------------------------------
// Violation shape + the two checks (DEAD ANCHOR, DRIFTED QUOTE).
// ---------------------------------------------------------------------------

export interface Violation {
  file: string;
  line: number;
  citation: string;
  reason: string;
}

export function checkFileComments(fileAbs: string, fileRel: string, src: string): Violation[] {
  const lines = extractCommentLines(src);
  const { blob, lineAt } = buildCommentBlob(lines);
  const citations = findCitationsInBlob(fileRel, blob, lineAt);
  const violations: Violation[] = [];

  for (const c of citations) {
    const resolved = resolveCitationPath(c.rawPath, fileAbs);
    if (!resolved.ok) {
      violations.push({
        file: c.file,
        line: c.line,
        citation: c.matchText,
        reason: `dead anchor -- "${c.rawPath}" does not resolve from ${fileRel}'s own directory, repo root, src/, app/src/, or docs/design/`,
      });
      continue;
    }
    const targetLines = readFileSync(resolved.absPath!, "utf-8").split("\n");
    if (c.firstLine > targetLines.length) {
      violations.push({
        file: c.file,
        line: c.line,
        citation: c.matchText,
        reason: `dead anchor -- cites line ${c.firstLine} of ${resolved.relPath}, which has only ${targetLines.length} lines`,
      });
      continue;
    }

    const quote = quoteAfter(blob, c.blobIndexAfter, DRIFT_WINDOW);
    if (!quote || quote.length === 0) continue; // no immediately-following receipt to check

    const needle = normalise(quote);
    let matched = false;
    for (let offset = -2; offset <= 2; offset++) {
      const idx = c.firstLine - 1 + offset;
      if (idx < 0 || idx >= targetLines.length) continue;
      if (normalise(targetLines[idx]!).includes(needle)) {
        matched = true;
        break;
      }
    }
    if (!matched) {
      violations.push({
        file: c.file,
        line: c.line,
        citation: c.matchText,
        reason:
          `drifted quote -- \`${quote}\` following "${c.matchText}" does not appear (whitespace-` +
          `collapsed) within ${resolved.relPath}:${c.firstLine} +/- 2`,
      });
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------
// Population (DEC-808: derived, never hand-listed): every *.ts/*.tsx/*.css
// under src/** and app/src/**, `.test.` paths excluded -- via
// enumerateSourceFiles, reused verbatim (see header), called once per root.
// ---------------------------------------------------------------------------

const POPULATION_FILES = [
  ...enumerateSourceFiles(join(ROOT, "src")),
  ...enumerateSourceFiles(join(ROOT, "app", "src")),
].sort();

const ALL_VIOLATIONS: Violation[] = POPULATION_FILES.flatMap((abs) =>
  checkFileComments(abs, abs.slice(ROOT.length + 1), readFileSync(abs, "utf-8")),
);

// Ratchet (DEC-808 two-sided-ratchet rule, DEC-967 saturated-ratchet-lie
// rule -- never `= OFFENDERS.length` or any expression naming the measured
// set). This is a TO-DO LIST seeded WITH the debt this INSTRUMENT-ONLY task
// finds (repairs are sibling lanes v12m-w11-bb (src/**) and v12m-w11-cc
// (app/src/**), per this task's own scope). Measured on this branch by
// forcing the constant to -1 and reading the printed offender list; see
// docs/design/audit/code-comment-citation-v12.md for the full list this
// number was read from, including this task's own explanation of why the
// measured 37 differs from the task's ~19 estimate (measured on a
// DIFFERENT commit, with resolution/extension-scope choices this scan had
// to make on its own -- trust the measurement, per the task's own
// instruction).
// Thunderdome megabatch re-measurement: w11-bb and w11-cc each repaired 8
// dead/drifted comment citations in this same batch, so the 37 this
// instrument lane measured on its own base is stale. Integrated: 20.
export const CODE_COMMENT_CITATION_CEILING = 0;

describe("code comment citation scan: src/** and app/src/** (DEC-967 doc-integrity lens widened to code comments)", () => {
  it("population sanity: walks a non-trivial number of source files", () => {
    expect(POPULATION_FILES.length).toBeGreaterThan(100);
  });

  it("citation grammar sanity: finds at least one path:line citation in a comment (a broken regex must not pass vacuously)", () => {
    const total = POPULATION_FILES.reduce((n, abs) => {
      const rel = abs.slice(ROOT.length + 1);
      const src = readFileSync(abs, "utf-8");
      const { blob, lineAt } = buildCommentBlob(extractCommentLines(src));
      return n + findCitationsInBlob(rel, blob, lineAt).length;
    }, 0);
    expect(total).toBeGreaterThan(50);
  });

  it(`every path:line citation inside a code comment under src/** or app/src/** resolves to a real file/line and, where a backtick quote immediately follows (within ${DRIFT_WINDOW} chars), matches it (whitespace-collapsed) within +/-2 lines of the cited line (ceiling: CODE_COMMENT_CITATION_CEILING, may only be lowered)`, () => {
    if (ALL_VIOLATIONS.length > CODE_COMMENT_CITATION_CEILING) {
      throw new Error(
        `${ALL_VIOLATIONS.length} code-comment citations are unresolved/drifted, above the ratchet ` +
          `ceiling of ${CODE_COMMENT_CITATION_CEILING} (may only be LOWERED, never raised to paper over ` +
          `a regression):\n` +
          ALL_VIOLATIONS.map((v) => `${v.file}:${v.line} "${v.citation}" -- ${v.reason}`).join("\n"),
      );
    }
    expect(ALL_VIOLATIONS.length).toBeLessThanOrEqual(CODE_COMMENT_CITATION_CEILING);
  });

  it("the ceiling is not stale: the measured violation count is not below CODE_COMMENT_CITATION_CEILING (two-sided ratchet, DEC-808)", () => {
    if (ALL_VIOLATIONS.length < CODE_COMMENT_CITATION_CEILING) {
      throw new Error(
        `measured ${ALL_VIOLATIONS.length} unresolved/drifted code-comment citations, below the ` +
          `declared ceiling of ${CODE_COMMENT_CITATION_CEILING} -- lower the constant: ` +
          `export const CODE_COMMENT_CITATION_CEILING = ${ALL_VIOLATIONS.length};`,
      );
    }
    expect(ALL_VIOLATIONS.length).toBeGreaterThanOrEqual(CODE_COMMENT_CITATION_CEILING);
  });
});

// ---------------------------------------------------------------------------
// NON-VACUITY (house rule: every scan ships one) -- a FABRICATED single-
// file fixture, never a live product count (which would itself become a
// sentinel). Exercises the exact same extractCommentLines/buildCommentBlob/
// findCitationsInBlob/resolveCitationPath/checkFileComments pipeline the
// population walk above uses via a real temp-directory tree, per the task's
// five required cases: one resolving citation, one unresolvable path, one
// over-EOF line, one drifted quote, one correct relative citation.
// ---------------------------------------------------------------------------

describe("non-vacuity: fabricated fixture proves the grammar", () => {
  const tmpRoot = mkdtempSync(join(tmpdir(), "code-comment-citation-fixture-"));
  const subdir = join(tmpRoot, "pkg");

  // The cited sibling file lives beside the citing file, in `pkg/`, so the
  // "correct relative citation" case exercises directory-relative
  // resolution (rung 1 of the ladder), the exact shape the verified
  // `./index.tsx:61` example needs.
  mkdirSync(subdir);
  const citedRelName = "target.ts";
  const citedAbs = join(subdir, citedRelName);
  // 5 lines; line 3 carries the literal the resolving/drifted cases check
  // against.
  writeFileSync(citedAbs, "line one\nline two\nexport const FIXTURE_TOKEN = 42;\nline four\nline five");

  const citingAbs = join(subdir, "citing.ts");
  // Connector text between each citation and its receipt quote is kept
  // SHORT (a bare space, well inside DRIFT_WINDOW=12) so every quote in
  // this fixture is actually inside the checked window -- a wordy
  // connector like "which declares" would itself exceed the window and
  // silently exempt the citation from DIRECTION 2, defeating the fixture's
  // purpose.
  const citingSrc = [
    // 1: resolving citation, quote matches its own cited line exactly
    //    (directory-relative form -- the verified `./index.tsx:61` shape).
    "// ./target.ts:3 `export const FIXTURE_TOKEN = 42;`",
    // 2: unresolvable path -- no such file anywhere on the ladder.
    "// ./does-not-exist.ts:1 is a stale pointer",
    // 3: over-EOF line -- target.ts has only 5 lines.
    "// ./target.ts:99 before a trim",
    // 4: drifted quote -- line 3 of target.ts does not contain this text.
    "// ./target.ts:3 `export const WRONG_TOKEN = 0;`",
    // 5: correct relative citation with a MATCHING quote 2 lines off (line
    //    1 cited, quote actually lives on line 3, inside the +/-2 window).
    "// ./target.ts:1 `export const FIXTURE_TOKEN = 42;`",
  ].join("\n");
  writeFileSync(citingAbs, citingSrc);

  const violations = checkFileComments(citingAbs, "pkg/citing.ts", citingSrc);

  it("the resolving, quote-matching citation (physical line 1) is not flagged", () => {
    // Case 4 below also cites "./target.ts:3" (same path:line text) but as
    // a DRIFTED quote on physical line 4 -- disambiguate by line, not by
    // the citation's own text, since the two share it.
    expect(violations.some((v) => v.line === 1)).toBe(false);
  });

  it("an unresolvable path is flagged as a dead anchor", () => {
    const hit = violations.find((v) => v.citation.startsWith("./does-not-exist.ts:1"));
    expect(hit).toBeDefined();
    expect(hit!.reason).toMatch(/dead anchor -- "\.\/does-not-exist\.ts" does not resolve/);
  });

  it("a line number past EOF is flagged as a dead anchor", () => {
    const hit = violations.find((v) => v.citation.startsWith("./target.ts:99"));
    expect(hit).toBeDefined();
    expect(hit!.reason).toMatch(/has only 5 lines/);
  });

  it("a drifted quote is flagged", () => {
    const hit = violations.find(
      (v) => v.citation.startsWith("./target.ts:3") && v.reason.startsWith("drifted quote"),
    );
    expect(hit).toBeDefined();
    expect(hit!.reason).toContain("WRONG_TOKEN");
  });

  it("a correct relative citation whose quote sits within +/-2 lines of the cited line passes", () => {
    expect(violations.some((v) => v.citation.startsWith("./target.ts:1"))).toBe(false);
  });

  it("exactly the three expected violations are produced -- no extra, no missing", () => {
    expect(violations.length).toBe(3);
  });

  it("cleanup", () => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });
});
