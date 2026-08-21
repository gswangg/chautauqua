// CSS comment copy-leak scan (DEC-613 wave-146 amendment; task w21-d).
//
// Server-rendered stylesheets under src/routes/**/*.css.ts are inlined
// verbatim into the served HTML's <style> element -- comments and all. A
// CSS comment that quotes real product copy (a sentence the app also
// renders in a .tsx view) therefore leaks that copy onto the PAGE a second
// time, which can double a copy-uniqueness count (submit-cfp-frame-copy
// .test.ts's "Already have an account?" occurrences-of-1 assertion) or
// plant a forbidden phrase on a page that must not carry it (ClosedPage's
// "Browse the programme" exclusion). Task w21-d repaired the two live
// instances of this by hand
// (src/routes/public/cfp.css.ts:118-122,443-447 now cite copy by file +
// class token, the DEC-967 drift-proof citation idiom, instead of
// reproducing the sentence); this file is the instrument so the class
// cannot come back unnoticed.
//
// EXTRACTION CHOICE (deliberately NOT test/code-comment-citation.scan
// .test.ts's extractCommentLines): every real CSS comment this population
// carries lives INSIDE a `css\`...\`` tagged template literal (measured
// while building this scan -- e.g. cfp.css.ts's whole rule set, including
// its `/* DEC-909 ... */`-style comments, sits between one opening and one
// closing backtick). extractCommentLines's state machine treats a `` ` ``
// as opening STRING state, in which `/*`/`*/` are just characters -- correct
// for genuine JS comments outside a template literal, but it means that
// extractor finds ZERO of the comments this scan exists to grade, a false-
// negative-only defect the opposite direction from this scan's job (DEC-
// 967's "an instrument's dead branch looks exactly like a clean pass"
// shape). This file therefore uses a direct `/\*([\s\S]*?)\*\//g` walk
// over the RAW file text instead -- correct for this population because a
// `.css.ts` module's only string content is CSS text itself, which this
// repo's own convention (measured across the population below) never
// embeds a literal `/*` inside (no CSS comment-inside-a-value, no `url()`
// data URI carrying one); a JS-string/JS-comment distinction the citation
// scan needs for arbitrary source is not a real hazard here.
//   - ENTITY_MAP/stripComments, reused verbatim from test/frame-source
//     -corpus.ts (DEC-613: a second copy of a vocabulary is a trap with a
//     delay fuse) -- entity decode for the CSS-comment side, and comment-
//     stripping (this population's `//`/`/* */`/string-aware, the SAME
//     concern the code-comment-citation header raises, but here applied to
//     .tsx files, which are NOT the `.css.ts` population's
//     backtick-template shape -- .tsx source's real comments sit outside
//     any CSS template literal, so stripComments's ordinary JS-comment
//     handling is exactly right on that side) ahead of JSX-text-node
//     extraction, so a .tsx file's own comments can never masquerade as
//     rendered copy.
// NOT reused: enumerateSourceFiles's own population is EVERY .ts/.tsx/.css
// file under a root; this scan needs two narrower, disjoint populations
// (only src/routes/**/*.css.ts on the comment side, only src/routes/**
// /*.tsx on the match side) so it re-derives those two via readdirSync
// directly, matching the recursive-readdirSync idiom every other scan in
// this suite already uses (e.g. batch-cap-declaration.scan.test.ts,
// desktop-frame-ledger.scan.test.ts).
//
// RATCHET (DEC-989 wave-146 amendment): this is a BRAND-NEW instrument
// landing in a parallel wave alongside sibling worker lanes this planner
// cannot serialize against -- per that amendment, a brand-new instrument
// may only be seeded ONE-SIDED (may only be LOWERED, never raised) rather
// than the usual two-sided ratchet; the two-sided upgrade (a "ceiling is
// not stale" companion assertion) is owed to a later single-owner wave,
// not claimed here.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ENTITY_MAP, stripComments } from "./frame-source-corpus";

const ROOT = resolve(__dirname, "..");
const MIN_LEAK_LEN = 16;

// ---------------------------------------------------------------------------
// Populations.
// ---------------------------------------------------------------------------

/** Every non-test src/routes/**\/*.css.ts file (the comment side). */
function enumerateRouteCssTsFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".css.ts")) continue;
    const full = join(entry.parentPath, entry.name);
    if (full.includes(".test.")) continue;
    out.push(full);
  }
  return out.sort();
}

/** Every non-test src/routes/**\/*.tsx file (the JSX match side). */
function enumerateRouteTsxFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".tsx")) continue;
    const full = join(entry.parentPath, entry.name);
    if (full.includes(".test.")) continue;
    out.push(full);
  }
  return out.sort();
}

const CSS_TS_FILES = enumerateRouteCssTsFiles(join(ROOT, "src", "routes"));
const ROUTE_TSX_FILES = enumerateRouteTsxFiles(join(ROOT, "src", "routes"));

/** Decodes this population's HTML entities (reusing frame-source-corpus's
 * own table, DEC-613) and collapses whitespace, WITHOUT stripping `<`/`>` --
 * callers need those to find node boundaries. */
function decodeAndCollapse(s: string): string {
  let out = s;
  for (const [entity, char] of Object.entries(ENTITY_MAP)) {
    out = out.split(entity).join(char);
  }
  return out.replace(/\s+/g, " ");
}

/** Every JSX TEXT NODE in `strippedSrc` (comments already stripped) --
 * deliberately narrower than "the whole normalized file", which frame-
 * control-label.scan.test.ts's own match side uses for a DIFFERENT job
 * (checking a KNOWN short label occurs anywhere, including inside a prop
 * string). Here the comment side supplies an ARBITRARY >=16-char window,
 * and matching that against a whole file's code -- import paths, class-
 * name attribute strings, JSX prop names like `dangerouslySetInnerHTML` --
 * manufactures false leaks out of ordinary code citations (measured while
 * building this scan: 64 "leaks" against the whole-file blob, all of them
 * either a class token this file's own comment correctly cites, or generic
 * JS/JSX syntax that has nothing to do with rendered copy). A JSX text
 * node is the content strictly between a `>` and the next `<`/`{` -- the
 * same `>text<` idiom test/frame-control-label.scan.test.ts's own footer/
 * anchor walk already uses for the frame-pack side of that ledger, applied
 * here to the .tsx side instead. Each node is decoded/whitespace-collapsed
 * independently (a leak must sit inside ONE rendered text run, not span
 * across a nested element the way the identity-note sentence used to
 * before task w21-d's own repair split it across a classless `<a>`). */
function extractJsxTextNodes(strippedSrc: string): string[] {
  const out: string[] = [];
  const re = />([^<>{}]+)</g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(strippedSrc))) {
    const text = decodeAndCollapse(m[1]!).trim();
    if (text.length >= MIN_LEAK_LEN && /[A-Za-z]/.test(text)) out.push(text);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Leak detection: slide a window across each file's whitespace-collapsed
// comment blob, growing any >=MIN_LEAK_LEN match that appears verbatim
// inside some single .tsx JSX text node into its maximal run, then skip
// past the whole matched run (so one long leaked sentence is one
// violation, not a run of overlapping 16-char windows all reported
// separately).
// ---------------------------------------------------------------------------

export function findLeakedRuns(commentBlob: string, tsxBlobs: readonly string[]): string[] {
  const runs: string[] = [];
  const n = commentBlob.length;
  let i = 0;
  while (i <= n - MIN_LEAK_LEN) {
    const window = commentBlob.slice(i, i + MIN_LEAK_LEN);
    if (tsxBlobs.some((b) => b.includes(window))) {
      let end = i + MIN_LEAK_LEN;
      while (end < n && tsxBlobs.some((b) => b.includes(commentBlob.slice(i, end + 1)))) {
        end += 1;
      }
      runs.push(commentBlob.slice(i, end));
      i = end;
    } else {
      i += 1;
    }
  }
  return runs;
}

export interface LeakViolation {
  file: string;
  line: number;
  leaked: string;
}

/** Every `/* ... *\/` comment in `src` (raw file text, template-literal
 * boundaries included -- see header for why this population's comments
 * need that), paired with the 1-based physical line its opening `/*`
 * starts on. */
function extractRawBlockComments(src: string): Array<{ line: number; text: string }> {
  const out: Array<{ line: number; text: string }> = [];
  const re = /\/\*([\s\S]*?)\*\//g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const line = src.slice(0, m.index).split("\n").length;
    out.push({ line, text: m[1]! });
  }
  return out;
}

export function findCommentCopyLeaks(fileAbs: string, fileRel: string, src: string, tsxBlobs: readonly string[]): LeakViolation[] {
  const out: LeakViolation[] = [];
  for (const { line, text } of extractRawBlockComments(src)) {
    const collapsed = decodeAndCollapse(text);
    const runs = findLeakedRuns(collapsed, tsxBlobs);
    for (const run of runs) {
      out.push({ file: fileRel, line, leaked: run });
    }
  }
  return out;
}

const TSX_TEXT_NODES = ROUTE_TSX_FILES.flatMap((abs) => extractJsxTextNodes(stripComments(readFileSync(abs, "utf-8"))));

const ALL_LEAKS: LeakViolation[] = CSS_TS_FILES.flatMap((abs) =>
  findCommentCopyLeaks(abs, abs.slice(ROOT.length + 1), readFileSync(abs, "utf-8"), TSX_TEXT_NODES),
);

// Ratchet (DEC-989 wave-146 amendment: brand-new instrument, ONE-SIDED --
// may only be LOWERED, never raised). Seeded by forcing this constant to -1
// and reading the offender list this branch measures back: 37. Task w21-d's
// own repair (cfp.css.ts:118-122,443-447 reworded to cite file+class-token
// instead of quoting copy) closed the two live leaks named in that task's
// own scope (the two that were breaking submit-cfp-frame-copy.test.ts);
// this instrument's population is wider than that named scope (every
// src/routes/**/*.css.ts comment vs. every src/routes/**/*.tsx JSX text
// node) and surfaces 37 pre-existing comments elsewhere that also quote
// real copy verbatim, none of which this task was asked to repair. This is
// a TO-DO LIST seeded WITH that debt, per DEC-989's wave-146 amendment for
// a brand-new parallel-wave instrument -- repair is a later single-owner
// wave's lane, not claimed here.
export const CSS_COMMENT_COPY_LEAK_CEILING = 37;

describe("CSS comment copy-leak scan: src/routes/**/*.css.ts comments vs src/routes/**/*.tsx text (DEC-613 wave-146 amendment)", () => {
  it("population sanity: walks a non-trivial number of route stylesheets and views", () => {
    expect(CSS_TS_FILES.length).toBeGreaterThan(5);
    expect(ROUTE_TSX_FILES.length).toBeGreaterThan(5);
  });

  it(
    `no src/routes/**/*.css.ts comment quotes a >=${MIN_LEAK_LEN}-char run of real .tsx copy verbatim ` +
      `(ceiling: CSS_COMMENT_COPY_LEAK_CEILING, may only be LOWERED)`,
    () => {
      if (ALL_LEAKS.length > CSS_COMMENT_COPY_LEAK_CEILING) {
        throw new Error(
          `${ALL_LEAKS.length} CSS comment(s) leak product copy into the served page, above the ` +
            `ratchet ceiling of ${CSS_COMMENT_COPY_LEAK_CEILING} (may only be LOWERED, never raised to ` +
            `paper over a regression):\n` +
            ALL_LEAKS.map((v) => `${v.file}:${v.line} leaked "${v.leaked}"`).join("\n"),
        );
      }
      expect(ALL_LEAKS.length).toBeLessThanOrEqual(CSS_COMMENT_COPY_LEAK_CEILING);
    },
  );
});

// ---------------------------------------------------------------------------
// NON-VACUITY (house rule: every scan ships one) -- a FABRICATED comment
// blob and a FABRICATED tsx blob, never a live product string (which would
// itself become a sentinel). Proves findLeakedRuns/findCommentCopyLeaks
// actually catch a leak, not just pass vacuously over an empty population.
// ---------------------------------------------------------------------------

describe("non-vacuity: a fabricated leaking comment is caught", () => {
  const FIXTURE_SENTENCE = "Totally fabricated leak sentence for this fixture only";
  // Exercises the exact node-extraction path the population walk uses,
  // rather than hand-building a blob -- a fabricated JSX fragment, never a
  // live product string (which would itself become a sentinel).
  const tsxBlobs = extractJsxTextNodes(`<p>Intro text ${FIXTURE_SENTENCE} trailing text</p>`);

  it("a CSS comment quoting the fixture sentence verbatim is flagged", () => {
    const src = `export const CSS = css\`\n  /* some note: "${FIXTURE_SENTENCE}" appears here */\n  .x { color: red; }\n\`;\n`;
    const leaks = findCommentCopyLeaks("fixture.css.ts", "fixture.css.ts", src, tsxBlobs);
    expect(leaks.length).toBeGreaterThan(0);
    expect(leaks.some((v) => v.leaked.includes("fabricated leak sentence"))).toBe(true);
  });

  it("a CSS comment that does NOT quote the fixture sentence is not flagged", () => {
    const src = `export const CSS = css\`\n  /* an unrelated short note about padding */\n  .x { color: red; }\n\`;\n`;
    const leaks = findCommentCopyLeaks("fixture.css.ts", "fixture.css.ts", src, tsxBlobs);
    expect(leaks.length).toBe(0);
  });

  it("a run shorter than the 16-char floor is not flagged even if it matches", () => {
    const src = `export const CSS = css\`\n  /* short: "Intro text" only */\n  .x { color: red; }\n\`;\n`;
    const leaks = findCommentCopyLeaks("fixture.css.ts", "fixture.css.ts", src, tsxBlobs);
    expect(leaks.length).toBe(0);
  });
});
