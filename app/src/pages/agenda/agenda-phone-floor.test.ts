// Agenda tier-2 tap-floor + overflow fix scan (task w8-g; DEC-393/DEC-989
// wave-90 amendment).
//
// Closes the five tap-floor offenders and three overflow offenders the
// wave-90 audit (docs/design/audit/tap-floor-v12.md) recorded for
// app/src/pages/agenda/agenda.css:
//   tap-floor:  .chq-agenda-head-actions, .chq-breaks-add-actions,
//               .chq-breaks-row-actions, .chq-phone-footer-actions,
//               .chq-toolbar-link
//   overflow:   .chq-agenda-clash-note, .chq-agenda-summary,
//               .chq-toolbar-link
//
// The fix landed as ONE new `@media (max-width: 700px)` block appended at
// the true end of agenda.css (never editing/reordering the blocks already
// there, per DEC-385 -- source order alone decides at equal specificity).
// This test parses the raw CSS text rather than rendering, matching the
// house idiom used by the *.scan.test.ts files this task's audit was
// produced from.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = join(HERE, 'agenda.css');
const CSS = readFileSync(CSS_PATH, 'utf-8');

/** Strips `/* … *\/` comments. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Every top-level construct (a plain rule OR a whole `@media { ... }`
 * block, brace-matched, comments skipped so a literal `{`/`}` inside a
 * comment can't desynchronise the scan) with its raw source span. */
function topLevelConstructs(css: string): Array<{ start: number; end: number; text: string }> {
  const out: Array<{ start: number; end: number; text: string }> = [];
  let depth = 0;
  let constructStart = -1;
  let i = 0;
  while (i < css.length) {
    if (css.startsWith('/*', i)) {
      const end = css.indexOf('*/', i + 2);
      i = end === -1 ? css.length : end + 2;
      continue;
    }
    if (depth === 0 && constructStart === -1 && !/\s/.test(css[i] ?? '')) {
      constructStart = i;
    }
    if (css[i] === '{') {
      depth++;
    } else if (css[i] === '}') {
      depth--;
      if (depth === 0 && constructStart !== -1) {
        out.push({ start: constructStart, end: i + 1, text: css.slice(constructStart, i + 1) });
        constructStart = -1;
      }
    }
    i++;
  }
  return out;
}

/** True if `css`'s LAST top-level construct is an `@media` block, and
 * `marker` (which lives in the leading comment immediately above that
 * block's `{`, not inside its braces) appears in the span from the end of
 * the PREVIOUS top-level construct through the end of the last one -- i.e.
 * nothing else was appended after our fix block, and the marker comment is
 * the one immediately preceding it. */
function fixBlockIsLastConstruct(css: string, marker: string): boolean {
  const constructs = topLevelConstructs(css);
  if (constructs.length === 0) return false;
  const last = constructs[constructs.length - 1]!;
  if (!/^@media/.test(last.text.trim())) return false;
  const prevEnd = constructs.length >= 2 ? constructs[constructs.length - 2]!.end : 0;
  return css.slice(prevEnd, last.end).includes(marker);
}

/** Every `selector { body }` rule inside every `@media (max-width: <=700px)`
 * block in `css` (brace-matched; body is comment-stripped before return). */
function narrowMediaRules(css: string, maxN = 700): Array<{ selector: string; body: string }> {
  const out: Array<{ selector: string; body: string }> = [];
  const mediaRe = /@media[^{]*max-width:\s*(\d+)px[^{]*\{/g;
  let mm: RegExpExecArray | null;
  while ((mm = mediaRe.exec(css)) !== null) {
    const width = Number(mm[1]);
    if (width > maxN) continue;
    const bodyStart = mm.index + mm[0].length;
    let depth = 1;
    let i = bodyStart;
    for (; i < css.length && depth > 0; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') depth--;
    }
    const block = stripComments(css.slice(bodyStart, i - 1));
    const re = /([^{}]+)\{([^{}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(block)) !== null) {
      out.push({ selector: (m[1] ?? '').trim(), body: m[2] ?? '' });
    }
  }
  return out;
}

function selectorMentions(selector: string, token: string): boolean {
  return selector
    .split(',')
    .map((s) => s.trim())
    .some((s) => s === `.${token}` || s.endsWith(` .${token}`) || s.endsWith(`.${token}`));
}

/** All three overflow-escape properties present inside the phone-width
 * block(s), OR a named `overflow-exempt:` comment sits above a rule
 * mentioning `token` anywhere in the raw file. */
function hasOverflowEscapeOrExemption(css: string, token: string): boolean {
  const bodies = narrowMediaRules(css, 700)
    .filter((r) => selectorMentions(r.selector, token))
    .map((r) => r.body)
    .join(' ');
  const escaped =
    /overflow\s*:\s*hidden/.test(bodies) &&
    /text-overflow\s*:\s*ellipsis/.test(bodies) &&
    /min-width\s*:\s*0/.test(bodies);
  if (escaped) return true;
  const exemptRe = new RegExp(`\\/\\*\\s*overflow-exempt:[^*]*\\*\\/\\s*[^{}]*\\.${token}\\b`);
  return exemptRe.test(css);
}

/** All four floor properties present inside the phone-width block(s) for a
 * (possibly compound) selector, matched literally against the comma list. */
function hasFloorShapeForSelector(css: string, compoundSelector: string): boolean {
  const bodies = narrowMediaRules(css, 700)
    .filter((r) =>
      r.selector
        .split(',')
        .map((s) => s.trim())
        .includes(`.${compoundSelector}`),
    )
    .map((r) => r.body)
    .join(' ');
  return (
    /min-height\s*:\s*44px/.test(bodies) &&
    /display\s*:\s*flex/.test(bodies) &&
    /align-items\s*:\s*center/.test(bodies) &&
    /padding-inline\s*:\s*10px/.test(bodies) &&
    /margin-inline\s*:\s*-10px/.test(bodies)
  );
}

/** All four floor properties present for a bare (non-compound) token. */
function hasFloorShape(css: string, token: string): boolean {
  const bodies = narrowMediaRules(css, 700)
    .filter((r) => selectorMentions(r.selector, token))
    .map((r) => r.body)
    .join(' ');
  return (
    /min-height\s*:\s*44px/.test(bodies) &&
    /display\s*:\s*flex/.test(bodies) &&
    /align-items\s*:\s*center/.test(bodies) &&
    /padding-inline\s*:\s*10px/.test(bodies) &&
    /margin-inline\s*:\s*-10px/.test(bodies)
  );
}

const FIX_BLOCK_MARKER = 'Tier-2 tap-floor + overflow fixes (task w8-g';

describe('agenda phone tap-floor + overflow fixes (task w8-g, DEC-393/DEC-989)', () => {
  it('appends its fix block as the true last top-level construct in the file (falsifiability control)', () => {
    expect(fixBlockIsLastConstruct(CSS, FIX_BLOCK_MARKER)).toBe(true);
    // Positive control: a stylesheet with something appended AFTER a
    // same-marker block must be rejected.
    const badCss = `
      @media (max-width: 700px) {
        /* Tier-2 tap-floor + overflow fixes (task w8-g */
        .chq-x { min-height: 44px; }
      }
      .chq-appended-after { color: red; }
    `;
    expect(fixBlockIsLastConstruct(badCss, FIX_BLOCK_MARKER)).toBe(false);
  });

  it.each([
    'chq-agenda-head-actions .chq-btn',
    'chq-breaks-add-actions .chq-btn',
    'chq-breaks-row-actions .chq-btn',
    'chq-phone-footer-actions .chq-phone-footer-btn',
  ])('reaches the 44px tap-floor on the anchor inside %s', (compound) => {
    expect(hasFloorShapeForSelector(CSS, compound)).toBe(true);
  });

  it('grows .chq-toolbar-link directly (it is itself the anchor, not a container)', () => {
    expect(hasFloorShape(CSS, 'chq-toolbar-link')).toBe(true);
  });

  it('escapes overflow on .chq-agenda-summary and .chq-toolbar-link', () => {
    expect(hasOverflowEscapeOrExemption(CSS, 'chq-agenda-summary')).toBe(true);
    expect(hasOverflowEscapeOrExemption(CSS, 'chq-toolbar-link')).toBe(true);
  });

  it('exempts .chq-agenda-clash-note by name instead of ellipsizing it (judgement call: a clash note names both sides or it names nothing)', () => {
    expect(hasOverflowEscapeOrExemption(CSS, 'chq-agenda-clash-note')).toBe(true);
    expect(/overflow-exempt:/.test(CSS)).toBe(true);
    // Falsifiability: a fabricated sheet with NEITHER the escape properties
    // NOR the named exemption comment must be rejected.
    const badCss = `.chq-agenda-clash-note { white-space: nowrap; }`;
    expect(hasOverflowEscapeOrExemption(badCss, 'chq-agenda-clash-note')).toBe(false);
  });

  it('does not flag a synthetic offender with only three of the four floor properties (falsifiability control)', () => {
    const badCss = `
      @media (max-width: 700px) {
        .chq-x-fake-actions .chq-btn {
          min-height: 44px;
          display: flex;
          align-items: center;
        }
      }
    `;
    expect(hasFloorShapeForSelector(badCss, 'chq-x-fake-actions .chq-btn')).toBe(false);
  });
});
