// task v12m-w16-ui-r3-c (DEC-919 amendment: "THE RULE CHIP STATES ITS RULE
// SHORT"): contacts.css text scan bounding `.chq-contacts-filter-rule-chip-
// edit`'s label width at 390 so a long unbounded `ruleChipLabel()` string
// cannot push the `+ Rule` chip and every other active rule past the
// strip's horizon. jsdom applies no stylesheet, so a computed-style
// assertion would pass regardless of what the file says; this is a
// source-text scan, not a render test, modelled on
// contacts-head-band-face-390.test.ts.
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

describe('contacts.css rule-chip label bound at 390 (DEC-919 amendment, v12m-w16-ui-r3-c)', () => {
  it('the whole file has exactly one @media (max-width: 700px) block, and the bound rule lives inside it', () => {
    expect(BLOCKS.length).toBe(1);
    const last = BLOCKS[0]!;
    expect(last.body).toMatch(
      /\.chq-contacts-filter-rule-chip-edit\s*\{\s*max-width:\s*46vw;\s*min-width:\s*0;\s*overflow:\s*hidden;\s*text-overflow:\s*ellipsis;\s*white-space:\s*nowrap;\s*\}/,
    );
  });

  it('the bound rule is positioned AFTER every earlier .chq-contacts-filter-rule-chip-edit rule in the block', () => {
    const last = BLOCKS[0]!;
    const editIdxs = [...last.body.matchAll(/\.chq-contacts-filter-rule-chip-edit\s*\{/g)].map(
      (m) => m.index!,
    );
    // The earlier phone rule (min-height/flex/type register) plus this
    // bound rule -- at least two occurrences of the selector.
    expect(editIdxs.length).toBeGreaterThanOrEqual(2);
    const boundIdx = last.body.search(
      /\.chq-contacts-filter-rule-chip-edit\s*\{\s*max-width:\s*46vw;/,
    );
    expect(boundIdx).toBeGreaterThanOrEqual(Math.max(...editIdxs));
  });

  it('white-space: nowrap, overflow and text-overflow all appear together in the bound rule\'s own body', () => {
    const last = BLOCKS[0]!;
    const boundMatch = last.body.match(
      /\.chq-contacts-filter-rule-chip-edit\s*\{([^}]*max-width:\s*46vw;[^}]*)\}/,
    );
    expect(boundMatch).not.toBeNull();
    const body = boundMatch![1]!;
    expect(body).toMatch(/white-space:\s*nowrap;/);
    expect(body).toMatch(/overflow:\s*hidden;/);
    expect(body).toMatch(/text-overflow:\s*ellipsis;/);
  });

  it('no .chq-contacts-filter-rule-chip-edit declaration appears after the terminal block closes', () => {
    const last = BLOCKS[0]!;
    const after = STRIPPED.slice(last.end);
    expect(after).not.toMatch(/\.chq-contacts-filter-rule-chip-edit\s*\{/);
  });

  it('the earlier phone .chq-contacts-filter-rule-chip-edit rule (min-height/flex/type register) is untouched', () => {
    expect(CSS).toMatch(
      /\.chq-contacts-filter-rule-chip-edit \{\n {4}min-height: 44px;\n {4}display: flex;\n {4}align-items: center;\n {4}padding-inline: 4px;\n {4}margin-inline: -4px;\n {4}border: none;\n {4}background: none;\n {4}font-family: inherit;\n {4}font-size: 13px;\n {4}font-weight: 600;\n {4}color: inherit;\n {2}\}/,
    );
  });

  it('the frame lines cited in the appended comment still read verbatim what is quoted', () => {
    // docs/design/Chautauqua Contacts.dc.html:187 `display:flex; gap:7px;
    // overflow-x:auto; -webkit-overflow-scrolling:touch` -- the strip.
    const line187 = DESIGN_LINES[186]; // 0-indexed
    expect(line187).toContain(
      'display:flex; gap:7px; overflow-x:auto; -webkit-overflow-scrolling:touch',
    );

    // docs/design/Chautauqua Contacts.dc.html:190 `border:1px solid
    // #4E5C31; background:#EFF1E4; color:#2E3A16; border-radius:4px;
    // min-height:44px; display:flex; align-items:center; gap:9px;
    // padding:0 12px; font-size:13px; font-weight:600` -- the rule chip.
    const line190 = DESIGN_LINES[189]; // 0-indexed
    expect(line190).toContain(
      'border:1px solid #4E5C31; background:#EFF1E4; color:#2E3A16; border-radius:4px; min-height:44px; display:flex; align-items:center; gap:9px; padding:0 12px; font-size:13px; font-weight:600',
    );
  });
});
