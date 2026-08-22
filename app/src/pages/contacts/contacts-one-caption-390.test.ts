// task v12m-w16-ui-r5-e (DEC-930 wave-16-r5 amendment): ONE narrowing
// caption at 390, not two stacked. FilterRulesPanel.tsx renders two
// captions for the same AND -- `.chq-contacts-filter-rules-caption`
// ("Matching all of") heading the desktop builder row, and
// `.chq-contacts-filter-chipstrip-caption` ("All of") heading the 390 chip
// strip. At 390 the builder row is display:none until disclosed, but the
// instant it opens both captions paint 11px apart. contacts.css's terminal
// block now stands the builder caption down (display:none) so the strip's
// caption -- the group's actual accessible name via aria-labelledby -- is
// the sole survivor. jsdom applies no stylesheet, so a computed-style
// assertion would pass regardless of what the file says; this is a
// source-text scan, not a render test, modelled on
// contacts-chip-interaction-states-390.test.ts /
// contacts-rule-chip-label-bound-390.test.ts.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { stripCssComments } from '../../../../test/helpers/strip-css-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = join(HERE, 'contacts.css');
const PANEL_PATH = join(HERE, 'FilterRulesPanel.tsx');
const CSS = readFileSync(CSS_PATH, 'utf-8');
const PANEL = readFileSync(PANEL_PATH, 'utf-8');
const STRIPPED = stripCssComments(CSS);

/** Byte offsets of every `@media (max-width: 700px) {` opener in the
 * (comment-stripped) source, paired with the offset of its matching closing
 * brace -- so "the terminal block's body" and "position within it" are real
 * source ranges rather than a naive indexOf. */
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

describe('contacts.css one narrowing caption at 390 (DEC-930 wave-16-r5 amendment, v12m-w16-ui-r5-e)', () => {
  it('the file has exactly one terminal @media (max-width: 700px) block', () => {
    expect(BLOCKS.length).toBe(1);
  });

  const TERMINAL = () => BLOCKS[0]!.body;

  it('the block contains .chq-contacts-filter-rules-caption { display: none; }', () => {
    expect(TERMINAL()).toMatch(
      /\.chq-contacts-filter-rules-caption\s*\{\s*display:\s*none;\s*\}/,
    );
  });

  it('the stand-down rule is positioned AFTER every earlier .chq-contacts-filter-rules-caption rule in the block', () => {
    const captionIdxs = [
      ...TERMINAL().matchAll(/\.chq-contacts-filter-rules-caption\s*\{/g),
    ].map((m) => m.index!);
    // The earlier ellipsis rule plus this stand-down rule -- at least two
    // occurrences of the selector in the terminal block.
    expect(captionIdxs.length).toBeGreaterThanOrEqual(2);
    const standDownIdx = TERMINAL().search(
      /\.chq-contacts-filter-rules-caption\s*\{\s*display:\s*none;/,
    );
    expect(standDownIdx).toBeGreaterThanOrEqual(Math.max(...captionIdxs));
  });

  it('the block contains no rule hiding .chq-contacts-filter-chipstrip-caption -- the surviving caption is never the one stood down', () => {
    expect(TERMINAL()).not.toMatch(
      /\.chq-contacts-filter-chipstrip-caption\s*\{[^}]*display:\s*none/,
    );
    // Also guard against a compound selector sneaking chipstrip-caption
    // into a display:none rule alongside the rules-caption.
    const displayNoneRules = [
      ...TERMINAL().matchAll(/([^{}]+)\{\s*display:\s*none;\s*\}/g),
    ].map((m) => m[1]!);
    for (const selector of displayNoneRules) {
      expect(selector).not.toMatch(/chq-contacts-filter-chipstrip-caption/);
    }
  });

  it('the earlier ellipsis rule for .chq-contacts-filter-rules-caption is untouched', () => {
    expect(TERMINAL()).toMatch(
      /\.chq-contacts-filter-rules-caption\s*\{\s*overflow:\s*hidden;\s*text-overflow:\s*ellipsis;\s*min-width:\s*0;\s*\}/,
    );
  });

  it('FilterRulesPanel.tsx: the chipstrip caption still carries the id its aria-labelledby points at, so the substituted caption is still the group\'s accessible name', () => {
    const idMatch = PANEL.match(
      /<span className="chq-contacts-filter-chipstrip-caption" id=\{(\w+)\}>/,
    );
    expect(idMatch).not.toBeNull();
    const idVar = idMatch![1]!;

    // Locate the `.chq-contacts-filter-chipstrip` group's whole opening tag
    // (attribute ORDER is not asserted -- role/className/aria-labelledby may
    // land in any order). The tag cannot be bounded by the first bare `>`:
    // the aria-labelledby ternary's own condition
    // (`activeRules(rules).length > 0 ? ... : undefined`) contains a `>`
    // that is not the tag's close. The tag's real close is the lone `>` on
    // its own line that JSX prints after the last attribute.
    const chipstripAttrIdx = PANEL.indexOf('className="chq-contacts-filter-chipstrip"');
    expect(chipstripAttrIdx).toBeGreaterThan(-1);
    const tagStart = PANEL.lastIndexOf('<div', chipstripAttrIdx);
    expect(tagStart).toBeGreaterThan(-1);
    const tagEndIdx = PANEL.indexOf('\n    >', chipstripAttrIdx);
    expect(tagEndIdx).toBeGreaterThan(-1);
    const openTag = PANEL.slice(tagStart, tagEndIdx);

    expect(openTag).toMatch(/role="group"/);

    const ariaMatch = openTag.match(/aria-labelledby=\{([\s\S]*)\}\s*$/);
    expect(ariaMatch).not.toBeNull();
    const ariaExpr = ariaMatch![1]!;

    // The group's accessible name is the caption span's id exactly when
    // `activeRules(rules).length > 0`, and stands down (no accessible name
    // via this attribute) with the caption otherwise.
    const ternaryMatch = ariaExpr.match(
      /^activeRules\(rules\)\.length > 0 \? (\w+) : undefined$/,
    );
    expect(ternaryMatch).not.toBeNull();
    expect(ternaryMatch![1]).toBe(idVar);

    // The desktop builder caption carries no id and is referenced by no
    // aria-labelledby anywhere in the file.
    expect(PANEL).not.toMatch(
      /<span className="chq-contacts-filter-rules-caption"[^>]*\bid=/,
    );
  });
});
