// Frame-citation contract (DEC-976 amendment, wave 23; DEC-808). DEC-976's
// amendment rules that every `docs/design/*.dc.html:<line>` reference in an
// app/src or src comment must be immediately followed, in the same
// comment, by the cited line's literal declaration in backticks -- the
// quote is the receipt: a reader comparing the rule below to the quote
// beside it needs no second file open, and a frame edit that moves a line
// breaks the quote instead of silently rotting the number.
//
// This scan asserts quote PRESENCE and frame-TRUTH only, per DEC-976's own
// text -- it deliberately does NOT assert the neighbouring CSS/copy equals
// the quote (that comparison is the auditor's judgment; a rule may
// legitimately differ from a frame under a recorded ruling, and forcing
// equality would turn the scan into a rubber stamp):
//
//   1) a backticked literal follows every citation, within the same
//      comment;
//   2) that literal appears verbatim (whitespace-normalised) at the
//      cited line of the named frame file under docs/design/.
//
// Enumeration (DEC-808): readdirSync over app/src and src -- never a
// hand-listed manifest of "the files with citations", which desyncs the
// moment a citation is added or moved. The one non-manifest scoping rule
// this test applies (mirrored from the task that landed it, w23-e) is
// structural, not a list of names: every *.css file under app/src, and
// every *.ts/*.tsx file under src, excluding *.test.ts/*.test.tsx (test
// files are not held to the citation contract, mirroring
// css-contract.scan.test.ts's own *.test.tsx exclusion for invariant C/D).
//
// Matching is done against a WHITESPACE-FLATTENED copy of each file (all
// runs of whitespace, and any jsdoc `* `/line-comment `// ` continuation
// marker at a line start, collapsed to one space) so a citation or its
// quote that a house wrapped across a comment's line width -- e.g. a frame
// name split "Chautauqua Public and\n * Portal.dc.html" -- is still found;
// this is a house convention (long comments wrap), never itself asserted.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP_SRC = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(APP_SRC, '..', '..');
const SRC_ROOT = join(REPO_ROOT, 'src');
const DESIGN_ROOT = join(REPO_ROOT, 'docs', 'design');

function isTestFile(name: string): boolean {
  return /\.test\.tsx?$/.test(name);
}

/** Every file under `root` matching one of `extensions`, test files
 * excluded, enumerated via readdirSync rather than named (DEC-808). */
function enumerateFiles(root: string, extensions: string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    if (!extensions.some((ext) => entry.name.endsWith(ext))) continue;
    if (isTestFile(entry.name)) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

const TARGET_FILES = [
  ...enumerateFiles(APP_SRC, ['.css']),
  ...enumerateFiles(SRC_ROOT, ['.ts', '.tsx']),
];

function normalise(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** Collapses comment-wrap line breaks (and any run of whitespace) to a
 * single space, so a citation or quote split across a wrapped comment line
 * reads as one contiguous string for matching purposes. */
function flatten(content: string): string {
  return content
    .replace(/\r?\n[ \t]*\*\/?[ \t]?/g, ' ')
    .replace(/\r?\n[ \t]*\/\/[ \t]?/g, ' ')
    .replace(/\s+/g, ' ');
}

interface Citation {
  /** Repo-relative path of the file carrying the citation. */
  file: string;
  /** The frame's filename under docs/design/, e.g. "Chautauqua Review.dc.html". */
  frameFile: string;
  /** The first line number named by the citation (a multi-line citation
   * like ":97/101" or ":117,121,136,140,153" cites several identical
   * lines in this codebase's usage so far; the first is the one checked). */
  firstLine: number;
  /** The full matched citation text, for failure messages. */
  matchText: string;
  /** Index in the FLATTENED source immediately after the citation, where
   * the backtick quote is expected to follow. */
  index: number;
}

// Strict form: docs/design/<Frame Name>.dc.html:<line-blob>
const STRICT_RE = /docs\/design\/([A-Za-z][A-Za-z0-9 ]*\.dc\.html):\s*([\d/,-]+)/g;

// Abbreviated form -- used only where the source is licensed to ship to the
// browser (PUBLIC_CSS / THEME_CSS) and is forbidden from spelling the
// product-name-bearing frame filename: docs/design's "<Sheet>" sheet
// (.dc.html:<line-blob> ...).
const ABBREV_RE = /docs\/design's\s+"([^"]+)"\s+sheet\s*\(\.dc\.html:\s*([\d/,-]+)/g;

function firstLineNumber(blob: string): number {
  const m = blob.match(/\d+/);
  if (!m) throw new Error(`no digit found in line reference "${blob}"`);
  return Number(m[0]);
}

function findCitations(file: string, flat: string): Citation[] {
  const out: Citation[] = [];
  for (const m of flat.matchAll(STRICT_RE)) {
    out.push({
      file,
      frameFile: m[1]!,
      firstLine: firstLineNumber(m[2]!),
      matchText: m[0],
      index: m.index! + m[0].length,
    });
  }
  for (const m of flat.matchAll(ABBREV_RE)) {
    out.push({
      file,
      frameFile: `Chautauqua ${normalise(m[1]!)}.dc.html`,
      firstLine: firstLineNumber(m[2]!),
      matchText: m[0],
      index: m.index! + m[0].length,
    });
  }
  return out;
}

/**
 * The first backtick-quoted literal within `window` characters after a
 * citation's end (in the flattened source), or null if none is found.
 * Tolerates an escaped backtick (`\``) immediately inside either
 * delimiter: some citations live inside a JS/TS template-literal string
 * (CARDS_CSS/THEME_CSS), where a bare `` ` `` would terminate the string
 * early, so the source escapes it -- the escape character itself is never
 * part of the quoted CSS/copy and is stripped.
 */
function quoteAfter(flat: string, index: number, window = 400): string | null {
  const slice = flat.slice(index, index + window);
  const m = slice.match(/`([^`]*)`/);
  if (!m) return null;
  return (m[1] ?? '').replace(/\\/g, '');
}

const frameLineCache = new Map<string, string[]>();
function frameLines(frameFile: string): string[] {
  let lines = frameLineCache.get(frameFile);
  if (!lines) {
    lines = readFileSync(join(DESIGN_ROOT, frameFile), 'utf-8').split('\n');
    frameLineCache.set(frameFile, lines);
  }
  return lines;
}

interface Scanned extends Citation {
  flat: string;
}

const ALL_CITATIONS: Scanned[] = TARGET_FILES.flatMap((file) => {
  const relPath = relative(REPO_ROOT, file);
  const flat = flatten(readFileSync(file, 'utf-8'));
  return findCitations(relPath, flat).map((c) => ({ ...c, flat }));
});

describe('frame-citation contract (DEC-976 amendment wave 23, DEC-808)', () => {
  it('enumeration finds citations to check (guards against a silently-empty scan)', () => {
    expect(ALL_CITATIONS.length).toBeGreaterThanOrEqual(23);
  });

  it('every citation is immediately followed, in the same comment, by a backtick-quoted literal', () => {
    const missing = ALL_CITATIONS.filter((c) => {
      const quote = quoteAfter(c.flat, c.index);
      return !quote || quote.length === 0;
    }).map((c) => `${c.file}: "${c.matchText}" has no backtick-quoted literal following it`);
    expect(missing).toEqual([]);
  });

  it('every quoted literal appears verbatim (whitespace-normalised) at its cited frame line', () => {
    const mismatches: string[] = [];
    for (const c of ALL_CITATIONS) {
      const quote = quoteAfter(c.flat, c.index);
      if (!quote) continue; // reported by the presence test above
      const lines = frameLines(c.frameFile);
      const frameLine = lines[c.firstLine - 1];
      if (frameLine === undefined) {
        mismatches.push(
          `${c.file}: "${c.matchText}" cites ${c.frameFile}:${c.firstLine}, which does not exist in that frame`
        );
        continue;
      }
      if (!normalise(frameLine).includes(normalise(quote))) {
        mismatches.push(
          `${c.file}: quote \`${quote}\` for "${c.matchText}" does not appear verbatim at ${c.frameFile}:${c.firstLine} (frame line: "${frameLine.trim()}")`
        );
      }
    }
    expect(mismatches).toEqual([]);
  });
});
