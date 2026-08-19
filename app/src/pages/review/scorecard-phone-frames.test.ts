// v12 design pack — the reviewer scorecard at 390 (DEC-889 wave-86
// amendment, task w4-h), both states, in
// docs/design/Chautauqua Review.dc.html:
//
//   "Reviewer scorecard · /review/plans/:id/submissions/:id" (scored
//   state, :280 -> :351)
//   "Scorecard · a criterion unscored"                       (:934 -> end
//   of file, :1137)
//
// jsdom applies no stylesheet and evaluates no @media rule, so — mirroring
// app/src/pages/contacts/contacts-phone-frames.test.ts — the CSS half of
// this pin is a source-scan against the CSS TEXT of scorecard.css's phone
// layer, not computed style. The scorecard's phone-only markup (the back
// link + counter row, the clamped-abstract disclosure, the unscored
// callout/instruction, the "Not yet" Overall) is gated behind `isPhone`
// (useIsPhone) rather than a media query, so that half is pinned as a
// literal source-scan against Scorecard.tsx instead.
//
// DEC-967 wave-86: every claim below cites a real line-range inside the
// frame's own extent, quotes a verbatim backticked literal out of that
// range, and is followed by a real assertion (never a citation alone).
//
// Two standing rules pinned alongside the frame geometry:
//
//   * DEC-385 single-direction: scorecard.css's phone layer is
//     `@media (max-width: …)` ONLY, and it is the LAST top-level
//     construct in the file (wave-85 cascade-exposure rule).
//   * DESIGN-RULINGS "The 44px floor": no phone token here may author a
//     `min-height` below 44px.
//
// Desktop is frozen: scorecard-measure.test.ts and Scorecard.render.test.tsx
// run unchanged, and every phone-only branch here is gated on `isPhone`,
// which is false in every jsdom render test per useIsPhone's own contract.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));

function read(file: string): string {
  return readFileSync(join(HERE, file), 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');
}

const SCORECARD_CSS = read('scorecard.css');
const SCORECARD_TSX = readFileSync(join(HERE, 'Scorecard.tsx'), 'utf-8');

/** Concatenated bodies of every `@media (max-width: …)` block in `css`,
 * brace-matched (never regex-bounded on `[^}]*`, which would stop at the
 * first NESTED rule's own closing brace and silently pin nothing). */
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

/** A single rule's declaration body, by selector, inside the phone layer
 * -- selectors compared as WHOLE members of the rule's selector list. */
function phoneRule(css: string, selector: string): string {
  const layer = phoneLayer(css);
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = rule.exec(layer)) !== null) {
    const selectors = m[1]!
      .split(',')
      .map((s) => s.trim().replace(/\s+/g, ' '))
      .filter(Boolean);
    if (selectors.includes(selector)) return m[2]!;
  }
  throw new Error(`no phone rule for ${selector}`);
}

describe('DEC-385: the scorecard phone layer is single-direction, and its own last construct', () => {
  it('scorecard.css declares no min-width media query', () => {
    expect(SCORECARD_CSS).not.toMatch(/@media[^{]*min-width/);
  });

  it('scorecard.css has at least one max-width phone block', () => {
    expect(phoneLayer(SCORECARD_CSS).length).toBeGreaterThan(0);
  });

  it("the phone @media block is the file's last top-level construct", () => {
    const trimmed = SCORECARD_CSS.trimEnd();
    expect(trimmed.endsWith('}')).toBe(true);
    const lastOpen = trimmed.lastIndexOf('@media');
    expect(lastOpen).toBeGreaterThan(-1);
    // Nothing but whitespace/comments follows the block's own closing
    // brace -- i.e. the media rule's closer IS the file's final `}`.
    let depth = 0;
    let i = trimmed.indexOf('{', lastOpen);
    depth = 1;
    i += 1;
    while (i < trimmed.length && depth > 0) {
      if (trimmed[i] === '{') depth += 1;
      else if (trimmed[i] === '}') depth -= 1;
      i += 1;
    }
    expect(trimmed.slice(i).trim()).toBe('');
  });
});

describe('DESIGN-RULINGS: never author a min-height below 44px on a scorecard phone token', () => {
  it("scorecard.css's phone layer floors every authored min-height at 44px", () => {
    const layer = phoneLayer(SCORECARD_CSS);
    const heights = [...layer.matchAll(/min-height:\s*(\d+)px/g)].map((m) => Number(m[1]));
    expect(heights.length).toBeGreaterThan(0);
    for (const h of heights) expect(h).toBeGreaterThanOrEqual(44);
  });
});

describe('v12 phone frame "Reviewer scorecard · /review/plans/:id/submissions/:id" (:280 -> :351, scored)', () => {
  it('citation :283-284 `<a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Wave 2 queue</a>` / `<span style="margin-left:auto; ...">7 of 18 done</span>` — the back link and the counter share one row, the counter pushed right', () => {
    expect(SCORECARD_TSX).toContain('chq-review-scorecard-phone-head-row');
    expect(SCORECARD_TSX).toContain('chq-review-scorecard-phone-progress');
    const row = phoneRule(SCORECARD_CSS, '.chq-review-scorecard-phone-head-row');
    expect(row).toMatch(/display:\s*flex/);
    const back = phoneRule(SCORECARD_CSS, '.chq-review-back');
    expect(back).toMatch(/min-height:\s*44px/);
    const counter = phoneRule(SCORECARD_CSS, '.chq-review-scorecard-phone-progress');
    expect(counter).toMatch(/margin-left:\s*auto/);
  });

  it('citation :295 `<a href="#" style="font-size:13px; font-weight:700; display:inline-flex; align-items:center; min-height:44px">Read the full submission</a>` — the clamped abstract behind one 44px disclosure', () => {
    expect(SCORECARD_TSX).toContain('Read the full submission');
    expect(SCORECARD_TSX).toContain('chq-review-scorecard-abstract-disclosure');
    const clamp = phoneRule(SCORECARD_CSS, '.chq-review-scorecard-abstract-clamped');
    expect(clamp).toMatch(/-webkit-line-clamp/);
    const disclosure = phoneRule(SCORECARD_CSS, '.chq-review-scorecard-abstract-disclosure');
    expect(disclosure).toMatch(/min-height:\s*44px/);
  });

  it('citation :306/:948/:959 `<div style="display:flex; gap:7px">` — the rating scale is ONE flex row of equal chips, never a shrunk desktop control and never a scroller', () => {
    const group = phoneRule(SCORECARD_CSS, '.chq-review-rating-group');
    expect(group).toMatch(/display:\s*flex/);
    expect(group).toMatch(/gap:\s*7px/);
    expect(group).not.toMatch(/display:\s*grid/);
    expect(group).not.toMatch(/overflow-x/);
    const btn = phoneRule(SCORECARD_CSS, '.chq-review-rating-btn');
    expect(btn).toMatch(/flex:\s*1/);
    expect(btn).toMatch(/min-height:\s*44px/);
  });

  it('citation :328 `font-size:34px; font-weight:700; ... line-height:1` — Overall prints as a 34px numeral', () => {
    const value = phoneRule(SCORECARD_CSS, '.chq-review-overall-value');
    expect(value).toMatch(/font-size:\s*34px/);
  });

  it('citation :334 `<label style="display:flex; align-items:center; gap:9px; min-height:44px; ...">` — the recuse row already meets the 44px floor at rest (no phone override needed)', () => {
    expect(SCORECARD_TSX).toContain('chq-review-checkbox-label');
    expect(SCORECARD_TSX).toMatch(/Recuse me from this one/);
  });

  it('citation :341-343 `<span style="flex:1; ...min-height:46px; ...">Submit and next</span>` / `<span style="border:1px solid #BAB6A6; ...min-height:46px; ...">Save draft</span>` — a filled Submit + a bordered Save draft, side by side at 46px in a sticky dock', () => {
    const actions = phoneRule(SCORECARD_CSS, '.chq-review-scorecard-rail .chq-review-editor-actions');
    expect(actions).toMatch(/flex-direction:\s*row/);
    expect(actions).toMatch(/position:\s*sticky/);
    expect(actions).toMatch(/bottom:\s*0/);
    const btn = phoneRule(SCORECARD_CSS, '.chq-review-scorecard-rail .chq-review-editor-actions .chq-btn');
    expect(btn).toMatch(/min-height:\s*46px/);
    const primary = phoneRule(SCORECARD_CSS, '.chq-review-scorecard-rail .chq-review-editor-actions .chq-btn-primary');
    expect(primary).toMatch(/flex:\s*1/);
    expect(SCORECARD_TSX).toContain('Submit and next');
    expect(SCORECARD_TSX).toContain('Save draft');
  });
});

describe('v12 phone frame "Scorecard · a criterion unscored" (:934 -> end of file, :1137)', () => {
  it('citation :941-943 `<div style="border:1px solid #1B1D17; border-left:4px solid #1B1D17; ...">` / `One criterion still needs a score` — a 4px-left-bordered callout naming the missing criterion', () => {
    expect(SCORECARD_TSX).toContain('One criterion still needs a score');
    expect(SCORECARD_TSX).toContain('chq-review-scorecard-unscored-callout');
    const callout = phoneRule(SCORECARD_CSS, '.chq-review-scorecard-unscored-callout');
    expect(callout).toMatch(/border-left:\s*4px solid/);
  });

  it('citation :961/:964 `border:1px solid #1B1D17; ...` chips + `font-size:13px; font-weight:600; ...color:#1B1D17` — ink-bordered chips plus the 13px/600 ink instruction on the unscored criterion', () => {
    expect(SCORECARD_TSX).toContain('chq-review-criterion-unscored');
    expect(SCORECARD_TSX).toContain('Pick a score, or recuse yourself if you cannot judge this one.');
    const chips = phoneRule(SCORECARD_CSS, '.chq-review-criterion-unscored .chq-review-rating-btn');
    expect(chips).toMatch(/border-color:\s*var\(--chq-ink\)/);
    const instruction = phoneRule(SCORECARD_CSS, '.chq-review-criterion-unscored-instruction');
    expect(instruction).toMatch(/font-size:\s*13px/);
    expect(instruction).toMatch(/font-weight:\s*600/);
    expect(instruction).toMatch(/color:\s*var\(--chq-ink\)/);
  });

  it('citation :969 `<span style="font-size:14px; font-weight:600; color:#565A4B">Not yet</span>` — Overall reads a muted "Not yet", never a partial computation', () => {
    expect(SCORECARD_TSX).toContain("'Not yet'");
    expect(SCORECARD_TSX).toContain('chq-review-overall-value-not-yet');
    // overallScore is only ever non-null once every rating criterion has a
    // numeric entry (overallReady) — "Not yet" is the ONLY thing phone
    // prints in its place, never a partial arithmetic sentence.
    expect(SCORECARD_TSX).toMatch(/overallScore === null \? 'Not yet' : formatScore\(overallScore\)/);
    const notYet = phoneRule(SCORECARD_CSS, '.chq-review-overall-value-not-yet');
    expect(notYet).toMatch(/font-size:\s*14px/);
    expect(notYet).toMatch(/color:\s*var\(--chq-muted\)/);
  });
});
