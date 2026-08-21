// task v12m-w16-ui-r5-a (src/decisions-data/DEC-383.md, wave-16-r5 amendment):
// the house `:focus-visible` ring (app/src/styles.css `outline: 2px solid
// var(--chq-brand); outline-offset: 2px;`) is a standing OUTWARD offset, but
// the 390 head's two `overflow-x: auto` scroll containers
// (`.chq-contacts-filter-chipstrip`, `.chq-contacts-segment-pills`) each
// clip that outward ring on their focusable children. jsdom applies no
// stylesheet, so a computed-style assertion would pass regardless of what
// the file says -- this is a source-text scan, not a render test --
// modelled on contacts-chip-interaction-states-390.test.ts.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { stripCssComments } from '../../../../test/helpers/strip-css-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = join(HERE, 'contacts.css');
const CSS = readFileSync(CSS_PATH, 'utf-8');
const STRIPPED = stripCssComments(CSS);

/** Byte offsets of every `@media (max-width: 700px) {` opener in the
 * (comment-stripped) source, paired with the offset of its matching closing
 * brace -- so "the terminal block's body" is a real source range rather
 * than a naive indexOf. */
function maxWidth700Blocks(css: string): Array<{ start: number; end: number; body: string }> {
  const opener = /@media\s*\(max-width:\s*700px\)\s*\{/g;
  const blocks: Array<{ start: number; end: number; body: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = opener.exec(css)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    const bodyStart = i;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') depth -= 1;
      i += 1;
    }
    blocks.push({ start: m.index, end: i, body: css.slice(bodyStart, i - 1) });
  }
  return blocks;
}

const BLOCKS = maxWidth700Blocks(STRIPPED);

describe('contacts.css phone head strip focus ring (DEC-383 amendment, v12m-w16-ui-r5-a)', () => {
  it('the file has exactly one terminal @media (max-width: 700px) block', () => {
    expect(BLOCKS.length).toBe(1);
  });

  const TERMINAL = () => BLOCKS[0]!.body;

  /** DEC-808: derive the population, don't hand-list it. Every top-level
   * selector in the terminal block whose declaration body contains
   * `overflow-x: auto`. */
  function overflowXAutoSelectors(body: string): string[] {
    const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
    const found: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = ruleRe.exec(body)) !== null) {
      const selector = m[1]!.trim();
      const decl = m[2]!;
      if (/overflow-x:\s*auto/.test(decl)) {
        found.push(selector);
      }
    }
    return found;
  }

  it('exactly two rules in the terminal block declare overflow-x: auto, and they are the two head strips', () => {
    const selectors = overflowXAutoSelectors(TERMINAL());
    expect(selectors).toEqual([
      '.chq-contacts-filter-chipstrip',
      '.chq-contacts-segment-pills',
    ]);
  });

  it('each overflow-x: auto strip has a :focus-visible scoping rule declaring a NEGATIVE outline-offset', () => {
    const selectors = overflowXAutoSelectors(TERMINAL());
    expect(selectors.length).toBe(2);
    for (const selector of selectors) {
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const focusRuleRe = new RegExp(
        `${escaped}\\s*:focus-visible[^{]*\\{([^}]*)\\}`,
      );
      const match = TERMINAL().match(focusRuleRe);
      expect(match, `expected a :focus-visible rule scoped under ${selector}`).not.toBeNull();
      const body = match![1]!;
      expect(body).toMatch(/outline-offset:\s*-\d/);
    }
  });

  it('the new rule scopes both strips together rather than redeclaring a bare shared token', () => {
    expect(TERMINAL()).toMatch(
      /\.chq-contacts-filter-chipstrip :focus-visible,\s*\n?\s*\.chq-contacts-segment-pills :focus-visible\s*\{[^}]*outline-offset:\s*-2px;[^}]*\}/,
    );
  });

  it('declares no outline: none anywhere in the terminal block', () => {
    expect(TERMINAL()).not.toMatch(/outline:\s*none/);
  });

  it('cites both frame lines with their verbatim declaration', () => {
    // Comments wrap across source lines (house convention), so normalise
    // whitespace before matching -- mirrors app/src/frame-citation.scan.test.ts's
    // own `flatten`/`normalise` treatment of wrapped comments.
    const flattened = CSS.replace(/\s+/g, ' ');
    expect(flattened).toMatch(/Contacts\.dc\.html:187/);
    expect(flattened).toMatch(/Contacts\.dc\.html:194/);
    expect(flattened).toMatch(
      /display:flex; gap:7px; overflow-x:auto; -webkit-overflow-scrolling:touch/,
    );
  });
});
