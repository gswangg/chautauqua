// task r1-d (DEC-995): contacts.css text scan for the phone head band's
// `N of M` counter. Six rules land inside the file's LAST (terminal)
// `@media (max-width: 700px)` block per DEC-385 (single-direction, one
// terminal block -- test/phone-terminal-block.scan.test.ts owns the
// file-wide "one terminal block" invariant; this file only checks THESE
// six rules' position within it) plus one desktop default outside every
// media block.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { stripCssComments as stripComments } from '../../../../test/helpers/strip-css-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = join(HERE, 'contacts.css');
const CSS = readFileSync(CSS_PATH, 'utf-8');

/** Byte offsets of every `@media (max-width: 700px) {` opener in the
 * (comment-stripped) source, paired with the offset of its matching closing
 * brace, so "last terminal block" and "position within it" can be checked
 * on real source ranges rather than a naive indexOf. */
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

const STRIPPED = stripComments(CSS);
const BLOCKS = maxWidth700Blocks(STRIPPED);

describe('contacts.css phone head band (DEC-995)', () => {
  it('has at least one max-width:700px block, and the six new rules all live inside the LAST one', () => {
    expect(BLOCKS.length).toBeGreaterThan(0);
    const last = BLOCKS[BLOCKS.length - 1]!;

    const mustBeInLastBlock = [
      '.chq-contacts-title-row { display:grid; grid-template-columns: 1fr auto; align-items: baseline; }',
    ];
    // The literal spacing in the source may differ from the task prose;
    // check by selector presence + declaration substrings instead of one
    // exact string.
    expect(last.body).toMatch(/\.chq-contacts-title-row\s*\{\s*display:\s*grid;/);
    expect(last.body).toMatch(/grid-template-columns:\s*1fr auto;/);
    expect(last.body).toMatch(/\.chq-contacts-title-actions\s*\{\s*grid-column:\s*1\s*\/\s*-1;/);
    expect(last.body).toMatch(/\.chq-contacts-head-count\s*\{[^}]*display:\s*block;/);
    expect(last.body).toMatch(/\.chq-contacts-title-row \.chq-summary\s*\{\s*display:\s*none;/);
    // .chq-contacts-filter-match-count's hide (a SECOND declaration of the
    // same selector, later in the block, superseding only visibility).
    const matchCountRules = [...last.body.matchAll(/\.chq-contacts-filter-match-count\s*\{([^}]*)\}/g)];
    expect(matchCountRules.length).toBeGreaterThanOrEqual(2);
    expect(matchCountRules.at(-1)![1]).toMatch(/display:\s*none;/);
    expect(last.body).toMatch(/\.chq-contacts-tab-filters\s*\{\s*order:\s*-1;/);

    void mustBeInLastBlock; // documents intent; matched via the regex assertions above
  });

  it('the grid .chq-contacts-title-row rule is positioned AFTER the earlier column-flex rule for the same selector, in the same (last) block', () => {
    const last = BLOCKS[BLOCKS.length - 1]!;
    const flexIdx = last.body.search(/\.chq-contacts-title-row\s*\{\s*flex-direction:\s*column;/);
    const gridIdx = last.body.search(/\.chq-contacts-title-row\s*\{\s*display:\s*grid;/);
    expect(flexIdx).toBeGreaterThanOrEqual(0);
    expect(gridIdx).toBeGreaterThan(flexIdx);
  });

  it('.chq-summary is never declared as a bare top-level selector anywhere in this file (it is a SHELL token, never redefined here) -- only ever appears as a descendant of this page\'s own ancestor class', () => {
    // Walk every rule's selector list (split on commas across the whole
    // file) and check each individual selector -- a compound descendant
    // selector like `.chq-contacts-title-row .chq-summary` is fine (that's
    // exactly the scoped hide this task adds); only a selector that IS
    // exactly `.chq-summary` on its own is forbidden.
    const ruleRe = /([^{}]+)\{[^{}]*\}/g;
    const bareOffenders: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = ruleRe.exec(STRIPPED)) !== null) {
      const selectors = m[1]!
        .split(',')
        .map((s) => s.trim());
      for (const sel of selectors) {
        if (sel === '.chq-summary') bareOffenders.push(sel);
      }
    }
    expect(bareOffenders).toEqual([]);
  });

  it('the desktop .chq-contacts-head-count { display: none; } default sits outside every media block', () => {
    for (const block of BLOCKS) {
      expect(block.body).not.toMatch(/\.chq-contacts-head-count\s*\{\s*display:\s*none;\s*\}/);
    }
    // And it does exist somewhere in the file (outside all blocks, so its
    // start offset falls between/after blocks -- checked by excluding all
    // block ranges from the search).
    let outside = STRIPPED;
    for (const block of [...BLOCKS].sort((a, b) => b.start - a.start)) {
      outside = outside.slice(0, block.start) + outside.slice(block.end);
    }
    expect(outside).toMatch(/\.chq-contacts-head-count\s*\{\s*display:\s*none;\s*\}/);
  });

  it('no .chq-contacts-head-count declaration appears after the (last) block closes', () => {
    const last = BLOCKS[BLOCKS.length - 1]!;
    const after = STRIPPED.slice(last.end);
    expect(after).not.toMatch(/\.chq-contacts-head-count\s*\{/);
  });
});
