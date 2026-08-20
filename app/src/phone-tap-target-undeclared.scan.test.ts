// Undeclared-height tap-target lens (DEC-367 wave-120 PREDICATE REPAIR).
//
// The base scan's `findOffenders()` (phone-tap-target.scan.test.ts:92-116)
// does:
//
//   const height = declaredHeightPx(body);
//   if (height === undefined || height >= TAP_FLOOR_PX) continue;
//
// -- a top-level control rule that names NO `height`/`min-height` at all is
// dropped from the population before any floor test runs: the SAME branch
// that skips an already-conforming rule also skips one that declares
// nothing. That is the inverse of the truth -- a control with no declared
// height cannot reach 44px except by accident of line-height.
// `app/src/pages/review/review.css:650-660`'s
// `.chq-review-queue-footer-showall { border: none; background: none;
// padding: 0; font-size: 13px; }` on a real `<button type="button">`
// (ReviewerQueue.tsx:402-404, also PlanEditor.tsx:2319) is the proof: the
// live 390 probe (docs/probes/metafid-phoneB-ssr-2026-08-19.md) measured it
// at 52x30, sub-floor, while `findOffenders()` and both SSR tap ratchets
// all read clean.
//
// This file is the missing Tier-2 half, in NEW files so it contends with
// nobody: three sibling lanes are editing phone-tap-target.scan.test.ts and
// phone-tap-target-scan/anchor-floor.ts this wave (DEC-989). The predicate
// itself lives in ./phone-tap-target-scan/undeclared.ts, importing every
// parsing primitive from ./core.js (DEC-613).
//
// This lane is the INSTRUMENT, not the drain: DEC-991 forbids authoring
// exemptions ahead of the fixes it would excuse, and no stylesheet is
// touched here.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  allCssFiles,
  allTsxFiles,
  declaredHeightPx,
  narrowMediaRules,
  selectorDeclaresBareClass,
  stripTsxComments,
  tapTargetTagTokens,
  topLevelRulesWithExemption,
} from './phone-tap-target-scan/core.js';
import {
  composesWithFlooredToken,
  findUndeclaredHeightOffenders,
  tagClassSets,
  tokenIsFloored,
} from './phone-tap-target-scan/undeclared.js';

const HERE = dirname(fileURLToPath(import.meta.url)); // app/src
const REPO_ROOT = join(HERE, '..', '..');

const CSS_FILES = allCssFiles(HERE);
const TSX_FILES = allTsxFiles(HERE);

// Measured on this branch by forcing the ceiling to -1 and reading the
// printed offender list (DEC-989 clause a): 23, across 13 sheets, including
// `.chq-review-queue-footer-showall`. This is the campaign's first
// measurement of this population -- there is no prior value to compare
// against, only the base scan's zero, which this file's own header explains
// is blind by construction. Composition credit (clause b) already removes
// tokens like `.chq-btn-primary`/`.chq-btn-secondary` (which only ever
// appear beside the floored `.chq-btn`) from a larger pre-composition
// count -- this 23 is post-composition, the true residue.
//
// PREDICATE REPAIR (DEC-989 clause c): the base scan's `findOffenders()`
// treats `height === undefined` (no height/min-height declared at all) the
// same as `height >= TAP_FLOOR_PX` (already conforming) -- both `continue`
// past the same line, so a control that never declared a height was
// invisible to the ratchet that is supposed to catch sub-floor controls.
// The old ceiling was blind, not zero: `.chq-review-queue-footer-showall`
// (review.css:650, 52x30 live-probed) proves a real offender sat under a
// scan reporting a clean population.
export const UNDECLARED_HEIGHT_OFFENDERS_CEILING = 23;

describe('undeclared-height tap-target lens (DEC-367 wave-120 PREDICATE REPAIR)', () => {
  it('derives a non-empty population and includes a known-live offender (vacuous-population tripwire)', () => {
    expect(CSS_FILES.length).toBeGreaterThan(5);
    expect(TSX_FILES.length).toBeGreaterThan(5);
    const offenders = findUndeclaredHeightOffenders(CSS_FILES, TSX_FILES, REPO_ROOT);
    expect(offenders.length).toBeGreaterThan(0);
    expect(
      offenders.some((o) => o.includes('chq-review-queue-footer-showall')),
      `expected .chq-review-queue-footer-showall among the offenders:\n${offenders.join('\n')}`,
    ).toBe(true);
  }, 20000);

  it('flags a synthetic control rule declaring neither height nor min-height, with no phone floor (positive control)', () => {
    const tsx = `export const X = () => <button className="chq-x-fake-showall">Show all</button>;`;
    const css = `.chq-x-fake-showall { border: none; background: none; padding: 0; font-size: 13px; }`;
    const tokens = new Set(tapTargetTagTokens(stripTsxComments(tsx)));
    expect(tokens.has('chq-x-fake-showall')).toBe(true);
    const rule = topLevelRulesWithExemption(css).find((r) =>
      selectorDeclaresBareClass(r.selector, 'chq-x-fake-showall'),
    )!;
    expect(declaredHeightPx(rule.body)).toBeUndefined();
    expect(rule.exempt).toBe(false);
    const narrowFloored = narrowMediaRules(css, 700).some(
      (r) => selectorDeclaresBareClass(r.selector, 'chq-x-fake-showall') && (declaredHeightPx(r.body) ?? 0) >= 44,
    );
    expect(narrowFloored).toBe(false);
    const sites = tagClassSets(stripTsxComments(tsx));
    expect(sites).toEqual([['chq-x-fake-showall']]);
    expect(composesWithFlooredToken('chq-x-fake-showall', sites, [css])).toBe(false);
  });

  it('does not flag a no-height rule with a phone-width >=44px min-height override (negative control: phone floor clears)', () => {
    const css = `
      .chq-x-fake-noheight { border: none; padding: 0; }
      @media (max-width: 700px) {
        .chq-x-fake-noheight { min-height: 44px; }
      }
    `;
    const rule = topLevelRulesWithExemption(css).find((r) =>
      selectorDeclaresBareClass(r.selector, 'chq-x-fake-noheight'),
    )!;
    expect(declaredHeightPx(rule.body)).toBeUndefined();
    const narrowFloored = narrowMediaRules(css, 700).some(
      (r) => selectorDeclaresBareClass(r.selector, 'chq-x-fake-noheight') && (declaredHeightPx(r.body) ?? 0) >= 44,
    );
    expect(narrowFloored).toBe(true);
  });

  it('does not flag a no-height token whose every markup site also carries a floored sibling token (negative control: composition clears)', () => {
    // `.chq-x-fake-primary` never appears alone -- every markup site also
    // carries `.chq-x-fake-btn`, which IS floored. Mirrors the real
    // `.chq-btn-primary`/`.chq-btn-secondary` beside `.chq-btn` shape.
    const tsx = `
      export const A = () => <button className="chq-x-fake-btn chq-x-fake-primary">Save</button>;
      export const B = () => <button className="chq-x-fake-primary chq-x-fake-btn">Send</button>;
    `;
    const css = `
      .chq-x-fake-primary { border: none; padding: 0 12px; }
      .chq-x-fake-btn { min-height: 44px; }
    `;
    const stripped = stripTsxComments(tsx);
    const sites = tagClassSets(stripped);
    expect(sites.length).toBe(2);
    expect(tokenIsFloored('chq-x-fake-btn', [css])).toBe(true);
    expect(tokenIsFloored('chq-x-fake-primary', [css])).toBe(false);
    expect(composesWithFlooredToken('chq-x-fake-primary', sites, [css])).toBe(true);
  });

  it('does not flag a no-height token carrying a named tap-floor-exempt comment (negative control: exemption clears)', () => {
    const css = `
      /* tap-floor-exempt: decorative icon-only toggle, never a phone tap target */
      .chq-x-fake-icon { border: none; padding: 0; }
    `;
    const rule = topLevelRulesWithExemption(css).find((r) =>
      selectorDeclaresBareClass(r.selector, 'chq-x-fake-icon'),
    )!;
    expect(rule.exempt).toBe(true);
  });

  it('stays at or under the undeclared-height offender ceiling (one-sided ratchet: may only fall)', () => {
    const offenders = findUndeclaredHeightOffenders(CSS_FILES, TSX_FILES, REPO_ROOT);
    expect(
      offenders.length,
      `undeclared-height tap-target offenders (${offenders.length}, ceiling ${UNDECLARED_HEIGHT_OFFENDERS_CEILING}):\n${offenders.join('\n')}`,
    ).toBeLessThanOrEqual(UNDECLARED_HEIGHT_OFFENDERS_CEILING);
  }, 20000);

  it(`never falls below the offender ceiling (${UNDECLARED_HEIGHT_OFFENDERS_CEILING}) without the ceiling being lowered to match (a stale ceiling licenses stagnation)`, () => {
    const offenders = findUndeclaredHeightOffenders(CSS_FILES, TSX_FILES, REPO_ROOT);
    if (offenders.length < UNDECLARED_HEIGHT_OFFENDERS_CEILING) {
      throw new Error(
        `undeclared-height tap-target offenders (${offenders.length}) fell below the ` +
          `UNDECLARED_HEIGHT_OFFENDERS_CEILING of ${UNDECLARED_HEIGHT_OFFENDERS_CEILING}. This is the ` +
          `ratchet working: offenders got fixed. Lower the ceiling in the same commit (a merge-train ` +
          `act, never a worker's edit mid-lane) by replacing the line:\n` +
          `  export const UNDECLARED_HEIGHT_OFFENDERS_CEILING = ${offenders.length};`,
      );
    }
    expect(offenders.length).toBeGreaterThanOrEqual(UNDECLARED_HEIGHT_OFFENDERS_CEILING);
  });
});
