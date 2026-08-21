// task v12m-w16-ui-r4-b (DEC-385 amendment): contacts.css text scan for the
// 390 head band reading as ONE uninterrupted column -- no borrowed shell
// hairline cutting through it, and a uniform 11px rhythm across the seams
// between the band's three top-level siblings. jsdom applies no stylesheet,
// so a computed-style assertion would pass regardless of what the file
// says; this is a source-text scan, not a render test. Shape follows
// contacts-head-band-face-390.test.ts.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// DEC-374/DEC-613: the ONE string-aware stripper, never a private
// re-derivation.
import { stripCssComments as stripComments } from '../../../../test/helpers/strip-css-comments';

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
 * brace, so "single terminal block" and "position within it" can be
 * checked on real source ranges rather than a naive indexOf. */
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

describe('contacts.css 390 head band column (DEC-385 amendment, v12m-w16-ui-r4-b)', () => {
  it('the whole file has exactly one @media (max-width: 700px) block, and it is the file\'s last block', () => {
    expect(BLOCKS.length).toBe(1);
    const last = BLOCKS[0]!;
    const after = STRIPPED.slice(last.end);
    expect(after.trim()).toBe('');
  });

  it('defect 1: the tabstrip-row rule declares BOTH border-top:none and border-bottom:none, so no borrowed shell hairline cuts through the band', () => {
    // docs/design/Chautauqua Contacts.dc.html:180 draws the head band as
    // one column with no internal rules: `flex-direction:column; gap:11px`.
    const last = BLOCKS[0]!;
    const rule = last.body.match(/\.chq-toolbar\.chq-contacts-tabstrip-row\s*\{([^}]*)\}/);
    expect(rule).not.toBeNull();
    const body = rule![1]!;
    expect(body).toMatch(/border-top:\s*none;/);
    expect(body).toMatch(/border-bottom:\s*none;/);
  });

  // docs/design/Chautauqua Contacts.dc.html:180 `gap:11px` -- the frame's
  // uniform band rhythm, restated here at the two seams between the band's
  // three top-level siblings.
  it('defect 2: a phone rule for .chq-contacts-page:has(> .chq-contacts-title-row) exists and declares gap: 11px', () => {
    const last = BLOCKS[0]!;
    expect(last.body).toMatch(
      /\.chq-contacts-page:has\(>\s*\.chq-contacts-title-row\)\s*\{\s*gap:\s*11px;\s*\}/,
    );
  });

  it('the bare .chq-contacts-page phone rule still declares gap: 16px -- the drills\' rhythm is provably NOT moved', () => {
    const last = BLOCKS[0]!;
    expect(last.body).toMatch(/\.chq-contacts-page\s*\{\s*gap:\s*16px;\s*\}/);
  });

  it('the :has() override is positioned AFTER the bare .chq-contacts-page rule (narrow-overrides-wide, DEC-385 single-direction)', () => {
    const last = BLOCKS[0]!;
    const bareIdx = last.body.search(/\.chq-contacts-page\s*\{\s*gap:\s*16px;\s*\}/);
    const hasIdx = last.body.search(
      /\.chq-contacts-page:has\(>\s*\.chq-contacts-title-row\)\s*\{\s*gap:\s*11px;\s*\}/,
    );
    expect(bareIdx).toBeGreaterThanOrEqual(0);
    expect(hasIdx).toBeGreaterThan(bareIdx);
  });

  it('every declaration checked above lives inside the sheet\'s single terminal block, and nothing follows the block', () => {
    const last = BLOCKS[0]!;
    const after = STRIPPED.slice(last.end);
    expect(after).not.toMatch(/\.chq-toolbar\.chq-contacts-tabstrip-row\s*\{/);
    expect(after).not.toMatch(/\.chq-contacts-page:has\(/);
    expect(after).not.toMatch(/\.chq-contacts-page\s*\{/);
    expect(after.trim()).toBe('');
  });

  it('the frame line cited in the appended comments still reads verbatim what is quoted', () => {
    // docs/design/Chautauqua Contacts.dc.html:180 `border-bottom:1px solid
    // #1B1D17; padding:14px 16px; flex-shrink:0; display:flex;
    // flex-direction:column; gap:11px` -- the head band container, drawn
    // as ONE column with a uniform 11px rhythm and no internal rules.
    const line180 = DESIGN_LINES[179]; // 0-indexed
    expect(line180).toContain(
      'border-bottom:1px solid #1B1D17; padding:14px 16px; flex-shrink:0; display:flex; flex-direction:column; gap:11px',
    );
    expect(line180).toContain('gap:11px');
    expect(line180).toContain('border-bottom:1px solid #1B1D17');
  });
});
