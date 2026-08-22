// Frame-citation core: path roots, file enumeration, citation matching, and
// quote/line lookup helpers shared by app/src/frame-citation.scan.test.ts
// and its sibling frame-citation-frames.ts / frame-citation-receipts.ts
// modules.
//
// Contention decomposition (no behaviour change): this module used to live
// inline in app/src/frame-citation.scan.test.ts, which had grown to 1038
// lines and become a merge-conflict hotspot. Extracted verbatim (same
// logic, same path math -- this file stays in app/src/ specifically so
// `dirname(fileURLToPath(import.meta.url))` still resolves to app/src, the
// same REPO_ROOT/SRC_ROOT/DESIGN_ROOT computation the original file used).
// See DEC-976 (frame-truth), DEC-808 (enumeration-not-manifest), DEC-613 (a
// second copy of a vocabulary is a trap with a delay fuse -- this
// extraction is the single copy every describe block now shares).
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const APP_SRC = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(APP_SRC, '..', '..');
export const SRC_ROOT = join(REPO_ROOT, 'src');
export const DESIGN_ROOT = join(REPO_ROOT, 'docs', 'design');
export const TEST_DIR_ROOT = join(REPO_ROOT, 'test');

export function isTestFile(name: string): boolean {
  return /\.test\.tsx?$/.test(name);
}

/** Every file under `root` matching one of `extensions`, test files
 * excluded, enumerated via readdirSync rather than named (DEC-808). */
export function enumerateFiles(root: string, extensions: string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    if (!extensions.some((ext) => entry.name.endsWith(ext))) continue;
    if (isTestFile(entry.name)) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

/** Every *.test.ts/*.test.tsx file under `root` (readdirSync, DEC-808 idiom,
 * never a hand-listed manifest). */
export function enumerateTestFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !isTestFile(entry.name)) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

export function normalise(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** Collapses comment-wrap line breaks (and any run of whitespace) to a
 * single space, so a citation or quote split across a wrapped comment line
 * reads as one contiguous string for matching purposes. */
export function flatten(content: string): string {
  return content
    .replace(/\r?\n[ \t]*\*\/?[ \t]?/g, ' ')
    .replace(/\r?\n[ \t]*\/\/[ \t]?/g, ' ')
    .replace(/\s+/g, ' ');
}

export interface Citation {
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
export const STRICT_RE = /docs\/design\/([A-Za-z][A-Za-z0-9 ]*\.dc\.html):\s*([\d/,-]+)/g;

// Abbreviated form -- used only where the source is licensed to ship to the
// browser (PUBLIC_CSS / THEME_CSS) and is forbidden from spelling the
// product-name-bearing frame filename: docs/design's "<Sheet>" sheet
// (.dc.html:<line-blob> ...).
export const ABBREV_RE = /docs\/design's\s+"([^"]+)"\s+sheet\s*\(\.dc\.html:\s*([\d/,-]+)/g;

export function firstLineNumber(blob: string): number {
  const m = blob.match(/\d+/);
  if (!m) throw new Error(`no digit found in line reference "${blob}"`);
  return Number(m[0]);
}

export function findCitations(file: string, flat: string): Citation[] {
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
export function quoteAfter(flat: string, index: number, window = 400): string | null {
  const slice = flat.slice(index, index + window);
  const m = slice.match(/`([^`]*)`/);
  if (!m) return null;
  return (m[1] ?? '').replace(/\\/g, '');
}

const frameLinesByFile = new Map<string, string[]>();
export function frameLines(frameFile: string): string[] {
  let lines = frameLinesByFile.get(frameFile);
  if (!lines) {
    lines = readFileSync(join(DESIGN_ROOT, frameFile), 'utf-8').split('\n');
    frameLinesByFile.set(frameFile, lines);
  }
  return lines;
}

export function designFileNames(): string[] {
  return readdirSync(DESIGN_ROOT, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.dc.html'))
    .map((e) => e.name)
    .sort();
}

/** Locates a citation's SOURCE line (its position in the citing test file --
 * distinct from `firstLine`, which is the FRAME's cited line) via a
 * sequential search with a rolling cursor, so repeated identical matchTexts
 * in one file resolve in appearance order. Tolerates whitespace collapsed by
 * `flatten` (a wrapped comment) by falling back to a regex that rejoins
 * words with the same connector flatten() would have collapsed. */
export function locateSourceIndex(raw: string, matchText: string, searchFrom: number): number {
  // matchText came out of flatten(), which collapses a wrapped comment's
  // line break AND its continuation marker (`* `/`// `) to one space -- so
  // the raw text may have `// ` or `* ` sitting where matchText has a bare
  // space. Rejoin each space with the same connector flatten() would have
  // collapsed, so a name split across a wrapped `//` comment (e.g.
  // "...Chautauqua\n// Comms.dc.html:177") still resolves.
  //
  // The connector is all-optional, so this pattern also matches the ordinary
  // unwrapped spelling -- it is a SUPERSET of a literal indexOf, and the
  // earliest position it reports is the true next occurrence of this
  // citation in either form.
  //
  // That superset relationship is the whole point, and why the literal
  // indexOf below is only allowed to WIN A TIE rather than short-circuit.
  // Citations are resolved in flattened-source order against a rolling
  // cursor, which is only sound if each lookup returns the EARLIEST
  // remaining occurrence. Preferring a literal hit outright breaks that:
  // when a file cites the same frame span twice -- once wrapped across a
  // comment line break, once contiguous further down -- the wrapped first
  // citation finds no literal match at its own position and silently
  // resolves to the CONTIGUOUS one instead, leapfrogging it. The cursor
  // then advances past that stolen position and the second, genuinely
  // contiguous citation can no longer be found at all, so a file with
  // perfectly well-formed citations throws "flatten() and the raw file
  // disagree on its text". test/portal-edit-390-frames.test.ts is exactly
  // this shape: its header comment wraps
  // "docs/design/Chautauqua Public\n// and Portal.dc.html:600-674" across
  // lines 2-3 and its describe() repeats the same span contiguously.
  const CONNECTOR = String.raw`\s*(?:\/\/|\*\/?)?\s*`;
  const pattern = matchText
    .split(' ')
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join(CONNECTOR);
  const m = raw.slice(searchFrom).match(new RegExp(pattern));
  const wrapped = m?.index === undefined ? -1 : searchFrom + m.index;
  const direct = raw.indexOf(matchText, searchFrom);

  if (wrapped === -1 && direct === -1) {
    throw new Error(
      `could not locate citation "${matchText}" in its own source file to check line adjacency -- ` +
        `flatten() and the raw file disagree on its text`
    );
  }
  if (wrapped === -1) return direct;
  if (direct === -1) return wrapped;
  return Math.min(direct, wrapped);
}

export function lineNumberAt(raw: string, index: number): number {
  let n = 1;
  for (let i = 0; i < index; i++) if (raw.charCodeAt(i) === 10) n++;
  return n;
}

export { relative };
