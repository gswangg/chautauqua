// DEC-993 (wave-19 amendment, DESIGN-RULINGS B8): "the ▾ on a select-like
// control always sits at the right edge of the control in muted ink
// (#565A4B), never as the last glyph of the label" -- the frames render it
// as its own element every time; app/src/components/EventSwitcher.tsx's
// .chq-eventswitcher-caret is the reference shape this scan enforces (the
// exact frame citation for that grammar sits beside the loop's own
// expect() below, next to the assertion it receipts).
// This is a source-scan (mirroring app/src/phone-block-visibility.test.ts):
// every *.tsx under app/src/** AND src/** is read as text (DEC-808
// wave-99 amendment -- B8 governs the whole product, and Hono's SSR JSX
// under src/ renders real `<select>`-adjacent markup too), and every bare
// `▾` glyph must either sit inside an element whose className/class ends
// in `-caret` (nothing else between the tags but the glyph and
// whitespace), or be a named, reasoned exemption in DISCLOSURE_TOGGLE_OK
// below -- a caret that PRECEDES its label is a disclosure toggle
// (expand/collapse), a different affordance from a select caret, and is
// out of this scan's scope.
//
// Hono JSX writes `class=`, not `className=` (React's DOM-property
// spelling) -- the wave-95 lesson (interaction-states/tap-floor scans hit
// the same shape) is that a token reader matching only `className\s*=`
// reads a fraction of the real SSR population. The caret-element regex
// below therefore accepts BOTH `className="..."` and `class="..."`.
//
// Native <select> elements are out of scope: the UA draws their own
// caret. The CONFORMANT SSR shape for a custom select-like caret is
// src/views/theme.ts's `select { appearance: none; ... background-image:
// ... }` rule (~line 385): it strips the native caret with
// `appearance:none` and paints its own via a background-image data URI on
// the `<select>` element itself, rather than rendering a `▾` glyph as
// JSX text -- this scan's `▾`-glyph rule does not apply to that mechanism
// and must not be extended to flag it.
//
// DEC-374 (wave-18 amendment: FRAME EVIDENCE IS NOT PRODUCT COPY). A test
// file that quotes docs/design/*.dc.html VERBATIM inside a string/backtick
// literal (a `verbatimLine(...)` receipt, a citation quote) is receipting
// the frame, not authoring product JSX -- this scan's subject is product
// markup, so any otherwise-bare `▾` that resolves to a verbatim frame
// quote via test/helpers/frame-evidence.ts's isFrameEvidence() is excluded
// from the offender population before it is built, exactly like a
// DISCLOSURE_TOGGLE_OK entry.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { isFrameEvidence } from '../../test/helpers/frame-evidence';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_SRC = HERE;
const REPO_ROOT = join(APP_SRC, '..', '..');
const SRC_ROOT = join(REPO_ROOT, 'src');

function walk(dir: string, suffix: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p, suffix));
    else if (entry.endsWith(suffix)) out.push(p);
  }
  return out;
}

/** Bare `▾` glyphs that are a disclosure toggle -- the glyph PRECEDES its
 * label and flips direction with `open`/`expanded` state (▾ open / ▸
 * closed), unlike a select caret, which always points down and always
 * trails the label inside its own `-caret`-classed element. Each entry
 * names the file (relative to app/src), the 1-based line, and the reason
 * so the exemption is reviewable, not a silent escape hatch. */
// Paths are relative to the repo root (REPO_ROOT below), not app/src, so
// entries from both the SPA (app/src/**) and SSR (src/**) trees share one
// unambiguous key space.
// DEC-967 amendment (wave-121): re-keyed on a source LITERAL rather than a
// line number. A line number drifts every time another lane edits code
// above the toggle (this entry alone was re-pointed 1303 -> 1378 by the
// wave-119 train); a distinctive source substring on the ▾ line does not.
// `anchorLiteral` is resolved against the file below (resolveAnchorLine),
// which fails loudly if the literal is absent or ambiguous -- an anchor
// that cannot uniquely locate its line is not an anchor.
const DISCLOSURE_TOGGLE_OK_SOURCE: Array<[file: string, anchorLiteral: string, reason: string]> = [
  [
    'app/src/pages/review/ResultsTable.tsx',
    "{expanded ? '▾' : '▸'} {countOf(row.count, 'review')}",
    "expand/collapse disclosure toggle ({expanded ? '▾' : '▸'} count) -- the " +
      'glyph precedes its label and flips direction with `expanded`, unlike a ' +
      'select caret, which always points down and always trails the label in ' +
      'its own -caret element.',
  ],
  [
    'app/src/pages/submissions/SubmissionDetailPage.tsx',
    "criteriaOpen ? '▾' : '▸'",
    "expand/collapse criteria disclosure toggle ({criteriaOpen ? '▾' : '▸'} " +
      'count) -- same disclosure affordance as ResultsTable.tsx:485.',
  ],
];

/** Resolves an anchor literal to its 1-based line number inside `file`
 * (relative to REPO_ROOT). Fails loudly -- no fallback -- if the literal is
 * missing or matches more than once, since an ambiguous anchor cannot
 * uniquely identify a line. */
function resolveAnchorLine(file: string, anchorLiteral: string): number {
  const content = readFileSync(join(REPO_ROOT, file), 'utf-8');
  const first = content.indexOf(anchorLiteral);
  if (first === -1) {
    throw new Error(
      `DISCLOSURE_TOGGLE_OK anchor not found: ${JSON.stringify(anchorLiteral)} does not ` +
        `occur in ${file}. Update the anchor literal to match the current source.`,
    );
  }
  const second = content.indexOf(anchorLiteral, first + 1);
  if (second !== -1) {
    throw new Error(
      `DISCLOSURE_TOGGLE_OK anchor is ambiguous: ${JSON.stringify(anchorLiteral)} occurs ` +
        `more than once in ${file}. An ambiguous anchor is not an anchor -- make it more ` +
        'distinctive.',
    );
  }
  return content.slice(0, first).split('\n').length;
}

const DISCLOSURE_TOGGLE_OK: Array<[file: string, line: number, reason: string]> =
  DISCLOSURE_TOGGLE_OK_SOURCE.map(([file, anchorLiteral, reason]) => [
    file,
    resolveAnchorLine(file, anchorLiteral),
    reason,
  ]);

const DISCLOSURE_TOGGLE_OK_KEYS = new Set(
  DISCLOSURE_TOGGLE_OK.map(([file, line]) => `${file}:${line}`),
);

/** A `▾` that legitimately sits alone inside a `className="...-caret"` or
 * `class="...-caret"` element (React SPA vs Hono SSR spellings; matching
 * tag names, glyph is the only text content). */
const CARET_ELEMENT_RE = /<(\w+)[^>]*\bclass(?:Name)?="[^"]*-caret"[^>]*>\s*▾\s*<\/\1>/g;

/** Strips `//` line comments and `/* *\/` block comments so a `▾` inside a
 * source comment (e.g. a test file's prose pointing at a rendered string
 * like "Segment: none ▾") is not mistaken for JSX text content. */
function stripComments(source: string): string {
  return source
    // Block comments: preserve the newline count inside the match so
    // downstream line-number arithmetic (content.slice(0, idx).split('\n'))
    // stays in sync with the original file.
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''))
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('select-caret scan (DEC-993 wave-19 amendment, DESIGN-RULINGS B8)', () => {
  it('every DISCLOSURE_TOGGLE_OK entry names a file:line that actually contains ▾', () => {
    for (const [file, line] of DISCLOSURE_TOGGLE_OK) {
      const content = readFileSync(join(REPO_ROOT, file), 'utf-8');
      const lines = content.split('\n');
      expect(lines[line - 1], `${file}:${line} is out of range`).toBeDefined();
      expect(lines[line - 1]).toContain('▾');
    }
  });

  // DEC-967 amendment (wave-121): resolveAnchorLine controls -- proves the
  // re-key mechanism itself fails loudly rather than silently producing a
  // wrong or vacuous line, since the whole point of the re-key is that a
  // future rename/removal of the anchor must break loudly, not silently.
  it('resolveAnchorLine throws when the anchor literal is missing from the file', () => {
    expect(() =>
      resolveAnchorLine(
        'app/src/pages/review/ResultsTable.tsx',
        'this literal does not occur anywhere in the file, guaranteed',
      ),
    ).toThrow(/anchor not found/);
  });

  it('resolveAnchorLine throws when the anchor literal is ambiguous (matches more than once)', () => {
    expect(() =>
      resolveAnchorLine('app/src/pages/review/ResultsTable.tsx', "type=\"button\""),
    ).toThrow(/anchor is ambiguous/);
  });

  it('resolveAnchorLine resolves a present, unique anchor to its real line', () => {
    const [file, anchorLiteral] = DISCLOSURE_TOGGLE_OK_SOURCE[1]!;
    const line = resolveAnchorLine(file, anchorLiteral);
    const content = readFileSync(join(REPO_ROOT, file), 'utf-8');
    expect(content.split('\n')[line - 1]).toContain(anchorLiteral);
  });

  // DEC-808 wave-99 amendment: the population is every .tsx under
  // app/src/** (the SPA) PLUS every .tsx under src/** (Hono SSR routes/
  // views) -- B8 governs the whole product, and the original walk only
  // ever saw the SPA half.
  const files = [...walk(APP_SRC, '.tsx'), ...walk(SRC_ROOT, '.tsx')];
  expect(files.length).toBeGreaterThan(5); // regex sanity floor: the walk actually found files

  it('the SSR half of the walk is non-empty (vacuous-population tripwire, DEC-808 wave-99)', () => {
    expect(files.some((f) => f.startsWith(SRC_ROOT + sep))).toBe(true);
  });

  for (const file of files) {
    const rel = relative(REPO_ROOT, file).split(sep).join('/');
    it(`${rel}: every ▾ sits inside a *-caret element or is an allowlisted disclosure toggle`, () => {
      const raw = readFileSync(file, 'utf-8');
      const content = stripComments(raw);
      const consumed = new Set<number>();
      for (const m of content.matchAll(CARET_ELEMENT_RE)) {
        consumed.add(m.index! + m[0].indexOf('▾'));
      }
      let idx = content.indexOf('▾');
      while (idx !== -1) {
        if (!consumed.has(idx)) {
          const line = content.slice(0, idx).split('\n').length;
          const key = `${rel}:${line}`;
          const lineText = content.split('\n')[line - 1] ?? '';
          const idxOnLine = idx - (content.lastIndexOf('\n', idx) + 1);
          // DEC-374 (wave-18 amendment): a bare ▾ that is a verbatim frame
          // quote inside a test-file string/backtick literal is evidence,
          // not product copy -- excluded before the assertion below.
          if (isFrameEvidence(rel, lineText, idxOnLine)) {
            idx = content.indexOf('▾', idx + 1);
            continue;
          }
          // DEC-993 (DESIGN-RULINGS B8): docs/design/Chautauqua
          // Speakers.dc.html: 68-70 gives the caret its own element, e.g.
          // `<span style="color:#565A4B; padding-left:6px">▾</span>` (and
          // :91 repeats the same shape) -- the assertion below enforces
          // exactly that split.
          expect(
            DISCLOSURE_TOGGLE_OK_KEYS.has(key),
            `${key}: bare ▾ is not inside a className="*-caret" element and is not ` +
              'an allowlisted disclosure toggle. Wrap it in its own element with a ' +
              "className ending in -caret (see EventSwitcher.tsx's " +
              '.chq-eventswitcher-caret for the reference shape), or add a reasoned ' +
              'entry to DISCLOSURE_TOGGLE_OK.',
          ).toBe(true);
        }
        idx = content.indexOf('▾', idx + 1);
      }
    });
  }
});
