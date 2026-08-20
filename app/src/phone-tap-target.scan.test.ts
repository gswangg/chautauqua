// Phone tap-target floor scan (DEC-253 amendment, DEC-367 floor -- wave 25 /
// task w25-d).
//
// Measured on the admin-mobile pass at 390x844:
// `input.chq-input.chq-submissions-filterbar-search` rendered a 26px tap
// target against the 44px minimum
// (docs/verification-log/task-w17-d-render-sweep.md:163-165). The 26px is
// a deliberate DESKTOP chip height (submissions.css's
// .chq-submissions-filterbar-search/-select match the adjacent .chq-pill
// row), so the fix is additive only: a phone-width override, not a desktop
// change.
//
// This scan enumerates (readdirSync, DEC-808 idiom, never a hand-listed
// manifest) every app/src *.css file and every app/src *.tsx file
// (excluding *.test.tsx) and:
//
//   1. Collects every `chq-…` class token that appears in a class position
//      on an `<input`, `<select`, `<button`, or an `<a>` whose class list
//      also carries `chq-btn` (an anchor styled as a button-face control).
//   2. For each such token, finds its TOP-LEVEL (outside any @media block)
//      CSS rule -- a plain `.chq-token { ... }` selector, alone or in a
//      comma list -- and reads any `height`/`min-height` declaration.
//   3. If that declared value is below 44px, the token is a tap-target
//      offender UNLESS one of:
//        a) some `@media (max-width: <=700px) { ... }` block declares
//           `height`/`min-height` >= 44px for the same selector, or
//        b) the top-level rule carries an inline exemption comment
//           immediately above it: `/* tap-floor-exempt: <reason> */`.
//   Never an allowlist populated from the failure output -- every
//   exemption is a comment sitting next to the rule it exempts.
//
// The scanning primitives live in ./phone-tap-target-scan/{core,anchor-
// floor,ssr}.ts (custodian decomposition, wave v12m-w8: this file had grown
// into a repeated merge-conflict hotspot at 882 lines). This file keeps
// only the base sub-44px SPA scan's population wiring and `describe`/`it`
// block -- NO behavior change, only where the code that does it lives.
//
// Custodian decomposition wave v12m-w12: this file had grown into a repeat
// merge-conflict hotspot again (570 lines, four conflicts across w12-k and
// w12-l alone) precisely because three independent lenses -- this base
// scan, the row-action-anchor lens, and the SSR widening -- shared one
// file, so any two lanes lowering DIFFERENT ceilings collided on the same
// lines. Split into three sibling files, each owning one lens and one (or
// two) ceiling constant:
//   - ./phone-tap-target-anchor-floor.scan.test.ts (row-action-anchor,
//     ANCHOR_FLOOR_OFFENDERS_CEILING)
//   - ./phone-tap-target-ssr.scan.test.ts (SSR routes,
//     SSR_TAP_FLOOR_OFFENDERS_CEILING, SSR_UNFLOORED_TOKENS_CEILING)
// Every ceiling constant's full amendment history now lives in
// ./phone-tap-target-scan/ceilings.ts, imported by whichever sibling test
// file checks it, and re-exported below for any caller still importing
// from this file's original path. NO behavior change: every assertion,
// control, and population in this file is byte-for-byte what used to be
// here.
import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  allCssFiles,
  allTsxFiles,
  declaredHeightPx,
  narrowMediaRules,
  selectorDeclaresBareClass,
  stripTsxComments,
  TAP_FLOOR_PX,
  tapTargetTagTokens,
  topLevelRulesWithExemption,
} from './phone-tap-target-scan/core.js';
import {
  ANCHOR_FLOOR_OFFENDERS_CEILING,
  SSR_TAP_FLOOR_OFFENDERS_CEILING,
  SSR_UNFLOORED_TOKENS_CEILING,
} from './phone-tap-target-scan/ceilings.js';

// Re-exported for compatibility with any caller importing the ceiling
// constants from this file's original path (none exists in the tree today
// -- verified by grep before the split -- but the constants moved, not
// disappeared).
export { ANCHOR_FLOOR_OFFENDERS_CEILING, SSR_TAP_FLOOR_OFFENDERS_CEILING, SSR_UNFLOORED_TOKENS_CEILING };

const HERE = dirname(fileURLToPath(import.meta.url)); // app/src
const REPO_ROOT = join(HERE, '..', '..');

const CSS_FILES = allCssFiles(HERE);
const TSX_FILES = allTsxFiles(HERE);

/** All tap-target-eligible `chq-…` tokens found across every TSX file. */
function allTapTargetTokens(): Set<string> {
  const out = new Set<string>();
  for (const path of TSX_FILES) {
    const src = stripTsxComments(readFileSync(path, 'utf-8'));
    for (const t of tapTargetTagTokens(src)) out.add(t);
  }
  return out;
}

/**
 * For a given token, find offenders: a top-level rule declaring
 * height/min-height < 44px, with no phone-width override >= 44px and no
 * inline exemption comment.
 */
function findOffenders(): string[] {
  const tokens = allTapTargetTokens();
  const offenders: string[] = [];
  for (const path of CSS_FILES) {
    const label = relative(REPO_ROOT, path);
    const raw = readFileSync(path, 'utf-8');
    for (const { selector, body, exempt } of topLevelRulesWithExemption(raw)) {
      const matchingTokens = [...tokens].filter((t) => selectorDeclaresBareClass(selector, t));
      if (matchingTokens.length === 0) continue;
      const height = declaredHeightPx(body);
      if (height === undefined || height >= TAP_FLOOR_PX) continue;
      if (exempt) continue;
      const narrow = narrowMediaRules(raw, 700).some((r) => {
        if (!matchingTokens.some((t) => selectorDeclaresBareClass(r.selector, t))) return false;
        const h = declaredHeightPx(r.body);
        return h !== undefined && h >= TAP_FLOOR_PX;
      });
      if (narrow) continue;
      offenders.push(`${label}: "${selector}" (${height}px, tokens: ${matchingTokens.join(', ')})`);
    }
  }
  return offenders;
}

describe('phone tap-target floor scan (DEC-253 amendment, DEC-367)', () => {
  it('found more than one CSS file and one TSX file to scan (vacuous-scan tripwire)', () => {
    expect(CSS_FILES.length).toBeGreaterThan(5);
    expect(TSX_FILES.length).toBeGreaterThan(5);
  });

  it('flags a synthetic sub-floor input rule with no override or exemption (positive control)', () => {
    const tsx = `export const X = () => <input className="chq-x-fake-search" />;`;
    const css = `.chq-x-fake-search { min-height: 26px; }`;
    const tokens = new Set(tapTargetTagTokens(stripTsxComments(tsx)));
    expect(tokens.has('chq-x-fake-search')).toBe(true);
    const rules = topLevelRulesWithExemption(css);
    const rule = rules.find((r) => selectorDeclaresBareClass(r.selector, 'chq-x-fake-search'));
    expect(rule).toBeDefined();
    expect(declaredHeightPx(rule!.body)).toBe(26);
    expect(rule!.exempt).toBe(false);
  });

  it('does not flag a sub-floor rule with a phone-width >=44px override (negative control)', () => {
    const css = `
      .chq-x-fake-search { min-height: 26px; }
      @media (max-width: 700px) {
        .chq-x-fake-search { min-height: 44px; }
      }
    `;
    const rule = topLevelRulesWithExemption(css).find((r) =>
      selectorDeclaresBareClass(r.selector, 'chq-x-fake-search'),
    )!;
    expect(declaredHeightPx(rule.body)).toBe(26);
    const overridden = narrowMediaRules(css, 700).some(
      (r) =>
        selectorDeclaresBareClass(r.selector, 'chq-x-fake-search') &&
        (declaredHeightPx(r.body) ?? 0) >= TAP_FLOOR_PX,
    );
    expect(overridden).toBe(true);
  });

  it('does not flag a sub-floor rule carrying a named tap-floor-exempt comment (negative control)', () => {
    const css = `
      /* tap-floor-exempt: decorative icon-only chip, never a phone tap target */
      .chq-x-fake-chip { min-height: 20px; }
    `;
    const rule = topLevelRulesWithExemption(css).find((r) =>
      selectorDeclaresBareClass(r.selector, 'chq-x-fake-chip'),
    )!;
    expect(rule.exempt).toBe(true);
  });

  it('every sub-44px input/select/button/chq-btn-anchor control has a >=44px phone override or a named exemption', () => {
    const offenders = findOffenders();
    expect(
      offenders,
      `sub-44px tap targets with no phone-width override and no tap-floor-exempt comment:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
