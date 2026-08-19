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
interface RuleBody {
  body: string;
  /** Byte offset of the first character INSIDE the rule's braces. */
  index: number;
}

function allRuleBodiesFor(css: string, selector: string): RuleBody[] {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  const bodies: RuleBody[] = [];
  let m: RegExpExecArray | null;
  while ((m = ruleRe.exec(css))) {
    const selectors = (m[1] ?? '').split(',').map((s) => s.trim());
    if (selectors.some((s) => s === selector)) {
      bodies.push({ body: m[2] ?? '', index: m.index + m[0].indexOf('{') + 1 });
    }
  }
  if (bodies.length === 0) {
    throw new Error(`no rule found anywhere for ${escaped}`);
  }
  return bodies;
}

/** The token's floor rule: the LAST body (of possibly several across the
 * file) that declares min-height -- the one that actually wins the cascade.
 * Since the DEC-385 wave-100/102/103 forward-merge, a token can carry two
 * phone rules in the same terminal block (e.g. .chq-detail-delete-link at
 * detail.css:870 and :1177); the later one is the effective rule, so the
 * first match would assert against a shadowed body. Fails loudly if none
 * declares a floor -- a token with no floored body at all is exactly the
 * defect this test exists to catch. */
function floorBody(css: string, selector: string): RuleBody {
  const bodies = allRuleBodiesFor(css, selector);
  const floored = [...bodies].reverse().find((b) => /min-height\s*:/.test(b.body));
  if (!floored) {
    throw new Error(`no min-height declared for ${selector} in any of its ${bodies.length} rule body(ies)`);
  }
  return floored;
}

/** True if the body at `idx` sits inside a `@media (max-width: ...)` block
 * (never a top-level, always-applied rule) -- DEC-385 requires this to be a
 * narrow override, not a desktop-wide change. Takes an explicit offset
 * rather than re-finding the body by text: two rules can share a body
 * verbatim, and indexOf would answer for the wrong one. */
function isInsideMaxWidthBlock(css: string, idx: number): boolean {
  if (idx < 0 || idx > css.length) return false;
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
  // CSS comments are stripped before any structural scan. Since the DEC-385
  // wave-100/102/103 forward-merges, a provenance comment can sit between a
  // `}` and the next selector -- where the rule grammar above would swallow
  // it into that rule's selector list -- and can itself contain the literal
  // `@media` (detail.css:1094 reads "so this `@media` block always wins
  // ties"), which the block-header scan would mistake for a real block
  // opener. Comments carry no declarations, so dropping them first is safe.
  const stripComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');
  const detailCss = stripComments(readFileSync(DETAIL_CSS_PATH, 'utf-8'));
  const errorStatesCss = stripComments(readFileSync(ERROR_STATES_CSS_PATH, 'utf-8'));

  const cases: Array<{ name: string; css: string; selector: string }> = [
    { name: 'chq-detail-content-link', css: detailCss, selector: '.chq-detail-content-link' },
    { name: 'chq-detail-delete-link', css: detailCss, selector: '.chq-detail-delete-link' },
    { name: 'chq-error-summary-link', css: errorStatesCss, selector: '.chq-error-summary-link' },
  ];

  for (const { name, css, selector } of cases) {
    it(`${name} declares min-height:44px, centred flex, and horizontal padding inside a max-width block`, () => {
      const { body, index } = floorBody(css, selector);
      expect(declares(body, 'min-height', '44px')).toBe(true);
      expect(declares(body, 'display', 'inline-flex')).toBe(true);
      expect(declares(body, 'align-items', 'center')).toBe(true);
      // Horizontal padding: either a `padding` shorthand with a non-zero
      // second/only value, or an explicit padding-left/-right pair.
      const hasShorthandPadding = /padding\s*:\s*(?!0\s*;)[^;]*[1-9][0-9]*px[^;]*;/.test(body);
      const hasLonghandPadding =
        /padding-left\s*:\s*[1-9][0-9]*px\s*;/.test(body) && /padding-right\s*:\s*[1-9][0-9]*px\s*;/.test(body);
      expect(hasShorthandPadding || hasLonghandPadding).toBe(true);
      expect(isInsideMaxWidthBlock(css, index)).toBe(true);
    });
  }

  it('.chq-detail-delete-link phone rule still declares its OWN horizontal padding (0 8px), not inherited from the top-level rule', () => {
    // Guard against a later 'the top level already has a 44px control box
    // (commit 7f450624), the phone rule is now redundant' cleanup silently
    // deleting the phone rule: the top-level rule never declares padding,
    // so this is the only place horizontal padding for this token exists
    // at any width. Pinning it explicitly (beyond the generic
    // shorthand/longhand check above) makes deleting the phone block a
    // visible test failure, not a silent regression.
    const { body } = floorBody(detailCss, '.chq-detail-delete-link');
    expect(declares(body, 'padding', '0 8px')).toBe(true);
  });

  it('DESKTOP PRESERVED: .chq-detail-content-link keeps its existing top-level property (align-self) unchanged', () => {
    const body = topLevelRuleBody(detailCss, '.chq-detail-content-link');
    expect(declares(body, 'align-self', 'flex-start')).toBe(true);
    // No floor properties leaked into the always-applied desktop rule.
    expect(body).not.toMatch(/min-height\s*:/);
  });

  it('USER OVERRIDE (commit 7f450624): .chq-detail-delete-link gets a real control box at EVERY width, not just on phone', () => {
    // DEC-393 wave-108 amendment: the user's own v12-review commit
    // (7f450624) rules that a bare 13px muted anchor read as unstyled lost
    // text, and gave the top-level rule a real 44px control box -- at
    // every width, not narrowed behind a max-width block. This outranks
    // both the desktop freeze and this file's earlier 'no min-height at
    // top level' pin for this one selector; that pin is now stale and is
    // rewritten positively rather than deleted. The pre-existing font-size
    // and color are still asserted since the user's commit kept them.
    const body = topLevelRuleBody(detailCss, '.chq-detail-delete-link');
    expect(declares(body, 'font-size', '13px')).toBe(true);
    expect(declares(body, 'color', 'var(--chq-muted)')).toBe(true);
    expect(declares(body, 'display', 'inline-flex')).toBe(true);
    expect(declares(body, 'align-items', 'center')).toBe(true);
    expect(declares(body, 'min-height', '44px')).toBe(true);
    expect(declares(body, 'white-space', 'nowrap')).toBe(true);
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
