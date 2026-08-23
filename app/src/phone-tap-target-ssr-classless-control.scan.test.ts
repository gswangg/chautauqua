// Phone tap-target floor scan -- SSR classless NON-ANCHOR control
// population (wave v12m-w40, task w40-e, DEC-393).
//
// Companion to `phone-tap-target-ssr-classless-anchor.scan.test.ts`
// (`SSR_CLASSLESS_ANCHOR_CEILING`, owned by v12m-w39-e) -- that file only
// ever widened the SSR population to a classless `<a>`. This file widens
// it to the classless NON-anchor interactive tag set
// ({input, select, textarea, button}) under `src/routes/public/**` and
// `src/routes/portal/**`, excluding `<input type="hidden">` (inert, no hit
// box). Explicitly disjoint populations, explicitly disjoint ceilings
// (`ssr-classless-control-ceiling.ts`, never `ceilings.ts`), so the two
// lanes owning them never touch the same constant.
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { stripTsxComments } from './phone-tap-target-scan/core.js';
import {
  findSsrClasslessControlOffenders,
  ssrClasslessControlRouteFiles,
  ssrClasslessControlSites,
  ssrCssModuleFiles,
  SSR_CLASSLESS_CONTROL_CEILING,
} from './phone-tap-target-scan/ssr-classless-control-ceiling.js';

const HERE = dirname(fileURLToPath(import.meta.url)); // app/src
const REPO_ROOT = join(HERE, '..', '..');
const SSR_ROOT = join(REPO_ROOT, 'src');
const ROUTES_ROOT = join(SSR_ROOT, 'routes');
const SSR_CSS_MODULES = ssrCssModuleFiles(SSR_ROOT);
const ROUTE_FILES = ssrClasslessControlRouteFiles(ROUTES_ROOT);

export { SSR_CLASSLESS_CONTROL_CEILING };

describe('phone tap-target floor scan — SSR classless NON-ANCHOR control population', () => {
  it('derives a non-empty population scoped to public/ and portal/ only (vacuous-scan tripwire)', () => {
    expect(ROUTE_FILES.length).toBeGreaterThan(5);
    const labels = ROUTE_FILES.map((p) => relative(ROUTES_ROOT, p));
    expect(labels.every((l) => l.startsWith('public/') || l.startsWith('portal/'))).toBe(true);
    expect(labels.some((l) => l.startsWith('public/'))).toBe(true);
    expect(labels.some((l) => l.startsWith('portal/'))).toBe(true);
  });

  it('does not confuse a class-bearing control for a classless one (negative control)', () => {
    const src = '<div class="chq-x"><input class="chq-y" name="a" /></div>';
    expect(ssrClasslessControlSites(src)).toEqual([]);
  });

  it('excludes an <input type="hidden"> (inert, no hit box -- positive-population exclusion)', () => {
    const src = '<div class="chq-x"><input type="hidden" name="csrf" value="t" /></div>';
    expect(ssrClasslessControlSites(src)).toEqual([]);
  });

  it('admits a visible <input> with no class (positive control) keyed on its enclosing token', () => {
    const src = '<div class="chq-x"><input type="text" name="q" /></div>';
    const sites = ssrClasslessControlSites(src);
    expect(sites).toHaveLength(1);
    expect(sites[0]!.tag).toBe('input');
    expect(sites[0]!.tokens).toEqual(['chq-x']);
  });

  it('admits a classless <select> and <button> too (element-set breadth control)', () => {
    const src = '<div class="chq-x"><select name="r"><option>A</option></select><button>Go</button></div>';
    const sites = ssrClasslessControlSites(src);
    expect(sites.map((s) => s.tag)).toEqual(['select', 'button']);
  });

  it('ignores a classless control that only appears inside a // comment (known false positive)', () => {
    const raw = '// escape is a plain <input>, never a real one\nexport const X = () => <section class="chq-x" />;';
    const stripped = stripTsxComments(raw);
    expect(ssrClasslessControlSites(stripped)).toEqual([]);
  });

  it('reports an unfloored classless control as an offender (tmpdir fixture, positive control) and a fully-floored one as clean (tmpdir fixture, negative control)', async () => {
    const { mkdtempSync, rmSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const dir = mkdtempSync(join(tmpdir(), 'w40e-classless-control-'));
    try {
      const tsxPath = join(dir, 'fixture.tsx');
      const cssPath = join(dir, 'fixture.css.ts');
      writeFileSync(
        tsxPath,
        'export const X = () => <div class="chq-w40e-wrap"><input type="text" name="q" /></div>;',
      );

      writeFileSync(cssPath, 'export const FAKE_CSS = `.chq-w40e-wrap { color: blue; }`;');
      const unfloored = findSsrClasslessControlOffenders([tsxPath], [cssPath], dir);
      expect(unfloored.some((o) => o.includes('chq-w40e-wrap'))).toBe(true);

      writeFileSync(
        cssPath,
        'export const FAKE_CSS = `@media (max-width: 700px) { .chq-w40e-wrap input { min-height: 44px; display: flex; align-items: center; padding: 0 12px; } }`;',
      );
      const floored = findSsrClasslessControlOffenders([tsxPath], [cssPath], dir);
      expect(floored.some((o) => o.includes('chq-w40e-wrap'))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('a classless control with no enclosing chq- token at all is reported against "(no enclosing chq- token)" and can never pass (tmpdir fixture)', async () => {
    const { mkdtempSync, rmSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const dir = mkdtempSync(join(tmpdir(), 'w40e-no-token-'));
    try {
      const tsxPath = join(dir, 'fixture.tsx');
      writeFileSync(tsxPath, 'export const X = () => <input type="text" name="q" />;');
      const offenders = findSsrClasslessControlOffenders([tsxPath], [], dir);
      expect(offenders).toEqual(['fixture.tsx:1 — <input> (no enclosing chq- token)']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('honours a named tap-floor-exempt comment on the enclosing token (tmpdir fixture, mirrors the real .chq-cfp-option composition shape)', async () => {
    const { mkdtempSync, rmSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const dir = mkdtempSync(join(tmpdir(), 'w40e-exempt-'));
    try {
      const tsxPath = join(dir, 'fixture.tsx');
      const cssPath = join(dir, 'fixture.css.ts');
      writeFileSync(
        tsxPath,
        'export const X = () => <label class="chq-w40e-option"><input type="checkbox" name="t" />Label</label>;',
      );
      writeFileSync(
        cssPath,
        'export const FAKE_CSS = `/* tap-floor-exempt: composition -- fixture */\\n.chq-w40e-option { min-height: 46px; display: flex; align-items: center; padding: 0 14px; }`;',
      );
      const offenders = findSsrClasslessControlOffenders([tsxPath], [cssPath], dir);
      expect(offenders.some((o) => o.includes('chq-w40e-option'))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('stays at or under the SSR classless-control ceiling, and never raises it silently', () => {
    const offenders = findSsrClasslessControlOffenders(ROUTE_FILES, SSR_CSS_MODULES, REPO_ROOT);
    expect(
      offenders.length,
      `SSR classless <input>/<select>/<textarea>/<button> tap targets under public/+portal/ with no ` +
        `reaching phone-width floor and no tap-floor-exempt comment on their enclosing token ` +
        `(${offenders.length}, ceiling ${SSR_CLASSLESS_CONTROL_CEILING} -- may only be LOWERED):\n${offenders.join('\n')}`,
    ).toBeLessThanOrEqual(SSR_CLASSLESS_CONTROL_CEILING);
  });

  it(`never falls below the SSR classless-control ceiling (${SSR_CLASSLESS_CONTROL_CEILING}) without the ceiling being lowered to match (a stale ceiling licenses stagnation)`, () => {
    const offenders = findSsrClasslessControlOffenders(ROUTE_FILES, SSR_CSS_MODULES, REPO_ROOT);
    if (offenders.length < SSR_CLASSLESS_CONTROL_CEILING) {
      throw new Error(
        `SSR classless-control offenders (${offenders.length}) fell below the ` +
          `SSR_CLASSLESS_CONTROL_CEILING of ${SSR_CLASSLESS_CONTROL_CEILING}. This is the ratchet ` +
          `working: offenders got fixed. Lower the ceiling now (DEC-989 protocol): force this ` +
          `constant to -1, read the printed offender list, and replace the line in ` +
          `phone-tap-target-scan/ssr-classless-control-ceiling.ts:\n` +
          `  export const SSR_CLASSLESS_CONTROL_CEILING = ${offenders.length};`,
      );
    }
    expect(offenders.length).toBeGreaterThanOrEqual(SSR_CLASSLESS_CONTROL_CEILING);
  });
});
