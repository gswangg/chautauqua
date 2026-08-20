// DEC-937 wave-121/123 amendment receipt (task w12-o): the painted-face
// half of the cancelled-padding lens (app/src/cancelled-padding-face.scan.test.ts)
// for agenda.css. Three selectors that share the `.chq-btn` family
// (.chq-agenda-head-actions .chq-btn, .chq-breaks-add-actions .chq-btn,
// .chq-phone-footer-actions .chq-phone-footer-btn) resolve to a PAINTED
// face (.chq-btn-primary/-secondary, styles.css `.chq-btn-primary {` /
// `.chq-btn-secondary {`) and must never carry the cancelled-padding idiom
// (padding-inline:Npx paired with an equal-and-opposite margin-inline:-Npx)
// -- on a painted control that idiom narrows the drawn face and drags it
// past its layout edge. Asserts the NEGATIVE (no rule matching these
// selectors carries the cancelled pair anywhere in the file) and the
// POSITIVE (each reaches the 44px floor with its own real inline padding
// and zero outward margin).
//
// .chq-breaks-row-actions .chq-btn is deliberately NOT asserted here --
// BreaksPanel.tsx's Edit/Remove controls in that row are .chq-btn-tertiary
// (background:none; border:none), genuinely borderless, and correctly
// keep the cancelled-padding idiom (see agenda-phone-floor.test.ts's own
// "agenda phone painted-anchor drain" describe block).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = join(HERE, 'agenda.css');
const CSS = readFileSync(CSS_PATH, 'utf-8');

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '');
}

const STRIPPED = stripComments(CSS);

/** Every `selector { body }` rule in `css` (brace-matched, comment-stripped). */
function allRules(css: string): Array<{ selector: string; body: string }> {
  const out: Array<{ selector: string; body: string }> = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    const selector = (m[1] ?? '').trim();
    if (!selector || selector.startsWith('@')) continue;
    out.push({ selector, body: m[2] ?? '' });
  }
  return out;
}

/** True if `body` carries the cancelled-padding idiom (padding-inline:Npx
 * paired with margin-inline:-Npx for the SAME N). */
function isCancelledPadding(body: string): boolean {
  const pi = body.match(/padding-inline\s*:\s*(\d+)px/);
  const mi = body.match(/margin-inline\s*:\s*-(\d+)px/);
  return !!pi && !!mi && pi[1] === mi[1];
}

const PAINTED_SELECTORS = [
  '.chq-agenda-head-actions .chq-btn',
  '.chq-breaks-add-actions .chq-btn',
  '.chq-phone-footer-actions .chq-phone-footer-btn',
];

describe('agenda.css painted-face drain (DEC-937 wave-121/123, task w12-o)', () => {
  it.each(PAINTED_SELECTORS)(
    'NEGATIVE: no rule reachable via %s carries the cancelled-padding idiom (no margin-inline: -10px)',
    (selector) => {
      const rules = allRules(STRIPPED).filter((r) =>
        r.selector
          .split(',')
          .map((s) => s.trim())
          .includes(selector),
      );
      expect(rules.length).toBeGreaterThan(0);
      for (const rule of rules) {
        expect(isCancelledPadding(rule.body)).toBe(false);
      }
    },
  );

  it.each(PAINTED_SELECTORS)(
    'POSITIVE: %s reaches the 44px floor with its own 16px inline padding and no outward margin',
    (selector) => {
      const rules = allRules(STRIPPED).filter((r) =>
        r.selector
          .split(',')
          .map((s) => s.trim())
          .includes(selector),
      );
      const bodies = rules.map((r) => r.body).join(' ');
      expect(bodies).toMatch(/min-height\s*:\s*44px/);
      expect(bodies).toMatch(/display\s*:\s*flex/);
      expect(bodies).toMatch(/align-items\s*:\s*center/);
      expect(bodies).toMatch(/padding-inline\s*:\s*16px/);
      expect(bodies).toMatch(/margin-inline\s*:\s*0\b/);
    },
  );

  it('falsifiability control: a synthetic painted rule that still cancels its padding is caught', () => {
    const badCss = '.chq-x-fake .chq-btn { min-height: 44px; padding-inline: 10px; margin-inline: -10px; }';
    const rules = allRules(badCss).filter((r) => r.selector.trim() === '.chq-x-fake .chq-btn');
    expect(rules.some((r) => isCancelledPadding(r.body))).toBe(true);
  });

  it('.chq-breaks-row-actions .chq-btn (borderless .chq-btn-tertiary) correctly keeps the cancelled-padding idiom', () => {
    const rules = allRules(STRIPPED).filter((r) =>
      r.selector
        .split(',')
        .map((s) => s.trim())
        .includes('.chq-breaks-row-actions .chq-btn'),
    );
    expect(rules.length).toBeGreaterThan(0);
    expect(rules.some((r) => isCancelledPadding(r.body))).toBe(true);
  });
});
