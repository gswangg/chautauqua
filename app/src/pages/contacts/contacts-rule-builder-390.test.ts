// DEC-993/DEC-919 (task r1-b): the builder-disclosure phone declarations
// (`.chq-contacts-filter-rules-row` / `.chq-contacts-filter-rules-row.is-
// builder-open` / `.chq-contacts-filter-rule-chip-edit` /
// `.chq-contacts-filter-builder-done`) must all live inside contacts.css's
// SINGLE terminal `@media (max-width: 700px)` block (DEC-385: narrow
// overrides wide via max-width media queries ONLY, and the block must be
// textually terminal -- see test/phone-terminal-block.scan.test.ts), with
// the `.is-builder-open` visibility rule declared AFTER the plain hide
// (equal-specificity ties break by source order), no later top-level rule
// re-declaring `display` for either selector, and every authored
// min-height among the new rules at the 44px floor.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS = readFileSync(join(HERE, 'contacts.css'), 'utf-8');

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

const STRIPPED = stripComments(CSS);

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

const NEW_SELECTORS = [
  '.chq-contacts-filter-rules-row {',
  '.chq-contacts-filter-rules-row.is-builder-open {',
  '.chq-contacts-filter-rule-chip-edit {',
  '.chq-contacts-filter-builder-done {',
];

describe('Contacts rule builder disclosure — phone declarations (DEC-993)', () => {
  it('contacts.css has exactly one terminal phone block', () => {
    const blocks = phoneBlocks(STRIPPED);
    expect(blocks.length).toBe(1);
    const after = STRIPPED.slice(blocks[0]!.endIndex);
    expect(after.trim()).toBe('');
  });

  it('both .chq-contacts-filter-rules-row visibility rules live inside that block', () => {
    const [block] = phoneBlocks(STRIPPED);
    expect(block!.body).toContain('.chq-contacts-filter-rules-row {');
    expect(block!.body).toContain('.chq-contacts-filter-rules-row.is-builder-open {');
  });

  it('the .is-builder-open rule is declared AFTER the plain .chq-contacts-filter-rules-row rule', () => {
    const [block] = phoneBlocks(STRIPPED);
    const body = block!.body;
    const plainIndex = body.indexOf('.chq-contacts-filter-rules-row {');
    const openIndex = body.indexOf('.chq-contacts-filter-rules-row.is-builder-open {');
    expect(plainIndex).toBeGreaterThanOrEqual(0);
    expect(openIndex).toBeGreaterThan(plainIndex);
  });

  it('no later top-level rule re-declares display for either selector', () => {
    const [block] = phoneBlocks(STRIPPED);
    const body = block!.body;
    const openIndex = body.indexOf('.chq-contacts-filter-rules-row.is-builder-open {');
    const openDeclEnd = body.indexOf('}', openIndex);
    const after = body.slice(openDeclEnd + 1);
    // Neither selector should reappear anywhere after the is-builder-open
    // declaration closes -- that declaration is meant to be the LAST word
    // on this pair's visibility in the cascade.
    expect(after).not.toContain('.chq-contacts-filter-rules-row {');
    expect(after).not.toContain('.chq-contacts-filter-rules-row.is-builder-open {');
    // Also verify against the whole sheet outside this block entirely.
    const outsideBlock = STRIPPED.slice(0, STRIPPED.indexOf('@media (max-width: 700px)'));
    const afterBlock = STRIPPED.slice(phoneBlocks(STRIPPED)[0]!.endIndex);
    for (const sheet of [outsideBlock, afterBlock]) {
      expect(sheet).not.toContain('.chq-contacts-filter-rules-row.is-builder-open {');
    }
  });

  it('every new selector declaration lives inside the terminal phone block', () => {
    const [block] = phoneBlocks(STRIPPED);
    for (const sel of NEW_SELECTORS) {
      expect(block!.body).toContain(sel);
    }
  });

  it('no new-rule declaration appears anywhere after the phone block closes', () => {
    const blocks = phoneBlocks(STRIPPED);
    const after = STRIPPED.slice(blocks[0]!.endIndex);
    for (const sel of NEW_SELECTORS) {
      expect(after).not.toContain(sel);
    }
  });

  it('every authored min-height in the new rules is 44px', () => {
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

  it('the desktop default `.chq-contacts-filter-builder-done { display: none }` is declared outside any media block', () => {
    const withoutMedia = STRIPPED.replace(/@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g, '');
    const escaped = '.chq-contacts-filter-builder-done'.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`);
    const match = withoutMedia.match(re);
    expect(match).not.toBeNull();
    expect(match![1]!.replace(/\s+/g, ' ').trim()).toBe('display: none;');
  });
});
