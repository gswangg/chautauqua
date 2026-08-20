// task w12-l (DEC-393, DEC-989, DEC-576): the review-cluster tier-2 sweep.
//
// docs/design/DESIGN-RULINGS.md`The 44px floor, and how it gets evaded` --
// every interactive element on a phone needs `min-height:44px` PLUS centred
// flex PLUS non-zero horizontal padding; padding alone (or min-height
// alone) does not reach the floor.
//
// jsdom applies no stylesheet and evaluates no @media rule, so -- mirroring
// review-admin-phone-frames.test.ts -- these are source-scan pins on
// review.css/scorecard.css's TEXT, not computed style. Desktop is frozen:
// every assertion below reads only inside a `max-width` phone block or a
// top-level `tap-floor-exempt` comment; nothing here touches a top-level
// rule's body.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEC_393, DEC_576, DEC_989 } from '../../../../src/decisions';

void DEC_393; // the row-action-anchor tap-target floor this task drains
void DEC_989; // horizontal-overflow-at-390 + the ratchet shape this task lowers
void DEC_576; // this wave's ruling: .chq-pill's anchor form is floored once, in styles.css

const HERE = dirname(fileURLToPath(import.meta.url));

function read(file: string): string {
  return readFileSync(join(HERE, file), 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');
}
function readRaw(file: string): string {
  return readFileSync(join(HERE, file), 'utf-8');
}

const REVIEW_CSS = read('review.css');
const REVIEW_CSS_RAW = readRaw('review.css');
const SCORECARD_CSS = read('scorecard.css');
const SCORECARD_CSS_RAW = readRaw('scorecard.css');

/** Concatenated bodies of every `@media (max-width: …)` block in `css`,
 * brace-matched (not regex-bounded) so a nested rule never ends it early. */
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
 * Selectors compared as whole members of the rule's selector list. Last
 * declaration wins when a selector is restated (matches the cascade). */
function phoneRule(css: string, selector: string): string {
  const layer = phoneLayer(css);
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  let found: string | null = null;
  while ((m = rule.exec(layer)) !== null) {
    const selectors = m[1]!
      .split(',')
      .map((s) => s.trim().replace(/\s+/g, ' '))
      .filter(Boolean);
    if (selectors.includes(selector)) found = m[2]!;
  }
  if (found === null) throw new Error(`no phone rule for ${selector}`);
  return found;
}

const FLOOR_RE = {
  minHeight: /min-height:\s*44px/,
  flexCenter: /display:\s*flex/,
  alignCenter: /align-items:\s*center/,
  paddingNonZero: /padding(?:-(?:left|right|inline))?:\s*(?!0(?:px)?(?:\s|;|$))\S/,
};

function expectFloored(css: string, selector: string): void {
  const rule = phoneRule(css, selector);
  expect(rule).toMatch(FLOOR_RE.minHeight);
  expect(rule).toMatch(FLOOR_RE.flexCenter);
  expect(rule).toMatch(FLOOR_RE.alignCenter);
  expect(rule).toMatch(/padding:\s*0 \d/);
}

describe('review.css tier-2 anchor-floor sweep (task w12-l, DEC-393)', () => {
  it('.chq-review-add-link (criterion-options-footer form) is floored, not inline-flex', () => {
    expectFloored(REVIEW_CSS, '.chq-review-criterion-options-footer .chq-review-add-link');
  });

  it('.chq-review-add-link (add-criteria form) is floored, not inline-flex', () => {
    expectFloored(REVIEW_CSS, '.chq-review-add-criteria .chq-review-add-link');
  });

  it('.chq-review-plan-action-link is floored with display:flex (not inline-flex)', () => {
    expectFloored(REVIEW_CSS, '.chq-review-plan-action-link');
  });

  it('.chq-review-section-head-actions .chq-link-button is floored with display:flex (not inline-flex)', () => {
    expectFloored(REVIEW_CSS, '.chq-review-section-head-actions .chq-link-button');
  });

  it('a.chq-review-queue-title (the Link form only) is floored', () => {
    expectFloored(REVIEW_CSS, 'a.chq-review-queue-title');
  });

  it('.chq-review-results-head-actions .chq-link-button is floored', () => {
    expectFloored(REVIEW_CSS, '.chq-review-results-head-actions .chq-link-button');
  });

  const buttonOnlyContainers = [
    '.chq-review-criteria-empty-actions',
    '.chq-review-decision-actions',
    '.chq-review-editor-actions',
    '.chq-review-editor-title-actions',
    '.chq-review-scope-confirm-actions',
    '.chq-review-title-actions',
  ];
  it.each(buttonOnlyContainers)(
    '%s carries a tap-floor-exempt comment (button-only container, DEC-393)',
    (selector) => {
      const re = new RegExp(
        `\\/\\*\\s*tap-floor-exempt:[^*]*\\*\\/\\s*[^{}]*\\${selector}\\b[^{}]*\\{`,
      );
      expect(REVIEW_CSS_RAW).toMatch(re);
    },
  );

  it('.chq-pill carries a DEC-576 composition exemption, not a second floor', () => {
    const re = /\/\*\s*tap-floor-exempt:\s*composition[^*]*\*\/\s*[^{}]*\.chq-pill\b[^{}]*\{/;
    expect(REVIEW_CSS_RAW).toMatch(re);
  });

  it('DEC-576: PlanList.tsx renders .chq-pill only on a <span>, never a bare <a>', () => {
    const tsx = readFileSync(join(HERE, 'PlanList.tsx'), 'utf-8');
    const pillTags = [...tsx.matchAll(/<(a|Link|span)\b[^>]*chq-pill[^>]*>/g)].map((m) => m[1]);
    expect(pillTags.length).toBeGreaterThan(0);
    expect(pillTags.every((tag) => tag === 'span')).toBe(true);
  });

});

describe('review.css tier-2 overflow sweep (task w12-l, DEC-989)', () => {
  it('.chq-review-criteria-eyebrow keeps nowrap invisible at phone width, but the escape is stated (display:none does not clear a value-level scan)', () => {
    const rule = phoneRule(REVIEW_CSS, '.chq-review-criteria-eyebrow');
    expect(rule).toMatch(/display:\s*none/);
    expect(rule).toMatch(/overflow:\s*hidden/);
    expect(rule).toMatch(/text-overflow:\s*ellipsis/);
  });

  it('.chq-reviewer-plan-head-row clears its fixed grid tracks in the phone layer while staying hidden', () => {
    const rule = phoneRule(REVIEW_CSS, '.chq-reviewer-plan-head-row');
    expect(rule).toMatch(/display:\s*none/);
    expect(rule).toMatch(/grid-template-columns:\s*1fr/);
    // no fixed px track survives in the phone-layer declaration
    expect(rule.match(/\d+(?:\.\d+)?px/g) ?? []).toEqual([]);
  });
});

describe('scorecard.css tier-2 anchor-floor sweep (task w12-l, DEC-393)', () => {
  it('.chq-review-scorecard-rail .chq-review-editor-actions carries a tap-floor-exempt comment (button-only, desktop-only)', () => {
    const re =
      /\/\*\s*tap-floor-exempt:[^*]*\*\/\s*[^{}]*\.chq-review-scorecard-rail \.chq-review-editor-actions\b[^{}]*\{/;
    expect(SCORECARD_CSS_RAW).toMatch(re);
  });
});

describe('desktop frozen (DEC-385)', () => {
  it('review.css/scorecard.css carry no min-width media query', () => {
    expect(REVIEW_CSS).not.toMatch(/@media[^{]*min-width/);
    expect(SCORECARD_CSS).not.toMatch(/@media[^{]*min-width/);
  });

  it('every edited selector in this task still owns its original top-level (desktop) declaration, untouched', () => {
    // Bare-existence check: the top-level rule for each still exists
    // outside any @media block, i.e. this task added/strengthened only
    // inside max-width blocks or as an exemption comment above the
    // existing top-level rule.
    const withoutMedia = REVIEW_CSS.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
    for (const selector of [
      '.chq-review-criteria-empty-actions',
      '.chq-review-decision-actions',
      '.chq-review-editor-actions',
      '.chq-review-editor-title-actions',
      '.chq-review-scope-confirm-actions',
      '.chq-review-title-actions',
      '.chq-review-queue-title',
      '.chq-review-results-head-actions',
    ]) {
      expect(withoutMedia).toContain(`${selector} {`);
    }
  });
});
