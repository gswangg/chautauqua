// v12m-w6-h (Tier 2, the 44px floor: the link population nothing measures).
// docs/design/audit/phone-tap-floor-links.md re-derives the population that
// phone-tap-target.scan.test.ts's <(input|select|button|a)>-plus-chq-btn
// regex can never see: every chq-* token rendered on a React Router <Link>/
// <NavLink> or a bare <a>. This test locks the three ROOMY tokens this wave
// fixed -- .chq-detail-content-link and .chq-detail-delete-link
// (app/src/pages/submissions/detail.css) and .chq-error-summary-link
// (app/src/components/error-states.css) -- to DESIGN-RULINGS.md:189's
// floor: min-height:44px, centred flex, and horizontal padding, inside a
// max-width block. It also re-asserts each token's pre-existing top-level
// rule is byte-unchanged in the properties it already declared, since this
// wave is only ever supposed to ADD a phone rule, never touch desktop
// (DEC-385: single-direction responsive, narrow overrides wide via
// max-width media queries ONLY).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const DETAIL_CSS_PATH = join(HERE, '..', 'pages', 'submissions', 'detail.css');
const ERROR_STATES_CSS_PATH = join(HERE, 'error-states.css');

/** Extracts a top-level (not inside any @media block) rule's declaration
 * body by selector. Strips every @media block first (one level of nested
 * braces, which is all any sheet here uses) so a selector that also
 * appears inside a phone block is never mistaken for the top-level one. */
function topLevelRuleBody(css: string, selector: string): string {
  const withoutMedia = css.replace(/@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g, '');
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = withoutMedia.match(new RegExp(`(^|[,{}\\s])${escaped}\\s*\\{([^}]*)\\}`));
  const body = match?.[2];
  if (body === undefined) throw new Error(`no top-level rule found for ${selector}`);
  return body;
}

/** True if a property:value pair (order-independent within the value's own
 * whitespace) exists verbatim in a declaration body. */
function declares(body: string, prop: string, value: string): boolean {
  const re = new RegExp(`${prop}\\s*:\\s*${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*;`);
  return re.test(body);
}

/** Every rule body anywhere in the file (top-level or inside any @media
 * block) whose selector list contains the given selector -- used to find
 * a token's phone-only floor rule regardless of which appended block it
 * lives in. */
function allRuleBodiesFor(css: string, selector: string): string[] {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  const bodies: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = ruleRe.exec(css))) {
    const selectors = (m[1] ?? '').split(',').map((s) => s.trim());
    if (selectors.some((s) => s === selector)) bodies.push(m[2] ?? '');
  }
  if (bodies.length === 0) {
    throw new Error(`no rule found anywhere for ${escaped}`);
  }
  return bodies;
}

/** The token's floor rule: the one body (of possibly several across the
 * file) that actually declares min-height. Fails loudly if none does --
 * a token with no floored body at all is exactly the defect this test
 * exists to catch. */
function floorBody(css: string, selector: string): string {
  const bodies = allRuleBodiesFor(css, selector);
  const floored = bodies.find((b) => /min-height\s*:/.test(b));
  if (!floored) {
    throw new Error(`no min-height declared for ${selector} in any of its ${bodies.length} rule body(ies)`);
  }
  return floored;
}

/** True if the body sits inside a `@media (max-width: ...)` block (never a
 * top-level, always-applied rule) -- DEC-385 requires this to be a narrow
 * override, not a desktop-wide change. */
function isInsideMaxWidthBlock(css: string, body: string): boolean {
  const idx = css.indexOf(body);
  if (idx === -1) return false;
  const before = css.slice(0, idx);
  const openMedia = before.lastIndexOf('@media');
  if (openMedia === -1) return false;
  const mediaHeader = css.slice(openMedia, before.indexOf('{', openMedia) + 1);
  if (!/max-width\s*:/.test(mediaHeader)) return false;
  // Make sure that @media block hasn't already closed before `body` starts
  // (i.e. `body` really is nested inside it, not just textually after it).
  let depth = 0;
  for (let i = before.indexOf('{', openMedia); i < idx; i += 1) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return false; // block closed before body started
    }
  }
  return true;
}

describe('the 44px floor for the three ROOMY link tokens this wave fixed', () => {
  const detailCss = readFileSync(DETAIL_CSS_PATH, 'utf-8');
  const errorStatesCss = readFileSync(ERROR_STATES_CSS_PATH, 'utf-8');

  const cases: Array<{ name: string; css: string; selector: string }> = [
    { name: 'chq-detail-content-link', css: detailCss, selector: '.chq-detail-content-link' },
    { name: 'chq-detail-delete-link', css: detailCss, selector: '.chq-detail-delete-link' },
    { name: 'chq-error-summary-link', css: errorStatesCss, selector: '.chq-error-summary-link' },
  ];

  for (const { name, css, selector } of cases) {
    it(`${name} declares min-height:44px, centred flex, and horizontal padding inside a max-width block`, () => {
      const body = floorBody(css, selector);
      expect(declares(body, 'min-height', '44px')).toBe(true);
      expect(declares(body, 'display', 'inline-flex')).toBe(true);
      expect(declares(body, 'align-items', 'center')).toBe(true);
      // Horizontal padding: either a `padding` shorthand with a non-zero
      // second/only value, or an explicit padding-left/-right pair.
      const hasShorthandPadding = /padding\s*:\s*(?!0\s*;)[^;]*[1-9][0-9]*px[^;]*;/.test(body);
      const hasLonghandPadding =
        /padding-left\s*:\s*[1-9][0-9]*px\s*;/.test(body) && /padding-right\s*:\s*[1-9][0-9]*px\s*;/.test(body);
      expect(hasShorthandPadding || hasLonghandPadding).toBe(true);
      expect(isInsideMaxWidthBlock(css, body)).toBe(true);
    });
  }

  it('DESKTOP PRESERVED: .chq-detail-content-link keeps its existing top-level property (align-self) unchanged', () => {
    const body = topLevelRuleBody(detailCss, '.chq-detail-content-link');
    expect(declares(body, 'align-self', 'flex-start')).toBe(true);
    // No floor properties leaked into the always-applied desktop rule.
    expect(body).not.toMatch(/min-height\s*:/);
  });

  it('DESKTOP PRESERVED: .chq-detail-delete-link keeps its existing top-level properties (font-size, color) unchanged', () => {
    const body = topLevelRuleBody(detailCss, '.chq-detail-delete-link');
    expect(declares(body, 'font-size', '13px')).toBe(true);
    expect(declares(body, 'color', 'var(--chq-muted)')).toBe(true);
    expect(body).not.toMatch(/min-height\s*:/);
  });

  it('DESKTOP PRESERVED: .chq-error-summary-link keeps its existing top-level properties (font-size, font-weight, color, text-decoration) unchanged', () => {
    const body = topLevelRuleBody(errorStatesCss, '.chq-error-summary-link');
    expect(declares(body, 'font-size', '13px')).toBe(true);
    expect(declares(body, 'font-weight', '700')).toBe(true);
    expect(declares(body, 'color', 'var(--chq-brand)')).toBe(true);
    expect(declares(body, 'text-decoration', 'none')).toBe(true);
    expect(body).not.toMatch(/min-height\s*:/);
  });

  it('the error-vocabulary parity scan still ignores this token (it never claimed .chq-error-summary-link needs an SSR twin)', () => {
    // Sanity guard: the new @media block must not accidentally change the
    // top-level rule's text such that the parity scan's selector regex
    // (test/error-vocabulary-parity.scan.test.ts) starts matching the
    // wrong body. The desktop rule text itself is untouched (asserted
    // above); this just confirms exactly one top-level declaration exists.
    const topLevelOnly = errorStatesCss.replace(/@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g, '');
    const occurrences = topLevelOnly.match(/\.chq-error-summary-link\s*\{/g) ?? [];
    expect(occurrences.length).toBe(1);
  });
});
