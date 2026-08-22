// DEC-937 wave-121/123 amendment receipt (task w12-o): the painted-face
// half of the cancelled-padding lens (app/src/cancelled-padding-face.scan.test.ts)
// for overview.css. `.chq-overview-btn` is PAINTED (border: 1px solid
// var(--chq-border-strong); background: var(--chq-surface-sunk);
// overview.css:358) and must never carry the cancelled-padding idiom
// (padding-inline:Npx paired with an equal-and-opposite margin-inline:-Npx)
// on any of its three row-action compounds -- on a painted control that
// idiom narrows the drawn face and drags it past its layout edge. Asserts
// the NEGATIVE (no rule matching these selectors carries the cancelled
// pair anywhere in the file) and the POSITIVE (each reaches the 44px floor
// with its own real inline padding and zero outward margin).
//
// `.chq-overview-link-btn` / `.chq-overview-section-action` are
// deliberately NOT asserted here -- both are genuinely borderless and
// correctly keep the cancelled-padding idiom (see overview-phone-floor.test.ts's
// "DEC-937 DRAIN" describe block).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { stripCssComments as stripComments } from '../../../../test/helpers/strip-css-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = join(HERE, 'overview.css');
const CSS = readFileSync(CSS_PATH, 'utf-8');

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
  '.chq-overview-row-actions .chq-overview-btn',
  '.chq-overview-row-actions-inline .chq-overview-btn',
  '.chq-overview-row-actions-column .chq-overview-btn',
];

describe('overview.css painted-face drain (DEC-937 wave-121/123, task w12-o)', () => {
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
    const badCss = '.chq-x-fake .chq-overview-btn { min-height: 44px; padding-inline: 10px; margin-inline: -10px; }';
    const rules = allRules(badCss).filter((r) => r.selector.trim() === '.chq-x-fake .chq-overview-btn');
    expect(rules.some((r) => isCancelledPadding(r.body))).toBe(true);
  });

  it.each(['.chq-overview-link-btn', '.chq-overview-section-action'])(
    '%s (borderless) correctly keeps the cancelled-padding idiom',
    (selector) => {
      const rules = allRules(STRIPPED).filter((r) =>
        r.selector
          .split(',')
          .map((s) => s.trim())
          .includes(selector),
      );
      expect(rules.length).toBeGreaterThan(0);
      expect(rules.some((r) => isCancelledPadding(r.body))).toBe(true);
    },
  );
});
