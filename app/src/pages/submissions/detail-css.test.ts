// DEC-989 (wave 42 amendment): gate-3 measured frame 02 at 1600px --
// body rules x=244->944 (700px), rail x=1036->1356 (320px), 92px gutter
// between them, the 1112px pair centred on the page. jsdom does not apply
// an external stylesheet's layout (see page-measure.test.ts / speakers-css
// .test.ts), so this reads the stylesheet's own text and asserts on the
// declarations directly rather than rendering + measuring computed style.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = join(HERE, 'detail.css');

/** Extracts a top-level (not inside an @media block) rule's declaration body by selector. */
function topLevelRuleBody(css: string, selector: string): string {
  const withoutMedia = css.replace(/@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g, '');
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = withoutMedia.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  const body = match?.[1];
  if (body === undefined) throw new Error(`no top-level rule found for ${selector}`);
  return body;
}

/**
 * Brace-matches one @media block by its query text and returns the body.
 * detail.css carries two (900px intermediate, 700px phone), so a regex that
 * stops at the first `}` would read the wrong one.
 */
function mediaBlockBody(css: string, query: string): string {
  const open = css.indexOf(`@media ${query} {`);
  if (open === -1) throw new Error(`no @media ${query} block found`);
  let depth = 0;
  for (let i = css.indexOf('{', open); i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(css.indexOf('{', open) + 1, i);
    }
  }
  throw new Error(`unterminated @media ${query} block`);
}

/** A rule's declaration body by selector, searched inside one media block. */
function ruleBodyIn(blockText: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = blockText.match(new RegExp(`(^|[,{}])\\s*${escaped}\\s*\\{([^}]*)\\}`, 'm'));
  const body = match?.[2];
  if (body === undefined) throw new Error(`no rule found for ${selector} inside the media block`);
  return body;
}

describe('detail.css layout geometry (DEC-989, wave 42 amendment)', () => {
  const css = readFileSync(CSS_PATH, 'utf-8');

  it('splits the two columns 700px body / 320px rail with a 92px gutter (frame 02 measurement)', () => {
    const body = topLevelRuleBody(css, '.chq-detail-layout');
    expect(body).toMatch(/grid-template-columns:\s*700px\s+320px/);
    expect(body).toMatch(/gap:\s*92px/);
  });

  it('centres the 1112px (700 + 92 + 320) pair on the page', () => {
    const body = topLevelRuleBody(css, '.chq-detail-layout');
    expect(body).toMatch(/max-width:\s*1112px/);
    expect(body).toMatch(/margin:\s*0 auto/);
  });

  it('the Decision block carries no card chrome -- no border, radius, or panel fill', () => {
    const body = topLevelRuleBody(css, '.chq-detail-decision');
    expect(body).not.toMatch(/\bborder(-\w+)?:\s*1px/);
    expect(body).not.toMatch(/\bborder-radius:/);
    expect(body).not.toMatch(/background:\s*var\(--chq-surface-sunk\)/);
  });

  it('no rule for .chq-detail-decision-actions remains (the Clone action row is gone)', () => {
    expect(css).not.toMatch(/\.chq-detail-decision-actions\s*\{/);
  });
});

// Phone pins for the v12 'Submission detail · 390' frame. Every assertion
// below reads the 700px @media body, and the desktop-preservation block at
// the end re-asserts that none of these numbers leaked into a top-level
// rule -- DEC-385 makes this codebase single-direction (max-width only), so
// a phone metric outside the block would silently move desktop.
describe('detail.css phone frame (390) fidelity', () => {
  const css = readFileSync(CSS_PATH, 'utf-8');
  const phone = mediaBlockBody(css, '(max-width: 700px)');

  it('the back link and the Previous/Next pager clear the 44px tap floor', () => {
    // DESIGN-RULINGS "the 44px floor, and how it gets evaded": a bare text
    // link's hit box is only its line box. min-height alone is not enough --
    // the box has to be a flex box for the height to be reachable.
    const body = ruleBodyIn(phone, '.chq-detail-back,\n  .chq-detail-position-prev,\n  .chq-detail-position-next');
    expect(body).toMatch(/min-height:\s*44px/);
    expect(body).toMatch(/display:\s*inline-flex/);
    expect(body).toMatch(/align-items:\s*center/);
  });

  it('the pager wraps rather than being dropped from the ref row (DEC-386)', () => {
    const body = ruleBodyIn(phone, '.chq-detail-ref-row');
    expect(body).toMatch(/flex-wrap:\s*wrap/);
    // No display:none anywhere in the phone block: the frame reflows
    // capability, it never removes it.
    expect(phone).not.toMatch(/\.chq-detail-position[\s\S]{0,120}display:\s*none/);
  });

  it('the header pair steps down to the frame 10px eyebrow / 22px title', () => {
    expect(ruleBodyIn(phone, '.chq-detail-eyebrow')).toMatch(/font-size:\s*10px/);
    const h1 = ruleBodyIn(phone, '.chq-detail-heading h1');
    expect(h1).toMatch(/font-size:\s*22px/);
    expect(h1).toMatch(/letter-spacing:\s*-0\.035em/);
    expect(h1).toMatch(/line-height:\s*1\.2/);
  });

  it('answer rows carry a micro-label <dt> over the value, single column', () => {
    const row = ruleBodyIn(phone, '.chq-answer-row');
    expect(row).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    expect(row).toMatch(/padding:\s*13px 0/);
    const dt = ruleBodyIn(phone, '.chq-answer-row dt');
    expect(dt).toMatch(/font-size:\s*11px/);
    expect(dt).toMatch(/font-weight:\s*800/);
    expect(dt).toMatch(/letter-spacing:\s*0\.09em/);
    expect(dt).toMatch(/text-transform:\s*uppercase/);
    // De-emphasis by weight + the muted token, never the Disabled colour
    // (DESIGN-RULINGS: #8E8A7A has exactly two legal uses, neither is a label).
    expect(dt).toMatch(/color:\s*var\(--chq-muted\)/);
    const dd = ruleBodyIn(phone, '.chq-answer-row dd');
    expect(dd).toMatch(/font-size:\s*14px/);
    expect(dd).toMatch(/line-height:\s*1\.55/);
  });

  it('abstract and reviewer comments take the frame body scale', () => {
    const abstract = ruleBodyIn(phone, '.chq-detail-abstract');
    expect(abstract).toMatch(/font-size:\s*15px/);
    expect(abstract).toMatch(/line-height:\s*1\.65/);
    const comment = ruleBodyIn(phone, '.chq-review-comment');
    expect(comment).toMatch(/font-size:\s*13px/);
    expect(comment).toMatch(/line-height:\s*1\.55/);
  });

  it('the decision rail reads as one row of three controls (audit fix, v12 mobile campaign w1: primary 46px, secondary pair 44px, matching frame lines 311/314 rather than a shared 46px)', () => {
    const rail = ruleBodyIn(phone, '.chq-detail-decision-rail');
    expect(rail).toMatch(/flex-direction:\s*row/);
    expect(rail).toMatch(/flex-wrap:\s*wrap/);
    // Children are full-width by default; only the primary and the pair
    // opt back onto the shared line.
    expect(ruleBodyIn(phone, '.chq-detail-decision-rail > *')).toMatch(/width:\s*100%/);
    expect(ruleBodyIn(phone, '.chq-detail-decision-rail > .chq-detail-decision-primary')).toMatch(/flex:\s*1 1 40%/);
    expect(ruleBodyIn(phone, '.chq-detail-decision-rail > .chq-detail-decision-secondary-pair')).toMatch(
      /flex:\s*2 1 55%/,
    );
    const primary = ruleBodyIn(phone, '.chq-detail-decision-primary');
    expect(primary).toMatch(/min-height:\s*46px/);
    expect(primary).toMatch(/border-radius:\s*var\(--chq-r-ctl-phone\)/);
    const secondaryPair = ruleBodyIn(phone, '.chq-detail-decision-secondary-pair .chq-btn');
    expect(secondaryPair).toMatch(/min-height:\s*44px/);
    expect(secondaryPair).toMatch(/border-radius:\s*var\(--chq-r-ctl-phone\)/);
  });

  it('DESKTOP PRESERVED: no phone metric escaped into a top-level rule', () => {
    // The desktop values these phone rules override, re-asserted from the
    // outside-media text. If any phone number below ever lands top-level,
    // the pair it belongs to fails here rather than silently on the desktop
    // screen (DEC-385 single-direction responsive).
    expect(topLevelRuleBody(css, '.chq-detail-heading h1')).toMatch(/font-size:\s*30px/);
    expect(topLevelRuleBody(css, '.chq-detail-eyebrow')).toMatch(/font-size:\s*11px/);
    expect(topLevelRuleBody(css, '.chq-answer-row')).toMatch(/grid-template-columns:\s*190px 1fr/);
    expect(topLevelRuleBody(css, '.chq-answer-row')).toMatch(/padding:\s*14px 0/);
    expect(topLevelRuleBody(css, '.chq-answer-row dt')).toMatch(/font-size:\s*13px/);
    expect(topLevelRuleBody(css, '.chq-answer-row dd')).toMatch(/font-size:\s*15px/);
    expect(topLevelRuleBody(css, '.chq-detail-abstract')).toMatch(/font-size:\s*16px/);
    expect(topLevelRuleBody(css, '.chq-review-comment')).toMatch(/font-size:\s*15px/);
    // The rail stays a column on desktop, and the primary stays full width.
    expect(topLevelRuleBody(css, '.chq-detail-decision-rail')).toMatch(/flex-direction:\s*column/);
    expect(topLevelRuleBody(css, '.chq-detail-decision-primary')).toMatch(/width:\s*100%/);
    expect(topLevelRuleBody(css, '.chq-detail-back')).not.toMatch(/min-height:/);
  });
});

// DEC-610 (v12 mobile campaign w2 ruling, task w2-a): the decision rail
// renders inside .chq-phone-dock at 390 instead of .chq-detail-aside
// (SubmissionDetailPage.tsx). These rules used to live in a second,
// separately-appended `@media (max-width: 700px)` block; DEC-385
// (wave-100/102, retired by task w3-l per wave-103's forward-merge
// ruling) forbids a stylesheet carrying more than one top-level phone
// block, so this content was forward-merged into the file's single
// terminal `@media (max-width: 700px)` block. The "a second phone block
// exists" assertion that used to live here asserted the very shape DEC-385
// now forbids, so it is retired rather than fixed -- there is exactly one
// block to find, and mediaBlockBody's first-match search finds it.
describe('detail.css phone dock geometry (DEC-610)', () => {
  const css = readFileSync(CSS_PATH, 'utf-8');
  const dockBlock = mediaBlockBody(css, '(max-width: 700px)');

  it('inside .chq-phone-dock, the rail fills the dock at the frame gap (8px, not the in-aside 9px)', () => {
    const rail = ruleBodyIn(dockBlock, '.chq-phone-dock .chq-detail-decision-rail');
    expect(rail).toMatch(/flex:\s*1/);
    expect(rail).toMatch(/gap:\s*8px/);
  });

  it('Accept and Decline split the row evenly; the third control (Waitlist) sizes to its own content', () => {
    expect(ruleBodyIn(dockBlock, '.chq-phone-dock .chq-detail-decision-primary')).toMatch(/flex:\s*1/);
    const pairFirst = ruleBodyIn(
      dockBlock,
      '.chq-phone-dock .chq-detail-decision-primary ~ .chq-detail-decision-secondary-pair .chq-btn:first-child',
    );
    expect(pairFirst).toMatch(/flex:\s*1/);
    const pairLast = ruleBodyIn(
      dockBlock,
      '.chq-phone-dock .chq-detail-decision-primary ~ .chq-detail-decision-secondary-pair .chq-btn:last-child',
    );
    expect(pairLast).toMatch(/flex:\s*0 0 auto/);
    expect(pairLast).toMatch(/padding:\s*0 14px/);
  });
});
