// Undeclared-height tap-target lens (DEC-367 wave-120 PREDICATE REPAIR).
//
// The base scan's `findOffenders()` (phone-tap-target.scan.test.ts:92-116)
// does:
//
//   const height = declaredHeightPx(body);
//   if (height === undefined || height >= TAP_FLOOR_PX) continue;
//
// -- so a top-level control rule that names NO `height`/`min-height` at all
// is dropped from the population BEFORE any floor test runs, exactly like
// one that already clears the floor. That is the inverse of the truth: a
// control with no declared height cannot reach 44px except by accident of
// line-height, and `app/src/pages/review/review.css:650-660`'s
// `.chq-review-queue-footer-showall { border: none; background: none;
// padding: 0; font-size: 13px; }` on a real `<button type="button">`
// (ReviewerQueue.tsx, PlanEditor.tsx) is the proof -- live-probed 52x30
// (docs/probes/metafid-phoneB-ssr-2026-08-19.md) while both SSR tap
// ratchets read 0 and the base assertion passes green.
//
// This module is the missing half: every population token whose top-level
// rule declares NEITHER `height` NOR `min-height`. Cleared by any of:
//   (a) a phone-scoped (<=700px) rule reaching the token with
//       `min-height >= 44px`;
//   (b) COMPOSITION -- every markup site carrying the token also carries a
//       token that is ITSELF floored (declares height/min-height >= 44px
//       somewhere, top-level or narrow), derived from the TSX class lists,
//       never hand-listed. This is what makes `.chq-btn-primary` and
//       `.chq-btn-secondary` false members: they only ever appear beside
//       `chq-btn`, which is floored.
//   (c) a named `/* tap-floor-exempt: <reason> */` comment over the rule.
//
// Imports every parsing primitive from ./core.js (DEC-613: a second copy of
// a vocabulary is a trap with a delay fuse) -- nothing here re-implements
// comment stripping, brace walking, or exemption grammar. `tagClassSets`
// below is new (not a copy): the base scan's `tapTargetTagTokens` FLATTENS
// every matching tag's classes into one file-wide Set, which is exactly
// right for "does this token appear anywhere" but cannot answer "what else
// rides along with it on THIS tag" -- the question composition credit (b)
// needs. It reuses the identical tag/attribute/token grammar, just grouped
// per tag instead of merged.
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import {
  declaredHeightPx,
  hasExemptionForToken,
  narrowMediaRules,
  selectorDeclaresBareClass,
  SPA_CLASS_ATTR_RE,
  stripTsxComments,
  TAP_FLOOR_PX,
  tapTargetTagTokens,
  topLevelRulesWithExemption,
} from './core.js';

/** Every matching tag's own `chq-…` class token list, grouped per tag
 * (rather than flattened across the file) -- the shape composition credit
 * needs: "what else rides along with this token on the SAME element". Same
 * tag/attribute/token grammar as `tapTargetTagTokens` in ./core.js. */
export function tagClassSets(src: string, classAttrRe: RegExp = SPA_CLASS_ATTR_RE): string[][] {
  const out: string[][] = [];
  const tagRe = /<(input|select|button|a)\b([^>]*)>/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(src)) !== null) {
    const tag = m[1];
    const attrs = m[2] ?? '';
    const classMatch = attrs.match(classAttrRe);
    if (!classMatch) continue;
    const classText = classMatch[1] ?? '';
    const tokens = [...classText.matchAll(/chq-[a-z0-9-]+/g)].map((t) => t[0]);
    if (tag === 'a' && !tokens.includes('chq-btn')) continue;
    if (tokens.length > 0) out.push(tokens);
  }
  return out;
}

/** True if `token` has, anywhere across `cssTexts`, a rule (top-level or
 * inside a <=700px block) declaring `height`/`min-height` >= 44px -- i.e.
 * it is ITSELF a floored token, independent of the undeclared-height
 * population this module scans. */
export function tokenIsFloored(token: string, cssTexts: string[]): boolean {
  for (const raw of cssTexts) {
    for (const r of topLevelRulesWithExemption(raw)) {
      if (!selectorDeclaresBareClass(r.selector, token)) continue;
      const h = declaredHeightPx(r.body);
      if (h !== undefined && h >= TAP_FLOOR_PX) return true;
    }
    for (const r of narrowMediaRules(raw, 700)) {
      if (!selectorDeclaresBareClass(r.selector, token)) continue;
      const h = declaredHeightPx(r.body);
      if (h !== undefined && h >= TAP_FLOOR_PX) return true;
    }
  }
  return false;
}

/** Composition credit (b): `token` clears the undeclared-height population
 * only if it has at least one markup site AND every markup site carrying it
 * also carries some OTHER token that is itself floored. A token with no
 * markup site in `markupSites` (should not happen -- it came from the same
 * TSX scan) grants no credit. */
export function composesWithFlooredToken(
  token: string,
  markupSites: string[][],
  cssTexts: string[],
  isFloored: (t: string) => boolean = (t) => tokenIsFloored(t, cssTexts),
): boolean {
  const sites = markupSites.filter((classes) => classes.includes(token));
  if (sites.length === 0) return false;
  return sites.every((classes) => classes.some((other) => other !== token && isFloored(other)));
}

/** Every population token with a top-level rule declaring NEITHER `height`
 * NOR `min-height`, no phone-scoped floor, no composition credit, and no
 * named exemption. Reported as `<file>: "<selector>" (no height declared,
 * token: <token>)`. */
export function findUndeclaredHeightOffenders(
  cssFiles: string[],
  tsxFiles: string[],
  repoRoot: string,
): string[] {
  const cssTexts = cssFiles.map((path) => readFileSync(path, 'utf-8'));
  const tokens = new Set<string>();
  const markupSites: string[][] = [];
  for (const path of tsxFiles) {
    const src = stripTsxComments(readFileSync(path, 'utf-8'));
    for (const t of tapTargetTagTokens(src)) tokens.add(t);
    for (const classes of tagClassSets(src)) markupSites.push(classes);
  }

  // `tokenIsFloored` re-walks every CSS file's rules; memoize per distinct
  // token seen on a markup site so composition credit (checked once per
  // candidate x co-riding token) doesn't re-parse the whole tree each time.
  const flooredMemo = new Map<string, boolean>();
  const isFloored = (t: string): boolean => {
    let cached = flooredMemo.get(t);
    if (cached === undefined) {
      cached = tokenIsFloored(t, cssTexts);
      flooredMemo.set(t, cached);
    }
    return cached;
  };

  const offenders: string[] = [];
  for (const path of cssFiles) {
    const label = relative(repoRoot, path);
    const raw = readFileSync(path, 'utf-8');
    for (const { selector, body, exempt } of topLevelRulesWithExemption(raw)) {
      if (exempt) continue;
      const matchingTokens = [...tokens].filter((t) => selectorDeclaresBareClass(selector, t));
      if (matchingTokens.length === 0) continue;
      const height = declaredHeightPx(body);
      if (height !== undefined) continue; // declares SOME height -- not this population
      for (const token of matchingTokens) {
        if (hasExemptionForToken(raw, token)) continue;
        const narrowFloored = narrowMediaRules(raw, 700).some(
          (r) => selectorDeclaresBareClass(r.selector, token) && (declaredHeightPx(r.body) ?? 0) >= TAP_FLOOR_PX,
        );
        if (narrowFloored) continue;
        if (composesWithFlooredToken(token, markupSites, cssTexts, isFloored)) continue;
        offenders.push(`${label}: "${selector}" (no height declared, token: ${token})`);
      }
    }
  }
  return offenders.sort();
}
