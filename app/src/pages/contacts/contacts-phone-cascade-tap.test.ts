// v12 mobile wave 7 (task w7-c) -- DEC-385 cascade repair + DEC-393 tap floor,
// contacts + public-rail cluster.
//
// Three source-order shadows measured on main:
//
//   * contacts-panels.css:531 `.chq-contacts-duplicate-group { grid-
//     template-columns: 1fr }` (inside an EARLIER @media (max-width: 700px)
//     block) loses to the top-level `minmax(0, 1fr) auto auto` declared
//     later in the file at :578.
//   * contacts-panels.css:535 `.chq-contacts-duplicate-names { white-space:
//     normal }` loses to the top-level `nowrap` at :608.
//   * contacts-panels.css's `.chq-contacts-duplicate-group
//     .chq-contacts-import-actions { flex-wrap: wrap }` loses to a later
//     top-level `nowrap` on the same selector.
//   * rail.css.ts:156 `.chq-pub-surface-title { font-size: 26px }` (inside
//     an earlier ≤700px block) loses to the top-level 36px declared later
//     at :218.
//
// DEC-385 says the phone layer is `max-width` ONLY -- reordering the file
// was ruled out (37 other worktrees hold hunks in these files), so the
// fix is a single TERMINAL @media (max-width: 700px) block appended at the
// end of each file: CSS's cascade is decided by SOURCE ORDER when
// specificity ties, so the last-declared rule for a given selector+
// property wins regardless of which @media block it sits in. This file
// proves the repair by finding every declaration of the repaired
// selector+property across the WHOLE file (mirroring
// contacts-phone-frames.test.ts's brace-matched scanners) and asserting
// the LAST one by source position sits inside a max-width phone block.
//
// DEC-393's wave-7 technique -- grow the ANCHOR, absorb the padding with
// an equal-and-opposite negative inline margin, never pad a container --
// is proved by asserting each floor selector carries all four
// declarations with matching padding-inline / margin-inline magnitudes.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { RAIL_CSS } from '../../../../src/routes/public/css/rail.css';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Comments stripped before any scanning -- mirrors contacts-phone-frames
 * .test.ts's `read`, so a `{`/`}` inside a long explanatory comment can
 * never desynchronise the brace-matching below. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function read(file: string): string {
  return stripComments(readFileSync(join(HERE, file), 'utf-8'));
}

const CONTACTS_CSS = read('contacts.css');
const PANELS_CSS = read('contacts-panels.css');
const RAIL_CSS_STRIPPED = stripComments(RAIL_CSS);

/** Every top-level-or-nested rule `{selector list, body}` in `css`, in
 * source order, whose selector list (split on `,`, exact-trimmed member
 * match) includes `selector`. An @media wrapper's own "selector" (the
 * `@media (...)` condition text) can never itself satisfy this match: its
 * body contains further `{`/`}` nesting, so `[^{}]*` cannot span it and
 * the attempt fails outright -- the engine falls through to the inner
 * rules, which is exactly the granularity this needs. `m.index` orders
 * occurrences regardless of which @media block (if any) they sit inside. */
function ruleOccurrences(css: string, selector: string): { index: number; body: string }[] {
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  const out: { index: number; body: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = rule.exec(css)) !== null) {
    const selectors = m[1]!
      .split(',')
      .map((s) => s.trim().replace(/\s+/g, ' '))
      .filter(Boolean);
    if (selectors.includes(selector)) out.push({ index: m.index, body: m[2]! });
  }
  return out;
}

/** Byte ranges `[start, end)` of every top-level `@media (max-width: …)`
 * block's BODY (brace-matched, so a nested rule's own braces can never
 * end the range early) -- mirrors contacts-phone-frames.test.ts's
 * phoneLayer, but keeps the offsets instead of concatenating the text. */
function phoneBlockRanges(css: string): [number, number][] {
  const ranges: [number, number][] = [];
  const opener = /@media\s*\(max-width:\s*\d+px\)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = opener.exec(css)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') depth -= 1;
      i += 1;
    }
    if (depth !== 0) throw new Error('unbalanced @media block');
    ranges.push([start, i - 1]);
  }
  return ranges;
}

function isInsidePhoneBlock(css: string, index: number): boolean {
  return phoneBlockRanges(css).some(([s, e]) => index >= s && index < e);
}

type CascadeCase = {
  label: string;
  css: string;
  selector: string;
  property: string;
  winningValue: RegExp;
};

const CASCADE_CASES: CascadeCase[] = [
  {
    label: 'contacts-panels.css duplicate-group grid stacks to one column at phone',
    css: PANELS_CSS,
    selector: '.chq-contacts-duplicate-group',
    property: 'grid-template-columns',
    winningValue: /grid-template-columns:\s*1fr\s*;/,
  },
  {
    label: 'contacts-panels.css duplicate-names wraps instead of truncating at phone',
    css: PANELS_CSS,
    selector: '.chq-contacts-duplicate-names',
    property: 'white-space',
    winningValue: /white-space:\s*normal\s*;/,
  },
  {
    label: 'contacts-panels.css duplicate-group action pair wraps at phone',
    css: PANELS_CSS,
    selector: '.chq-contacts-duplicate-group .chq-contacts-import-actions',
    property: 'flex-wrap',
    winningValue: /flex-wrap:\s*wrap\s*;/,
  },
  {
    label: 'rail.css.ts public surface title holds the phone register',
    css: RAIL_CSS_STRIPPED,
    selector: '.chq-pub-surface-title',
    property: 'font-size',
    winningValue: /font-size:\s*26px\s*;/,
  },
];

describe('DEC-385 wave-7 amendment: terminal block wins the cascade', () => {
  for (const c of CASCADE_CASES) {
    it(c.label, () => {
      const occurrences = ruleOccurrences(c.css, c.selector);
      // A real shadow: the selector must be declared more than once (the
      // earlier, losing phone declaration and the top-level rule that beat
      // it), not just once inside a phone block.
      expect(occurrences.length).toBeGreaterThanOrEqual(2);

      const last = occurrences[occurrences.length - 1]!;
      expect(last.body).toMatch(c.winningValue);
      expect(isInsidePhoneBlock(c.css, last.index)).toBe(true);

      // Sanity: at least one EARLIER occurrence sat outside every phone
      // block -- otherwise this selector was never actually shadowed by a
      // top-level rule and the case is testing nothing.
      const earlierTopLevel = occurrences
        .slice(0, -1)
        .some((occ) => !isInsidePhoneBlock(c.css, occ.index));
      expect(earlierTopLevel).toBe(true);
    });
  }
});

/** All four DEC-393 floor declarations, with padding-inline and
 * margin-inline required to be equal-and-opposite (never just "some
 * padding" and "some negative margin"). */
function assertFloor(body: string): void {
  expect(body).toMatch(/min-height:\s*44px/);
  expect(body).toMatch(/display:\s*flex/);
  expect(body).toMatch(/align-items:\s*center/);
  const padding = /padding-inline:\s*(\d+)px/.exec(body);
  const margin = /margin-inline:\s*-(\d+)px/.exec(body);
  expect(padding, `${JSON.stringify(body)} has no padding-inline`).not.toBeNull();
  expect(margin, `${JSON.stringify(body)} has no negative margin-inline`).not.toBeNull();
  expect(padding![1]).toBe(margin![1]);
}

describe('DEC-393 wave-7 technique: grow the anchor, absorb the padding', () => {
  it('.chq-contacts-merge-back (contacts-panels.css) sits at the 44px floor', () => {
    const occurrences = ruleOccurrences(PANELS_CSS, '.chq-contacts-merge-back');
    expect(occurrences.length).toBeGreaterThanOrEqual(1);
    const last = occurrences[occurrences.length - 1]!;
    expect(isInsidePhoneBlock(PANELS_CSS, last.index)).toBe(true);
    assertFloor(last.body);
  });

  it('the Export CSV link in .chq-contacts-title-actions sits at the 44px floor', () => {
    const occurrences = ruleOccurrences(CONTACTS_CSS, '.chq-contacts-title-actions a');
    expect(occurrences.length).toBeGreaterThanOrEqual(1);
    const last = occurrences[occurrences.length - 1]!;
    expect(isInsidePhoneBlock(CONTACTS_CSS, last.index)).toBe(true);
    assertFloor(last.body);
  });

  it('the Merge link in .chq-contacts-rail-duplicate-actions sits at the 44px floor', () => {
    const occurrences = ruleOccurrences(CONTACTS_CSS, '.chq-contacts-rail-duplicate-actions a');
    expect(occurrences.length).toBeGreaterThanOrEqual(1);
    const last = occurrences[occurrences.length - 1]!;
    expect(isInsidePhoneBlock(CONTACTS_CSS, last.index)).toBe(true);
    assertFloor(last.body);
  });

  it('never authors a phone min-height below 44px in either repaired file', () => {
    for (const css of [CONTACTS_CSS, PANELS_CSS]) {
      for (const [start, end] of phoneBlockRanges(css)) {
        const block = css.slice(start, end);
        for (const m of block.matchAll(/min-height:\s*(\d+)px/g)) {
          expect(Number(m[1])).toBeGreaterThanOrEqual(44);
        }
      }
    }
  });
});

describe('DEC-385: no min-width query was introduced', () => {
  it('contacts.css, contacts-panels.css and rail.css.ts stay single-direction', () => {
    expect(CONTACTS_CSS).not.toMatch(/@media[^{]*min-width/);
    expect(PANELS_CSS).not.toMatch(/@media[^{]*min-width/);
    expect(RAIL_CSS_STRIPPED).not.toMatch(/@media[^{]*min-width/);
  });
});
