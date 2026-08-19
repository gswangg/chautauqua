// DEC-383 wave-109 amendment: the cancelled-padding idiom (padding-inline
// cancelled by an equal-and-opposite negative margin-inline) is scoped to
// controls that paint NO box -- the quiet-action families
// (.chq-link-button, .chq-btn-tertiary, dense/roomy status chips). On a
// bordered or filled control (.chq-btn, .chq-pill) it is not layout-neutral:
// it overlaps each adjacent sibling by 20px and bleeds 10px past the
// container. This test asserts the idiom survives ONLY on borderless
// subjects inside comms.css's terminal 700px block, and that the eight
// verified bordered offenders are free of margin-inline (task w5-n).
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

// The families the DEVIATIONS.md ruling names as borderless / quiet-action:
// .chq-link-button, .chq-btn-tertiary, dense/roomy status chips, and the
// .chq-comms-send-report-all-history text link (verified borderless by its
// rendered tier: chq-brand text colour, no background/border declared).
function isBorderlessSubject(selector: string): boolean {
  return (
    /\.chq-link-button\b/.test(selector) ||
    /\.chq-btn-tertiary\b/.test(selector) ||
    /chq-status-chip/.test(selector) ||
    /\.chq-comms-send-report-all-history\b/.test(selector)
  );
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
      expect(isBorderlessSubject(rule.selector)).toBe(true);
    }
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
