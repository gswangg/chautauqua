// app/src/pages/content/content-phone-floor.test.ts — task w8-e, DEC-393 /
// DEC-989 wave-90 amendments, TIER 2, v12 mobile campaign.
//
// Closes the Content cluster's docs/design/audit/tap-floor-v12.md rows: the
// 44px tap floor (DEC-393) for ten listed offenders and the 358px phone
// overflow escape (DEC-989) for seven listed offenders. These landed
// originally (wave 90) as a SECOND `@media (max-width: 700px)` block
// appended at the true end of content.css; w7-c (DEC-385 wave-111)
// forward-merged that second block into the file's original phone block,
// so content.css now carries exactly ONE terminal `@media (max-width:
// 700px)` block containing both. DEC-385 wave-85/wave-90 rulings: single-
// direction protects source order, not a one-block-per-file count — this
// file's assertions below read the (now sole) LAST block, which still
// contains every rule this task landed.
//
// EXCLUDED BY RULING (DEC-393 wave-90 amendment): `.chq-bulkbar-actions` and
// `.chq-pill` are shell-lane tokens whose base rule lives in
// app/src/styles.css -- this file must declare NO phone rule for either
// (asserted below), so the fix never mints a fifth copy of a shared
// vocabulary (DEC-613).
//
// JUDGEMENT CALL (recorded per the task instructions): five of the ten
// tap-floor offenders -- `.chq-content-actions`, `.chq-content-comment-
// actions`, `.chq-content-status-band-actions`, `.chq-content-summary-
// actions`, `.chq-content-files-header-actions` -- are flex containers whose
// interactive children are all `<button class="chq-btn ...">`
// (SessionList.tsx / CommentThread.tsx / DeliverableDetail.tsx /
// ContentApp.tsx / FilesLibrary.tsx), never an `<a>`/`<Link>`/
// `.chq-link-button` -- the only shapes the task's flush-row-anchor recipe
// (min-height + display:flex + align-items:center + padding-inline
// cancelled by margin-inline) names. The shared `.chq-btn` base
// (styles.css, frozen, out of this lane's scope) already gives every button
// `display:inline-flex; align-items:center; padding:10px 16px`; the
// substantive gap is height alone, so these five are closed with
// `min-height:44px` on their `.chq-btn` descendant instead of the full
// flush-anchor recipe (which would double up padding meant for a bare text
// link onto a control that already has its own chrome). This test asserts
// exactly that shape for those five, and the full four/five-property recipe
// for the three real anchors plus the empty `.chq-content-worklist-col-
// actions` header spacer.
//
// UPDATE (w7-c, DEC-385 wave-111 merge): `.chq-content-comment-actions
// .chq-btn` carries this batch's blanket `min-height:44px` in the CSS
// TEXT one property below a more specific, deliberate `min-height:48px`
// rule for the same selector (composer buttons, frame :422-424) that
// content.css declares earlier in the now-single phone block -- the merge
// collapsed the redundant/lower 44px declaration rather than shipping a
// second, competing value for one (selector, property) pair, so this
// selector's assertion below (>= 44px) is satisfied by the surviving 48px
// rule, not by a rule declared in this batch's own section.
//
// `.chq-content-detail-actions` (the container wrapping the two
// `.chq-content-detail-action-link` anchors) is closed by growing its
// anchor children, never itself -- no separate rule for the container, so
// it is not asserted as its own selector below.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const CSS_PATH = resolve(__dirname, 'content.css');
const CSS = readFileSync(CSS_PATH, 'utf-8');

const MAX_WIDTH_700_RE = /@media\s*\(max-width:\s*700px\)\s*\{/g;

/** Returns the [start, end) character range of every top-level
 * `@media (max-width: 700px) { ... }` block, matched by brace counting so
 * nested rules inside each block don't terminate it early. */
function findMaxWidth700Blocks(src: string): Array<{ openIdx: number; bodyStart: number; bodyEnd: number; blockEnd: number }> {
  const blocks: Array<{ openIdx: number; bodyStart: number; bodyEnd: number; blockEnd: number }> = [];
  let m: RegExpExecArray | null;
  MAX_WIDTH_700_RE.lastIndex = 0;
  while ((m = MAX_WIDTH_700_RE.exec(src)) !== null) {
    const openIdx = m.index;
    const bodyStart = m.index + m[0].length;
    let depth = 1;
    let i = bodyStart;
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) break;
      }
    }
    blocks.push({ openIdx, bodyStart, bodyEnd: i, blockEnd: i + 1 });
  }
  return blocks;
}

/** Returns the end offset of every top-level construct (rule or @media
 * block) in `src` -- used to check that nothing follows the last phone
 * block. */
function topLevelConstructEnds(src: string): number[] {
  const ends: number[] = [];
  let depth = 0;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '{') {
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0) ends.push(i + 1);
    }
  }
  return ends;
}

/** Extracts a flat rule's declaration body for `selector` from a block of
 * CSS text (no nested rules expected inside `src`). */
function ruleBody(src: string, selector: string): string | null {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Allow arbitrary whitespace AND block comments between the previous
  // rule's closing brace (or the block's own start) and the selector --
  // every subsection in the appended phone block opens with a `/* ... */`
  // header comment directly above its first rule.
  const re = new RegExp(`(?:^|\\})(?:\\s|\\/\\*[\\s\\S]*?\\*\\/)*${escaped}\\s*\\{([^{}]*)\\}`);
  const m = re.exec(src);
  return m ? (m[1] ?? '') : null;
}

function hasMinHeightFloor(body: string): boolean {
  const re = /min-height\s*:\s*(\d+(?:\.\d+)?)px/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    if (Number(m[1]) >= 44) return true;
  }
  return false;
}

function hasFlexCenter(body: string): boolean {
  return /display\s*:\s*flex\s*;/.test(body) && /align-items\s*:\s*center/.test(body);
}

function hasNonZeroHorizontalPadding(body: string): boolean {
  const nonZero = (v: string) => v.trim() !== '0' && v.trim() !== '0px';
  return [...body.matchAll(/padding-inline\s*:\s*([^;]+)/g)].some((m) => nonZero(m[1] ?? ''));
}

function hasOverflowEscape(body: string): boolean {
  return (
    /overflow\s*:\s*hidden/.test(body) &&
    /text-overflow\s*:\s*ellipsis/.test(body) &&
    /min-width\s*:\s*0\b/.test(body)
  );
}

const blocks = findMaxWidth700Blocks(CSS);
const lastBlock = blocks[blocks.length - 1]!;
const secondBlockText = CSS.slice(lastBlock.bodyStart, lastBlock.bodyEnd);

describe('content.css phone 44px floor + 390 overflow fixes (task w8-e)', () => {
  it('sanity: content.css declares exactly one top-level `@media (max-width: 700px)` block (w7-c merge, DEC-385 wave-111)', () => {
    expect(blocks.length).toBe(1);
  });

  it('the appended phone-floor block is the LAST top-level construct in content.css', () => {
    const constructEnds = topLevelConstructEnds(CSS);
    const lastConstructEnd = constructEnds[constructEnds.length - 1];
    expect(lastConstructEnd).toBe(lastBlock.blockEnd);
    // Nothing but whitespace follows the block's closing brace.
    expect(CSS.slice(lastBlock.blockEnd).trim()).toBe('');
  });

  describe('falsifiability control', () => {
    it('the floor/escape checkers correctly reject a non-conforming rule', () => {
      const brokenAnchor = ruleBody('.chq-fake-anchor { min-height: 32px; display: inline-flex; }', '.chq-fake-anchor');
      expect(brokenAnchor).not.toBeNull();
      expect(hasMinHeightFloor(brokenAnchor!)).toBe(false);
      expect(hasFlexCenter(brokenAnchor!)).toBe(false);
      expect(hasNonZeroHorizontalPadding(brokenAnchor!)).toBe(false);

      const brokenOverflow = ruleBody('.chq-fake-col { white-space: nowrap; }', '.chq-fake-col');
      expect(brokenOverflow).not.toBeNull();
      expect(hasOverflowEscape(brokenOverflow!)).toBe(false);

      // And the checkers correctly ACCEPT a conforming rule, so the negative
      // result above is a property of the input, not the checker.
      const okAnchor = ruleBody(
        '.chq-ok-anchor { min-height: 44px; display: flex; align-items: center; padding-inline: 10px; margin-inline: -10px; }',
        '.chq-ok-anchor',
      );
      expect(hasMinHeightFloor(okAnchor!)).toBe(true);
      expect(hasFlexCenter(okAnchor!)).toBe(true);
      expect(hasNonZeroHorizontalPadding(okAnchor!)).toBe(true);

      const okOverflow = ruleBody(
        '.chq-ok-col { overflow: hidden; text-overflow: ellipsis; min-width: 0; }',
        '.chq-ok-col',
      );
      expect(hasOverflowEscape(okOverflow!)).toBe(true);
    });
  });

  describe('tap-floor: real anchors get the full flush-row recipe', () => {
    const anchors = [
      '.chq-content-detail-action-link',
      '.chq-content-detail-speaker-link',
      '.chq-content-version-name',
    ];

    for (const selector of anchors) {
      it(`${selector} carries min-height:44px + display:flex + align-items:center + non-zero padding-inline in the appended block`, () => {
        const body = ruleBody(secondBlockText, selector);
        expect(body, `expected ${selector} to be declared in the appended phone block`).not.toBeNull();
        expect(hasMinHeightFloor(body!)).toBe(true);
        expect(hasFlexCenter(body!)).toBe(true);
        expect(hasNonZeroHorizontalPadding(body!)).toBe(true);
        // margin-inline cancels the padding so the label doesn't shift.
        expect(body).toMatch(/margin-inline\s*:\s*-10px/);
      });
    }
  });

  describe('tap-floor: empty header spacer gets the full recipe too', () => {
    it('.chq-content-worklist-col-actions carries the full recipe (inert under the hidden thead, applied for literal conformance)', () => {
      const body = ruleBody(secondBlockText, '.chq-content-worklist-col-actions');
      expect(body).not.toBeNull();
      expect(hasMinHeightFloor(body!)).toBe(true);
      expect(hasFlexCenter(body!)).toBe(true);
      expect(hasNonZeroHorizontalPadding(body!)).toBe(true);
    });
  });

  describe('tap-floor: button-container descendants get the substantive min-height fix (judgement call)', () => {
    const containerButtonSelectors = [
      '.chq-content-actions .chq-btn',
      '.chq-content-comment-actions .chq-btn',
      '.chq-content-status-band-actions .chq-btn',
      '.chq-content-summary-actions .chq-btn',
      '.chq-content-files-header-actions .chq-btn',
    ];

    for (const selector of containerButtonSelectors) {
      it(`${selector} carries min-height:44px in the appended block`, () => {
        const body = ruleBody(secondBlockText, selector);
        expect(body, `expected ${selector} to be declared in the appended phone block`).not.toBeNull();
        expect(hasMinHeightFloor(body!)).toBe(true);
      });
    }
  });

  describe('overflow: 358px-budget offenders get the three-property escape', () => {
    const escapedSelectors = [
      '.chq-content-files-table .chq-content-files-col-actions',
      '.chq-content-files-table .chq-content-files-col-version',
      '.chq-content-table thead th',
      '.chq-content-worklist-table .chq-content-worklist-col-actions',
      '.chq-role-label',
    ];

    for (const selector of escapedSelectors) {
      it(`${selector} carries overflow:hidden + text-overflow:ellipsis + min-width:0 in the appended block`, () => {
        const body = ruleBody(secondBlockText, selector);
        expect(body, `expected ${selector} to be declared in the appended phone block`).not.toBeNull();
        expect(hasOverflowEscape(body!)).toBe(true);
      });
    }
  });

  describe('overflow: the two Select-mode header controls are exempt, not truncated', () => {
    const exempt = ['.chq-content-phone-select-toggle', '.chq-content-phone-selecting-all'];

    for (const selector of exempt) {
      it(`${selector} carries a named overflow-exempt comment and is NOT given an ellipsis escape in the appended block`, () => {
        const escapedToken = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const exemptRe = new RegExp(`\\/\\*\\s*overflow-exempt:[^*]*\\*\\/\\s*${escapedToken}\\s*\\{`);
        expect(exemptRe.test(secondBlockText)).toBe(true);

        const body = ruleBody(secondBlockText, selector);
        if (body !== null) {
          expect(hasOverflowEscape(body)).toBe(false);
        }
      });
    }
  });

  describe('shared-vocabulary guard (DEC-393 wave-90 amendment, DEC-613)', () => {
    // The guard is about a BARE, undecorated selector for the shared token
    // -- a wholesale second declaration of the class styles.css already
    // owns. Pre-existing SCOPED compound selectors like `.chq-content-
    // worklist .chq-bulkbar-actions` (this page's own spacing override,
    // predating this task, in the FIRST phone block) are a different thing
    // entirely and are not what the ruling forbids -- so this checks for
    // the token as its own standalone selector (optionally in a
    // comma-separated list), never as a substring of a longer selector.
    function declaresBareSelector(blockText: string, token: string): boolean {
      const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // A selector list item is bounded by `,`, `{`, or start-of-selector-run
      // (i.e. immediately after `}` or the block's own opening brace) on one
      // side and `,` or `{` on the other, with only whitespace around it.
      const re = new RegExp(`(?:^|[{},])\\s*${escaped}\\s*(?=[,{])`);
      return re.test(blockText);
    }

    it('the appended phone-floor block declares NO bare .chq-pill selector', () => {
      expect(declaresBareSelector(secondBlockText, '.chq-pill')).toBe(false);
    });

    it('the appended phone-floor block declares NO bare .chq-bulkbar-actions selector', () => {
      expect(declaresBareSelector(secondBlockText, '.chq-bulkbar-actions')).toBe(false);
    });

    it('falsifiability: the bare-selector guard correctly flags a fabricated offending block', () => {
      const offending = `
  .chq-pill {
    color: red;
  }
`;
      expect(declaresBareSelector(offending, '.chq-pill')).toBe(true);
      const scoped = `
  .chq-content-worklist .chq-bulkbar-actions {
    margin-left: 0;
  }
`;
      // A scoped compound selector is NOT a bare declaration -- the guard
      // must not false-positive on it.
      expect(declaresBareSelector(scoped, '.chq-bulkbar-actions')).toBe(false);
    });
  });
});
