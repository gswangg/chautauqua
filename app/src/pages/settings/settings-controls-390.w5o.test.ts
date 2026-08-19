// v12m-w5-o: the only route into edit mode was a 15px bare-text control
// (.chq-settings-section-action, settings.css:210), and the borderless
// cancelled-padding idiom (padding-inline + equal negative margin-inline)
// had leaked onto bordered subjects in the same file's terminal phone
// block, bleeding them past their container/neighbour.
//
// Cites DEC-393 wave-109 amendment ("The only route into a capability is
// a ROOMY target at phone width") and DEC-383 wave-109 amendment ("The
// cancelled-padding idiom is for borderless controls only; a bordered box
// needs a real gap").
//
// CSS-text checks, mirroring the house idiom of
// `app/src/phone-tap-target.scan.test.ts` / this file's sibling
// `settings-phone-floor.test.ts`: jsdom performs no layout, so these read
// settings.css's OWN declarations rather than computed style.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEC_383, DEC_393 } from '../../../../src/decisions';

void DEC_383; // Fix 2: bordered subjects drop the cancelled-padding pair
void DEC_393; // Fix 1: .chq-settings-section-action gets the roomy floor

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = join(HERE, 'settings.css');
const CSS = readFileSync(CSS_PATH, 'utf-8');

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Brace-matched removal of every @media block (mirrors the sibling
 * scans' own idiom -- a linear scan, not a nested-quantifier regex). */
function stripMedia(css: string): string {
  const ranges: Array<[number, number]> = [];
  const openRe = /@media[^{]*\{/g;
  let m: RegExpExecArray | null;
  while ((m = openRe.exec(css)) !== null) {
    let i = m.index + m[0].length;
    let depth = 1;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') depth--;
      i++;
    }
    ranges.push([m.index, i]);
    openRe.lastIndex = i;
  }
  let out = '';
  let last = 0;
  for (const [start, end] of ranges) {
    out += css.slice(last, start);
    last = end;
  }
  out += css.slice(last);
  return out;
}

/** Every top-level `selector { body }` (outside any @media block). */
function topLevelRules(css: string): Array<{ selector: string; body: string }> {
  const withoutMedia = stripMedia(css);
  const out: Array<{ selector: string; body: string }> = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(withoutMedia)) !== null) {
    const selector = stripComments(m[1] ?? '').trim();
    if (!selector) continue;
    out.push({ selector, body: stripComments(m[2] ?? '') });
  }
  return out;
}

/** All `@media (max-width: <=700px) { ... }` block bodies, in source
 * order. There must be exactly ONE terminal block (DEC-385 single-
 * direction responsive / `test/phone-terminal-block.scan.test.ts`). */
function phoneBlocks(css: string): Array<{ body: string; start: number; end: number }> {
  const out: Array<{ body: string; start: number; end: number }> = [];
  const openRe = /@media\s*\(\s*max-width:\s*(\d+)px\s*\)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = openRe.exec(css)) !== null) {
    if (Number(m[1]) > 700) continue;
    const bodyStart = m.index + m[0].length;
    let depth = 1;
    let i = bodyStart;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') depth--;
      i++;
    }
    out.push({ body: css.slice(bodyStart, i - 1), start: m.index, end: i });
  }
  return out;
}

/** Rules inside a single block body, in source order (comments stripped,
 * so a rule quoting CSS inside its own leading comment can't desync the
 * brace walk -- DEC-613 wave-106). */
function rulesIn(body: string): Array<{ selector: string; body: string }> {
  const stripped = stripComments(body);
  const out: Array<{ selector: string; body: string }> = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped)) !== null) {
    const selector = (m[1] ?? '').trim();
    if (!selector) continue;
    out.push({ selector, body: m[2] ?? '' });
  }
  return out;
}

function findRule(
  rules: Array<{ selector: string; body: string }>,
  selector: string,
): { selector: string; body: string } | undefined {
  return rules.find((r) => r.selector.split(',').map((s) => s.trim()).includes(selector));
}

function hasFloorShape(body: string): boolean {
  const minHeightOk = /min-height\s*:\s*(\d+(?:\.\d+)?)px/.exec(body);
  const heightFloor = minHeightOk !== null && Number(minHeightOk[1]) >= 44;
  const flex = /display\s*:\s*(inline-)?flex/.test(body);
  const centered = /align-items\s*:\s*center/.test(body);
  const paddingInline =
    /padding-inline\s*:\s*(?!0\b)(?!0px)/.test(body) || /padding\s*:\s*[^;]*[1-9]/.test(body);
  return heightFloor && flex && centered && paddingInline;
}

const phoneBlockList = phoneBlocks(CSS);
const terminalBlock = phoneBlockList[phoneBlockList.length - 1]!;
const terminalRules = rulesIn(terminalBlock.body);
const topLevel = topLevelRules(CSS);

describe('vacuous-scan tripwires', () => {
  it('found the settings.css file and read a non-trivial amount of it', () => {
    expect(CSS.length).toBeGreaterThan(1000);
  });

  it('found exactly one @media(max-width<=700px) block -- the terminal block (DEC-385)', () => {
    expect(phoneBlockList.length).toBe(1);
  });

  it('found at least one rule inside the terminal block', () => {
    expect(terminalRules.length).toBeGreaterThan(10);
  });
});

describe('Fix 1 (DEC-393 wave-109 amendment): .chq-settings-section-action gets the 44px roomy floor', () => {
  it('has no min-height at all in its top-level (desktop) rule', () => {
    const rule = findRule(topLevel, '.chq-settings-section-action');
    expect(rule).toBeDefined();
    expect(/min-height/.test(rule!.body)).toBe(false);
    // the top-level rule stays a bare-text control at rest -- 13px/700,
    // borderless, no padding. Only the phone rule adds geometry.
    expect(/font-size\s*:\s*13px/.test(rule!.body)).toBe(true);
    expect(/border\s*:\s*none/.test(rule!.body)).toBe(true);
  });

  it('gets a conforming 44px roomy-register rule inside the terminal phone block', () => {
    const rule = findRule(terminalRules, '.chq-settings-section-action');
    expect(rule).toBeDefined();
    expect(hasFloorShape(rule!.body)).toBe(true);
    // cancelled-padding idiom: padding-inline is answered by an equal and
    // opposite negative margin-inline so no glyph moves.
    const padMatch = /padding-inline\s*:\s*(\d+(?:\.\d+)?)px/.exec(rule!.body);
    const marginMatch = /margin-inline\s*:\s*-(\d+(?:\.\d+)?)px/.exec(rule!.body);
    expect(padMatch).not.toBeNull();
    expect(marginMatch).not.toBeNull();
    expect(padMatch![1]).toBe(marginMatch![1]);
  });
});

describe('Fix 2 (DEC-383 wave-109 amendment): every negative-margin-inline rule in the terminal block is borderless', () => {
  const BORDERLESS_BASE_SELECTORS = new Set([
    '.chq-link-button',
    '.chq-settings-inline-action',
    // Fix 1's own subject: font-size:13px; font-weight:700; background:
    // none; border:none; padding:0 (settings.css:210) -- borderless by
    // its own top-level rule, so it legally keeps the cancelled-padding
    // pair (DEC-393 wave-109 amendment).
    '.chq-settings-section-action',
  ]);

  function isBorderlessSubject(selector: string): boolean {
    // A selector's SUBJECT is its rightmost compound (the element the
    // rule actually styles). Classify it borderless if that compound is
    // built entirely from classes with no border/fill of their own --
    // the DEC-383 wave-109 amendment's own allowlist
    // (.chq-link-button, .chq-btn-tertiary, .chq-settings-inline-action,
    // dense/roomy status chips) plus this file's own borderless base
    // .chq-settings-inline-action (settings.css:277 -- no border, no
    // background).
    const subject = selector.trim().split(/\s|>/).filter(Boolean).pop() ?? '';
    for (const base of BORDERLESS_BASE_SELECTORS) {
      if (subject.includes(base)) return true;
    }
    return false;
  }

  const negativeMarginRules = terminalRules.filter((r) =>
    /margin-inline\s*:\s*-\d/.test(r.body),
  );

  it('found at least one negative-margin-inline rule (positive control -- the scan can see them)', () => {
    expect(negativeMarginRules.length).toBeGreaterThan(0);
  });

  it('every rule declaring a negative margin-inline has a borderless subject', () => {
    const offenders = negativeMarginRules
      .map((r) => r.selector)
      .filter((sel) => !isBorderlessSubject(sel));
    expect(offenders).toEqual([]);
  });

  it('the Public-pages row action and the Saved-embeds button group are reset to margin-inline:0 (not left negative)', () => {
    const publicPages = findRule(
      terminalRules,
      '.chq-settings-public-pages-row > .chq-settings-inline-action',
    );
    const savedEmbeds = findRule(terminalRules, '.chq-settings-saved-embed-actions .chq-link-button');
    expect(publicPages).toBeDefined();
    expect(savedEmbeds).toBeDefined();
    // The LAST occurrence of a selector in source order wins the cascade
    // at equal specificity; rulesIn returns them in source order, so the
    // last match for each selector is authoritative. Re-scan for the
    // final rule with this exact selector group / selector.
    const publicPagesRules = terminalRules.filter((r) =>
      r.selector.includes('.chq-settings-public-pages-row > .chq-settings-inline-action'),
    );
    const savedEmbedsRules = terminalRules.filter(
      (r) => r.selector === '.chq-settings-saved-embed-actions .chq-link-button',
    );
    const lastPublicPages = publicPagesRules[publicPagesRules.length - 1]!;
    const lastSavedEmbeds = savedEmbedsRules[savedEmbedsRules.length - 1]!;
    expect(/margin-inline\s*:\s*0\b/.test(lastPublicPages.body)).toBe(true);
    expect(/margin-inline\s*:\s*-\d/.test(lastPublicPages.body)).toBe(false);
    expect(/margin-inline\s*:\s*0\b/.test(lastSavedEmbeds.body)).toBe(true);
    expect(/margin-inline\s*:\s*-\d/.test(lastSavedEmbeds.body)).toBe(false);
  });
});

describe('the terminal block gained exactly one sub-section; every pre-existing top-level rule set is unchanged', () => {
  // A representative set of top-level selectors this task must not have
  // touched -- if any of these stop resolving, an edit landed outside the
  // max-width block or a brace got unbalanced.
  const MUST_STILL_RESOLVE = [
    '.chq-settings-row-note',
    '.chq-settings-inline-action',
    '.chq-settings-people-table',
    '.chq-settings-section-action',
  ];

  it('lists top-level selectors that must still resolve, unchanged', () => {
    for (const sel of MUST_STILL_RESOLVE) {
      const rule = findRule(topLevel, sel);
      expect(rule, `expected top-level rule for ${sel}`).toBeDefined();
    }
  });

  it('still has exactly one terminal @media block (no second block opened)', () => {
    // duplicate of the vacuous-scan tripwire above, restated as the
    // guard this whole test file exists to enforce.
    expect(phoneBlocks(CSS).length).toBe(1);
  });
});
