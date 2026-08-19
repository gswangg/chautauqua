// v12 design pack — the two Reviewer Scorecard 390 frames in
// docs/design/Chautauqua Review.dc.html:
//
//   "Reviewer scorecard · /review/plans/:id/submissions/:id" (:280-350)
//   "Scorecard · a criterion unscored"                        (:934-1138)
//
// task w3-g. jsdom applies no stylesheet and evaluates no @media rule, so
// — mirroring app/src/pages/contacts/contacts-phone-frames.test.ts and
// app/src/shell-geometry.test.ts — these are source-scan pins on the CSS
// TEXT of scorecard.css (the one file this task owns), not computed style,
// plus pure-function pins on scorecardLogic.ts's own copy generator.
//
// Every describe below opens with one STRICT citation:
// `docs/design/Chautauqua Review.dc.html:<line>` immediately followed by
// that line's verbatim backticked literal — a body line inside the frame's
// own span, never the "390"/label caption line above it — landing inside
// the task's authority range (:280-350 or :934-1138).
//
// Desktop is frozen: every CSS assertion below reads only inside a
// max-width phone layer; the pre-existing desktop rules in scorecard.css
// (the two-column grid, the rating segment row, etc.) are untouched.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { unscoredBannerCopy } from './scorecardLogic';
import type { EvaluationCriterion } from './types';

const HERE = dirname(fileURLToPath(import.meta.url));

function read(file: string): string {
  return readFileSync(join(HERE, file), 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');
}

const SCORECARD_CSS = read('scorecard.css');
const STYLES_CSS = read('../../styles.css');
/** Raw (comments intact is irrelevant here; what matters is that JSX
 * comment stripping cannot eat the markup these regexes match). */
const SCORECARD_TSX = readFileSync(join(HERE, 'Scorecard.tsx'), 'utf-8');

/** Brace-matched concatenation of every `@media (max-width: …)` block's
 * body — mirrors contacts-phone-frames.test.ts's phoneLayer so a nested
 * rule's own closing brace can never end the scan early. */
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

/** A single rule's declaration body, by selector, inside the phone layer.
 * Selectors are matched as WHOLE members of the rule's comma-separated
 * selector list, never by substring. */
function phoneRule(css: string, selector: string): string {
  const layer = phoneLayer(css);
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = rule.exec(layer)) !== null) {
    const selectors = m[1]!
      .split(',')
      .map((s) => s.trim().replace(/\s+/g, ' '))
      .filter(Boolean);
    if (selectors.includes(selector)) return m[2]!;
  }
  throw new Error(`no phone rule for ${selector}`);
}

/** Mirrors app/src/phone-block-visibility.test.ts's stripMedia +
 * topLevelRuleBodies pair: the rule body for `selector` OUTSIDE any
 * @media block. */
function stripAnyMedia(css: string): string {
  return css.replace(/@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g, '');
}

function topLevelRuleBody(css: string, selector: string): string {
  const withoutMedia = stripAnyMedia(css);
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(withoutMedia);
  if (!m || m[1] === undefined) throw new Error(`no top-level rule for ${selector}`);
  return m[1];
}

describe('DEC-385: the scorecard phone layer is single-direction', () => {
  it('scorecard.css declares no min-width media query', () => {
    expect(SCORECARD_CSS).not.toMatch(/@media[^{]*min-width/);
  });

  it('scorecard.css has at least one max-width phone block', () => {
    expect(phoneLayer(SCORECARD_CSS).length).toBeGreaterThan(0);
  });
});

describe('v12 phone frame "Reviewer scorecard" (390) — docs/design/Chautauqua Review.dc.html:280-350', () => {
  it('docs/design/Chautauqua Review.dc.html:283 `<a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Wave 2 queue</a>` — the back link sits at the 44px floor in the phone head band', () => {
    const rule = phoneRule(SCORECARD_CSS, '.chq-review-scorecard-back-row .chq-review-back');
    expect(rule).toMatch(/min-height:\s*44px/);
    expect(rule).toMatch(/display:\s*flex/);
    expect(rule).toMatch(/align-items:\s*center/);
  });

  it('docs/design/Chautauqua Review.dc.html:284 `<span style="margin-left:auto; font-size:12px; font-weight:600; color:#565A4B">7 of 18 done</span>` — the counter is pinned right, phone-only, and invisible at desktop', () => {
    const rule = phoneRule(SCORECARD_CSS, '.chq-review-scorecard-phone-progress');
    expect(rule).toMatch(/margin-left:\s*auto/);
    expect(rule).toMatch(/font-size:\s*12px/);
    expect(rule).toMatch(/font-weight:\s*600/);
    // the desktop-leak guard: display:none outside the media query, so a
    // phone-only counter never doubles up beside the existing
    // #chq-header-slot portal at desktop widths.
    expect(topLevelRuleBody(SCORECARD_CSS, '.chq-review-scorecard-phone-progress')).toMatch(/display:\s*none/);
  });

  it('docs/design/Chautauqua Review.dc.html:342 `<span style="flex:1; background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:46px; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700">Submit and next</span>` — the dock\'s primary action is 46px and fills the row', () => {
    const btnRule = phoneRule(SCORECARD_CSS, '.chq-review-scorecard-dock .chq-btn');
    expect(btnRule).toMatch(/min-height:\s*46px/);
    const primaryRule = phoneRule(SCORECARD_CSS, '.chq-review-scorecard-dock .chq-btn-primary');
    expect(primaryRule).toMatch(/flex:\s*1/);
  });

  it('docs/design/Chautauqua Review.dc.html:343 `<span style="border:1px solid #BAB6A6; border-radius:6px; min-height:46px; display:flex; align-items:center; padding:0 16px; font-size:13px; font-weight:600">Save draft</span>` — the dock band itself is sticky and full-bleed against .chq-main\'s phone gutter', () => {
    const dockRule = phoneRule(SCORECARD_CSS, '.chq-review-scorecard-dock');
    expect(dockRule).toMatch(/position:\s*sticky/);
    expect(dockRule).toMatch(/bottom:\s*0/);
    expect(dockRule).toMatch(/margin-inline:\s*-16px/);
  });
});

const UNSCORED_BANNER_CRITERIA: EvaluationCriterion[] = [
  { id: 'c1', label: 'Relevance to the track', kind: 'rating', weight: 3 },
  { id: 'c2', label: 'Depth and originality', kind: 'rating', weight: 2 },
  { id: 'c3', label: 'Fit for this track', kind: 'dropdown', options: ['Strong fit', 'Weak fit', 'No fit'] },
];

describe('v12 phone frame "Scorecard · a criterion unscored" (390) — docs/design/Chautauqua Review.dc.html:934-1138', () => {
  it('docs/design/Chautauqua Review.dc.html:936 `<div style="border-bottom:1px solid #1B1D17; padding:14px 16px; flex-shrink:0; display:flex; flex-direction:column; gap:7px">` — the head band is sticky, bordered and full-bleed', () => {
    const rule = phoneRule(SCORECARD_CSS, '.chq-review-scorecard-head-band');
    expect(rule).toMatch(/position:\s*sticky/);
    expect(rule).toMatch(/top:\s*0/);
    expect(rule).toMatch(/border-bottom:\s*1px solid var\(--chq-ink\)/);
    expect(rule).toMatch(/margin-inline:\s*-16px/);
  });

  it('docs/design/Chautauqua Review.dc.html:941 `<div style="border:1px solid #1B1D17; border-left:4px solid #1B1D17; border-radius:5px; background:#EFEBDF; padding:14px 16px; display:flex; flex-direction:column; gap:5px">` — the unscored banner is an ink-outlined card with a 4px left border, never a toast', () => {
    const rule = phoneRule(SCORECARD_CSS, '.chq-review-scorecard-unscored-banner');
    expect(rule).toMatch(/border:\s*1px solid var\(--chq-ink\)/);
    expect(rule).toMatch(/border-left:\s*4px solid var\(--chq-ink\)/);
    expect(rule).toMatch(/border-radius:\s*5px/);
  });

  it('docs/design/Chautauqua Review.dc.html:943 `<span style="font-size:13px; line-height:1.55; color:#3F4237">The weighted total cannot be worked out until all three are scored.</span>` — the banner states the denominator, live off the same completeness predicate every other completeness surface reads', () => {
    const copy = unscoredBannerCopy(UNSCORED_BANNER_CRITERIA, { c1: 5, c2: 4 });
    expect(copy).not.toBeNull();
    expect(copy?.heading).toBe('One criterion still needs a score');
    expect(copy?.body).toBe('The weighted total cannot be worked out until all three are scored.');
    // every criterion scored -> the banner has nothing left to say
    expect(unscoredBannerCopy(UNSCORED_BANNER_CRITERIA, { c1: 5, c2: 4, c3: 'Strong fit' })).toBeNull();
  });

  it('docs/design/Chautauqua Review.dc.html:951 `<span style="flex:1; min-height:44px; display:flex; align-items:center; justify-content:center; border:1px solid #BAB6A6; border-radius:6px; font-family:\'Familjen Grotesk\', sans-serif; font-size:16px; font-weight:600; color:#3F4237">3</span>` — the rating chip row reads the frame\'s radius/type deltas, a PAIRED variant of the same control, not a second one', () => {
    const rule = phoneRule(SCORECARD_CSS, '.chq-review-rating-btn');
    expect(rule).toMatch(/border-radius:\s*var\(--chq-r-ctl-phone\)/);
    expect(rule).toMatch(/font-size:\s*16px/);
  });
});

// v12m-w3-review. Probe (390x844, authenticated reviewer, live app):
// `document.documentElement.scrollWidth` measured 422 against a
// clientWidth of 390 on /review/plans/:id/submissions/:id, and the DOM
// walk named exactly two nodes crossing the right edge --
// `span.chq-user-identity` (right 416) and the
// `button.chq-btn.chq-btn-tertiary.chq-header-signout` inside it (right
// 422). Both belong to the SHELL header, which the reviewer carve-out
// (`.chq-shell:not(:has(.chq-tabbar)):not(:has([data-chq-phone-signout]))`)
// un-hides for a tab-bar-less shell. Neither 390 scorecard frame draws
// any of it, and the same header hosted a SECOND "N of N done" via the
// #chq-header-slot portal while the head band already drew the frame's
// own counter at :284.
describe('v12 phone frames: the shell header stands down where the scorecard draws its own head band', () => {
  it("docs/design/Chautauqua Review.dc.html:281 `<div style=\"border-bottom:1px solid #1B1D17; padding:14px 16px; flex-shrink:0; display:flex; flex-direction:column; gap:9px\">` — the head band is the FIRST child of the 390 phone shell, so styles.css stands the app-shell header down under the attribute contract", () => {
    expect(phoneRule(STYLES_CSS, '.chq-shell:has([data-chq-phone-head]) .chq-header')).toMatch(/display:\s*none/);
  });

  it('the stand-down is single-direction (DEC-385): the rule exists ONLY inside a max-width layer, so desktop keeps its header', () => {
    expect(() => topLevelRuleBody(STYLES_CSS, '.chq-shell:has([data-chq-phone-head]) .chq-header')).toThrow();
    // control: the helper DOES find a real top-level rule in this sheet,
    // so the throw above is the absence of the rule, not a broken scan.
    expect(topLevelRuleBody(STYLES_CSS, '.chq-tabbar')).toMatch(/display:\s*none/);
  });

  it('the scorecard declares BOTH shell regions it takes over on its own page root, gated on useIsPhone — an attribute contract, never a URL selector', () => {
    expect(SCORECARD_TSX).toMatch(
      /const phoneRegionDeclarations = isPhone\s*\n?\s*\?\s*\(\{ 'data-chq-phone-dock': true, 'data-chq-phone-head': true \} as const\)\s*\n?\s*:\s*\{\};/,
    );
    expect(SCORECARD_TSX).toMatch(/\{\.\.\.phoneRegionDeclarations\}/);
  });

  it("docs/design/Chautauqua Review.dc.html:284 `<span style=\"margin-left:auto; font-size:12px; font-weight:600; color:#565A4B\">7 of 18 done</span>` — the counter is drawn once: the #chq-header-slot portal is mounted only when NOT phone, mirroring the phone span's own `isPhone &&` gate", () => {
    expect(SCORECARD_TSX).toMatch(
      /\{isPhone && queueProgress && queueProgress\.total > 0 && \(\s*\n\s*<span className="chq-review-scorecard-phone-progress">/,
    );
    expect(SCORECARD_TSX).toMatch(
      /\{!isPhone &&\s*\n\s*queueProgress &&\s*\n\s*queueProgress\.total > 0 &&[\s\S]{0,200}?createPortal\(/,
    );
  });

  it("docs/design/Chautauqua Review.dc.html:283 `<a href=\"#\" style=\"font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center\">‹ Wave 2 queue</a>` — the back affordance the frame DOES draw survives: only chrome the frame omits stands down", () => {
    expect(SCORECARD_TSX).toMatch(/<Link to=\{`\/review\/plans\/\$\{planId\}`\} className="chq-review-back">/);
    expect(SCORECARD_TSX).toMatch(/&lsaquo; \{plan\.name\} queue/);
  });
});
