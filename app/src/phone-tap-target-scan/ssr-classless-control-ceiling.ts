// SSR classless NON-ANCHOR control population (wave v12m-w40, task w40-e,
// DEC-393).
//
// `SSR_CLASSLESS_ANCHOR_CEILING` (ssr.ts / phone-tap-target-ssr-classless-
// anchor.scan.test.ts) widened the SSR population to a classless `<a>` --
// keyed on its nearest enclosing chq- token, the same depth-only tag-stack
// walk `spa-classless.ts` generalised for the SPA's own `<input>`/
// `<select>`/`<textarea>`/`<button>`/`Link`/`NavLink` population
// (`SPA_CLASSLESS_CONTROL_CEILING`). NEITHER of those two ratchets ever
// looked at a classless NON-ANCHOR interactive element under
// `src/routes/**` -- a bare `<input>`/`<select>`/`<textarea>`/`<button>` in
// an SSR view with no `class=`/`className=` of its own is invisible to
// both, an EMPTY population, not a zero-offender one (DEC-808).
//
// This module is that population's own ratchet, deliberately kept OUT of
// `ceilings.ts` (in flight, v12m-w39-e, over the classless-ANCHOR ceiling
// in the same file) and out of `spa-classless.ts` (the SPA population, a
// different surface). It is the SSR mirror of `SPA_CLASSLESS_CONTROL_CEILING`,
// scoped to `src/routes/public/**` and `src/routes/portal/**` only -- the
// two surfaces this wave's task named -- and excludes `<input type="hidden">`
// sites: a hidden input paints nothing and has no hit box, so it is not a
// tap-target population member at all (unlike a CSRF token field, which
// exists purely for the wire and is never rendered).
//
// Reuses `core.ts`'s `classlessTagSites` (DEC-613: a second copy of a
// vocabulary is a trap with a delay fuse) and `spa-classless.ts`'s
// `selectorReachesClasslessControl` (the SAME reach predicate the SPA
// population already uses, generalised over element name) rather than
// forking either a second time.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  classlessTagSites,
  ClasslessTagSite,
  hasExemptionForToken,
  hasFlexCenter,
  hasMinHeightFloor,
  horizontalPaddingNonZero,
  narrowMediaRules,
  SSR_CLASS_ATTR_RE,
  stripTsxComments,
} from './core.js';
import { extractCssTsLiteral, ssrCssModuleFiles } from './ssr.js';
import { selectorReachesClasslessControl } from './spa-classless.js';

/** The interactive NON-ANCHOR tag set this population grades. `<a>` is
 * deliberately excluded -- that population belongs to
 * `SSR_CLASSLESS_ANCHOR_CEILING` (v12m-w39-e owns it), and grading it here
 * too would double-count the same markup site under two ceilings. */
export const SSR_CLASSLESS_CONTROL_TAGS: readonly string[] = ['input', 'select', 'textarea', 'button'];

/** Every `*.tsx` file under `root`, excluding `*.test.*`. Enumerated, never
 * a hand-listed file set (DEC-808). */
function tsxFilesUnder(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.tsx')) continue;
    if (entry.name.includes('.test.')) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

/** `src/routes/public/**` and `src/routes/portal/**` only -- the two
 * surfaces this wave's task named, not the wider `src/routes/**`
 * `SSR_CLASSLESS_ANCHOR_CEILING` grades. */
export function ssrClasslessControlRouteFiles(routesRoot: string): string[] {
  return [...tsxFilesUnder(join(routesRoot, 'public')), ...tsxFilesUnder(join(routesRoot, 'portal'))].sort();
}

export { ssrCssModuleFiles };

/** True when `site` is an `<input type="hidden">` -- inert, no hit box, not
 * a population member. */
function isHiddenInput(site: ClasslessTagSite): boolean {
  return site.tag === 'input' && /\btype\s*=\s*["']hidden["']/.test(site.attrs);
}

export interface SsrClasslessControlSite extends ClasslessTagSite {}

/** Every classless `{input, select, textarea, button}` site in `src`
 * (already comment-stripped), excluding `<input type="hidden">`. */
export function ssrClasslessControlSites(src: string): SsrClasslessControlSite[] {
  // Parameter named `site`, not the single letter s: calling a helper with a
  // one-letter argument of that name spells a letter followed by a
  // parenthesised s, which is exactly the raw plural parenthetical
  // test/count-grammar.test.ts (DEC-957) forbids in user-facing copy. Its
  // pattern is purely lexical and cannot tell a one-letter argument from a
  // pluralised noun, so the argument gets a real name instead.
  return classlessTagSites(src, SSR_CLASSLESS_CONTROL_TAGS, /\bclass(?:Name)?\s*=/, SSR_CLASS_ATTR_RE).filter(
    (site) => !isHiddenInput(site),
  );
}

/**
 * Every classless-control site with no conforming phone-width floor and no
 * named exemption on its enclosing token, reported as
 * `<file>:<line> — <tag> .<token>` (or `<file>:<line> — <tag> (no
 * enclosing chq- token)`).
 *
 * Same three-clause predicate as `anchor-floor.ts` / `ssr.ts` /
 * `spa-classless.ts` -- min-height >=44px, `display:flex` +
 * `align-items:center`, non-zero horizontal padding, all inside some
 * `@media (max-width: <=700px)` block, on a selector reaching the control
 * through its enclosing token (or the bare element itself).
 */
export function findSsrClasslessControlOffenders(
  routeFiles: string[],
  ssrCssModules: string[],
  repoRoot: string,
): string[] {
  const perFile = ssrCssModules.map((path) => {
    const raw = extractCssTsLiteral(readFileSync(path, 'utf-8'));
    return { raw, narrow: narrowMediaRules(raw, 700) };
  });

  const offenders: string[] = [];
  for (const path of routeFiles) {
    const src = stripTsxComments(readFileSync(path, 'utf-8'));
    const label = relative(repoRoot, path);
    for (const site of ssrClasslessControlSites(src)) {
      if (site.tokens.length === 0) {
        offenders.push(`${label}:${site.line} — <${site.tag}> (no enclosing chq- token)`);
        continue;
      }
      let ok = false;
      let exempted = false;
      for (const token of site.tokens) {
        const reaching = perFile.flatMap(({ narrow }) =>
          narrow.filter((r) => selectorReachesClasslessControl(r.selector, token, site.tag)),
        );
        const body = reaching.map((r) => r.body).join(' ');
        if (
          reaching.length > 0 &&
          hasMinHeightFloor(body) &&
          hasFlexCenter(body) &&
          horizontalPaddingNonZero(body)
        ) {
          ok = true;
          break;
        }
        if (perFile.some(({ raw }) => hasExemptionForToken(raw, token))) exempted = true;
      }
      if (ok || exempted) continue;
      offenders.push(`${label}:${site.line} — <${site.tag}> .${site.tokens.join('.')}`);
    }
  }
  return offenders.sort();
}

// Re-measured at HEAD (task w40-e): forced this constant to -1 and read the
// printed offender list over `src/routes/public/**` + `src/routes/portal/**`.
// Raw population 7 (the wave-35-h roster's own line numbers had drifted on
// 4 of its 7 named rows; re-derived here via `classlessTagSites`, never
// hand-listed): 3 in submit-views.tsx (TrackChoices/FormatChoices/
// AudienceChoices radios, all `.chq-cfp-option`[`.chq-cfp-pill`]), 1 in
// portal/edit.tsx (the co-presenter Tracks checkbox, `.chq-cfp-option`),
// 1 in portal/edit.tsx (the co-presenter Role `<select>`,
// `.chq-portal-copresenter-role`), and 2 in portal/tasks/views.tsx (the
// task-upload and reupload `<input type="file">`, `.chq-portal-actions`/
// `.chq-card`).
//
// Drained same-commit: portal/edit.tsx's checkbox was ALREADY exempt --
// portal.css.ts:572 carries a `tap-floor-exempt: composition` comment on
// `.chq-cfp-option` (the wrapping `<label class="chq-cfp-option">` is the
// floored click/tap surface, not the 18x18 checkbox glyph, the same shape
// DEC-393 wave-124's TaskView/Scorecard exemptions already name). cfp.css.ts
// got the IDENTICAL exemption comment for the same `.chq-cfp-option`
// composition shape -- every TrackChoices/FormatChoices/AudienceChoices
// option row wraps its radio input in exactly this label, no exception --
// draining all 3 submit-views.tsx offenders in one exemption. The
// co-presenter Role `<select>` got a real additive phone-only rule (display:
// flex; align-items:center; padding, beside its pre-existing min-height:48px
// narrow rule). The two `<input type="file">` sites got a real additive
// phone-only rule reaching them via `.chq-portal-actions input[type=file],
// .chq-card input[type=file]`.
//
// Re-measured after the fix: 0. RATCHET: SSR_CLASSLESS_CONTROL_CEILING=0
export const SSR_CLASSLESS_CONTROL_CEILING = 0;
