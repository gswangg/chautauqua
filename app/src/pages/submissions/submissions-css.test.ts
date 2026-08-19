// v12 mobile campaign wave 6 (task w6-f), superseding the wave-2 DEC-919
// interpretation this test file previously pinned. Frame docs/design/
// Chautauqua Submissions.dc.html:137-152 (further citations name any line
// in :137-:180, the frame's extent) draws the phone head as an H1+summary
// baseline, a full-width 44px search field on its own line, then a 7px-gap
// horizontally scrolling chip strip. DESIGN-RULINGS' governing principle
// -- a 390 frame keeps the desktop design's CAPABILITIES, nothing is
// deleted at phone width -- means the frame's anatomy is honoured by
// RE-LINING, not by hiding the sort select, the track select, the
// ColumnPicker, or any status pill beyond the two named in the frame's
// copy. Only the 'Status' caption and the hairline divider (chrome, not a
// capability) go away. jsdom applies no external stylesheet's @media rule
// (mirrors detail-css.test.ts's own note), so this reads submissions.css's
// own text.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = join(HERE, 'submissions.css');
const CSS = readFileSync(CSS_PATH, 'utf-8');

/** Brace-matches every `@media (max-width: 700px) { ... }` block and
 * concatenates their bodies -- mirrors phone-page-scaffold.test.ts's own
 * phoneLayer helper rather than assuming a fixed count. DEC-385 (wave-100/
 * 102/103) forbids more than one top-level phone block per sheet; task
 * w3-l forward-merged submissions.css's four blocks into its single
 * terminal block, so this now matches exactly one, unchanged behaviour. */
function phoneLayer(css: string): string {
  const out: string[] = [];
  const opener = /@media\s*\(max-width:\s*700px\)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = opener.exec(css)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') depth -= 1;
      i += 1;
    }
    out.push(css.slice(start, i - 1));
  }
  return out.join('\n');
}

const PHONE = phoneLayer(CSS);

describe('submissions.css phone head re-lining (DEC-919 wave-7 amendment)', () => {
  it('hides the Status caption, the filterbar divider and the ColumnPicker -- chrome, a label, and the one control DEC-919 allows to vanish (nothing left to govern once the table stacks)', () => {
    expect(PHONE).toMatch(/\.chq-submissions-status-label,[\s\S]{0,400}display:\s*none/);
    expect(PHONE).toMatch(/\.chq-submissions-filterbar-divider,[\s\S]{0,400}display:\s*none/);
    expect(PHONE).toMatch(/\.chq-submissions-columnpicker[\s\S]{0,400}display:\s*none/);
  });

  // docs/design/Chautauqua Submissions.dc.html:147
  // `min-height:44px; display:flex; align-items:center; padding:0 13px`
  // -- the search field is a full-width 44px control on its own line.
  it('re-lines the search+sort row into a column so the search field spans the measure on its own line', () => {
    expect(PHONE).toMatch(/\.chq-submissions-filterbar-searchsort\s*\{[^}]*flex-direction:\s*column/);
  });

  // DEC-919 wave-7: sorting is a capability the frame never removes, and the
  // strip it sits in already scrolls -- so the Sort select re-lines at the
  // 44px floor instead of vanishing.
  it('never hides the Sort select', () => {
    expect(PHONE).not.toMatch(
      /\.chq-submissions-filterbar-searchsort \.chq-submissions-filterbar-sort-select[\s\S]{0,400}display:\s*none/,
    );
  });

  it('never hides the sort select or the track select at phone width -- both govern data still on screen, so they re-line rather than vanish (the ColumnPicker is the one sanctioned hide, DEC-919 wave 7 / DEVIATIONS.md)', () => {
    expect(PHONE).not.toMatch(/\.chq-submissions-filterbar-searchsort \.chq-submissions-filterbar-sort-select[\s\S]{0,200}display:\s*none/);
    expect(PHONE).not.toMatch(/\.chq-submissions-filterbar \.chq-submissions-filterbar-select[\s\S]{0,200}display:\s*none/);
  });

  it('never narrows the status-pill population by data-status -- every pill stays in the scrolling strip', () => {
    expect(PHONE).not.toMatch(/\.chq-status-pills \[data-status\][^{]*:not\(/);
  });

  // docs/design/Chautauqua Submissions.dc.html:148
  // `display:flex; gap:7px; overflow-x:auto`
  // -- three status pills only (no ColumnPicker, DEC-919 wave-92/102).
  it('keeps .chq-submissions-filterbar as one horizontally scrolling strip (status pills + track select) at the 44px floor', () => {
    expect(PHONE).toMatch(/\.chq-submissions-filterbar,[\s\S]{0,200}overflow-x:\s*auto/);
    expect(PHONE).toMatch(/\.chq-submissions-filterbar-select\s*\{[^}]*min-height:\s*44px/);
    expect(PHONE).toMatch(/\.chq-submissions-columnpicker > summary\s*\{[^}]*min-height:\s*44px/);
  });

  it('desktop keeps every control (no display:none for these selectors outside a media block)', () => {
    const withoutMedia = CSS.replace(/@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g, '');
    expect(withoutMedia).not.toMatch(/\.chq-submissions-status-label\s*\{[^}]*display:\s*none/);
    expect(withoutMedia).not.toMatch(/\.chq-submissions-columnpicker\s*\{[^}]*display:\s*none/);
  });
});
