// v12 mobile campaign, task w2-h: CFP form builder at 390 (Tier 1, SPA).
// jsdom applies no @media rule (see forms-phone-390.render.test.tsx for the
// markup-presence half of this frame), so the phone-only CSS itself is
// verified here as a source scan of forms.css, mirroring
// forms-header-measure.test.ts's own approach for this file.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS_RAW = readFileSync(join(HERE, 'forms.css'), 'utf-8');
// Comments stripped for rule extraction (mirroring phone-page-scaffold.
// test.ts's own `read` helper): a long explanatory comment above a rule --
// this file has several, citing the frame line -- must never desynchronise
// the selector captured by the regex-based rule scanner below. The
// max-width-occurrence-count test still reads CSS_RAW, since two of its six
// occurrences are themselves inside comments.
const CSS = CSS_RAW.replace(/\/\*[\s\S]*?\*\//g, '');

/** Concatenated body of the file's max-width media block, brace-matched. */
function phoneLayer(css: string): string {
  const opener = /@media\s*\(max-width:\s*700px\)\s*\{/g;
  const m = opener.exec(css);
  if (!m) throw new Error('no max-width:700px media block found');
  let depth = 1;
  let i = m.index + m[0].length;
  const start = i;
  while (i < css.length && depth > 0) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}') depth -= 1;
    i += 1;
  }
  if (depth !== 0) throw new Error('unbalanced @media block');
  return css.slice(start, i - 1);
}

/** A single rule's declaration body, by selector, within `layer`. */
function ruleIn(layer: string, selector: string): string {
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = rule.exec(layer)) !== null) {
    const selectors = m[1]!
      .split(',')
      .map((s) => s.trim().replace(/\s+/g, ' '))
      .filter(Boolean);
    if (selectors.includes(selector)) return m[2]!;
  }
  throw new Error(`no rule for ${selector} in the phone layer`);
}

describe('forms.css phone block is the last construct in the file (DEC-576: single max-width switch, appended last)', () => {
  it('the @media(max-width:700px) block has no CSS after it', () => {
    const trimmed = CSS_RAW.trimEnd();
    expect(trimmed.endsWith('}')).toBe(true);
    const opener = /@media\s*\(max-width:\s*700px\)\s*\{/g;
    let last: RegExpExecArray | null = null;
    let m: RegExpExecArray | null;
    while ((m = opener.exec(CSS_RAW)) !== null) last = m;
    expect(last, 'expected exactly one max-width:700px block').not.toBeNull();
    let depth = 1;
    let i = last!.index + last![0].length;
    while (i < CSS_RAW.length && depth > 0) {
      if (CSS_RAW[i] === '{') depth += 1;
      else if (CSS_RAW[i] === '}') depth -= 1;
      i += 1;
    }
    // Everything from the block's closing brace to EOF is whitespace only.
    expect(CSS_RAW.slice(i).trim()).toBe('');
  });

  it('still has exactly 6 max-width occurrences (2 prose + .chq-forms-content + .chq-forms-field-modal + the media query + its max-width:none override)', () => {
    expect((CSS_RAW.match(/max-width/g) ?? []).length).toBe(6);
  });
});

const PHONE = phoneLayer(CSS);

describe('ruling (a): the reorder handle is a real 44px target at 390 (frame docs/design/Chautauqua Submissions.dc.html:468 `<div style="width:390px; height:844px; ...">`, DEC-715)', () => {
  it('.chq-forms-field-drag clears the 44px floor with centred flex, not bare padding', () => {
    const drag = ruleIn(PHONE, '.chq-forms-field-drag');
    expect(drag).toMatch(/min-height:\s*44px/);
    expect(drag).toMatch(/width:\s*44px/);
    expect(drag).toMatch(/display:\s*flex/);
    expect(drag).toMatch(/align-items:\s*center/);
    expect(drag).toMatch(/justify-content:\s*center/);
    expect(drag).toMatch(/padding:\s*0 4px/);
  });

  it("the row's grid column for the handle widens from the desktop 16px to 44px to match", () => {
    const row = ruleIn(PHONE, '.chq-forms-field-row');
    expect(row).toMatch(/grid-template-columns:\s*44px 1fr auto/);
  });
});

describe('ruling (b): editing stays a per-question drill (frame caption "Reorder and edit one question at a time"), never an inline column', () => {
  it('the field modal drops its 560px desktop cap at phone (full-screen drill, not an inline expand)', () => {
    const modal = ruleIn(PHONE, '.chq-forms-field-modal');
    expect(modal).toMatch(/max-width:\s*none/);
  });
});

describe('phone drill head reuses the landed v12 scaffold, resetting only what the desktop-frozen unconditional rule would otherwise fight', () => {
  it('.chq-forms-header resets align-items for the shared column layout (the desktop rule stays flex-end/row, frozen, unconditional)', () => {
    const header = ruleIn(PHONE, '.chq-forms-header');
    expect(header).toMatch(/align-items:\s*flex-start/);
    expect(header).not.toMatch(/max-width/);
  });

  it('.chq-forms-phone-meta is hidden outside the phone block and shown inside it', () => {
    const desktopMatch = CSS.match(/\.chq-forms-phone-meta\s*\{([^}]*)\}/);
    expect(desktopMatch).not.toBeNull();
    expect(desktopMatch![1]).toMatch(/display:\s*none/);
    const meta = ruleIn(PHONE, '.chq-forms-phone-meta');
    expect(meta).toMatch(/display:\s*block/);
    expect(meta).toMatch(/font-size:\s*13px/);
    expect(meta).toMatch(/color:\s*var\(--chq-muted\)/);
  });
});

describe('phone dock: filled "Save the form" over bordered "Preview" (frame docs/design/Chautauqua Submissions.dc.html:468 `<div style="width:390px; height:844px; ...">`)', () => {
  it('.chq-forms-phone-footer switches from the base display:none to flex', () => {
    const desktopMatch = CSS.match(/\.chq-forms-phone-footer\s*\{([^}]*)\}/);
    expect(desktopMatch).not.toBeNull();
    expect(desktopMatch![1]).toMatch(/display:\s*none/);
    const footer = ruleIn(PHONE, '.chq-forms-phone-footer');
    expect(footer).toMatch(/display:\s*flex/);
  });

  it('Preview (.chq-btn-secondary) never gets forced to flex:1 -- only the primary "Save the form" fills, via the shared .chq-phone-dock .chq-btn-primary rule', () => {
    const secondary = ruleIn(PHONE, '.chq-forms-phone-footer .chq-btn-secondary');
    expect(secondary).toMatch(/flex:\s*0 1 auto/);
    // This file must never itself force flex:1 on the whole button group --
    // that job belongs solely to the shared .chq-phone-dock .chq-btn-primary
    // rule (app/src/styles.css), so a bordered Preview can never be
    // silently stretched to match Save the form's width again.
    expect(() => ruleIn(PHONE, '.chq-forms-phone-footer .chq-btn')).not.toThrow();
    expect(ruleIn(PHONE, '.chq-forms-phone-footer .chq-btn')).not.toMatch(/flex:\s*1/);
  });
});
