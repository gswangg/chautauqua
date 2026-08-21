// w17-c (DEC-825): receipts for the two Content 390 frame gaps this task
// closes -- (1) the worklist card's `{{ row.speaker }} · {{ row.file }},
// {{ row.when }}` meta line, which the terminal max-width:700px block used
// to reach with a two-column grid + 48%-clamp DEVIATION, now reached with a
// wrapping flex line-box instead; (2) the Files header's now-doubled
// "Download all" control, which content.css's terminal block now RE-LINES
// away (hides the header wrap, keeps the identical footer-dock control).
//
// DEC-967 shape (verbatimLine): read the ACTUAL design-file line, assert it
// byte-for-byte, THEN assert the CSS -- copied from
// DeliverableDetail.stack-390.render.test.tsx's own helpers. A fresh file,
// not an extension of content-phone-frames.test.ts (task scope).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Content.dc.html');
const CSS_FILE = join(HERE, 'content.css');

/** DEC-967 shape: read the ACTUAL line, assert it byte-for-byte matches the
 * literal this file claims -- copied from DeliverableDetail.stack-390
 * .render.test.tsx's own `verbatimLine`. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

/** content.css's ONE terminal `@media (max-width: 700px)` block --
 * brace-matched, LAST occurrence (the file has exactly one such block; the
 * "terminal" qualifier matches DeliverableDetail.stack-390.render.test.tsx's
 * own `phoneBlock` / ContentApp.worklist-390.render.test.tsx's
 * `contentPhoneBlock`). */
function phoneBlock(): string {
  const source = readFileSync(CSS_FILE, 'utf-8');
  const open = source.lastIndexOf('@media (max-width: 700px) {');
  expect(open).toBeGreaterThan(-1);
  const bodyStart = source.indexOf('{', open) + 1;
  let depth = 1;
  let i = bodyStart;
  for (; i < source.length && depth > 0; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') depth--;
  }
  return source.slice(bodyStart, i - 1);
}

/** Every matching rule body concatenated, never just the first -- a
 * selector can legitimately be declared more than once inside the one
 * terminal block (DeliverableDetail.stack-390.render.test.tsx's own
 * `phoneRule` precedent). */
function phoneRule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = [...css.matchAll(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`, 'g'))];
  expect(matches.length, `no phone rule for \`${selector}\``).toBeGreaterThan(0);
  return matches.map((m) => m[1]).join('\n');
}

describe('content.css 390: worklist meta line is a wrapping flex line-box, not the old grid + 48% clamp (w17-c, DEC-825)', () => {
  const ROW = '.chq-content-worklist .chq-content-table tr.chq-content-row';

  it('frame citation: :220 draws the meta as ONE line, `{{ row.speaker }} · {{ row.file }}, {{ row.when }}`', () => {
    verbatimLine(
      220,
      '            <span style="font-size:13px; color:#565A4B; line-height:1.5">{{ row.speaker }} · {{ row.file }}, {{ row.when }}</span>',
    );
  });

  it('the row is a wrapping flex line-box, not a grid', () => {
    const body = phoneRule(phoneBlock(), ROW);
    expect(body).toMatch(/display:\s*flex/);
    expect(body).toMatch(/flex-wrap:\s*wrap/);
    expect(body).not.toMatch(/display:\s*grid/);
    expect(body).not.toMatch(/grid-template-columns/);
  });

  it('every cell is placed with order + flex, never grid-row/grid-column', () => {
    const body = phoneBlock();
    for (const n of [1, 2, 3, 4, 5, 6]) {
      const cell = phoneRule(body, `${ROW} > td:nth-child(${n})`);
      expect(cell, `td:nth-child(${n})`).not.toMatch(/grid-row/);
      expect(cell, `td:nth-child(${n})`).not.toMatch(/grid-column/);
    }
    expect(phoneRule(body, `${ROW} > td:nth-child(1)`)).toMatch(/order:\s*1/);
    expect(phoneRule(body, `${ROW} > td:nth-child(1)`)).toMatch(/flex:\s*0 0 auto/);
    expect(phoneRule(body, `${ROW} > td:nth-child(5)`)).toMatch(/order:\s*2/);
    expect(phoneRule(body, `${ROW} > td:nth-child(5)`)).toMatch(/flex:\s*1 1 auto/);
    expect(phoneRule(body, `${ROW} > td:nth-child(2)`)).toMatch(/order:\s*3/);
    expect(phoneRule(body, `${ROW} > td:nth-child(2)`)).toMatch(/flex:\s*0 0 100%/);
    expect(phoneRule(body, `${ROW} > td:nth-child(3)`)).toMatch(/order:\s*4/);
    expect(phoneRule(body, `${ROW} > td:nth-child(3)`)).toMatch(/flex:\s*0 1 auto/);
    expect(phoneRule(body, `${ROW} > td:nth-child(4)`)).toMatch(/order:\s*5/);
    expect(phoneRule(body, `${ROW} > td:nth-child(4)`)).toMatch(/flex:\s*0 1 auto/);
    expect(phoneRule(body, `${ROW} > td:nth-child(6)`)).toMatch(/order:\s*6/);
    expect(phoneRule(body, `${ROW} > td:nth-child(6)`)).toMatch(/flex:\s*0 0 100%/);
  });

  it('drops the 48% clamps the grid-era layout forced on speaker and latest-file', () => {
    const body = phoneBlock();
    const speaker = phoneRule(body, `${ROW} > td:nth-child(3)`);
    const file = phoneRule(body, `${ROW} > td:nth-child(4)`);
    expect(speaker).not.toMatch(/48%/);
    expect(file).not.toMatch(/48%/);
    expect(speaker).not.toMatch(/justify-self/);
    expect(file).not.toMatch(/justify-self/);
  });

  it('keeps the `·` separator as punctuation with no trailing space, no letter (phone-label-source.scan.test.ts)', () => {
    const body = phoneBlock();
    const sep = phoneRule(body, `${ROW} > td:nth-child(4)::before`);
    expect(sep).toMatch(/content:\s*'·'/);
    expect(sep).not.toMatch(/content:\s*'· '/);
  });

  it('the selecting-mode override still hides/shows nth-child(1)/(6) by display alone, cascading over the same order/flex base', () => {
    const body = phoneBlock();
    const restSelect = phoneRule(body, `${ROW} > td:nth-child(1)`);
    expect(restSelect).toMatch(/order:\s*1/);
    // Concatenated across all declarations for this selector in the block:
    // the base order/flex rule AND the later rest-state display:none.
    expect(restSelect).toMatch(/display:\s*none/);

    const selectingTick = phoneRule(
      body,
      '.chq-content-worklist-selecting .chq-content-table tr.chq-content-row > td:nth-child(1)',
    );
    expect(selectingTick).toMatch(/display:\s*flex/);

    const selectingActions = phoneRule(
      body,
      '.chq-content-worklist-selecting .chq-content-table tr.chq-content-row > td:nth-child(6)',
    );
    expect(selectingActions).toMatch(/display:\s*none/);
  });
});

describe('content.css 390: Files header "Download all" is RE-LINED to the footer dock alone, never doubled (w17-c, DEC-825)', () => {
  it('frame citation: :360 the footer dock\'s "Download all" primary button, min-height:48px', () => {
    verbatimLine(
      360,
      '        <span style="flex:1; background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:48px; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700">Download all</span>',
    );
  });

  it('frame citation: :342 the header row draws only the file/size summary, no download-all control -- the frame reserves the capability for the dock alone', () => {
    verbatimLine(342, '        <span style="font-size:13px; color:#565A4B">31 files · 412 MB</span>');
  });

  it('hides the header\'s whole download-all wrap at 390, not just its button', () => {
    const body = phoneRule(phoneBlock(), '.chq-content-files-download-all-wrap');
    expect(body).toMatch(/display:\s*none/);
  });

  it('the comment names the dock control that carries the capability, RE-LINED idiom', () => {
    const source = readFileSync(CSS_FILE, 'utf-8');
    const open = source.lastIndexOf('@media (max-width: 700px) {');
    const commentStart = source.lastIndexOf(
      '/*',
      source.indexOf('.chq-content-files-download-all-wrap {\n    align-items: stretch;\n    display: none;', open),
    );
    const commentEnd = source.indexOf('*/', commentStart) + 2;
    const comment = source.slice(commentStart, commentEnd);
    expect(comment).toMatch(/RE-LINED, not removed/);
    expect(comment).toMatch(/chq-phone-dock/);
    expect(comment).toMatch(/chq-btn-primary/);
  });
});
