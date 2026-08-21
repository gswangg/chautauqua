// task v12m-w16-ui-r2-d (DEC-937): contacts.css text scan for the 390 head
// band's own face -- an 11px single-column rhythm with no internal rules,
// matching the frame's head-band and search-box lines (cited with quote +
// expect() below). jsdom applies no stylesheet, so a computed-style
// assertion would pass regardless of what the file says; this is a
// source-text scan, not a render test.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = join(HERE, 'contacts.css');
const DESIGN_PATH = join(
  HERE,
  '..',
  '..',
  '..',
  '..',
  'docs',
  'design',
  'Chautauqua Contacts.dc.html',
);
const CSS = readFileSync(CSS_PATH, 'utf-8');
const DESIGN = readFileSync(DESIGN_PATH, 'utf-8');
const DESIGN_LINES = DESIGN.split('\n');

/** Strip comments so a selector mentioned only in prose can't false-match. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

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

describe('contacts.css 390 head band face (DEC-937, v12m-w16-ui-r2-d)', () => {
  it('the whole file has exactly one @media (max-width: 700px) block, and it is the file\'s last block', () => {
    expect(BLOCKS.length).toBe(1);
    const last = BLOCKS[0]!;
    // Nothing meaningful (a selector or declaration) follows the block's
    // closing brace -- only whitespace/newlines to end of file.
    const after = STRIPPED.slice(last.end);
    expect(after.trim()).toBe('');
  });

  it('all four appended rules live inside the terminal block', () => {
    const last = BLOCKS[0]!;
    expect(last.body).toMatch(/\.chq-contacts-title-row\s*\{\s*gap:\s*11px;\s*\}/);
    expect(last.body).toMatch(
      /\.chq-toolbar\.chq-contacts-tabstrip-row\s*\{\s*border-top:\s*none;\s*padding-block:\s*0;\s*gap:\s*11px;\s*\}/,
    );
    expect(last.body).toMatch(/\.chq-contacts-directory-main\s*\{\s*gap:\s*11px;\s*\}/);
    expect(last.body).toMatch(/\.chq-contacts-search\s*\{\s*font-size:\s*14px;\s*\}/);
  });

  it('each of the four rules is positioned AFTER every earlier rule for the same selector within the block', () => {
    const last = BLOCKS[0]!;

    const titleRowIdxs = [...last.body.matchAll(/\.chq-contacts-title-row\s*\{/g)].map((m) => m.index!);
    expect(titleRowIdxs.length).toBeGreaterThanOrEqual(1);
    const titleRowGapIdx = last.body.search(/\.chq-contacts-title-row\s*\{\s*gap:\s*11px;\s*\}/);
    expect(titleRowGapIdx).toBeGreaterThanOrEqual(Math.max(...titleRowIdxs));

    const directoryMainIdxs = [...last.body.matchAll(/\.chq-contacts-directory-main\s*\{/g)].map(
      (m) => m.index!,
    );
    expect(directoryMainIdxs.length).toBeGreaterThanOrEqual(1);
    const directoryMainGapIdx = last.body.search(/\.chq-contacts-directory-main\s*\{\s*gap:\s*11px;\s*\}/);
    expect(directoryMainGapIdx).toBeGreaterThanOrEqual(Math.max(...directoryMainIdxs));

    const searchIdxs = [...last.body.matchAll(/\.chq-contacts-search\s*\{/g)].map((m) => m.index!);
    expect(searchIdxs.length).toBeGreaterThanOrEqual(1);
    const searchFontIdx = last.body.search(/\.chq-contacts-search\s*\{\s*font-size:\s*14px;\s*\}/);
    expect(searchFontIdx).toBeGreaterThanOrEqual(Math.max(...searchIdxs));

    // .chq-toolbar.chq-contacts-tabstrip-row is new -- no earlier rule for
    // this exact compound selector should exist ahead of it.
    const compoundIdxs = [...last.body.matchAll(/\.chq-toolbar\.chq-contacts-tabstrip-row\s*\{/g)].map(
      (m) => m.index!,
    );
    expect(compoundIdxs.length).toBe(1);
  });

  it('no declaration for any of the four selectors appears anywhere after the block closes (the cascade trap)', () => {
    const last = BLOCKS[0]!;
    const after = STRIPPED.slice(last.end);
    expect(after).not.toMatch(/\.chq-contacts-title-row\s*\{/);
    expect(after).not.toMatch(/\.chq-toolbar\.chq-contacts-tabstrip-row\s*\{/);
    expect(after).not.toMatch(/\.chq-contacts-directory-main\s*\{/);
    expect(after).not.toMatch(/\.chq-contacts-search\s*\{/);
  });

  it('the top-level desktop .chq-contacts-directory-main rule (gap: 14px) is byte-unchanged', () => {
    expect(CSS).toMatch(
      /\.chq-contacts-directory-main \{\n {2}display: flex;\n {2}flex-direction: column;\n {2}gap: 14px;\n {2}min-width: 0;\n\}/,
    );
  });

  it('the top-level desktop .chq-contacts-search rule (min-width: 280px) is byte-unchanged', () => {
    expect(CSS).toMatch(/\.chq-contacts-search \{\n {2}min-width: 280px;\n\}/);
  });

  it('the frame lines cited in the appended comments still read verbatim what is quoted', () => {
    // docs/design/Chautauqua Contacts.dc.html:180 `border-bottom:1px solid
    // #1B1D17; padding:14px 16px; flex-shrink:0; display:flex;
    // flex-direction:column; gap:11px` -- the head band container.
    const line180 = DESIGN_LINES[179]; // 0-indexed
    expect(line180).toContain(
      'border-bottom:1px solid #1B1D17; padding:14px 16px; flex-shrink:0; display:flex; flex-direction:column; gap:11px',
    );

    // docs/design/Chautauqua Contacts.dc.html:186 `border:1px solid
    // #BAB6A6; border-radius:6px; min-height:44px; display:flex;
    // align-items:center; padding:0 13px; font-size:14px; color:#565A4B;
    // background:#FAF8F2` -- the search box.
    const line186 = DESIGN_LINES[185]; // 0-indexed
    expect(line186).toContain(
      'border:1px solid #BAB6A6; border-radius:6px; min-height:44px; display:flex; align-items:center; padding:0 13px; font-size:14px; color:#565A4B; background:#FAF8F2',
    );
  });
});
