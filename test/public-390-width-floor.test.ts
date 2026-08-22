import { describe, it, expect } from 'vitest';
import { DOCS_SITE_CSS } from '../src/routes/docs-site.css';
import { CHROME_CSS, CHROME_PHONE_CSS } from '../src/routes/public/css/chrome.css';

// CHROME_CSS is desktop-scope only (DEC-385 wave-143 split): the phone
// @media block lives in the separate CHROME_PHONE_CSS export, split out so
// each composing sheet can concatenate it as its own trailing terminal
// phone region. `.chq-pub-activefilters-clear`'s real (phone) rule lives
// there, not in CHROME_CSS -- grade the concatenation of both, exactly as
// every host composes them.
const CHROME_CSS_COMPOSED = CHROME_CSS + CHROME_PHONE_CSS;

// DEC-393 wave-33: docs/design/audit/public-390-interactive-offenders-v12.md
// named two live 44px-height-but-short-WIDTH offenders on the phone (390)
// surface -- both had min-height:44px and centred flex but no horizontal
// padding, so their hit box was only as wide as their text label:
//   docs/design/audit/public-390-interactive-offenders-v12.md, under
//   `## /docs/start-here`: `a.chq-docs-phone-back w=38px h=44px`
//   docs/design/audit/public-390-interactive-offenders-v12.md, under
//   `## /embed/e/seed_embed_0001`: `a.chq-pub-activefilters-clear w=40px h=44px`
// This test asserts, from SOURCE, that both selectors' phone rules now
// declare a non-zero horizontal padding alongside the pre-existing
// min-height:44px + centred flex, and ships a negative control so the
// scan cannot pass vacuously.

/** Strip CSS comments so a comment quoting a frame/roster literal never
 *  masquerades as a real declaration. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

interface FloorCheck {
  minHeight44: boolean;
  centredFlex: boolean;
  nonZeroHorizontalPadding: boolean;
}

/** Extract the FIRST rule body for `selector` in `css` (comments already
 *  stripped) and grade it against the three width-floor requirements. */
function checkSelectorFloor(css: string, selector: string): FloorCheck {
  const stripped = stripComments(css);
  // Match `<selector> {` (allowing the selector to be immediately followed
  // by whitespace/`{`, so `.chq-pub-activefilters-clear` never accidentally
  // matches a longer selector it is merely a prefix of). A selector can
  // have a base-scope declaration (often just `display: none`) ahead of
  // its real phone rule (DEC-385: narrow overrides wide via max-width
  // media queries ONLY, appended at the end) -- grade the LAST occurrence,
  // which is the terminal phone block's own rule.
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'g');
  const matches = [...stripped.matchAll(re)];
  if (matches.length === 0) {
    throw new Error(`selector ${selector} not found in supplied CSS source`);
  }
  const lastMatch = matches[matches.length - 1];
  if (lastMatch === undefined) {
    throw new Error(`selector ${selector}: unreachable, matches.length checked non-zero`);
  }
  const body = lastMatch[1];
  if (body === undefined) {
    throw new Error(`selector ${selector} matched with no capture group body`);
  }

  const minHeight44 = /min-height\s*:\s*44px/.test(body);
  const isFlex = /display\s*:\s*flex/.test(body);
  const isCentred = /align-items\s*:\s*center/.test(body);
  const centredFlex = isFlex && isCentred;

  const paddingMatch = body.match(/padding\s*:\s*([^;]+);/);
  let nonZeroHorizontalPadding = false;
  if (paddingMatch) {
    const rawValue = paddingMatch[1];
    if (rawValue === undefined) {
      throw new Error('padding declaration matched with no capture group value');
    }
    const parts = rawValue.trim().split(/\s+/).map((p) => parseFloat(p));
    // CSS shorthand: 1 value = all sides, 2 = vert/horiz, 3 = top/horiz/bottom,
    // 4 = top/right/bottom/left. Horizontal padding is the right-hand value(s).
    let horiz: number;
    if (parts.length === 1) {
      const only = parts[0];
      if (only === undefined) throw new Error('unreachable: 1-value padding shorthand missing value');
      horiz = only;
    } else if (parts.length <= 3) {
      const second = parts[1];
      if (second === undefined) throw new Error('unreachable: padding shorthand missing horizontal value');
      horiz = second;
    } else {
      const right = parts[1];
      const left = parts[3];
      if (right === undefined || left === undefined) throw new Error('unreachable: 4-value padding shorthand missing value');
      horiz = Math.max(right, left);
    }
    nonZeroHorizontalPadding = horiz > 0;
  }
  // padding-left/padding-right longhand fallback (not used by either rule
  // today, but the check should not be fooled if a future edit switches).
  if (!nonZeroHorizontalPadding) {
    const left = body.match(/padding-left\s*:\s*([\d.]+)px/);
    const right = body.match(/padding-right\s*:\s*([\d.]+)px/);
    const inline = body.match(/padding-inline\s*:\s*([\d.]+)px/);
    if ((left?.[1] && parseFloat(left[1]) > 0) || (right?.[1] && parseFloat(right[1]) > 0) || (inline?.[1] && parseFloat(inline[1]) > 0)) {
      nonZeroHorizontalPadding = true;
    }
  }

  return { minHeight44, centredFlex, nonZeroHorizontalPadding };
}

describe('public 390 width-floor (DEC-393 wave-33)', () => {
  it('a.chq-docs-phone-back carries min-height:44px, centred flex, AND non-zero horizontal padding', () => {
    const result = checkSelectorFloor(DOCS_SITE_CSS, '.chq-docs-phone-back');
    expect(result.minHeight44).toBe(true);
    expect(result.centredFlex).toBe(true);
    expect(result.nonZeroHorizontalPadding).toBe(true);
  });

  it('a.chq-pub-activefilters-clear carries min-height:44px, centred flex, AND non-zero horizontal padding', () => {
    const result = checkSelectorFloor(CHROME_CSS_COMPOSED, '.chq-pub-activefilters-clear');
    expect(result.minHeight44).toBe(true);
    expect(result.centredFlex).toBe(true);
    expect(result.nonZeroHorizontalPadding).toBe(true);
  });

  it('does not touch the sibling .chq-pub-select-clear rule (task scope: only fix rows that measure short)', () => {
    // .chq-pub-select-clear was not named as an offender in the roster
    // (docs/design/audit/public-390-interactive-offenders-v12.md) and its
    // arithmetic is unchanged by this wave's edit -- still padding: 0 4px.
    const stripped = stripComments(CHROME_CSS_COMPOSED);
    const matches = [...stripped.matchAll(/\.chq-pub-select-clear\s*\{([^}]*)\}/g)];
    expect(matches.length).toBeGreaterThan(0);
    const body = matches[matches.length - 1]?.[1];
    expect(body).toBeDefined();
    expect(body).toContain('padding: 0 4px');
  });

  it('negative control: a synthetic rule with min-height but zero horizontal padding is reported as an offender', () => {
    const syntheticOffender = `
      @media (max-width: 480px) {
        .chq-synthetic-offender {
          display: flex;
          align-items: center;
          min-height: 44px;
          padding: 0;
        }
      }
    `;
    const result = checkSelectorFloor(syntheticOffender, '.chq-synthetic-offender');
    expect(result.minHeight44).toBe(true);
    expect(result.centredFlex).toBe(true);
    expect(result.nonZeroHorizontalPadding).toBe(false);
  });
});
