// DEC-993 (wave-19 amendment, DESIGN-RULINGS B8): "the ▾ on a select-like
// control always sits at the right edge of the control in muted ink
// (#565A4B), never as the last glyph of the label" -- the frames render it
// as its own element every time (docs/design/Chautauqua Speakers.dc.html:
// 68-70 and :91; app/src/components/EventSwitcher.tsx's
// .chq-eventswitcher-caret is the reference shape this scan enforces).
// This is a source-scan (mirroring app/src/phone-block-visibility.test.ts):
// every *.tsx under app/src/** is read as text, and every bare `▾` glyph
// must either sit inside an element whose className ends in `-caret`
// (nothing else between the tags but the glyph and whitespace), or be a
// named, reasoned exemption in DISCLOSURE_TOGGLE_OK below -- a caret that
// PRECEDES its label is a disclosure toggle (expand/collapse), a different
// affordance from a select caret, and is out of this scan's scope.
//
// Native <select> elements are out of scope: the UA draws their own caret
// and .chq-select already reserves clearance for it.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_SRC = HERE;

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
const DISCLOSURE_TOGGLE_OK: Array<[file: string, line: number, reason: string]> = [
  [
    'pages/review/ResultsTable.tsx',
    446,
    "expand/collapse disclosure toggle ({expanded ? '▾' : '▸'} count) -- the " +
      'glyph precedes its label and flips direction with `expanded`, unlike a ' +
      'select caret, which always points down and always trails the label in ' +
      'its own -caret element.',
  ],
  [
    'pages/submissions/SubmissionDetailPage.tsx',
    1184,
    "expand/collapse criteria disclosure toggle ({criteriaOpen ? '▾' : '▸'} " +
      'count) -- same disclosure affordance as ResultsTable.tsx:446.',
  ],
];

const DISCLOSURE_TOGGLE_OK_KEYS = new Set(
  DISCLOSURE_TOGGLE_OK.map(([file, line]) => `${file}:${line}`),
);

/** A `▾` that legitimately sits alone inside a `className="...-caret"`
 * element (matching tag names, glyph is the only text content). */
const CARET_ELEMENT_RE = /<(\w+)[^>]*className="[^"]*-caret"[^>]*>\s*▾\s*<\/\1>/g;

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
      const content = readFileSync(join(APP_SRC, file), 'utf-8');
      const lines = content.split('\n');
      expect(lines[line - 1], `${file}:${line} is out of range`).toBeDefined();
      expect(lines[line - 1]).toContain('▾');
    }
  });

  const files = walk(APP_SRC, '.tsx');
  expect(files.length).toBeGreaterThan(5); // regex sanity floor: the walk actually found files

  for (const file of files) {
    const rel = relative(APP_SRC, file).split(sep).join('/');
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
