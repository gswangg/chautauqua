// v12 design pack — review cluster, wave 7 (task w7-b).
//
// Two defects, one terminal `@media (max-width: 700px)` block appended to
// review.css:
//
//   1. CASCADE REPAIR (DEC-385 wave-7 amendment). Two selectors each carry a
//      phone-narrow override placed BEFORE a later top-level re-declaration
//      of the same property on the same selector — since `@media` adds no
//      specificity, source order alone decides, and the later top-level rule
//      wins at every width including 390:
//        .chq-review-reviewer-row  — phone rule at :1208-1212 (1 track) is
//          beaten by the top-level 5-track grid at :1675-1677.
//        .chq-review-summary-grid  — phone rule at :1379-1383 (2-up) is
//          beaten by the top-level 2-up re-declaration at :1667-1670 (same
//          values today, but the shape is what this test pins).
//      The fix restates both, one final time, at the very end of the file.
//
//   2. THE 44px FLOOR (DEC-393 wave-7 amendment, DESIGN-RULINGS.md "The 44px
//      floor, and how it gets evaded"). Four anchors are styled only by
//      font-size/weight with no height or padding, so they measure well
//      under 44px tall: the per-plan row actions
//      (`.chq-review-plan-actions > a` / `> .chq-link-button`), the reviewer
//      row action (`.chq-reviewer-plan-row-action`), and the two back links
//      (`.chq-review-back`, `.chq-review-editor-back-link`). Each gets
//      `min-height:44px` + centred flex + `padding-inline:10px` with an
//      equal-and-opposite `margin-inline:-10px` so the added hit box does
//      not shift the ink the frame draws (Chautauqua Review.dc.html:793,
//      the 390 "Your plans · /review" frame -- receipted below).
//
// jsdom applies no stylesheet and evaluates no @media rule, so this is a
// source-scan pin on the CSS TEXT, mirroring the read/phoneLayer helper
// shape in app/src/pages/contacts/contacts-phone-frames.test.ts — with one
// addition (`parseRules`) needed here because this file's shadowed-pair
// assertion must see BOTH the phone-block and the top-level copy of the
// same selector, in source order, not just the phone layer in isolation.
//
// Desktop is frozen: every new declaration this test pins lives inside a
// `max-width: 700px` block, and nothing above the terminal block was
// touched.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Comments stripped before any brace scanning -- a literal `{`/`}` inside a
 * long explanatory comment (this file has several) would desynchronise a
 * naive depth counter. */
function read(file: string): string {
  return readFileSync(join(HERE, file), 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');
}

const REVIEW_CSS = read('review.css');

interface Rule {
  selectors: string[];
  body: string;
  /** The @media condition text this rule sits directly inside, or null for
   * a top-level rule. Only one level of nesting exists in this file. */
  media: string | null;
}

/** Brace-matched parse into a flat, SOURCE-ORDER list of rules, each tagged
 * with its enclosing @media condition (if any). Regex-only scanning (the
 * `([^{}]+)\{([^{}]*)\}` shape used once a sheet has been flattened to a
 * single phone layer) cannot be used directly on a whole file that mixes
 * top-level rules with nested media rules -- it would treat an `@media`
 * block's own `{`/`}` as an ordinary rule and truncate at the first nested
 * `}`. This walks the brace tree instead. */
function parseRules(css: string): Rule[] {
  const rules: Rule[] = [];
  let i = 0;
  function parseBlock(mediaCtx: string | null): void {
    while (i < css.length) {
      let j = i;
      while (j < css.length && css[j] !== '{' && css[j] !== '}') j += 1;
      if (j >= css.length) return;
      if (css[j] === '}') {
        i = j + 1;
        return;
      }
      const header = css.slice(i, j).trim();
      i = j + 1;
      if (header.startsWith('@media')) {
        parseBlock(header);
      } else {
        let depth = 1;
        let k = i;
        while (k < css.length && depth > 0) {
          if (css[k] === '{') depth += 1;
          else if (css[k] === '}') depth -= 1;
          k += 1;
        }
        const body = css.slice(i, k - 1);
        rules.push({
          selectors: header
            .split(',')
            .map((s) => s.trim().replace(/\s+/g, ' '))
            .filter(Boolean),
          body,
          media: mediaCtx,
        });
        i = k;
      }
    }
  }
  parseBlock(null);
  if (rules.length === 0) throw new Error('no rules parsed');
  return rules;
}

const RULES = parseRules(REVIEW_CSS);

function isMaxWidth700(media: string | null): boolean {
  return media !== null && /max-width:\s*700px/.test(media);
}

/** All rules (in source order) whose selector list includes `selector`
 * exactly (whole member, not substring). */
function occurrences(selector: string): Rule[] {
  const found = RULES.filter((r) => r.selectors.includes(selector));
  if (found.length === 0) throw new Error(`no rule for selector ${selector}`);
  return found;
}

function last<T>(arr: T[]): T {
  return arr[arr.length - 1]!;
}

describe('review.css phone cascade repair (DEC-385 wave-7 amendment)', () => {
  it('.chq-review-reviewer-row: last declaration in the file is inside a max-width:700px block', () => {
    const occ = occurrences('.chq-review-reviewer-row');
    // Three occurrences on main: the original phone override (:1208), the
    // top-level 5-track widen (:1675) that used to beat it, and this task's
    // terminal restatement.
    expect(occ.length).toBeGreaterThanOrEqual(3);
    const lastOcc = last(occ);
    expect(isMaxWidth700(lastOcc.media)).toBe(true);
    expect(lastOcc.body).toMatch(/grid-template-columns:\s*1fr\s*;/);
  });

  it('.chq-review-summary-grid: last declaration in the file is inside a max-width:700px block', () => {
    const occ = occurrences('.chq-review-summary-grid');
    expect(occ.length).toBeGreaterThanOrEqual(3);
    const lastOcc = last(occ);
    expect(isMaxWidth700(lastOcc.media)).toBe(true);
    expect(lastOcc.body).toMatch(/grid-template-columns:\s*1fr\s+1fr\s*;/);
  });

  it('the terminal cascade-repair block is the LAST @media (max-width: 700px) block in the file', () => {
    const phoneBlocks = RULES.filter((r) => isMaxWidth700(r.media));
    const lastBlockCondition = last(phoneBlocks).media;
    // every rule tagged with that exact media-condition string instance
    // must come from the same (final) @media occurrence -- checked
    // indirectly: the reviewer-row and summary-grid fixes above are already
    // asserted to be the LAST occurrence of their selectors, which can only
    // be true if they live in the file's final phone block.
    expect(lastBlockCondition).toMatch(/max-width:\s*700px/);
  });
});

describe('review.css 44px tap-target floor (DEC-393 wave-7 amendment)', () => {
  const FLOOR_ANCHORS: { selector: string; label: string }[] = [
    { selector: '.chq-review-plan-actions > a', label: 'plan-list row actions (anchor)' },
    { selector: '.chq-review-plan-actions > .chq-link-button', label: 'plan-list row actions (link-button)' },
    { selector: '.chq-reviewer-plan-row-action', label: 'reviewer plan row action' },
    { selector: '.chq-review-back', label: 'back link' },
    { selector: '.chq-review-editor-back-link', label: 'editor back link' },
  ];

  // docs/design/Chautauqua Review.dc.html:793
  // `<div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)">`
  // -- the 390 frame each anchor below sits inside.
  it.each(FLOOR_ANCHORS)('$selector ($label) carries all four floor declarations inside a max-width:700px block', ({ selector }) => {
    const occ = occurrences(selector).filter((r) => isMaxWidth700(r.media));
    expect(occ.length).toBeGreaterThan(0);
    const body = last(occ).body;
    expect(body).toMatch(/min-height:\s*44px\s*;/);
    expect(body).toMatch(/display:\s*flex\s*;/);
    expect(body).toMatch(/align-items:\s*center\s*;/);
    expect(body).toMatch(/padding-inline:\s*10px\s*;/);
    expect(body).toMatch(/margin-inline:\s*-10px\s*;/);
  });

  it.each(FLOOR_ANCHORS)('$selector: padding-inline and margin-inline are equal and opposite magnitudes', ({ selector }) => {
    const occ = occurrences(selector).filter((r) => isMaxWidth700(r.media));
    const body = last(occ).body;
    const padding = /padding-inline:\s*(-?\d+(?:\.\d+)?)px\s*;/.exec(body);
    const margin = /margin-inline:\s*(-?\d+(?:\.\d+)?)px\s*;/.exec(body);
    expect(padding).not.toBeNull();
    expect(margin).not.toBeNull();
    const paddingValue = Number(padding![1]);
    const marginValue = Number(margin![1]);
    expect(paddingValue).toBeGreaterThan(0);
    expect(marginValue).toBe(-paddingValue);
  });

  it('none of the four floor declarations were added outside a max-width block (desktop frozen)', () => {
    for (const { selector } of FLOOR_ANCHORS) {
      const topLevel = occurrences(selector).filter((r) => r.media === null);
      for (const rule of topLevel) {
        expect(rule.body).not.toMatch(/min-height:\s*44px/);
        expect(rule.body).not.toMatch(/padding-inline:\s*10px/);
      }
    }
  });
});

describe('DEC-385 single-direction (no min-width query introduced)', () => {
  it('review.css contains no min-width media query', () => {
    expect(REVIEW_CSS).not.toMatch(/@media[^{]*min-width/);
  });
});
