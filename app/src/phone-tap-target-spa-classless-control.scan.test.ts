// Phone tap-target floor scan -- SPA classless-control population (wave
// v12m-w10, task w10-na, DEC-180 wave-154 amendment).
//
// Every SPA tap-target ratchet in ./phone-tap-target-scan/ is keyed on
// class TOKENS taken from markup: an `<a>`/`<Link>`/`<NavLink>`/`<button>`/
// `<select>`/`<textarea>`/`<input>` under app/src/**/*.tsx declaring no
// `className=` contributes NO token, so it is ungradeable by construction
// -- the same blind spot the SSR half of the product already learned to
// see (`phone-tap-target-ssr-classless-anchor.scan.test.ts`, wave v12m-w17
// task w17-c), never mirrored onto the SPA until now.
//
// This file only WIDENS the population into visibility -- draining the
// offenders it finds is folded into this same lane's scope per the task
// (see ceilings.ts's SPA_CLASSLESS_CONTROL_CEILING history and
// docs/design/audit/spa-classless-control-390-v12.md for the full ledger).
import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { allCssFiles, allTsxFiles, stripTsxComments } from './phone-tap-target-scan/core.js';
import {
  findSpaClasslessControlOffenders,
  selectorReachesClasslessControl,
  spaClasslessControlSites,
  SPA_CLASSLESS_CONTROL_TAGS,
} from './phone-tap-target-scan/spa-classless.js';
import { SPA_CLASSLESS_CONTROL_CEILING } from './phone-tap-target-scan/ceilings.js';

const HERE = dirname(fileURLToPath(import.meta.url)); // app/src
const REPO_ROOT = join(HERE, '..', '..');
const SPA_ROOT = HERE;
const SPA_CSS_MODULES = allCssFiles(SPA_ROOT);
const TSX_FILES = allTsxFiles(SPA_ROOT);

export { SPA_CLASSLESS_CONTROL_CEILING };

describe('phone tap-target floor scan — SPA classless-control population', () => {
  it('derives a non-empty population (vacuous-scan tripwire): every population tag, exact total and per-file breakdown', () => {
    expect(TSX_FILES.length).toBeGreaterThan(50);
    const perFile = new Map<string, number>();
    let total = 0;
    for (const path of TSX_FILES) {
      const src = stripTsxComments(readFileSync(path, 'utf-8'));
      const n = spaClasslessControlSites(src).length;
      if (n > 0) perFile.set(relative(SPA_ROOT, path), n);
      total += n;
    }
    // Exact totals pinned so the grammar cannot silently drift to matching
    // nothing (DEC-967 wave-127: a scan that finds "0 offenders" over an
    // empty population is not conformance, it is blindness). Re-measure by
    // forcing this expectation to fail and reading the printed diff if the
    // corpus changes.
    expect(total).toBe(14);
    expect(Object.fromEntries(perFile)).toEqual({
      'pages/Agenda.tsx': 1,
      'pages/NotFound.tsx': 2,
      'pages/settings/EventSettingsPanel.tsx': 1,
      'pages/speakers/RosterPanel.tsx': 1,
      'pages/speakers/SpeakerDetailPage.tsx': 2,
      'pages/contacts/BulkEmailModal.tsx': 1,
      'pages/contacts/AddToEventModal.tsx': 1,
      'pages/contacts/ContactDrawer.tsx': 1,
      'pages/contacts/NewContactModal.tsx': 1,
      'pages/contacts/DuplicateEmailNotice.tsx': 1,
      'pages/submissions/SubmissionDetailPage.tsx': 2,
    });
  });

  it('covers every population tag ({a, Link, NavLink, button, select, textarea, input})', () => {
    expect(SPA_CLASSLESS_CONTROL_TAGS).toEqual(['a', 'Link', 'NavLink', 'button', 'select', 'textarea', 'input']);
  });

  it('does not confuse a className-bearing tag for a classless one (negative control)', () => {
    const src = '<div className="chq-x"><Link className="chq-y" to="/x">Go</Link></div>';
    expect(spaClasslessControlSites(src)).toEqual([]);
  });

  it('keys a classless control on its nearest enclosing chq- token, skipping an unclassed intermediate tag (positive control)', () => {
    const src = '<section className="chq-section"><p><Link to="/portal/tasks">View all</Link></p></section>';
    const sites = spaClasslessControlSites(src);
    expect(sites).toHaveLength(1);
    expect(sites[0]).toMatchObject({ tag: 'Link', tokens: ['chq-section'] });
  });

  it('reports "(no enclosing chq- token)" when nothing in the ancestor chain carries a chq- token (positive control)', () => {
    const src = '<div><p><button>Go</button></p></div>';
    const sites = spaClasslessControlSites(src);
    expect(sites).toHaveLength(1);
    expect(sites[0]).toMatchObject({ tag: 'button', tokens: [] });
  });

  it('ignores a classless tag that only appears inside a // comment (known false positive shape)', () => {
    const raw = '// escape is a plain <a href>, never a real anchor\nexport const X = () => <section className="chq-x" />;';
    const stripped = stripTsxComments(raw);
    expect(spaClasslessControlSites(stripped)).toEqual([]);
  });

  it('selectorReachesClasslessControl matches the bare element, a class-then-element descendant, and an element-qualified ancestor (positive controls); rejects an unrelated selector (negative control)', () => {
    expect(selectorReachesClasslessControl('a', 'chq-section', 'a')).toBe(true);
    expect(selectorReachesClasslessControl('.chq-section a', 'chq-section', 'a')).toBe(true);
    expect(selectorReachesClasslessControl('nav.chq-section a', 'chq-section', 'a')).toBe(true);
    expect(selectorReachesClasslessControl('.chq-section-other a', 'chq-section', 'a')).toBe(false);
    expect(selectorReachesClasslessControl('.chq-section button', 'chq-section', 'a')).toBe(false);
  });

  it('reports an unfloored classless control as an offender (tmpdir fixture, positive control) and a fully-floored one as clean (tmpdir fixture, negative control, DEC-967: non-vacuity over a fixture, never a product count)', async () => {
    const { mkdtempSync, rmSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const dir = mkdtempSync(join(tmpdir(), 'w10na-classless-control-'));
    try {
      const tsxPath = join(dir, 'fixture.tsx');
      const cssPath = join(dir, 'fixture.css');
      writeFileSync(
        tsxPath,
        'export const X = () => <section className="chq-w10na-section"><p><Link to="/x">Go</Link></p></section>;',
      );
      writeFileSync(cssPath, '.chq-w10na-section { color: blue; }');
      const unfloored = findSpaClasslessControlOffenders([tsxPath], [cssPath], dir);
      expect(unfloored.some((o) => o.includes('chq-w10na-section'))).toBe(true);

      writeFileSync(
        cssPath,
        '@media (max-width: 700px) { .chq-w10na-section a { min-height: 44px; display: flex; align-items: center; padding: 0 12px; } }',
      );
      const floored = findSpaClasslessControlOffenders([tsxPath], [cssPath], dir);
      expect(floored.some((o) => o.includes('chq-w10na-section'))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('a bare `<input>` at the top level with no ancestor at all is reported against "(no enclosing chq- token)" (tmpdir fixture) and can never pass', async () => {
    const { mkdtempSync, rmSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const dir = mkdtempSync(join(tmpdir(), 'w10na-no-token-'));
    try {
      const tsxPath = join(dir, 'fixture.tsx');
      writeFileSync(tsxPath, 'export const X = () => <input />;');
      const offenders = findSpaClasslessControlOffenders([tsxPath], [], dir);
      expect(offenders).toEqual(['fixture.tsx:1 — <input> (no enclosing chq- token)']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('a tap-floor-exempt comment on the enclosing token clears an otherwise-unfloored site (tmpdir fixture)', async () => {
    const { mkdtempSync, rmSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const dir = mkdtempSync(join(tmpdir(), 'w10na-exempt-'));
    try {
      const tsxPath = join(dir, 'fixture.tsx');
      const cssPath = join(dir, 'fixture.css');
      writeFileSync(
        tsxPath,
        'export const X = () => <div className="chq-w10na-exempt-scope"><button>Go</button></div>;',
      );
      writeFileSync(
        cssPath,
        '/* tap-floor-exempt: inline-in-prose */\n.chq-w10na-exempt-scope { color: blue; }',
      );
      const offenders = findSpaClasslessControlOffenders([tsxPath], [cssPath], dir);
      expect(offenders.some((o) => o.includes('chq-w10na-exempt-scope'))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('stays at or under the SPA classless-control ceiling, and never raises it silently', () => {
    const offenders = findSpaClasslessControlOffenders(TSX_FILES, SPA_CSS_MODULES, REPO_ROOT);
    expect(
      offenders.length,
      `SPA classless controls with no reaching phone-width floor and no tap-floor-exempt ` +
        `comment on their enclosing token (${offenders.length}, ceiling ${SPA_CLASSLESS_CONTROL_CEILING} -- ` +
        `may only be LOWERED):\n${offenders.join('\n')}`,
    ).toBeLessThanOrEqual(SPA_CLASSLESS_CONTROL_CEILING);
  });

  it(`never falls below the SPA classless-control ceiling (${SPA_CLASSLESS_CONTROL_CEILING}) without the ceiling being lowered to match (a stale ceiling licenses stagnation)`, () => {
    const offenders = findSpaClasslessControlOffenders(TSX_FILES, SPA_CSS_MODULES, REPO_ROOT);
    if (offenders.length < SPA_CLASSLESS_CONTROL_CEILING) {
      throw new Error(
        `SPA classless-control offenders (${offenders.length}) fell below the ` +
          `SPA_CLASSLESS_CONTROL_CEILING of ${SPA_CLASSLESS_CONTROL_CEILING}. This is the ratchet ` +
          `working: offenders got fixed. Lower the ceiling now (DEC-989 protocol): force this constant ` +
          `to -1, read the printed offender list, and replace the line in ` +
          `phone-tap-target-scan/ceilings.ts:\n` +
          `  export const SPA_CLASSLESS_CONTROL_CEILING = ${offenders.length};`,
      );
    }
    expect(offenders.length).toBeGreaterThanOrEqual(SPA_CLASSLESS_CONTROL_CEILING);
  });
});
