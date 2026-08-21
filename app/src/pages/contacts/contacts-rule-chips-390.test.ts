// src/decisions-data/DEC-919.md: the rule chip strip's four phone declarations
// (`.chq-contacts-filter-chipstrip`, `.chq-contacts-filter-chipstrip > *`,
// `.chq-contacts-filter-chipstrip-caption`, `.chq-contacts-filter-rule-chip`,
// `.chq-contacts-filter-rule-chip-dismiss`) must all live inside contacts.css's
// SINGLE terminal `@media (max-width: 700px)` block (DEC-385: narrow
// overrides wide via max-width media queries ONLY, and the block must be
// textually terminal -- see test/phone-terminal-block.scan.test.ts), every
// authored min-height among them must be the 44px floor, and the desktop
// default that hides the strip must be a bare top-level rule, outside any
// media block.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { stripCssComments } from '../../../../test/helpers/strip-css-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS = readFileSync(join(HERE, 'contacts.css'), 'utf-8');

const STRIPPED = stripCssComments(CSS);

/** All `@media (max-width: 700px) { ... }` block bodies (top-level only —
 * this sheet is known to have exactly one, per phone-terminal-block.scan). */
function phoneBlocks(css: string): { body: string; endIndex: number }[] {
  const blocks: { body: string; endIndex: number }[] = [];
  const headerRe = /@media\s*\(max-width:\s*700px\)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = headerRe.exec(css))) {
    let depth = 1;
    let i = m.index + m[0].length;
    const bodyStart = i;
    while (depth > 0 && i < css.length) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') depth--;
      i++;
    }
    blocks.push({ body: css.slice(bodyStart, i - 1), endIndex: i });
  }
  return blocks;
}

const RULE_CHIP_SELECTORS = [
  '.chq-contacts-filter-chipstrip {',
  '.chq-contacts-filter-chipstrip > * {',
  '.chq-contacts-filter-chipstrip-caption {',
  '.chq-contacts-filter-rule-chip {',
  '.chq-contacts-filter-rule-chip-dismiss {',
];

describe('Contacts rule chip strip — phone declarations (src/decisions-data/DEC-919.md)', () => {
  it('contacts.css has exactly one terminal phone block', () => {
    const blocks = phoneBlocks(STRIPPED);
    expect(blocks.length).toBe(1);
    const after = STRIPPED.slice(blocks[0]!.endIndex);
    expect(after.trim()).toBe('');
  });

  it('every chip-strip rule declaration lives inside that block', () => {
    const [block] = phoneBlocks(STRIPPED);
    for (const sel of RULE_CHIP_SELECTORS) {
      expect(block!.body).toContain(sel);
    }
  });

  it('no chip-strip declaration appears anywhere after the phone block closes', () => {
    const blocks = phoneBlocks(STRIPPED);
    const after = STRIPPED.slice(blocks[0]!.endIndex);
    for (const sel of RULE_CHIP_SELECTORS) {
      expect(after).not.toContain(sel);
    }
  });

  it('every authored min-height in the chip-strip phone rules is 44px', () => {
    const [block] = phoneBlocks(STRIPPED);
    const body = block!.body;
    // Extract each selector's own declaration body and check min-height.
    for (const sel of ['.chq-contacts-filter-chipstrip-caption', '.chq-contacts-filter-rule-chip', '.chq-contacts-filter-rule-chip-dismiss']) {
      const escaped = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`);
      const match = body.match(re);
      expect(match).not.toBeNull();
      const decl = match![1]!;
      const heightMatch = decl.match(/min-height:\s*([^;]+);/);
      expect(heightMatch).not.toBeNull();
      expect(heightMatch![1]!.trim()).toBe('44px');
    }
  });

  it('the desktop default `.chq-contacts-filter-chipstrip { display: none }` is declared outside any media block', () => {
    const withoutMedia = STRIPPED.replace(/@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g, '');
    const escaped = '.chq-contacts-filter-chipstrip'.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`);
    const match = withoutMedia.match(re);
    expect(match).not.toBeNull();
    expect(match![1]!.replace(/\s+/g, ' ').trim()).toBe('display: none;');
  });
});
