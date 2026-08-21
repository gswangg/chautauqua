// SPA classless-control population (wave v12m-w10, task w10-na, DEC-180
// wave-154 amendment).
//
// Every SPA tap-target ratchet in this directory (core.ts's base scan,
// anchor-floor.ts's row-action-anchor lens) is keyed on class TOKENS taken
// from markup -- a control with no `className=` at all contributes no
// token and is ungradeable by construction. The SSR half of the product
// already learned this (`ssr.ts`'s `classlessAnchorSites`, wave v12m-w17
// task w17-c) but no SPA mirror was ever built, and its own ratchet
// (`SSR_UNFLOORED_TOKENS_CEILING`) is class-token-keyed the same way.
//
// This module widens the population past `a`/`Link` alone to every
// interactive tag the design pack's floor applies to
// ({a, Link, NavLink, button, select, textarea, input}) -- a bare
// `<Link to="/x">` and a bare `<input>` are equally invisible to a
// class-token-keyed scan.
//
// Reuses `core.ts`'s `classlessTagSites` (the SAME depth-only tag-stack
// walk `ssr.ts`'s `classlessAnchorSites` now delegates to) rather than
// forking it a second time (DEC-613).
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import {
  classlessTagSites,
  ClasslessTagSite,
  escapeRe,
  hasExemptionForToken,
  hasFlexCenter,
  hasMinHeightFloor,
  horizontalPaddingNonZero,
  narrowMediaRules,
  SPA_CLASS_ATTR_RE,
  stripTsxComments,
} from './core.js';

/** The interactive tag set this population grades. `Link`/`NavLink` are
 * react-router components that render a DOM `<a>` -- see
 * `SPA_CONTROL_ELEMENT` for the tag -> rendered-element mapping used when
 * matching a CSS selector. */
export const SPA_CLASSLESS_CONTROL_TAGS: readonly string[] = [
  'a',
  'Link',
  'NavLink',
  'button',
  'select',
  'textarea',
  'input',
];

/** The DOM element each population tag actually renders as, for CSS
 * selector matching (`Link`/`NavLink` both render `<a>`; every other tag
 * in the population already names its own DOM element). */
const SPA_CONTROL_ELEMENT: Readonly<Record<string, string>> = {
  a: 'a',
  Link: 'a',
  NavLink: 'a',
  button: 'button',
  select: 'select',
  textarea: 'textarea',
  input: 'input',
};

/** `hasClassAttrRe` for `classlessTagSites`: the SPA only ever writes
 * `className=` (never bare `class=`, a DOM/JSX attribute name, not React's)
 * -- narrower, deliberately, than `ssr.ts`'s `/\bclass(?:Name)?\s*=/`,
 * which also has to admit a few Hono-JSX views shared with the SPA. */
const SPA_HAS_CLASS_ATTR_RE = /\bclassName\s*=/;

/** Every classless-control site across `tsxFiles` (already the
 * `{a, Link, NavLink, button, select, textarea, input}` population), one
 * `classlessTagSites` call per file so the caller can attribute a site back
 * to its own file/line. */
export function spaClasslessControlSites(src: string): ClasslessTagSite[] {
  return classlessTagSites(src, SPA_CLASSLESS_CONTROL_TAGS, SPA_HAS_CLASS_ATTR_RE, SPA_CLASS_ATTR_RE);
}

/** True when `selector` (a single, already-comma-split, trimmed clause)
 * reaches a classless control of element `element` keyed on `token`: the
 * bare element itself (`a`, `button`, …), or a descendant combinator off a
 * class matching `token` (`.<token> a`, `nav.<token> a`, or any other
 * element-qualified `<tag>.<token> a` shape -- DEC-937: a boundary match,
 * not a hyphen-prefix substring match). Mirrors `ssr.ts`'s
 * `selectorReachesClasslessAnchor`, generalised over the element name. */
export function selectorReachesClasslessControl(selector: string, token: string, element: string): boolean {
  if (selector === element) return true;
  const re = new RegExp(
    `(?:^|[\\s>+~])(?:[A-Za-z][\\w-]*)?\\.${escapeRe(token)}(?![\\w-])\\s+${escapeRe(element)}\\b`,
  );
  return re.test(selector);
}

/**
 * Every classless-control site with no conforming phone-width floor and no
 * named exemption on its enclosing token, reported as
 * `<file>:<line> — <tag> .<token>` (or `<file>:<line> — <tag> (no
 * enclosing chq- token)` when no ancestor carries one at all -- always an
 * offender, since nothing could ever key a CSS rule to it).
 *
 * Same three-clause predicate as `anchor-floor.ts`'s row-action-anchor lens
 * / `ssr.ts`'s classless-anchor lens -- min-height >=44px, `display:flex` +
 * `align-items:center`, non-zero horizontal padding -- all inside some
 * `@media (max-width: <=700px)` block, on a selector reaching the control
 * through its enclosing token.
 */
export function findSpaClasslessControlOffenders(
  tsxFiles: string[],
  cssFiles: string[],
  repoRoot: string,
): string[] {
  const perFile = cssFiles.map((path) => {
    const raw = readFileSync(path, 'utf-8');
    return { raw, narrow: narrowMediaRules(raw, 700) };
  });

  const offenders: string[] = [];
  for (const path of tsxFiles) {
    const src = stripTsxComments(readFileSync(path, 'utf-8'));
    const label = relative(repoRoot, path);
    for (const site of spaClasslessControlSites(src)) {
      const element = SPA_CONTROL_ELEMENT[site.tag] as string;
      if (site.tokens.length === 0) {
        offenders.push(`${label}:${site.line} — <${site.tag}> (no enclosing chq- token)`);
        continue;
      }
      let ok = false;
      let exempted = false;
      for (const token of site.tokens) {
        const reaching = perFile.flatMap(({ narrow }) =>
          narrow.filter((r) => selectorReachesClasslessControl(r.selector, token, element)),
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
