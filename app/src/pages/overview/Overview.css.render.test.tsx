// DEC-144 layer-2 harness: overview stylesheet contract tests. Extracted
// from Overview.render.test.tsx (contention-decomposition, no behavior
// change) -- these describe blocks read the raw overview.css text (jsdom
// does not apply an external stylesheet) rather than rendering the page, so
// they were split out of the render-smoke file to isolate their own
// contention (spacing-measure work vs. render-behavior work land in
// different files now).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// DEC-877 amendment: the headline row must not overflow its measure. The
// title is the flexible element (min-width: 0, ellipsis) and the toolbar is
// rigid (flex-shrink: 0) at desktop widths. jsdom does not apply an external
// stylesheet (see page-measure.test.ts / speakers-css.test.ts), so this reads
// the stylesheet's own text rather than rendering + measuring computed style.
describe('overview headline row CSS contract (DEC-877 amendment)', () => {
  it('keeps the title flexible and the toolbar rigid outside @media', () => {
    const cssPath = join(dirname(fileURLToPath(import.meta.url)), 'overview.css');
    const css = readFileSync(cssPath, 'utf8');
    const withoutMedia = css.replace(/@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g, '');

    const headlineMatch = withoutMedia.match(/\.chq-overview-headline\s*\{([^}]*)\}/);
    expect(headlineMatch).not.toBeNull();
    expect(headlineMatch![1]).toMatch(/min-width:\s*0/);

    const toolbarMatch = withoutMedia.match(/\.chq-overview-toolbar\s*\{([^}]*)\}/);
    expect(toolbarMatch).not.toBeNull();
    expect(toolbarMatch![1]).toMatch(/flex-shrink:\s*0/);
  });
});

// Gate-4 wave-6 amendment: pins the five top-third junctions (plus the two
// button/row pitch fixes in the same class) that regressed +86px (+28%)
// against the frame. Reads the raw stylesheet text (jsdom does not apply an
// external stylesheet -- see the headline-row contract test above) so the
// declared spacing values themselves can't silently drift back.
describe('overview top-third spacing measure (Gate-4 wave-6 amendment)', () => {
  const cssPath = join(dirname(fileURLToPath(import.meta.url)), 'overview.css');
  const css = readFileSync(cssPath, 'utf8');
  const withoutMedia = css.replace(/@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g, '');

  function ruleBody(selector: string): string {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = withoutMedia.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
    const body = match?.[1];
    if (body === undefined) throw new Error(`no top-level rule found for ${selector}`);
    return body;
  }

  it('header-rule -> band-rule and band-rule -> toolbar-top: the deadlines strip margin is 8px top / 6px bottom', () => {
    expect(ruleBody('.chq-overview-deadlines')).toMatch(/margin:\s*8px 0 6px/);
  });

  it('stat band: the deadline cell vertical padding is 11px', () => {
    expect(ruleBody('.chq-overview-deadline-cell')).toMatch(/padding:\s*11px 14px/);
  });

  it('h1 ink bottom -> the §01 2px rule: headline-row margin-bottom is 6px and section-header padding-bottom is 3px', () => {
    expect(ruleBody('.chq-overview-headline-row')).toMatch(/margin:\s*0 0 6px/);
    expect(ruleBody('.chq-overview-section-header')).toMatch(/padding-bottom:\s*3px/);
  });

  it('§01 row pitch (DEC-369 amendment, docs/design/Chautauqua Overview.dc.html:79): the overdue row padding matches the shared row padding at 16px', () => {
    // docs/design/Chautauqua Overview.dc.html:79 `display:grid;
    // grid-template-columns:1fr 1.15fr auto; gap:20px; align-items:baseline;
    // padding:16px 0; border-bottom:1px solid #E1DDCE`
    expect(ruleBody('.chq-overview-row-overdue')).toMatch(/padding:\s*16px 0/);
    expect(ruleBody('.chq-overview-row')).toMatch(/padding:\s*16px 0/);
  });

  it('toolbar buttons (DEC-369 amendment): vertical padding is 9px (secondary) / 10px (primary), horizontal padding unchanged', () => {
    expect(ruleBody('.chq-overview-toolbar-btn')).toMatch(/padding:\s*9px 16px/);
    expect(ruleBody('.chq-overview-toolbar-btn-primary')).toMatch(/padding:\s*10px 16px/);
  });

  it('"No action needed" quiet-row pitch (DEC-369 amendment, docs/design/Chautauqua Overview.dc.html:172): vertical padding is 14px, value column grid is 200px 1fr', () => {
    // docs/design/Chautauqua Overview.dc.html:172 `display:grid;
    // grid-template-columns:200px 1fr; gap:20px; align-items:baseline;
    // padding:14px 0; border-bottom:1px solid #E1DDCE`
    expect(ruleBody('.chq-overview-row-quiet')).toMatch(/padding:\s*14px 0/);
    expect(ruleBody('.chq-overview-row-quiet')).toMatch(/grid-template-columns:\s*200px 1fr/);
  });
});
