// v12m-w16-ui-r2-a (src/decisions-data/DEC-919.md): CSS-text scan for the
// rule builder
// disclosure's four phone declarations
// (`.chq-contacts-filter-rules-row { display: none }`,
// `.chq-contacts-filter-rules-row.is-builder-open { display: flex }`,
// `.chq-contacts-filter-rule-chip-edit`, `.chq-contacts-filter-builder-done`)
// -- all must live inside contacts.css's SINGLE terminal
// `@media (max-width: 700px)` block (DEC-385: narrow overrides wide via
// max-width media queries ONLY, block must be textually terminal --
// mirrors test/phone-terminal-block.scan.test.ts and
// contacts-rule-chips-390.test.ts's own shape), positioned after the
// earlier `.chq-contacts-filter-rules-row` phone rule, with the plain hide
// before the `.is-builder-open` override. The top-level
// `.chq-contacts-filter-builder-done { display: none }` default must sit
// outside every media block. Every authored min-height among the new
// rules must be the 44px floor.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// DEC-374/DEC-613: the ONE string-aware stripper, never a private re-derivation.
import { stripCssComments as stripComments } from '../../../../test/helpers/strip-css-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS = readFileSync(join(HERE, 'contacts.css'), 'utf-8');

const STRIPPED = stripComments(CSS);

/** All `@media (max-width: 700px) { ... }` block bodies (top-level only —
 * this sheet is known to have exactly one). */
function phoneBlocks(css: string): { body: string; startIndex: number; endIndex: number }[] {
  const blocks: { body: string; startIndex: number; endIndex: number }[] = [];
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
    blocks.push({ body: css.slice(bodyStart, i - 1), startIndex: bodyStart, endIndex: i });
  }
  return blocks;
}

const NEW_PHONE_SELECTORS = [
  '.chq-contacts-filter-rules-row {',
  '.chq-contacts-filter-rules-row.is-builder-open {',
  '.chq-contacts-filter-rule-chip-edit {',
  '.chq-contacts-filter-builder-done {',
];

describe('Contacts rule builder disclosure — phone declarations (src/decisions-data/DEC-919.md)', () => {
  it('contacts.css has exactly one terminal phone block', () => {
    const blocks = phoneBlocks(STRIPPED);
    expect(blocks.length).toBe(1);
    const after = STRIPPED.slice(blocks[0]!.endIndex);
    expect(after.trim()).toBe('');
  });

  it('all four new phone rules live inside that block', () => {
    const [block] = phoneBlocks(STRIPPED);
    for (const sel of NEW_PHONE_SELECTORS) {
      expect(block!.body).toContain(sel);
    }
  });

  it('the .is-builder-open rule is positioned after both the plain hide and the earlier flex-direction:column rule', () => {
    const [block] = phoneBlocks(STRIPPED);
    const body = block!.body;
    const earlierColumnIdx = body.indexOf('.chq-contacts-filter-rules-row {\n    flex-direction: column');
    const plainHideIdx = body.indexOf('.chq-contacts-filter-rules-row {\n    display: none;');
    const openIdx = body.indexOf('.chq-contacts-filter-rules-row.is-builder-open {');

    expect(earlierColumnIdx).toBeGreaterThanOrEqual(0);
    expect(plainHideIdx).toBeGreaterThan(earlierColumnIdx);
    expect(openIdx).toBeGreaterThan(plainHideIdx);
  });

  it('no declaration for the new selectors appears anywhere after the phone block closes', () => {
    const blocks = phoneBlocks(STRIPPED);
    const after = STRIPPED.slice(blocks[0]!.endIndex);
    for (const sel of NEW_PHONE_SELECTORS) {
      expect(after).not.toContain(sel);
    }
  });

  it('the top-level `.chq-contacts-filter-builder-done { display: none }` default sits outside every media block', () => {
    const withoutMedia = STRIPPED.replace(/@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g, '');
    const escaped = '.chq-contacts-filter-builder-done'.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`);
    const match = withoutMedia.match(re);
    expect(match).not.toBeNull();
    expect(match![1]!.replace(/\s+/g, ' ').trim()).toBe('display: none;');
  });

  it('every authored min-height in the new phone rules is 44px', () => {
    const [block] = phoneBlocks(STRIPPED);
    const body = block!.body;
    for (const sel of ['.chq-contacts-filter-rule-chip-edit', '.chq-contacts-filter-builder-done']) {
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
});
