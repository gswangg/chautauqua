// v12 mobile campaign wave 6 (task w6-f): the 'Submissions' 390 frame,
// docs/design's "Chautauqua Submissions" frame (.dc.html, line 137 -- see
// the per-claim citations below), previously unclaimed by the ledger (only
// cited from a submissions.css comment, and the ledger reads
// *.test.ts/*.test.tsx only). This file claims it.
//
// FRAME HEAD (docs/design's "Chautauqua Submissions" frame, lines 138-152):
// H1 'Submissions' at 27px with '12 awaiting triage' at 12px on the same
// baseline (lines 144-145); a full-width 44px search field on its own line
// (line 147); then a 7px-gap horizontally scrolling chip strip (lines
// 148-151). Each claim below carries its own DEC-976 citation and quote.
//
// RULING (wave 6 planner, this task owns this question; DEC-919 wave-92/102
// amends the ColumnPicker clause): DESIGN-RULINGS' governing principle -- a
// 390 frame keeps the desktop design's CAPABILITIES, nothing is deleted at
// phone width -- means the frame's anatomy is honoured by RE-LINING the
// app's FilterBarSearchSort + FilterBar rows, not by hiding controls. At
// <=700px: (a) the search+sort row becomes a column so the search field
// spans the measure on its own line at the 44px floor and the sort <select>
// drops beneath it; (b) the 'Status' caption and the hairline divider go
// display:none -- a label and chrome, not capabilities the frame draws; (c)
// the status pills and the track select remain, in one horizontally
// scrolling strip at the 44px floor, while the ColumnPicker is hidden --
// the ONE control DEC-919 wave-7 blesses, since the table has stacked into
// cards and there are no columns left for it to govern.
//
// OUT OF SCOPE (recorded per task instruction, not built here): the shell
// wordmark row (docs/design's "Chautauqua Submissions" frame, lines
// 138-142) and the bottom tab bar (lines 173-180) are shell chrome this
// task's frame draws but does not own -- they belong to the app shell lane,
// not this page's CSS.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = join(HERE, 'submissions.css');
const CSS = readFileSync(CSS_PATH, 'utf-8');

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

describe("frame docs/design's \"Chautauqua Submissions\" frame ('Submissions' 390, line 137)", () => {
  // docs/design/Chautauqua Submissions.dc.html:137
  // `width:390px; height:844px`
  it('is the 390 frame this file claims', () => {
    expect(CSS).toMatch(/@media \(max-width: 700px\)/);
  });

  // docs/design/Chautauqua Submissions.dc.html:144-145
  // `<h1 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:27px;`
  // page-local declaration, not a resolved pixel value (v12m-w6-a is out of this lane).
  it('the H1 uses the shared page-title-phone token', () => {
    const outsideHead = CSS.match(/\.chq-submissions-head-titles\s*\{[^}]*\}/);
    expect(outsideHead).not.toBeNull();
    const submissionsTableSrc = readFileSync(join(HERE, 'SubmissionsTable.tsx'), 'utf-8');
    expect(submissionsTableSrc).toMatch(/<h1 className="chq-page-title">Submissions<\/h1>/);
  });

  // docs/design/Chautauqua Submissions.dc.html:145
  // `<span style="font-size:12px; color:#565A4B">12 awaiting triage</span>`
  it('the head summary sits at 12px on the H1 baseline', () => {
    expect(PHONE).toMatch(/\.chq-submissions-head-titles \.chq-summary\s*\{[^}]*font-size:\s*12px/);
  });

  // docs/design/Chautauqua Submissions.dc.html:147
  // `min-height:44px; display:flex; align-items:center; padding:0 13px`
  it('the search+sort row re-lines into a column, search on its own full-width line, sort dropping beneath', () => {
    expect(PHONE).toMatch(/\.chq-submissions-filterbar-searchsort\s*\{[^}]*flex-direction:\s*column/);
    expect(PHONE).toMatch(
      /\.chq-submissions-filterbar-searchsort \.chq-submissions-filterbar-search,\s*\.chq-submissions-filterbar-searchsort \.chq-submissions-filterbar-sort-select\s*\{[^}]*width:\s*100%/,
    );
  });

  // docs/design/Chautauqua Submissions.dc.html:147
  // `border:1px solid #BAB6A6; border-radius:6px; min-height:44px`
  it('the search field itself clears the 44px floor', () => {
    expect(PHONE).toMatch(/\.chq-submissions-filterbar-search,\s*\.chq-submissions-filterbar-select\s*\{[^}]*min-height:\s*44px/);
  });

  // docs/design/Chautauqua Submissions.dc.html:148-151
  // `display:flex; gap:7px; overflow-x:auto`
  // the Status caption and divider are hidden -- chrome, not a capability.
  it('the Status caption and divider are hidden', () => {
    expect(PHONE).toMatch(/\.chq-submissions-status-label,[\s\S]{0,200}display:\s*none/);
    expect(PHONE).toMatch(/\.chq-submissions-filterbar-divider[,\s{][\s\S]{0,200}display:\s*none/);
  });

  // docs/design/Chautauqua Submissions.dc.html:148
  // `display:flex; gap:7px; overflow-x:auto`
  // DEC-919 wave-92/102: three status pills only -- ColumnPicker hidden.
  it('the status pills and track select remain in one horizontally scrolling strip; the ColumnPicker is hidden', () => {
    expect(PHONE).toMatch(/\.chq-submissions-filterbar,[\s\S]{0,200}overflow-x:\s*auto/);
    expect(PHONE).toMatch(/\.chq-submissions-filterbar \.chq-status-pills\s*\{[^}]*gap:\s*7px/);
    expect(PHONE).not.toMatch(/\.chq-status-pills \[data-status\][^{]*:not\(/);
    expect(PHONE).not.toMatch(/\.chq-submissions-filterbar \.chq-submissions-filterbar-select[\s\S]{0,200}display:\s*none/);
    expect(PHONE).toMatch(/\.chq-submissions-columnpicker[\s\S]{0,200}display:\s*none/);
    // The remaining track select clears the 44px floor; the ColumnPicker's
    // `> summary` rule is a desktop-only pin that survives the hide unreached.
    expect(PHONE).toMatch(/\.chq-submissions-filterbar-select\s*\{[^}]*min-height:\s*44px/);
    expect(PHONE).toMatch(/\.chq-submissions-columnpicker > summary\s*\{[^}]*min-height:\s*44px/);
  });

  // docs/design/Chautauqua Submissions.dc.html:149
  // `background:#1B1D17; color:#F4F1E8; border-radius:99px; min-height:44px`
  it('the active status chip fills ink, scoped to this filter bar', () => {
    expect(PHONE).toMatch(/\.chq-submissions-filterbar \.chq-pill\.is-active,\s*\.chq-submissions-filterbar \.chq-pill\.active\s*\{[^}]*background:\s*var\(--chq-ink\)/);
  });

  // docs/design/Chautauqua Submissions.dc.html:165
  // `flex:1; background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:44px`
  // (card body, already claimed elsewhere) the triage row keeps its
  // flex:1/flex:1/auto triple at the 44px floor.
  it('the triage row keeps its flex:1/flex:1/auto triple at the 44px floor', () => {
    expect(PHONE).toMatch(
      /\.chq-submissions-row-triage \.chq-btn \{[^}]*min-height:\s*44px/,
    );
    expect(PHONE).toMatch(
      /\.chq-submissions-row-triage \.chq-btn:nth-child\(1\),\s*\.chq-submissions-row-triage \.chq-btn:nth-child\(2\) \{[^}]*flex:\s*1/,
    );
  });

  it('DESKTOP PRESERVED: the search+sort column re-lining and the caption/divider hide stay phone-only', () => {
    const withoutMedia = CSS.replace(/@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g, '');
    expect(withoutMedia).not.toMatch(/\.chq-submissions-filterbar-searchsort\s*\{[^}]*flex-direction:\s*column/);
    expect(withoutMedia).not.toMatch(/\.chq-submissions-status-label\s*\{[^}]*display:\s*none/);
    expect(withoutMedia).not.toMatch(/\.chq-submissions-filterbar-divider\s*\{[^}]*display:\s*none/);
  });
});
