// Phone tap-target floor scan -- SSR classless-anchor population (wave
// v12m-w17, task w17-c).
//
// `SSR_UNFLOORED_TOKENS_CEILING` (phone-tap-target-ssr.scan.test.ts) is
// keyed on class TOKENS taken from markup: an `<a>` under src/routes/**
// declaring neither `class=` nor `className=` contributes NO token, so it
// was ungradeable by construction. Confirmed live at main `0e3ece58`: ~27
// bare `<a>` with no class attribute at all, three measured sub-floor with
// no reaching CSS rule anywhere in the tree
// (`.chq-pub-rail-day-row a` in sessions.tsx/agenda-rail.tsx, and the
// portal home's `<a href="/portal/tasks">`/`<a href="/portal/submissions">`,
// both inside `<section class="chq-section">` with no `.chq-section a`
// rule anywhere).
//
// This file only WIDENS the population into visibility -- draining the
// offenders it finds is a separate, later lane's job (see the ceiling
// comment in phone-tap-target-scan/ceilings.ts).
import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { stripTsxComments } from './phone-tap-target-scan/core.js';
import {
  classlessAnchorSites,
  findSsrClasslessAnchorOffenders,
  ssrCssModuleFiles,
  ssrRouteTsxFiles,
} from './phone-tap-target-scan/ssr.js';
import { SSR_CLASSLESS_ANCHOR_CEILING } from './phone-tap-target-scan/ceilings.js';

const HERE = dirname(fileURLToPath(import.meta.url)); // app/src
const REPO_ROOT = join(HERE, '..', '..');
const SSR_ROOT = join(REPO_ROOT, 'src');
const ROUTES_ROOT = join(SSR_ROOT, 'routes');
const SSR_CSS_MODULES = ssrCssModuleFiles(SSR_ROOT);
const ROUTE_FILES = ssrRouteTsxFiles(ROUTES_ROOT);

export { SSR_CLASSLESS_ANCHOR_CEILING };

describe('phone tap-target floor scan — SSR classless-anchor population', () => {
  it('derives a non-empty population (vacuous-scan tripwire), and excludes src/routes/dev/**', () => {
    expect(ROUTE_FILES.length).toBeGreaterThan(20);
    const labels = ROUTE_FILES.map((p) => relative(ROUTES_ROOT, p));
    expect(labels.some((l) => l.startsWith('public/'))).toBe(true);
    expect(labels.some((l) => l.startsWith('portal/'))).toBe(true);
    expect(labels.some((l) => l.startsWith('dev/'))).toBe(false);
  });

  it('does not confuse a class-bearing <a> for a classless one (negative control)', () => {
    const src = '<div class="chq-x"><a class="chq-y" href="/x">Go</a></div>';
    const sites = classlessAnchorSites(src);
    expect(sites).toEqual([]);
  });

  it('keys a classless <a> on its nearest enclosing chq- token, skipping an unclassed intermediate tag (positive control, mirrors the real portal-home shape)', () => {
    const src = '<section class="chq-section"><p><a href="/portal/tasks">View all tasks</a></p></section>';
    const sites = classlessAnchorSites(src);
    expect(sites).toHaveLength(1);
    expect(sites[0]!.tokens).toEqual(['chq-section']);
  });

  it('reports "(no enclosing chq- token)" when nothing in the ancestor chain carries a chq- token (positive control)', () => {
    const src = '<div><p><a href="/x">Go</a></p></div>';
    const sites = classlessAnchorSites(src);
    expect(sites).toHaveLength(1);
    expect(sites[0]!.tokens).toEqual([]);
  });

  it('ignores a bare <a href> that only appears inside a // comment (known false positive, src/routes/public/empty-state.tsx shape)', () => {
    const raw = '// escape is a plain <a href>, never a <button onClick>\nexport const X = () => <section class="chq-x" />;';
    const stripped = stripTsxComments(raw);
    expect(classlessAnchorSites(stripped)).toEqual([]);
  });

  it('reports an unfloored classless anchor as an offender (tmpdir fixture, positive control) and a fully-floored one as clean (tmpdir fixture, negative control, DEC-967 wave-127: non-vacuity over a fixture, never a product count)', async () => {
    const { mkdtempSync, rmSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const dir = mkdtempSync(join(tmpdir(), 'w17c-classless-anchor-'));
    try {
      const tsxPath = join(dir, 'fixture.tsx');
      const cssPath = join(dir, 'fixture.css.ts');
      writeFileSync(
        tsxPath,
        'export const X = () => <section class="chq-w17c-section"><p><a href="/x">Go</a></p></section>;',
      );

      writeFileSync(cssPath, 'export const FAKE_CSS = `.chq-w17c-section { color: blue; }`;');
      const unfloored = findSsrClasslessAnchorOffenders([tsxPath], [cssPath], dir);
      expect(unfloored.some((o) => o.includes('chq-w17c-section'))).toBe(true);

      writeFileSync(
        cssPath,
        'export const FAKE_CSS = `@media (max-width: 700px) { .chq-w17c-section a { min-height: 44px; display: flex; align-items: center; padding: 0 12px; } }`;',
      );
      const floored = findSsrClasslessAnchorOffenders([tsxPath], [cssPath], dir);
      expect(floored.some((o) => o.includes('chq-w17c-section'))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('a bare `<a>` at the top level with no ancestor at all is reported against "(no enclosing chq- token)" (tmpdir fixture) and can never pass, exemption included, since nothing keys a CSS rule to it', async () => {
    const { mkdtempSync, rmSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const dir = mkdtempSync(join(tmpdir(), 'w17c-no-token-'));
    try {
      const tsxPath = join(dir, 'fixture.tsx');
      writeFileSync(tsxPath, 'export const X = () => <a href="/x">Go</a>;');
      const offenders = findSsrClasslessAnchorOffenders([tsxPath], [], dir);
      expect(offenders).toEqual(['fixture.tsx:1 — (no enclosing chq- token)']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reports a live measured offender the field guide names (chq-pub-rail-day-row, sessions.tsx)', () => {
    const src = stripTsxComments(readFileSync(join(ROUTES_ROOT, 'public', 'sessions.tsx'), 'utf-8'));
    const sites = classlessAnchorSites(src);
    expect(sites.some((s) => s.tokens.includes('chq-pub-rail-day-row'))).toBe(true);
  });

  // Wave v12m-w18-e (DEC-967 sighting): the test this replaces named a
  // PRODUCT offender ("chq-section, portal/index.tsx") that w17-e's own
  // drain fixed (both anchors there now carry
  // class="chq-portal-standalone-link", so they no longer contribute a
  // classless-anchor site at all) -- the scan made fixing its own named
  // finding illegal, the exact trap this decision names. Non-vacuity is
  // proved here over an INLINE SYNTHETIC FIXTURE the test owns, never a
  // product count and never a coordinate in another file.
  it('reports an offender for a classless anchor keyed on a token with no reaching phone floor (non-vacuity control, synthetic fixture, DEC-967)', async () => {
    const { mkdtempSync, rmSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const dir = mkdtempSync(join(tmpdir(), 'w18e-nonvacuity-'));
    try {
      const tsxPath = join(dir, 'fixture.tsx');
      writeFileSync(
        tsxPath,
        'export const X = () => <section class="chq-w18e-fixture-section"><p><a href="/x">View all things</a></p></section>;',
      );
      const sites = classlessAnchorSites(
        stripTsxComments(readFileSync(tsxPath, 'utf-8')),
      );
      expect(sites).toHaveLength(1);
      expect(sites[0]!.tokens).toEqual(['chq-w18e-fixture-section']);
      const offenders = findSsrClasslessAnchorOffenders([tsxPath], [], dir);
      expect(offenders).toEqual(['fixture.tsx:1 — .chq-w18e-fixture-section']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('stays at or under the SSR classless-anchor ceiling, and never raises it silently', () => {
    const offenders = findSsrClasslessAnchorOffenders(ROUTE_FILES, SSR_CSS_MODULES, REPO_ROOT);
    expect(
      offenders.length,
      `SSR classless <a> tap targets with no reaching phone-width floor and no tap-floor-exempt ` +
        `comment on their enclosing token (${offenders.length}, ceiling ${SSR_CLASSLESS_ANCHOR_CEILING} -- ` +
        `may only be LOWERED):\n${offenders.join('\n')}`,
    ).toBeLessThanOrEqual(SSR_CLASSLESS_ANCHOR_CEILING);
  });

  it(`never falls below the SSR classless-anchor ceiling (${SSR_CLASSLESS_ANCHOR_CEILING}) without the ceiling being lowered to match (a stale ceiling licenses stagnation)`, () => {
    const offenders = findSsrClasslessAnchorOffenders(ROUTE_FILES, SSR_CSS_MODULES, REPO_ROOT);
    if (offenders.length < SSR_CLASSLESS_ANCHOR_CEILING) {
      throw new Error(
        `SSR classless-anchor offenders (${offenders.length}) fell below the ` +
          `SSR_CLASSLESS_ANCHOR_CEILING of ${SSR_CLASSLESS_ANCHOR_CEILING}. This is the ratchet ` +
          `working: offenders got fixed. Lower the ceiling now (DEC-989 wave-123 protocol): the lane ` +
          `that drains offenders re-measures on its own branch (force this constant to -1, read the ` +
          `printed offender list) and writes its own branch's truth; the merge train re-measures the ` +
          `integrated tree and writes the combined truth. Replace the line in ` +
          `phone-tap-target-scan/ceilings.ts:\n` +
          `  export const SSR_CLASSLESS_ANCHOR_CEILING = ${offenders.length};`,
      );
    }
    expect(offenders.length).toBeGreaterThanOrEqual(SSR_CLASSLESS_ANCHOR_CEILING);
  });
});
