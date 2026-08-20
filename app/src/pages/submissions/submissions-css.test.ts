// v12 mobile campaign wave 110 (task v12m-w6-d, DEC-919 amendment),
// superseding the wave-6 (task w6-f) interpretation this test file
// previously pinned. The Submissions 390 frame's :137-152 head (cited by
// path+line, quoted and receipted at each it() below -- a file-header
// citation can carry no expect(, DEC-976 wave-87) draws: wordmark row,
// title row (H1 + summary on a shared baseline), ONE 44px search box on
// its own line (:147), then ONE 7px-gap horizontally scrolling strip of
// exactly three 44px chips (:148-151 'Needs triage' filled / 'Accepted' /
// 'All 47') -- "Nothing else". That is a NARROWER anatomy than wave-6/7's "re-line, never remove"
// reading: this amendment explicitly reverses it for this screen -- the
// saved-views strip and the sort/track selects have no line left in the
// frame and are stood down (each with its own DEC-919 wave-96
// capability-removal receipt, app/src/phone-capability-removal.scan.test.ts)
// rather than re-lined. jsdom applies no external stylesheet's @media rule
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

describe('submissions.css phone head re-lining (DEC-919 wave-110 amendment)', () => {
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

  // Reverses the wave-7 "sorting is a capability the frame never removes"
  // reading for THIS screen: the frame's row 1 has no line left for a sort
  // control.
  const SORT_SELECT_BANKS = [
    ...PHONE.matchAll(/\.chq-submissions-filterbar-sort-select[^{]*\{([^}]*)\}/g),
    ...PHONE.matchAll(/\.chq-submissions-filterbar-searchsort \.chq-submissions-filterbar-sort-select[^{]*\{([^}]*)\}/g),
  ];
  // docs/design/Chautauqua Submissions.dc.html:147 `min-height:44px; display:flex; align-items:center` -- ONE 44px search box on row 1, "Nothing else".
  it('hides the Sort select at 390 -- the frame draws no sort control on the search row (:147)', () => {
    const banks = SORT_SELECT_BANKS;
    expect(banks.length).toBeGreaterThan(0);
    expect(banks.some((m) => /display:\s*none/.test(m[1]!))).toBe(true);
  });

  // Reverses the wave-7 "track filtering ... re-lines rather than
  // vanish[es]" reading: the frame's row 2 has no line left for a track
  // control either.
  // docs/design/Chautauqua Submissions.dc.html:148-151 `display:flex; gap:7px; overflow-x:auto` draws ONE chip strip (status chips only) as row 2 -- "Nothing else".
  it('hides the track select at 390 -- the frame draws no track control on the chip-strip row (:148-151)', () => {
    expect(PHONE).toMatch(/\.chq-submissions-filterbar \.chq-submissions-filterbar-select[^{]*\{[^}]*display:\s*none/);
  });

  // docs/design/Chautauqua Submissions.dc.html:137-152 `width:390px; height:844px`
  // draws no saved-views row at all -- the whole strip (ViewTabs.tsx) is
  // stood down, not re-lined.
  it('hides the saved-views strip at 390 -- the frame has no line for it', () => {
    expect(PHONE).toMatch(/\.chq-submissions-viewtabs[^{]*\{[^}]*display:\s*none/);
  });

  // Reverses the wave-6/7 "every pill stays in the scrolling strip" ruling
  // this test previously pinned: the frame's chip strip is a NARROWED
  // population, not the full six-status vocabulary. (The frame's third
  // chip, 'All 47', has no corresponding status literal in
  // SUBMISSION_STATUSES and is a known gap, not reproduced by this
  // CSS-only narrowing -- see the rule's own comment.)
  // docs/design/Chautauqua Submissions.dc.html:148-151 `display:flex; gap:7px; overflow-x:auto` names exactly three chips ('Needs triage' / 'Accepted' / 'All 47').
  it('narrows the status-pill population by data-status to the two status literals the frame names', () => {
    expect(PHONE).toMatch(/\.chq-status-pills \[data-status\]:not\(\[data-status='pending'\]\):not\(\[data-status='accepted'\]\)[^{]*\{[^}]*display:\s*none/);
  });

  // docs/design/Chautauqua Submissions.dc.html:148
  // `display:flex; gap:7px; overflow-x:auto`
  // -- the surviving status chips scroll horizontally at the 44px floor.
  it('keeps .chq-submissions-filterbar as one horizontally scrolling chip strip at the 44px floor', () => {
    expect(PHONE).toMatch(/\.chq-submissions-filterbar,[\s\S]{0,200}overflow-x:\s*auto/);
    expect(PHONE).toMatch(/\.chq-submissions-filterbar-search,[\s\S]{0,60}\.chq-submissions-filterbar-select\s*\{[^}]*min-height:\s*44px/);
  });

  it('desktop keeps every control (no display:none for these selectors outside a media block)', () => {
    const withoutMedia = CSS.replace(/@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g, '');
    expect(withoutMedia).not.toMatch(/\.chq-submissions-status-label\s*\{[^}]*display:\s*none/);
    expect(withoutMedia).not.toMatch(/\.chq-submissions-columnpicker\s*\{[^}]*display:\s*none/);
    expect(withoutMedia).not.toMatch(/\.chq-submissions-viewtabs\s*\{[^}]*display:\s*none/);
    expect(withoutMedia).not.toMatch(/\.chq-submissions-filterbar-sort-select\s*\{[^}]*display:\s*none/);
    expect(withoutMedia).not.toMatch(/\.chq-submissions-filterbar-select\s*\{[^}]*display:\s*none/);
  });
});
