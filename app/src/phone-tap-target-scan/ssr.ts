// SSR population widening (mandate item 5).
//
// Extracted from phone-tap-target.scan.test.ts (custodian decomposition,
// wave v12m-w8) with NO behavior change.
//
// The base scan (core.ts + the sibling test file) scans app/src ONLY: the
// SPA bundle's *.css sheets and its React *.tsx views. The SSR half of the
// product -- src/routes/public (the CFP, the public event site),
// src/routes/portal, src/routes/docs-site, src/routes/auth -- ships its own
// Hono JSX views and its own CSS-in-TS stylesheets, and NO tap-target scan
// looked at it until this widening. That is the same hole DEC-808 names as
// A DIRECTORY IS NOT A POPULATION: the scan was honest about everything it
// could see, and blind to half the surface. The meta-fidelity probe
// (scratchpad/metafid-c/out-public.txt) measured the consequence directly at
// 390 -- `button.chq-pub-search-submit` at 40x44, `a.chq-docs-wordmark` at
// 112.6x28, `button.chq-auth-demo-btn` at 269.8x17 -- live sub-floor
// controls on public routes, every one of them outside this file's
// population until now.
//
// SCOPE, stated plainly: this widening's job is to SEE the surface, not to
// fix it. The offender count is recorded as a ratchet seeded at the
// measured truth and may only be LOWERED -- one-sided by deliberate choice,
// unlike the two-sided ratchets elsewhere in this repo. Driving these to
// zero is engine work (the SSR sheets have no shared control-face primitive
// the way app/src's `.chq-btn` does), and a two-sided ratchet would demand
// that work be finished in the same change that makes it visible. Seeing
// first, then fixing, is the point.
//
// POPULATION is derived the way phone-horizontal-overflow.scan.test.ts
// derives its own SSR half -- by what a module's SOURCE declares (`export
// const *CSS`), never by a `.css.ts` filename convention, because
// src/views/theme.ts exports THEME_CSS without that suffix and a filename
// glob silently drops the one sheet every SSR surface loads (DEC-808,
// wave-96 finding).
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  declaredHeightPx,
  narrowMediaRules,
  selectorDeclaresBareClass,
  SSR_CLASS_ATTR_RE,
  TAP_FLOOR_PX,
  tapTargetTagTokens,
  topLevelRulesWithExemption,
  hasExemptionForToken,
  selectorMentionsToken,
  stripTsxComments,
} from './core.js';

const CSS_EXPORT_RE = /export const [A-Z0-9_]*CSS\s*=\s*/;

/** Every src/**\/*.ts module whose source exports a CSS template literal. */
export function ssrCssModuleFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.ts') || entry.name.includes('.test.')) continue;
    const absPath = join(entry.parentPath, entry.name);
    if (CSS_EXPORT_RE.test(readFileSync(absPath, 'utf-8'))) out.push(absPath);
  }
  return out.sort();
}

/** Every src/**\/*.tsx SSR view, excluding tests. */
export function ssrTsxFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.tsx') || entry.name.includes('.test.')) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

/** The literal CSS text out of a CSS-in-TS module, with `${...}`
 * interpolations stripped -- each names another module's own exported
 * constant, itself enumerated and scanned as that module's own file. */
export function extractCssTsLiteral(raw: string): string {
  return [...raw.matchAll(/`([\s\S]*?)`/g)]
    .map((m) => m[1] ?? '')
    .join('\n')
    .replace(/\$\{[^}]*\}/g, '');
}

export function allSsrTapTargetTokens(ssrTsxFiles: string[]): Set<string> {
  const out = new Set<string>();
  for (const path of ssrTsxFiles) {
    const src = stripTsxComments(readFileSync(path, 'utf-8'));
    for (const t of tapTargetTagTokens(src, SSR_CLASS_ATTR_RE)) out.add(t);
  }
  return out;
}

/** Same three-step judgement as core.ts's `findOffenders()` sibling in the
 * SPA scan -- top-level sub-floor height, no <=700px override, no named
 * exemption -- run over the SSR populations. */
export function findSsrOffenders(
  ssrCssModules: string[],
  tokens: Set<string>,
  repoRoot: string,
): string[] {
  const offenders: string[] = [];
  for (const path of ssrCssModules) {
    const label = relative(repoRoot, path);
    const raw = extractCssTsLiteral(readFileSync(path, 'utf-8'));
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
  return offenders.sort();
}

/**
 * The SECOND, stronger lens -- and the one that actually sees this surface.
 *
 * findSsrOffenders() above only catches a control that DECLARES a sub-44px
 * height. Measured on this branch that is zero, and the zero is honest but
 * nearly vacuous: the SSR sheets mostly declare no height at all, so their
 * controls collapse to content height and the probe measured them at 17-28px
 * live (`button.chq-auth-demo-btn` 269.8x17,
 * scratchpad/metafid-c/out-public.txt) while declaring nothing for a
 * text-scan to flag. app/src does not have this shape because its controls
 * compose `.chq-btn`, which carries the floor; the SSR sheets have no such
 * shared control-face primitive.
 *
 * So: an SSR tap-target token whose CSS never declares a >=44px
 * height/min-height ANYWHERE -- neither top-level nor inside a <=700px
 * block, on any selector mentioning it -- is an offender. A token with no
 * CSS rule at all is reported too (it inherits whatever its bare tag gives
 * it, which is never 44px).
 */
export function findSsrUnflooredTokens(
  ssrCssModules: string[],
  tokens: Set<string>,
  repoRoot: string,
): string[] {
  const tokenList = [...tokens];
  const perFile = ssrCssModules.map((path) => {
    const raw = extractCssTsLiteral(readFileSync(path, 'utf-8'));
    return {
      label: relative(repoRoot, path),
      raw,
      rules: [
        // NOTE: topLevelRulesWithExemption's own `exempt` flag is not used
        // here. It is set by `m[0].trimStart().startsWith('/*')`, i.e. by
        // ANY comment preceding the rule -- and these SSR sheets are
        // comment-dense (every rule carries a DEC receipt), so consulting
        // it would silently exempt nearly the whole population. This lens
        // asks hasExemptionForToken() for a real, named
        // `tap-floor-exempt:` comment instead. The SPA scan above is
        // unaffected: there the loose flag only ever relaxes a rule that
        // already declared a sub-floor height, a far smaller set.
        ...topLevelRulesWithExemption(raw).map((r) => ({ selector: r.selector, body: r.body })),
        ...narrowMediaRules(raw, 700).map((r) => ({ selector: r.selector, body: r.body })),
      ],
    };
  });

  const offenders: string[] = [];
  for (const token of tokenList) {
    let owner: string | undefined;
    let floored = false;
    let exempted = false;
    for (const { label, raw, rules } of perFile) {
      for (const r of rules) {
        if (!selectorMentionsToken(r.selector, token)) continue;
        owner ??= label;
        if (hasExemptionForToken(raw, token)) exempted = true;
        // declaredHeightPx returns the SMALLEST declared px value, so a
        // rule declaring both `height: 20px` and `min-height: 44px` must
        // still count as floored -- hence the second, direct test.
        const declared = declaredHeightPx(r.body);
        if (declared !== undefined && declared >= TAP_FLOOR_PX) floored = true;
        if (/(?:min-height|height)\s*:\s*(?:44|4[5-9]|[5-9]\d|\d{3,})px/.test(r.body)) floored = true;
      }
    }
    if (floored || exempted) continue;
    offenders.push(`${owner ?? '(no CSS rule)'} — .${token}`);
  }
  return offenders.sort();
}
