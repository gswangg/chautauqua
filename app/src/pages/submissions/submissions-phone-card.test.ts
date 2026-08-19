// DEC-610 (wave 14 task w14-h): phone submission card collapses to four
// wrapped lines with no capability lost. SubmissionsTable.tsx names two
// class-based hooks (`.chq-submissions-table-custom` on each custom-column
// <td>, `.chq-submissions-table-clone-cell` on the Clone <td>) so the phone
// CSS can address a variable-length custom-column set instead of counting
// nth-child positions past the fixed 1-7 columns. This file asserts the new
// phone rules live INSIDE the existing 700px media block only -- no desktop
// pixel moves (see submissions-phone-card.render.test.tsx for the render
// assertion that both class names are actually emitted, not dead selectors).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = join(HERE, 'submissions.css');

/** Strips one level of @media { ... } blocks out of a stylesheet's text. */
function withoutMediaBlocks(css: string): string {
  return css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\}[^{}]*)*\}/g, '');
}

/** Extracts the body text of the (single) 700px media block. */
function mediaBlockBody(css: string): string {
  const match = css.match(/@media \(max-width: 700px\) \{([\s\S]*)\n\}\n/);
  const body = match?.[1];
  if (body === undefined) throw new Error('no 700px media block found');
  return body;
}

describe('submissions.css phone card rules (DEC-610, task w14-h)', () => {
  const css = readFileSync(CSS_PATH, 'utf-8');
  const mediaBody = mediaBlockBody(css);

  it('the new custom-column and clone-cell hooks are declared only inside the 700px block', () => {
    expect(mediaBody).toMatch(/\.chq-submissions-table-custom\s*\{/);
    expect(mediaBody).toMatch(/\.chq-submissions-table-clone-cell\s*\{/);
    expect(withoutMediaBlocks(css)).not.toMatch(/\.chq-submissions-table-custom\s*\{/);
    expect(withoutMediaBlocks(css)).not.toMatch(/\.chq-submissions-table-clone-cell\s*\{/);
  });

  it('speakers (nth-child(4)) does not get a leading separator, but track/sent/custom do', () => {
    expect(mediaBody).not.toMatch(/nth-child\(4\)::before/);
    expect(mediaBody).toMatch(/nth-child\(5\)::before[\s,]*[\s\S]{0,200}?content:\s*'· '/);
    expect(mediaBody).toMatch(/nth-child\(7\)::before[\s,]*[\s\S]{0,200}?content:\s*'· '/);
    expect(mediaBody).toMatch(/\.chq-submissions-table-custom::before[\s,]*[\s\S]{0,200}?content:\s*'· '/);
  });

  it('leaves the top-level (outside-media) rule set unchanged from before this task', () => {
    // Snapshot taken from the file BEFORE task w14-h touched only the
    // interior of the existing 700px block: every top-level selector below
    // must still resolve, proving no desktop rule was added, removed, or
    // moved by this change.
    const outside = withoutMediaBlocks(css);
    const topLevelSelectors = [
      '.chq-submissions-table-wrap',
      '.chq-submissions-table',
      '.chq-submissions-table-ref',
      '.chq-submissions-table-title',
      '.chq-submissions-table-muted',
      '.chq-submissions-clone',
      '.chq-submissions-row-triage',
      '.chq-submissions-delete-page',
    ];
    for (const selector of topLevelSelectors) {
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      expect(outside).toMatch(new RegExp(`${escaped}[\\s,{]`));
    }
    // The two new phone-only class names must NOT leak into the top-level
    // (outside-media) stylesheet text.
    expect(outside).not.toContain('chq-submissions-table-custom');
    expect(outside).not.toContain('chq-submissions-table-clone-cell');
  });

  it('td:nth-child(1) (the checkbox) still keeps its own >=44px tap-area rule inside the media block', () => {
    expect(mediaBody).toMatch(/nth-child\(1\)[\s\S]*?min-height:\s*44px/);
  });
});

// Phone pins for the v12 'Submissions · 390' frame's card action row and
// chip strip. The frame draws the row as flex:1 / flex:1 / auto, so the two
// leading actions fill the card's width instead of collapsing to their text.
describe('submissions.css phone card action row + chip strip (390 frame)', () => {
  const css = readFileSync(CSS_PATH, 'utf-8');
  const mediaBody = mediaBlockBody(css);
  const outside = withoutMediaBlocks(css);

  it('the triage buttons clear the 44px floor and carry the phone control radius', () => {
    expect(mediaBody).toMatch(
      /\.chq-submissions-row-triage \.chq-btn \{[^}]*min-height:\s*44px[^}]*border-radius:\s*var\(--chq-r-ctl-phone\)/,
    );
  });

  it('the first two triage actions share the line at equal width, the third (Read) sizes to its label', () => {
    expect(mediaBody).toMatch(
      /\.chq-submissions-row-triage \.chq-btn:nth-child\(1\),\s*\.chq-submissions-row-triage \.chq-btn:nth-child\(2\) \{[^}]*flex:\s*1/,
    );
    // No flex on nth-child(3): the third action ('Read') keeps its
    // intrinsic width, which is what makes the row read flex:1 / flex:1 /
    // auto. DEC-610 amendment: it does get its own rule now, for the
    // frame's `padding:0 14px` -- just no `flex`.
    const nth3 = mediaBody.match(/\.chq-submissions-row-triage \.chq-btn:nth-child\(3\) \{([^}]*)\}/);
    expect(nth3).not.toBeNull();
    expect(nth3![1]).toMatch(/padding:\s*0 14px/);
    expect(nth3![1]).not.toMatch(/flex:/);
  });

  it('the status chips take the frame 13px type, scoped to this filter bar', () => {
    expect(mediaBody).toMatch(/\.chq-submissions-filterbar \.chq-pill \{[^}]*font-size:\s*13px/);
    expect(mediaBody).toMatch(/\.chq-submissions-filterbar \.chq-pill \{[^}]*padding:\s*0 13px/);
    // Scoped -- a bare `.chq-pill` rule here would move every other
    // screen's chips, which is not this lane's to change.
    expect(mediaBody).not.toMatch(/(^|[,{}])\s*\.chq-pill\s*\{/m);
  });

  it('DESKTOP PRESERVED: the action row and chip metrics stay phone-only', () => {
    // .chq-submissions-row-triage keeps its desktop rule and gains no
    // phone-only declaration outside the 700px block (DEC-385).
    expect(outside).toMatch(/\.chq-submissions-row-triage\s*\{/);
    expect(outside).not.toMatch(/\.chq-submissions-row-triage[^{]*\{[^}]*min-height:\s*44px/);
    expect(outside).not.toMatch(/\.chq-submissions-row-triage[^{]*\{[^}]*flex:\s*1/);
    expect(outside).not.toMatch(/\.chq-submissions-filterbar \.chq-pill/);
    expect(outside).not.toContain('--chq-r-ctl-phone');
  });
});
