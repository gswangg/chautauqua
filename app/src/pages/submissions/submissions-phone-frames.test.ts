// v12 mobile campaign wave 6 (task w6-f): the 'Submissions' 390 frame,
// docs/design/Chautauqua Submissions.dc.html:137, previously unclaimed by
// the ledger (only cited from a submissions.css comment, and the ledger
// reads *.test.ts/*.test.tsx only). This file claims it.
//
// FRAME HEAD (docs/design/Chautauqua Submissions.dc.html:138-152): H1
// 'Submissions' at 27px with '12 awaiting triage' at 12px on the same
// baseline (:144-145); a full-width 44px search field on its own line
// (:147); then a 7px-gap horizontally scrolling chip strip (:148-151).
//
// RULING (wave 6 planner, this task owns this question): DESIGN-RULINGS'
// governing principle -- a 390 frame keeps the desktop design's
// CAPABILITIES, nothing is deleted at phone width -- means the frame's
// anatomy is honoured by RE-LINING the app's FilterBarSearchSort + FilterBar
// rows, not by hiding controls. At <=700px: (a) the search+sort row becomes
// a column so the search field spans the measure on its own line at the
// 44px floor and the sort <select> drops beneath it; (b) the 'Status'
// caption and the hairline divider go display:none -- a label and chrome,
// not capabilities the frame draws; (c) the status pills, the track select
// and the ColumnPicker summary all remain, in one horizontally scrolling
// strip at the 44px floor.
//
// OUT OF SCOPE (recorded per task instruction, not built here): the shell
// wordmark row (docs/design/Chautauqua Submissions.dc.html:138-142) and the
// bottom tab bar (:173-180) are shell chrome this task's frame draws but
// does not own -- they belong to the app shell lane, not this page's CSS.
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

describe("frame docs/design/Chautauqua Submissions.dc.html:137 ('Submissions' 390)", () => {
  it('docs/design/Chautauqua Submissions.dc.html:144-145: the H1 uses the shared page-title-phone token (page-local declaration, not a resolved pixel value -- the shell cascade defect v12m-w6-a fixes is out of this lane)', () => {
    const outsideHead = CSS.match(/\.chq-submissions-head-titles\s*\{[^}]*\}/);
    expect(outsideHead).not.toBeNull();
    // The H1 itself carries the shared .chq-page-title class (SubmissionsTable.tsx),
    // which styles.css resolves to --chq-type-page-title-phone-size at phone
    // width -- this page makes no independent H1 size claim.
    const submissionsTableSrc = readFileSync(join(HERE, 'SubmissionsTable.tsx'), 'utf-8');
    expect(submissionsTableSrc).toMatch(/<h1 className="chq-page-title">Submissions<\/h1>/);
  });

  it('docs/design/Chautauqua Submissions.dc.html:145: the head summary sits at 12px on the H1 baseline', () => {
    expect(PHONE).toMatch(/\.chq-submissions-head-titles \.chq-summary\s*\{[^}]*font-size:\s*12px/);
  });

  it('docs/design/Chautauqua Submissions.dc.html:147: the search+sort row re-lines into a column, search on its own full-width line, sort dropping beneath', () => {
    expect(PHONE).toMatch(/\.chq-submissions-filterbar-searchsort\s*\{[^}]*flex-direction:\s*column/);
    expect(PHONE).toMatch(
      /\.chq-submissions-filterbar-searchsort \.chq-submissions-filterbar-search,\s*\.chq-submissions-filterbar-searchsort \.chq-submissions-filterbar-sort-select\s*\{[^}]*width:\s*100%/,
    );
  });

  it('docs/design/Chautauqua Submissions.dc.html:147: the search field itself clears the 44px floor', () => {
    expect(PHONE).toMatch(/\.chq-submissions-filterbar-search,\s*\.chq-submissions-filterbar-select\s*\{[^}]*min-height:\s*44px/);
  });

  it('docs/design/Chautauqua Submissions.dc.html:148-151: the Status caption and divider are hidden -- chrome, not a capability the frame draws', () => {
    expect(PHONE).toMatch(/\.chq-submissions-status-label,[\s\S]{0,200}display:\s*none/);
    expect(PHONE).toMatch(/\.chq-submissions-filterbar-divider[,\s{][\s\S]{0,200}display:\s*none/);
  });

  it('docs/design/Chautauqua Submissions.dc.html:148: the status pills, track select and ColumnPicker all remain, in one horizontally scrolling strip', () => {
    // The filter bar scrolls as one strip (7px gap on the pill sub-group per
    // :148) and none of its members are hidden by data-status or by class.
    expect(PHONE).toMatch(/\.chq-submissions-filterbar,[\s\S]{0,200}overflow-x:\s*auto/);
    expect(PHONE).toMatch(/\.chq-submissions-filterbar \.chq-status-pills\s*\{[^}]*gap:\s*7px/);
    expect(PHONE).not.toMatch(/\.chq-status-pills \[data-status\][^{]*:not\(/);
    expect(PHONE).not.toMatch(/\.chq-submissions-filterbar \.chq-submissions-filterbar-select[\s\S]{0,200}display:\s*none/);
    expect(PHONE).not.toMatch(/\.chq-submissions-columnpicker[,\s{][\s\S]{0,200}display:\s*none/);
    // Both remaining controls clear the 44px floor.
    expect(PHONE).toMatch(/\.chq-submissions-filterbar-select\s*\{[^}]*min-height:\s*44px/);
    expect(PHONE).toMatch(/\.chq-submissions-columnpicker > summary\s*\{[^}]*min-height:\s*44px/);
  });

  it('docs/design/Chautauqua Submissions.dc.html:149: the active status chip fills ink, scoped to this filter bar', () => {
    expect(PHONE).toMatch(/\.chq-submissions-filterbar \.chq-pill\.is-active,\s*\.chq-submissions-filterbar \.chq-pill\.active\s*\{[^}]*background:\s*var\(--chq-ink\)/);
  });

  it('docs/design/Chautauqua Submissions.dc.html:154-171 (card body, already claimed elsewhere): the triage row keeps its flex:1/flex:1/auto triple at the 44px floor', () => {
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
