// Row-action-anchor evasion lens (DEC-393 wave-87 amendment).
//
// Extracted from phone-tap-target.scan.test.ts (custodian decomposition,
// wave v12m-w8) with NO behavior change.
//
// The base scan (core.ts + the sibling test file) only ever looks at
// `<input|select|button>` and at `<a>` when it ALSO carries `chq-btn` -- the
// one shape DESIGN-RULINGS.md:189 names as the evasion, a bare anchor whose
// hit box is only as wide as its text, is the one shape outside that
// population. This module adds two populations the original scan cannot
// see:
//
//   (a) every `chq-…` token on an `<a>` or react-router `<Link>` with NO
//       `chq-btn` in its class list;
//   (b) every `chq-…` token DEFINED in the CSS tree whose own name matches
//       a row-action container shape (`chq-*-actions`, `chq-*-row-actions`)
//       -- derived by enumerating the class tokens that actually exist in
//       the CSS, never a hand-listed pair (DEC-808 idiom).
//
// For each member, conformance requires ALL THREE, inside some
// `@media (max-width: <=700px)` block, on the anchor itself or on a
// selector that reaches it: `min-height: >=44px`, `display:flex` +
// `align-items:center`, and non-zero horizontal padding. Any one alone is
// non-conformance (DESIGN-RULINGS.md:189: "padding alone does not reach the
// floor, and without padding the hit box is only as wide as the text").
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import {
  hasExemptionForToken,
  hasFlexCenter,
  hasMinHeightFloor,
  horizontalPaddingNonZero,
  narrowMediaRules,
  selectorMentionsToken,
  stripTsxComments,
  topLevelRulesWithExemption,
} from './core.js';

/** Every distinct `chq-…` token found in a class position on an `<a>` or a
 * react-router `<Link>` tag WITHOUT `chq-btn` in the same class list -- the
 * row-action-anchor shape DESIGN-RULINGS.md:189 names. */
export function bareAnchorTokens(src: string): string[] {
  const out = new Set<string>();
  const tagRe = /<(a|Link)\b([^>]*)>/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(src)) !== null) {
    const attrs = m[2] ?? '';
    const classMatch = attrs.match(/className\s*=\s*(\{[^}]*\}|"[^"]*")/);
    if (!classMatch) continue;
    const classText = classMatch[1] ?? '';
    const tokens = [...classText.matchAll(/chq-[a-z0-9-]+/g)].map((t) => t[0]);
    if (tokens.includes('chq-btn')) continue;
    for (const t of tokens) out.add(t);
  }
  return [...out];
}

/** Population (a): every bare-anchor token across every TSX file. */
export function allBareAnchorTokens(tsxFiles: string[]): Set<string> {
  const out = new Set<string>();
  for (const path of tsxFiles) {
    const src = stripTsxComments(readFileSync(path, 'utf-8'));
    for (const t of bareAnchorTokens(src)) out.add(t);
  }
  return out;
}

/** Population (b): every `chq-…` class token DEFINED anywhere in the CSS
 * tree whose own name matches a row-action container shape -- derived from
 * the CSS itself, never a hand-listed pair. */
export function rowActionContainerTokens(cssFiles: string[]): Set<string> {
  const out = new Set<string>();
  const re = /\.(chq-[a-z0-9-]+)/g;
  for (const path of cssFiles) {
    const raw = readFileSync(path, 'utf-8');
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
      const token = m[1] ?? '';
      if (/-actions(?:-[a-z0-9-]+)?$/.test(token)) out.add(token);
    }
  }
  return out;
}

/** True if `selector` addresses an anchor: a bare `a` element selector, or a
 * descendant class that is itself a known population-(a) anchor token. */
export function selectorReachesAnchor(selector: string, anchorTokens: Set<string>): boolean {
  if (/(^|[\s>+~])a(?=[.:#[\s,]|$)/.test(selector)) return true;
  for (const t of anchorTokens) {
    if (selectorMentionsToken(selector, t)) return true;
  }
  return false;
}

/** Every population-(a)/(b) member with no conforming phone-width rule and
 * no structural exemption, reported as `<file> — <selector>`. A token
 * declared in no CSS file at all is reported against `(no CSS rule)`. */
export function findAnchorFloorOffenders(
  cssFiles: string[],
  tsxFiles: string[],
  repoRoot: string,
): string[] {
  const anchorTokens = allBareAnchorTokens(tsxFiles);
  const containerTokens = rowActionContainerTokens(cssFiles);
  const offenders: string[] = [];

  // Precompute top-level and narrow-media rules ONCE per file -- a token
  // loop that re-parses every CSS file per token is quadratic in
  // (population size x file count) for no reason.
  const perFile = cssFiles.map((path) => {
    const raw = readFileSync(path, 'utf-8');
    return {
      label: relative(repoRoot, path),
      raw,
      topLevel: topLevelRulesWithExemption(raw),
      narrow: narrowMediaRules(raw, 700),
    };
  });

  const checkToken = (token: string, isContainer: boolean) => {
    let ownedSomewhere = false;
    for (const { label, raw, topLevel, narrow } of perFile) {
      const declaresToken = topLevel.some((r) => selectorMentionsToken(r.selector, token));
      if (!declaresToken) continue;
      ownedSomewhere = true;
      if (hasExemptionForToken(raw, token)) continue;
      const reaching = isContainer
        ? narrow.filter(
            (r) => selectorMentionsToken(r.selector, token) && selectorReachesAnchor(r.selector, anchorTokens),
          )
        : narrow.filter((r) => selectorMentionsToken(r.selector, token));
      const body = reaching.map((r) => r.body).join(' ');
      const ok = reaching.length > 0 && hasMinHeightFloor(body) && hasFlexCenter(body) && horizontalPaddingNonZero(body);
      if (!ok) {
        const sel = reaching.length > 0 ? reaching.map((r) => r.selector).join(', ') : `.${token}`;
        offenders.push(`${label} — ${sel}`);
      }
    }
    if (!ownedSomewhere) {
      // Narrow-media fallback: a phone-only token's rule correctly lives
      // only inside the <=700px block and nowhere at top level -- top-level
      // absence does not mean no stylesheet mentions the token (DEC-393
      // wave-8 amendment). Apply the SAME predicate, SAME container-reach
      // requirement, SAME exemption honouring. A container narrow rule that
      // never reaches an anchor establishes no floor at all -- that is
      // indistinguishable from having no rule, so ownership there is judged
      // by `reaching` (mention + reach), not by bare mention.
      //
      // Merge note (thunderdome megabatch): ported verbatim from task
      // v12m-w8-h, which fixed this false-negative on main while the
      // custodian decomposition (v12m-custodian-w8-1) was moving the
      // function out of app/src/phone-tap-target.scan.test.ts into this
      // module. The decomposition is explicitly NO behavior change, so the
      // fix belongs here, at the function's new home.
      let narrowOwnedSomewhere = false;
      for (const { label, raw, narrow } of perFile) {
        const reaching = isContainer
          ? narrow.filter(
              (r) => selectorMentionsToken(r.selector, token) && selectorReachesAnchor(r.selector, anchorTokens),
            )
          : narrow.filter((r) => selectorMentionsToken(r.selector, token));
        if (reaching.length === 0) continue;
        narrowOwnedSomewhere = true;
        if (hasExemptionForToken(raw, token)) continue;
        const body = reaching.map((r) => r.body).join(' ');
        const ok = hasMinHeightFloor(body) && hasFlexCenter(body) && horizontalPaddingNonZero(body);
        if (!ok) {
          const sel = reaching.map((r) => r.selector).join(', ');
          offenders.push(`${label} — ${sel}`);
        }
      }
      if (!narrowOwnedSomewhere) {
        offenders.push(`(no CSS rule) — .${token}`);
      }
    }
  };

  for (const t of anchorTokens) checkToken(t, false);
  for (const t of containerTokens) checkToken(t, true);
  return offenders.sort();
}
