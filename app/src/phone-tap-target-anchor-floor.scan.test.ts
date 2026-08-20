// Row-action-anchor tap-target floor scan (DEC-393 wave-87 amendment).
//
// Extracted from phone-tap-target.scan.test.ts (custodian decomposition,
// wave v12m-w12) with NO behavior change: this `describe` block, and the
// population it drives, is byte-for-byte what used to live in that file.
// Split out because that file had become a repeated merge-conflict hotspot
// -- multiple lanes lowering DIFFERENT ceilings (base sub-44px scan,
// row-action-anchor, SSR) were all forced to touch the same 570-line file.
// This file owns only the row-action-anchor lens; the base sub-44px scan
// lives in ./phone-tap-target.scan.test.ts, the SSR widening in
// ./phone-tap-target-ssr.scan.test.ts. The ceiling constant (with its full
// amendment history) now lives in ./phone-tap-target-scan/ceilings.ts so
// that lowering it is a one-line diff wherever it is imported.
//
// The scanning primitives live in ./phone-tap-target-scan/{core,anchor-
// floor}.ts, same as before this split.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  allCssFiles,
  allTsxFiles,
  hasFlexCenter,
  hasMinHeightFloor,
  horizontalPaddingNonZero,
  narrowMediaRules,
  selectorMentionsToken,
  stripTsxComments,
} from './phone-tap-target-scan/core.js';
import {
  allBareAnchorTokens,
  bareAnchorTokens,
  findAnchorFloorOffenders,
  rowActionContainerTokens,
  selectorReachesAnchor,
} from './phone-tap-target-scan/anchor-floor.js';
import { ANCHOR_FLOOR_OFFENDERS_CEILING } from './phone-tap-target-scan/ceilings.js';

// Self-contained population (same enumeration as the base scan file, DEC-808
// idiom -- readdirSync, never a hand-listed manifest). Recomputing this here
// rather than importing it from the base scan file keeps the two files free
// of an import edge between them, so a lane editing one never has to reason
// about the other's module-load side effects.
const HERE = dirname(fileURLToPath(import.meta.url)); // app/src
const REPO_ROOT = join(HERE, '..', '..');
const CSS_FILES = allCssFiles(HERE);
const TSX_FILES = allTsxFiles(HERE);

export { ANCHOR_FLOOR_OFFENDERS_CEILING };

describe('row-action-anchor tap-target floor scan (DEC-393 wave-87 amendment)', () => {
  it('derives a non-empty population and includes a known-good token (vacuous-population tripwire)', () => {
    const anchorTokens = allBareAnchorTokens(TSX_FILES);
    const containerTokens = rowActionContainerTokens(CSS_FILES);
    expect(anchorTokens.size).toBeGreaterThan(0);
    expect(containerTokens.size).toBeGreaterThan(0);
    // `chq-overview-link-btn` is a real bare `<a>`/`<Link>` class with no
    // `chq-btn` (Overview.tsx) -- a regex that silently matched nothing
    // could not have found it.
    expect(anchorTokens.has('chq-overview-link-btn')).toBe(true);
    // `chq-breaks-row-actions` is a real row-action container class defined
    // in agenda.css.
    expect(containerTokens.has('chq-breaks-row-actions')).toBe(true);
  });

  it('flags a synthetic bare anchor with only padding declared (positive control: padding alone does not reach the floor)', () => {
    const tsx = `export const X = () => <a className="chq-x-fake-anchor" href="/x">Go</a>;`;
    const css = `
      @media (max-width: 700px) {
        .chq-x-fake-anchor { padding: 0 16px; }
      }
    `;
    const tokens = bareAnchorTokens(stripTsxComments(tsx));
    expect(tokens).toEqual(['chq-x-fake-anchor']);
    const narrow = narrowMediaRules(css, 700);
    const rule = narrow.find((r) => selectorMentionsToken(r.selector, 'chq-x-fake-anchor'))!;
    expect(hasMinHeightFloor(rule.body)).toBe(false);
    expect(horizontalPaddingNonZero(rule.body)).toBe(true);
  });

  it('does not flag a synthetic bare anchor declaring all three phone properties (negative control)', () => {
    const css = `
      @media (max-width: 700px) {
        .chq-x-fake-anchor-2 {
          min-height: 44px;
          display: flex;
          align-items: center;
          padding: 0 16px;
        }
      }
    `;
    const rule = narrowMediaRules(css, 700).find((r) =>
      selectorMentionsToken(r.selector, 'chq-x-fake-anchor-2'),
    )!;
    expect(hasMinHeightFloor(rule.body)).toBe(true);
    expect(hasFlexCenter(rule.body)).toBe(true);
    expect(horizontalPaddingNonZero(rule.body)).toBe(true);
  });

  it('does not flag a row-action container reaching its anchor via a descendant selector (negative control)', () => {
    const css = `
      @media (max-width: 700px) {
        .chq-x-fake-row-actions a {
          min-height: 44px;
          display: flex;
          align-items: center;
          padding: 0 16px;
        }
      }
    `;
    const narrow = narrowMediaRules(css, 700);
    const rule = narrow.find((r) => selectorMentionsToken(r.selector, 'chq-x-fake-row-actions'))!;
    expect(selectorReachesAnchor(rule.selector, new Set())).toBe(true);
  });

  it('does not admit a row-action container token whose only mention is inside a CSS comment (positive control: DEC-989 wave-120)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'anchor-floor-comment-'));
    const path = join(dir, 'fixture.css');
    writeFileSync(
      path,
      '/* DEC-735: split from the old shared `.chq-x-fake-row-actions` -- retired, no rule, no markup left. */\n',
    );
    try {
      expect(rowActionContainerTokens([path]).has('chq-x-fake-row-actions')).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('admits a row-action container token declared in a real rule body (negative control: DEC-989 wave-120)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'anchor-floor-rule-'));
    const path = join(dir, 'fixture.css');
    writeFileSync(path, '.chq-x-fake-row-actions { display: flex; }\n');
    try {
      expect(rowActionContainerTokens([path]).has('chq-x-fake-row-actions')).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('stays at or under the offender ceiling (one-sided ratchet: may only fall)', () => {
    const offenders = findAnchorFloorOffenders(CSS_FILES, TSX_FILES, REPO_ROOT);
    expect(
      offenders.length,
      `row-action-anchor tap-target floor offenders (${offenders.length}, ceiling ${ANCHOR_FLOOR_OFFENDERS_CEILING}):\n${offenders.join('\n')}`,
    ).toBeLessThanOrEqual(ANCHOR_FLOOR_OFFENDERS_CEILING);
  });

  it(`never falls below the offender ceiling (${ANCHOR_FLOOR_OFFENDERS_CEILING}) without the ceiling being lowered to match (a stale ceiling licenses stagnation)`, () => {
    const offenders = findAnchorFloorOffenders(CSS_FILES, TSX_FILES, REPO_ROOT);
    if (offenders.length < ANCHOR_FLOOR_OFFENDERS_CEILING) {
      throw new Error(
        `row-action-anchor tap-target floor offenders (${offenders.length}) fell below the ` +
          `ANCHOR_FLOOR_OFFENDERS_CEILING of ${ANCHOR_FLOOR_OFFENDERS_CEILING}. This is the ratchet ` +
          `working: offenders got fixed. Lower the ceiling in the same commit (a merge-train act, ` +
          `never a worker's edit mid-lane) in phone-tap-target-scan/ceilings.ts by replacing the line:\n` +
          `  export const ANCHOR_FLOOR_OFFENDERS_CEILING = ${offenders.length};`,
      );
    }
    expect(offenders.length).toBeGreaterThanOrEqual(ANCHOR_FLOOR_OFFENDERS_CEILING);
  });
});
