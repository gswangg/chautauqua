// v12 design pack — the one width:390 PHONE frame in
// docs/design/Chautauqua Submissions.dc.html:
//
//   "CFP form · 390" (line 468) — reorder and edit one question at a time
//
// jsdom applies no stylesheet and evaluates no @media rule, so — mirroring
// app/src/pages/contacts/contacts-phone-frames.test.ts, which this file is
// modelled on — these are source-scan pins on the CSS TEXT of forms.css,
// not computed style.
//
// Two standing rules are pinned alongside the frame geometry:
//
//   * DEC-385 single-direction: the phone layer is `@media (max-width: …)`
//     ONLY. A min-width query would make the sheet bidirectional and is a
//     hard failure here.
//   * DESIGN-RULINGS "The 44px floor, and how it gets evaded": no phone
//     token may author a `min-height` below 44px, and an interactive
//     element needs min-height PLUS centred flex PLUS horizontal padding.
//
// Scope: this task (w1-i, app/src/pages/forms/** only) owns the row list,
// the "Add a question" control and the dock's step actions -- NOT the
// .chq-forms-header band (back-link / h1 / Opens-Closes-Received strip),
// which stays out of scope pending the shared-header consolidation noted
// in this task's findings. Desktop is frozen: every assertion below reads
// only inside a max-width block, and FormsPage.render.test.tsx /
// forms-header-measure.test.ts run unchanged.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Comments are stripped before any brace scanning, mirroring
 * contacts-phone-frames.test.ts's `read` helper. */
function read(file: string): string {
  return readFileSync(join(HERE, file), 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');
}

const FORMS_CSS = read('forms.css');

/** Concatenated bodies of every `@media (max-width: …)` block in `css`,
 * brace-matched rather than regex-bounded (mirrors contacts-phone-frames'
 * phoneLayer). */
function phoneLayer(css: string): string {
  const out: string[] = [];
  const opener = /@media\s*\(max-width:\s*\d+px\)\s*\{/g;
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
    if (depth !== 0) throw new Error('unbalanced @media block');
    out.push(css.slice(start, i - 1));
  }
  if (out.length === 0) throw new Error('no max-width media block found');
  return out.join('\n');
}

/** A single rule's declaration body, by selector, inside the phone layer --
 * matched as a WHOLE member of the rule's selector list, mirroring
 * contacts-phone-frames' phoneRule. */
function phoneRule(css: string, selector: string): string {
  const layer = phoneLayer(css);
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = rule.exec(layer)) !== null) {
    const selectors = m[1]!
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split(',')
      .map((s) => s.trim().replace(/\s+/g, ' '))
      .filter(Boolean);
    if (selectors.includes(selector)) return m[2]!;
  }
  throw new Error(`no phone rule for ${selector}`);
}

describe('DEC-385: the forms phone layer is single-direction', () => {
  it('forms.css declares no min-width media query', () => {
    expect(FORMS_CSS).not.toMatch(/@media[^{]*min-width/);
  });

  it('forms.css has at least one max-width phone block', () => {
    expect(phoneLayer(FORMS_CSS).length).toBeGreaterThan(0);
  });
});

describe('DESIGN-RULINGS: never author a min-height below 44px on a phone token', () => {
  it("forms.css's phone layer floors every authored min-height at 44px", () => {
    const layer = phoneLayer(FORMS_CSS);
    const heights = [...layer.matchAll(/min-height:\s*(\d+)px/g)].map((m) => Number(m[1]));
    expect(heights.length).toBeGreaterThan(0);
    for (const h of heights) expect(h).toBeGreaterThanOrEqual(44);
  });
});

describe('v12 phone frame "CFP form · 390" — the row list', () => {
  it('lays each row out as the frame draws it: drag glyph, label stack, actions, one flat row', () => {
    const row = phoneRule(FORMS_CSS, '.chq-forms-field-row');
    expect(row).toMatch(/grid-template-areas:\s*'drag label actions'/);
    expect(row).toMatch(/gap:\s*12px/);
    expect(row).toMatch(/padding:\s*14px 0/);
  });

  it('steps the drag glyph to the frame\'s 16px muted-2 tone (var(--chq-border-hover), the one token at #8E8A7A)', () => {
    const drag = phoneRule(FORMS_CSS, '.chq-forms-field-drag');
    expect(drag).toMatch(/font-size:\s*16px/);
    expect(drag).toMatch(/color:\s*var\(--chq-border-hover\)/);
  });

  it('steps the display label to the frame\'s 16px/600/-0.015em face', () => {
    const label = phoneRule(FORMS_CSS, '.chq-forms-field-label-text');
    expect(label).toMatch(/font-size:\s*16px/);
    expect(label).toMatch(/letter-spacing:\s*-0\.015em/);
  });

  it('collapses the desktop kind/required/help/condition lines behind the single phone-meta caption', () => {
    for (const sel of [
      '.chq-forms-field-kind',
      '.chq-forms-field-required',
      '.chq-forms-field-optional',
      '.chq-forms-field-help',
      '.chq-forms-field-condition',
    ]) {
      expect(phoneRule(FORMS_CSS, sel)).toMatch(/display:\s*none/);
    }

    const meta = phoneRule(FORMS_CSS, '.chq-forms-field-phone-meta');
    expect(meta).toMatch(/display:\s*block/);
    expect(meta).toMatch(/font-size:\s*12px/);
    expect(meta).toMatch(/color:\s*var\(--chq-muted\)/);
  });

  it('boxes the Edit control in the frame\'s bordered sunk fill at 44px, and hides Delete (reachable via FieldModal instead)', () => {
    const btn = phoneRule(FORMS_CSS, '.chq-forms-field-list .chq-btn');
    expect(btn).toMatch(/min-height:\s*44px/);
    expect(btn).toMatch(/padding:\s*0 14px/);
    expect(btn).toMatch(/border:\s*1px solid var\(--chq-border\)/);
    expect(btn).toMatch(/background:\s*var\(--chq-surface-sunk\)/);
    expect(btn).toMatch(/font-size:\s*13px/);
    expect(btn).toMatch(/font-weight:\s*600/);

    expect(phoneRule(FORMS_CSS, '.chq-forms-field-actions .chq-btn:last-child')).toMatch(/display:\s*none/);
  });
});

describe('v12 phone frame "CFP form · 390" — Add a question', () => {
  it('hides the desktop header link and shows the frame\'s full-width dashed control instead', () => {
    expect(phoneRule(FORMS_CSS, '.chq-forms-add-question')).toMatch(/display:\s*none/);

    const dashed = phoneRule(FORMS_CSS, '.chq-forms-add-question-phone');
    expect(dashed).toMatch(/display:\s*flex/);
    expect(dashed).toMatch(/width:\s*100%/);
    expect(dashed).toMatch(/min-height:\s*46px/);
    expect(dashed).toMatch(/border:\s*1px dashed var\(--chq-border\)/);
    expect(dashed).toMatch(/font-size:\s*13px/);
    expect(dashed).toMatch(/font-weight:\s*700/);
    expect(dashed).toMatch(/color:\s*var\(--chq-brand\)/);
  });
});

describe('v12 phone frame "CFP form · 390" — the dock\'s step actions', () => {
  it('gives "Save the form" the flex:1 filled slot and "Preview" the bordered fixed slot, both at 48px', () => {
    const footer = phoneRule(FORMS_CSS, '.chq-forms-phone-footer');
    expect(footer).toMatch(/display:\s*flex/);
    expect(footer).toMatch(/padding:\s*12px 16px 16px/);

    const btn = phoneRule(FORMS_CSS, '.chq-forms-phone-footer .chq-btn');
    expect(btn).toMatch(/min-height:\s*48px/);
    expect(btn).toMatch(/display:\s*flex/);
    expect(btn).toMatch(/align-items:\s*center/);
    expect(btn).toMatch(/justify-content:\s*center/);

    expect(phoneRule(FORMS_CSS, '.chq-forms-phone-save')).toMatch(/flex:\s*1/);
    expect(phoneRule(FORMS_CSS, '.chq-forms-phone-footer .chq-btn-secondary')).toMatch(/padding:\s*0 16px/);
  });
});

describe('desktop is frozen: the phone geometry lives only inside max-width blocks', () => {
  function desktopLayer(css: string): string {
    let out = '';
    let i = 0;
    const opener = /@media[^{]*\{/g;
    let m: RegExpExecArray | null;
    while ((m = opener.exec(css)) !== null) {
      out += css.slice(i, m.index);
      let depth = 1;
      let j = m.index + m[0].length;
      while (j < css.length && depth > 0) {
        if (css[j] === '{') depth += 1;
        else if (css[j] === '}') depth -= 1;
        j += 1;
      }
      i = j;
      opener.lastIndex = j;
    }
    return out + css.slice(i);
  }

  it('leaves the desktop row on its 20px/1fr/150px/108px/auto rhythm', () => {
    expect(desktopLayer(FORMS_CSS)).toMatch(
      /\.chq-forms-field-row\s*\{[^}]*grid-template-columns:\s*20px 1fr 150px 108px auto/,
    );
  });

  it('leaves the desktop drag glyph at 14px / var(--chq-muted)', () => {
    expect(desktopLayer(FORMS_CSS)).toMatch(/\.chq-forms-field-drag\s*\{[^}]*font-size:\s*14px/);
  });

  it('keeps the phone-only Add-a-question control and phone-meta caption hidden at desktop', () => {
    const desktop = desktopLayer(FORMS_CSS);
    expect(desktop).toMatch(/\.chq-forms-add-question-phone\s*\{[^}]*display:\s*none/);
    expect(desktop).toMatch(/\.chq-forms-field-phone-meta\s*\{[^}]*display:\s*none/);
  });

  it('keeps the desktop Add-a-question link, Delete action and kind/required columns visible', () => {
    const desktop = desktopLayer(FORMS_CSS);
    expect(desktop).not.toMatch(/\.chq-forms-add-question\s*\{[^}]*display:\s*none/);
    expect(desktop).not.toMatch(
      /\.chq-forms-field-actions \.chq-btn:last-child\s*\{[^}]*display:\s*none/,
    );
  });
});
