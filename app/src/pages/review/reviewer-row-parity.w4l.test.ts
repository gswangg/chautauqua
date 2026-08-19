// v12m-w4-l: closes a red on main. Commit 7f450624 (authored by the user,
// v12-review round) gave `.chq-review-reviewer-form .chq-btn` a
// `min-height: 44px` top-level rule, scoped to that one row -- the input
// beside it is a two-line stack (heading over input) at 44px, so the
// button read as visually short at 37px against it even after
// bottom-alignment (align-items: flex-end). DEC-393 wave-108 amendment:
// the user's override outranks any earlier pin, and the fix is scoped to
// this row only -- the shared `.chq-btn` token itself must stay untouched
// so every other button on the page keeps its own metrics.
//
// This is a source-scan pin over review.css, not a render test: it exists
// purely to catch a future edit that either removes the scoped floor or
// widens it into a bare top-level `.chq-btn { min-height: ... }` rule,
// which would silently re-floor every button sharing that class sheet-wide.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const REVIEW_CSS_PATH = join(HERE, 'review.css');

/** Strips CSS comments before any brace walk. Provenance comments in this
 * sheet quote CSS symbols (`@media`, selector-looking text) that would
 * desynchronise a naive brace/selector scan if left in. */
const stripComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** Strips every @media block (one level of nested braces, all this sheet
 * uses) so a selector that also appears inside a phone block is never
 * mistaken for the top-level one. */
function withoutMediaBlocks(css: string): string {
  return css.replace(/@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g, '');
}

/** Extracts a top-level rule's declaration body by exact selector (the
 * selector list entry must match verbatim, not just contain the text). */
function topLevelRuleBody(css: string, selector: string): string {
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = ruleRe.exec(css))) {
    const selectors = (m[1] ?? '').split(',').map((s) => s.trim());
    if (selectors.some((s) => s === selector)) return m[2] ?? '';
  }
  throw new Error(`no top-level rule found for ${selector}`);
}

function declares(body: string, prop: string, value: string): boolean {
  const re = new RegExp(`${prop}\\s*:\\s*${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*;`);
  return re.test(body);
}

describe('reviewer-row .chq-btn 44px floor parity (commit 7f450624)', () => {
  const reviewCss = stripComments(readFileSync(REVIEW_CSS_PATH, 'utf-8'));
  const topLevelOnly = withoutMediaBlocks(reviewCss);

  it('.chq-review-reviewer-form .chq-btn declares min-height:44px at top level', () => {
    const body = topLevelRuleBody(topLevelOnly, '.chq-review-reviewer-form .chq-btn');
    expect(declares(body, 'min-height', '44px')).toBe(true);
  });

  it('no bare top-level .chq-btn rule declares its own min-height (the fix stays scoped to the reviewer row)', () => {
    // Find every top-level rule whose selector list contains the bare
    // `.chq-btn` selector (not a descendant/compound selector like
    // `.chq-review-reviewer-form .chq-btn`), and assert none of them
    // declare min-height. A future edit that widens the floor to the
    // shared token sheet-wide would re-floor every button on the page --
    // exactly what the user's commit deliberately avoided.
    const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
    let m: RegExpExecArray | null;
    const bareBtnBodiesWithFloor: string[] = [];
    while ((m = ruleRe.exec(topLevelOnly))) {
      const selectors = (m[1] ?? '').split(',').map((s) => s.trim());
      const bareBtn = selectors.find((s) => s === '.chq-btn');
      if (bareBtn && /min-height\s*:/.test(m[2] ?? '')) {
        bareBtnBodiesWithFloor.push(m[2] ?? '');
      }
    }
    expect(bareBtnBodiesWithFloor).toEqual([]);
  });
});
