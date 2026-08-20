// DEC-383 wave-109 amendment: the cancelled-padding idiom (padding-inline
// cancelled by an equal-and-opposite negative margin-inline) is scoped to
// controls that paint NO box. On a bordered or filled control (.chq-btn,
// .chq-pill) it is not layout-neutral: it overlaps each adjacent sibling
// by 20px and bleeds 10px past the container. This test asserts the idiom
// survives ONLY on borderless subjects inside comms.css's terminal 700px
// block, and that the eight verified bordered offenders are free of
// margin-inline (task w5-n).
//
// task w8-i: "borderless" is judged by a DERIVED predicate, not a hand
// list. The criterion is 'paints no box'; a rule's own `border: none` and
// `background: none` declarations are the evidence for it, checked
// against the one place that could silently contradict them -- a
// top-level (non-media) rule for the same selector that reintroduces a
// non-`none` border or background at the base cascade tier. This is
// stronger than a hand list: a hand list only knows what a maintainer
// already verified and drifts silently when a new borderless control is
// added; the derived predicate re-derives borderlessness from the
// declarations for every new subject automatically. The quiet-action
// family names (.chq-link-button, .chq-btn-tertiary, dense/roomy status
// chips, .chq-comms-send-report-all-history) are kept as a fast path so
// their already-documented meaning is unchanged.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = join(HERE, 'comms.css');

/** Strips one level of @media { ... } blocks out of a stylesheet's text. */
function withoutMediaBlocks(css: string): string {
  return css.replace(/@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g, '');
}

/** Extracts the body text of the (single) 700px media block. */
function mediaBlockBody(css: string): string {
  const match = css.match(/@media \(max-width: 700px\) \{([\s\S]*)\n\}\n/);
  const body = match?.[1];
  if (body === undefined) throw new Error('no 700px media block found');
  return body;
}

/**
 * Splits a media-block body into individual rule records of
 * { selector, body }, ignoring comments. Good enough for this flat,
 * single-level media block (no nested @media/@supports inside it).
 */
function parseRules(mediaBody: string): { selector: string; body: string }[] {
  const stripped = mediaBody.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: { selector: string; body: string }[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped))) {
    const selector = m[1];
    const body = m[2];
    if (selector === undefined || body === undefined) continue;
    rules.push({ selector: selector.trim(), body });
  }
  return rules;
}

// The families the DEVIATIONS.md ruling names as borderless / quiet-action
// are kept as a fast path so the existing passing cases keep their
// documented meaning. Everything else is judged by a DERIVED predicate:
// the cancelled-padding idiom is legal on any subject that "paints no
// box" -- i.e. its own rule declares `border: none` AND `background: none`
// -- provided no TOP-LEVEL (non-media) rule for that same selector in
// comms.css reintroduces a non-`none` border or background (a desktop
// tier could otherwise paint the box the phone tier assumes is absent).
// This is stronger than a hand list: the declaration in the rule under
// test IS the evidence for "paints no box", checked against the one
// place (the top-level cascade) that could silently contradict it,
// rather than trusting a maintainer's memory of which selectors qualify.
function isBorderlessFamily(selector: string): boolean {
  return (
    /\.chq-link-button\b/.test(selector) ||
    /\.chq-btn-tertiary\b/.test(selector) ||
    /chq-status-chip/.test(selector) ||
    /\.chq-comms-send-report-all-history\b/.test(selector)
  );
}

function declaresNoBox(ruleBody: string): boolean {
  return /border:\s*none\b/.test(ruleBody) && /background:\s*none\b/.test(ruleBody);
}

/**
 * True if no top-level (outside any @media) rule for `selector` in
 * `outsideCss` declares a `border` or `background` value other than
 * `none` -- i.e. nothing at the base cascade tier repaints the box the
 * phone-tier rule assumes is absent.
 */
function topLevelReintroducesBox(selector: string, outsideCss: string): boolean {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|[\\n}])${escaped}\\s*\\{([^}]*)\\}`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(outsideCss))) {
    const body = m[2] ?? '';
    const border = body.match(/border:\s*([^;]+);/);
    const background = body.match(/background:\s*([^;]+);/);
    if (border?.[1] !== undefined && !/^none\b/.test(border[1].trim())) return true;
    if (background?.[1] !== undefined && !/^none\b/.test(background[1].trim())) return true;
  }
  return false;
}

function isBorderlessSubject(selector: string, ruleBody: string, outsideCss: string): boolean {
  if (isBorderlessFamily(selector)) return true;
  return declaresNoBox(ruleBody) && !topLevelReintroducesBox(selector, outsideCss);
}

describe('comms.css cancelled-padding idiom scoped to borderless controls (DEC-383 wave-109 amendment, task w5-n)', () => {
  const css = readFileSync(CSS_PATH, 'utf-8');
  const mediaBody = mediaBlockBody(css);
  const outside = withoutMediaBlocks(css);
  const rules = parseRules(mediaBody);

  it('every rule in the terminal phone block declaring a negative margin-inline has a borderless subject', () => {
    const negativeMarginRules = rules.filter((r) => /margin-inline:\s*-\d/.test(r.body));
    expect(negativeMarginRules.length).toBeGreaterThan(0);
    for (const rule of negativeMarginRules) {
      expect(isBorderlessSubject(rule.selector, rule.body, outside)).toBe(true);
    }
  });

  it('derived predicate: a synthetic borderless rule carrying the cancelled-padding pair passes', () => {
    const syntheticSelector = '.chq-comms-synthetic-borderless-test-subject';
    const syntheticBody = `
      min-height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding-inline: 10px;
      margin-inline: -10px;
      background: none;
      border: none;
    `;
    expect(isBorderlessFamily(syntheticSelector)).toBe(false);
    expect(isBorderlessSubject(syntheticSelector, syntheticBody, outside)).toBe(true);
  });

  it('derived predicate: a synthetic bordered rule carrying the cancelled-padding pair fails', () => {
    const syntheticSelector = '.chq-comms-synthetic-bordered-test-subject';
    const syntheticBody = `
      min-height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding-inline: 10px;
      margin-inline: -10px;
      background: var(--chq-surface);
      border: 1px solid var(--chq-border);
    `;
    expect(isBorderlessFamily(syntheticSelector)).toBe(false);
    expect(isBorderlessSubject(syntheticSelector, syntheticBody, outside)).toBe(false);
  });

  const borderedOffenders = [
    '.chq-comms-head-actions > .chq-pill',
    '.chq-comms-editor-actions > .chq-btn',
    '.chq-comms-history-head-actions > .chq-btn',
    '.chq-comms-preview-actions > .chq-btn',
    '.chq-comms-refusal-actions > .chq-btn',
    '.chq-comms-select-actions > .chq-btn',
    '.chq-comms-send-report-footer-actions > .chq-btn',
    '.chq-comms-template-actions > .chq-btn',
  ];

  it.each(borderedOffenders)('%s is free of margin-inline (and padding-inline) inside the phone block', (selector) => {
    const stripped = mediaBody.replace(/\/\*[\s\S]*?\*\//g, '');
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(^|[,}])\\s*${escaped}\\s*\\{([^}]*)\\}`);
    const match = stripped.match(re);
    expect(match, `expected to find rule for ${selector}`).not.toBeNull();
    const body = match![2];
    expect(body).not.toMatch(/margin-inline/);
    expect(body).not.toMatch(/padding-inline/);
    // Still floored and centred.
    expect(body).toMatch(/min-height:\s*44px/);
    expect(body).toMatch(/display:\s*flex/);
    expect(body).toMatch(/align-items:\s*center/);
  });

  it('the editor-actions link-button keeps the cancelled-padding idiom (borderless, untouched)', () => {
    const match = mediaBody.match(
      /\.chq-comms-editor-actions > \.chq-link-button\s*\{([^}]*)\}/,
    );
    expect(match).not.toBeNull();
    const body = match![1];
    expect(body).toMatch(/padding-inline:\s*10px/);
    expect(body).toMatch(/margin-inline:\s*-10px/);
  });

  it('the send-report all-history text link keeps the cancelled-padding idiom (borderless by rendered tier)', () => {
    const match = mediaBody.match(
      /\.chq-comms-send-report-all-history\s*\{([^}]*)\}/,
    );
    expect(match).not.toBeNull();
    const body = match![1];
    expect(body).toMatch(/padding-inline:\s*10px/);
    expect(body).toMatch(/margin-inline:\s*-10px/);
  });

  it('every bordered/filled container adjacent-sibling gap is still owned by its top-level rule (rider satisfied)', () => {
    const containers = [
      '.chq-comms-head-actions',
      '.chq-comms-history-head-actions',
      '.chq-comms-preview-actions',
      '.chq-comms-refusal-actions',
      '.chq-comms-select-actions',
      '.chq-comms-send-report-footer-actions',
      '.chq-comms-template-actions',
    ];
    for (const selector of containers) {
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`(^|[\\n}])${escaped}\\s*\\{([^}]*)\\}`);
      const match = outside.match(re);
      expect(match, `expected top-level rule for ${selector}`).not.toBeNull();
      expect(match![2]).toMatch(/gap:\s*\d/);
    }
  });

  it('this task touched only the interior of the existing terminal media block: no second block, no top-level padding-inline/margin-inline change', () => {
    const mediaBlockCount = (css.match(/@media \(max-width: 700px\)/g) ?? []).length;
    expect(mediaBlockCount).toBe(1);
    // The top-level (outside-media) rule set retains no padding-inline /
    // margin-inline for any of the touched selectors -- this task never
    // wrote anything outside the media block.
    const topLevelSelectors = [
      '.chq-comms-head-actions',
      '.chq-comms-editor-actions',
      '.chq-comms-history-head-actions',
      '.chq-comms-preview-actions',
      '.chq-comms-refusal-actions',
      '.chq-comms-select-actions',
      '.chq-comms-send-report-footer-actions',
      '.chq-comms-template-actions',
      '.chq-comms-send-report-all-history',
    ];
    for (const selector of topLevelSelectors) {
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      expect(outside).toMatch(new RegExp(`${escaped}[\\s,{]`));
    }
  });
});
