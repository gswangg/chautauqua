// Phone tap-target floor scan -- SSR routes (public/portal/docs/auth),
// mandate item 5.
//
// Extracted from phone-tap-target.scan.test.ts (custodian decomposition,
// wave v12m-w12) with NO behavior change: this `describe` block is
// byte-for-byte what used to live in that file. Split out because that
// file had become a repeated merge-conflict hotspot -- multiple lanes
// lowering DIFFERENT ceilings (base sub-44px scan, row-action-anchor, SSR)
// were all forced to touch the same 570-line file. This file owns only
// the SSR widening; the base SPA sub-44px scan lives in
// ./phone-tap-target.scan.test.ts, the SPA row-action-anchor lens in
// ./phone-tap-target-anchor-floor.scan.test.ts. Both ceiling constants
// (with their full amendment history) now live in
// ./phone-tap-target-scan/ceilings.ts.
//
// Everything here scans the SSR half of the product -- src/routes/public
// (the CFP, the public event site), src/routes/portal, src/routes/docs-site,
// src/routes/auth -- which ships its own Hono JSX views and its own CSS-in-TS
// stylesheets. See phone-tap-target-scan/ssr.ts for the full population
// rationale, the ratchet's one-sided-by-design rationale, and the known
// composed-modifier noise named in its ceiling comment.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  declaredHeightPx,
  narrowMediaRules,
  selectorDeclaresBareClass,
  SSR_CLASS_ATTR_RE,
  TAP_FLOOR_PX,
  tapTargetTagTokens,
  topLevelRulesWithExemption,
} from './phone-tap-target-scan/core.js';
import {
  allSsrTapTargetTokens,
  extractCssTsLiteral,
  findSsrOffenders,
  findSsrUnflooredTokens,
  ssrCssModuleFiles,
  ssrTsxFiles,
} from './phone-tap-target-scan/ssr.js';
import {
  SSR_TAP_FLOOR_OFFENDERS_CEILING,
  SSR_UNFLOORED_TOKENS_CEILING,
} from './phone-tap-target-scan/ceilings.js';

const HERE = dirname(fileURLToPath(import.meta.url)); // app/src
const REPO_ROOT = join(HERE, '..', '..');
const SSR_ROOT = join(REPO_ROOT, 'src');
const SSR_CSS_MODULES = ssrCssModuleFiles(SSR_ROOT);
const SSR_TSX_FILES = ssrTsxFiles(SSR_ROOT);

export { SSR_TAP_FLOOR_OFFENDERS_CEILING, SSR_UNFLOORED_TOKENS_CEILING };

describe('phone tap-target floor scan — SSR routes (public/portal/docs/auth)', () => {
  it('derives a non-empty SSR population from both halves (vacuous-scan tripwire)', () => {
    expect(SSR_CSS_MODULES.length).toBeGreaterThan(5);
    expect(SSR_TSX_FILES.length).toBeGreaterThan(5);
    // The four route families the mandate names must each be represented,
    // asserted by path rather than count so a silently-emptied population
    // cannot pass by staying "non-empty" on one family alone.
    const labels = SSR_CSS_MODULES.map((p) => relative(REPO_ROOT, p));
    for (const family of ['src/routes/public/', 'src/routes/portal/', 'src/routes/docs-site.css.ts', 'src/routes/auth.css.ts']) {
      expect(labels.some((l) => l.startsWith(family) || l === family), `no SSR stylesheet under ${family}`).toBe(true);
    }
  });

  it('reads Hono JSX `class=` where the SPA extractor reads `className=` (positive control)', () => {
    const ssr = `export const X = () => <button class="chq-pub-search-submit">Search</button>;`;
    // The SPA-shaped extractor is blind to it -- which is exactly why the
    // SSR half went unscanned for so long.
    expect(tapTargetTagTokens(ssr)).toEqual([]);
    expect(tapTargetTagTokens(ssr, SSR_CLASS_ATTR_RE)).toContain('chq-pub-search-submit');
  });

  it('admits a bare `<a>` (no chq-btn) into the SSR population, unlike the SPA default (DEC-393/DEC-976 wave-138 predicate repair)', () => {
    const ssr = `export const X = () => <a class="chq-x-bare-link">Bare</a>;`;
    // Default (SPA) population: a bare anchor without `chq-btn` is dropped --
    // it is graded separately, by anchor-floor.ts, over there.
    expect(tapTargetTagTokens(ssr, SSR_CLASS_ATTR_RE)).toEqual([]);
    // SSR population (anchorNeedsBtnToken: false, what ssr.ts now passes):
    // the same bare anchor IS admitted, because these routes have no
    // `.chq-btn` primitive at all.
    expect(tapTargetTagTokens(ssr, SSR_CLASS_ATTR_RE, { anchorNeedsBtnToken: false })).toContain('chq-x-bare-link');
  });

  it('reports an unfloored bare SSR anchor as an offender (positive control, tmpdir fixture), and the identical fixture through the SPA population is NOT reported (negative control, DEC-967 wave-127: non-vacuity over a fixture, never a product count)', () => {
    const ssr = `export const X = () => <a class="chq-x-bare-link">Bare</a>;`;
    const tmpDir = mkdtempSync(join(tmpdir(), 'w13-dd-bare-anchor-'));
    const cssPath = join(tmpDir, 'fixture.css.ts');
    // No height/min-height declared anywhere -- an honest unfloored fixture.
    writeFileSync(cssPath, 'export const FAKE_CSS = `.chq-x-bare-link { color: blue; }`;');
    try {
      // Positive control: widened (anchorNeedsBtnToken: false) SSR population
      // sees the bare-anchor token and reports it unfloored.
      const ssrTokens = new Set(tapTargetTagTokens(ssr, SSR_CLASS_ATTR_RE, { anchorNeedsBtnToken: false }));
      expect(ssrTokens.has('chq-x-bare-link')).toBe(true);
      const ssrOffenders = findSsrUnflooredTokens([cssPath], ssrTokens, tmpDir);
      expect(ssrOffenders.some((o) => o.includes('chq-x-bare-link'))).toBe(true);

      // Negative control: the SAME markup fixture read through the SPA
      // (default, anchorNeedsBtnToken: true) population never picks up the
      // bare anchor token at all -- there is nothing for a downstream
      // offender check to even see, let alone report.
      const spaTokens = new Set(tapTargetTagTokens(ssr));
      expect(spaTokens.has('chq-x-bare-link')).toBe(false);
      const spaOffenders = findSsrUnflooredTokens([cssPath], spaTokens, tmpDir);
      expect(spaOffenders.some((o) => o.includes('chq-x-bare-link'))).toBe(false);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('extracts rules out of a CSS-in-TS template literal, interpolations stripped (positive control)', () => {
    const mod = 'export const FAKE_CSS = `.chq-x-ssr-btn { min-height: 26px; }\n${OTHER_CSS}\n`;';
    const css = extractCssTsLiteral(mod);
    expect(css).toContain('.chq-x-ssr-btn');
    expect(css).not.toContain('OTHER_CSS');
    const rule = topLevelRulesWithExemption(css).find((r) =>
      selectorDeclaresBareClass(r.selector, 'chq-x-ssr-btn'),
    )!;
    expect(declaredHeightPx(rule.body)).toBe(26);
  });

  it('honours the same <=700px override and tap-floor-exempt escapes as the SPA scan (negative controls)', () => {
    const overridden = 'export const FAKE_CSS = `.chq-x-ssr-btn { min-height: 26px; }\n@media (max-width: 700px) { .chq-x-ssr-btn { min-height: 44px; } }`;';
    const css = extractCssTsLiteral(overridden);
    expect(
      narrowMediaRules(css, 700).some(
        (r) => selectorDeclaresBareClass(r.selector, 'chq-x-ssr-btn') && (declaredHeightPx(r.body) ?? 0) >= TAP_FLOOR_PX,
      ),
    ).toBe(true);

    const exempted = extractCssTsLiteral(
      'export const FAKE_CSS = `/* tap-floor-exempt: decorative */\n.chq-x-ssr-chip { min-height: 20px; }`;',
    );
    expect(
      topLevelRulesWithExemption(exempted).find((r) => selectorDeclaresBareClass(r.selector, 'chq-x-ssr-chip'))!.exempt,
    ).toBe(true);
  });

  it('stays at or under the SSR declared-sub-floor ceiling, and never raises it silently', () => {
    const tokens = allSsrTapTargetTokens(SSR_TSX_FILES);
    const offenders = findSsrOffenders(SSR_CSS_MODULES, tokens, REPO_ROOT);
    expect(
      offenders.length,
      `SSR sub-44px tap targets with no phone-width override and no tap-floor-exempt comment ` +
        `(${offenders.length}, ceiling ${SSR_TAP_FLOOR_OFFENDERS_CEILING} -- may only be LOWERED):\n${offenders.join('\n')}`,
    ).toBeLessThanOrEqual(SSR_TAP_FLOOR_OFFENDERS_CEILING);
  });

  it('the unfloored-token population is non-empty and includes a token the live probe measured sub-floor (tripwire)', () => {
    // A scan that silently stopped matching would report zero and look
    // like progress. Pin it to a token the meta-fidelity probe measured at
    // 390 with its own eyes, so "clean" can never mean "blind".
    const tokens = allSsrTapTargetTokens(SSR_TSX_FILES);
    expect(tokens.size).toBeGreaterThan(20);
    expect(tokens.has('chq-auth-demo-btn')).toBe(true);
    // Widened wave-139 (DEC-393 + DEC-976 wave-138; DEC-613 + DEC-989
    // wave-139): a bare `<a>` is now admitted as a control on the SSR
    // surfaces, so the population jumps considerably once anchors without
    // a `chq-btn` token count. `chq-pub-session-title` is a token three
    // independent reviewers measured sub-floor at 390.
    expect(tokens.size).toBeGreaterThan(60);
    expect(tokens.has('chq-pub-session-title')).toBe(true);
  });

  it('stays at or under the SSR unfloored-token ceiling, and never raises it silently', () => {
    const tokens = allSsrTapTargetTokens(SSR_TSX_FILES);
    const offenders = findSsrUnflooredTokens(SSR_CSS_MODULES, tokens, REPO_ROOT);
    expect(
      offenders.length,
      `SSR tap targets whose CSS never declares a >=44px floor at any width ` +
        `(${offenders.length}, ceiling ${SSR_UNFLOORED_TOKENS_CEILING} -- may only be LOWERED):\n${offenders.join('\n')}`,
    ).toBeLessThanOrEqual(SSR_UNFLOORED_TOKENS_CEILING);
  });

  it(`never falls below the SSR unfloored-token ceiling (${SSR_UNFLOORED_TOKENS_CEILING}) without the ceiling being lowered to match (a stale ceiling licenses stagnation)`, () => {
    const tokens = allSsrTapTargetTokens(SSR_TSX_FILES);
    const offenders = findSsrUnflooredTokens(SSR_CSS_MODULES, tokens, REPO_ROOT);
    if (offenders.length < SSR_UNFLOORED_TOKENS_CEILING) {
      throw new Error(
        `SSR tap targets whose CSS never declares a >=44px floor at any width (${offenders.length}) fell ` +
          `below the SSR_UNFLOORED_TOKENS_CEILING of ${SSR_UNFLOORED_TOKENS_CEILING}. This is the ratchet ` +
          `working: offenders got fixed. Lower the ceiling now (DEC-989 wave-123 protocol): the lane that ` +
          `drains offenders re-measures on its own branch (force this constant to -1, read the printed ` +
          `offender list) and writes its own branch's truth; the merge train re-measures the integrated ` +
          `tree and writes the combined truth. Replace the line in phone-tap-target-scan/ceilings.ts:\n` +
          `  export const SSR_UNFLOORED_TOKENS_CEILING = ${offenders.length};`,
      );
    }
    expect(offenders.length).toBeGreaterThanOrEqual(SSR_UNFLOORED_TOKENS_CEILING);
  });

  // Two-sided ratchet companion (DEC-808 wave-85 amendment, enforced by
  // test/campaign-ratchet-two-sided.scan.test.ts). This file's own header
  // comment pointed at "the companion ... test for the other half of the
  // ratchet this file's own test name always claimed to have" without ever
  // landing one for SSR_TAP_FLOOR_OFFENDERS_CEILING specifically -- mirrors
  // phone-tap-target-anchor-floor.scan.test.ts's ANCHOR_FLOOR_OFFENDERS_CEILING
  // companion and this same describe block's own SSR_UNFLOORED_TOKENS_CEILING
  // companion directly above.
  it(`never falls below the SSR declared-sub-floor ceiling (${SSR_TAP_FLOOR_OFFENDERS_CEILING}) without the ceiling being lowered to match (a stale ceiling licenses stagnation)`, () => {
    const tokens = allSsrTapTargetTokens(SSR_TSX_FILES);
    const offenders = findSsrOffenders(SSR_CSS_MODULES, tokens, REPO_ROOT);
    if (offenders.length < SSR_TAP_FLOOR_OFFENDERS_CEILING) {
      throw new Error(
        `SSR sub-44px tap targets with no phone-width override and no tap-floor-exempt comment ` +
          `(${offenders.length}) fell below the SSR_TAP_FLOOR_OFFENDERS_CEILING of ` +
          `${SSR_TAP_FLOOR_OFFENDERS_CEILING}. This is the ratchet working: offenders got fixed. Lower ` +
          `the ceiling now (DEC-989 wave-123 protocol): the lane that drains offenders re-measures on its ` +
          `own branch (force this constant to -1, read the printed offender list) and writes its own ` +
          `branch's truth; the merge train re-measures the integrated tree and writes the combined truth. ` +
          `Replace the line in phone-tap-target-scan/ceilings.ts:\n` +
          `  export const SSR_TAP_FLOOR_OFFENDERS_CEILING = ${offenders.length};`,
      );
    }
    expect(offenders.length).toBeGreaterThanOrEqual(SSR_TAP_FLOOR_OFFENDERS_CEILING);
  });
});
