// task v12m-w16-ui-r3-a (DEC-937 amendment): contacts.css text scan for the
// 390 head band's closing hairline, drawn as a border-TOP on the body it
// opens (`.chq-contacts-table-wrap`) rather than on the band itself, since
// the band's contents span three parents and no single element can carry
// the band box. jsdom applies no stylesheet, so a computed-style assertion
// would pass regardless of what the file says; this is a source-text scan,
// not a render test, modelled on contacts-head-band-face-390.test.ts.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { stripCssComments } from '../../../../test/helpers/strip-css-comments';

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

const STRIPPED = stripCssComments(CSS);
const BLOCKS = maxWidth700Blocks(STRIPPED);

describe('contacts.css 390 head band closing hairline (DEC-937 amendment, v12m-w16-ui-r3-a)', () => {
  it('the whole file has exactly one @media (max-width: 700px) block, and the new rule lives inside it', () => {
    expect(BLOCKS.length).toBe(1);
    const last = BLOCKS[0]!;
    const after = STRIPPED.slice(last.end);
    expect(after.trim()).toBe('');
    expect(last.body).toMatch(
      /\.chq-contacts-table-wrap\s*\{\s*margin-inline:\s*-16px;\s*padding-inline:\s*16px;\s*padding-top:\s*4px;\s*border-top:\s*1px solid var\(--chq-ink\);\s*\}/,
    );
  });

  it('the new rule is positioned after every earlier `.chq-contacts-table-wrap {` rule in the block', () => {
    const last = BLOCKS[0]!;
    const allIdxs = [...last.body.matchAll(/\.chq-contacts-table-wrap\s*\{/g)].map((m) => m.index!);
    // At least the earlier `{ gap: 16px }` rule plus this new rule.
    expect(allIdxs.length).toBeGreaterThanOrEqual(2);
    const newRuleIdx = last.body.search(/\.chq-contacts-table-wrap\s*\{\s*margin-inline:\s*-16px;/);
    expect(newRuleIdx).toBeGreaterThanOrEqual(0);
    const earlierIdxs = allIdxs.filter((i) => i !== newRuleIdx);
    expect(earlierIdxs.length).toBeGreaterThanOrEqual(1);
    expect(newRuleIdx).toBeGreaterThan(Math.max(...earlierIdxs));
  });

  it('no `.chq-contacts-table-wrap {` declaration appears anywhere after the block closes', () => {
    const last = BLOCKS[0]!;
    const after = STRIPPED.slice(last.end);
    expect(after).not.toMatch(/\.chq-contacts-table-wrap\s*\{/);
  });

  it('the top-level desktop .chq-contacts-table-wrap rule is byte-unchanged', () => {
    expect(CSS).toMatch(
      /\.chq-contacts-table-wrap \{\n {2}display: flex;\n {2}flex-direction: column;\n {2}gap: 14px;\n\}/,
    );
  });

  it('the two frame lines cited in the appended comment still read verbatim what is quoted', () => {
    // docs/design/Chautauqua Contacts.dc.html:180 -- the head band
    // container, closed by a hairline: `border-bottom:1px solid #1B1D17;
    // padding:14px 16px; flex-shrink:0; display:flex; flex-direction:column;
    // gap:11px`.
    const line180 = DESIGN_LINES[179]; // 0-indexed
    expect(line180).toContain(
      'border-bottom:1px solid #1B1D17; padding:14px 16px; flex-shrink:0; display:flex; flex-direction:column; gap:11px',
    );

    // docs/design/Chautauqua Contacts.dc.html:201 -- the scrolling body
    // opened immediately beneath the band: `flex:1; min-height:0;
    // overflow-y:auto; padding:4px 16px 16px`.
    const line201 = DESIGN_LINES[200]; // 0-indexed
    expect(line201).toContain('flex:1; min-height:0; overflow-y:auto; padding:4px 16px 16px');
  });
});
