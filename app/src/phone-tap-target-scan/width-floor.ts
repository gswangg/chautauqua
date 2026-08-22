// Width-half tap-floor lens (DEC-393/DEC-808 wave-26, task w26-j).
//
// THE GAP: DESIGN-RULINGS.md:189 rules the 44px floor as `min-height:44px`
// PLUS centred flex PLUS horizontal padding, "because without padding the
// hit box is only as wide as the text". Every existing tap-floor scan in
// this directory grades that third clause with `core.ts`'s
// `horizontalPaddingNonZero` -- which ANY non-zero padding value satisfies,
// including a bare 4px around a single glyph. Proof in-tree:
// `app/src/pages/contacts/contacts.css:1270`'s
// `.chq-contacts-filter-rule-chip-dismiss` gave a bare `✕` `padding-inline:
// 4px` -- a ~17px-wide hit box -- and passed every ceiling at 0; the repair
// at `contacts.css:1544` (`min-width: 44px`, inside the file's terminal
// `@media (max-width: 700px)` block) is a HAND fix with no instrument
// behind it. Eight more such hand repairs exist across the tree with no
// reader (DEC-851), listed in this wave's brief.
//
// This module is the missing WIDTH half, built as a WIDENING lens (DEC-808
// protocol): it measures and FILES, it does not fix. It never touches a
// stylesheet.
//
// POPULATION (DEC-808: enumerated, never hand-listed): every interactive
// element (`button`/`a`/`select`/`input[type=button|submit]`) across every
// SPA `*.tsx` under app/src and every SSR `*.tsx` under src/routes (minus
// tests, minus src/routes/dev/**) whose rendered content has NO visible
// text -- either a single non-alphanumeric glyph (a bare `✕`, `→`, `⋮⋮`) or
// nothing at all with an `aria-label`/`aria-labelledby` supplying its
// accessible name. Such a control cannot borrow width from its own label
// text the way an ordinary button can, so `horizontalPaddingNonZero`'s
// "any non-zero value passes" test is precisely wrong for it.
//
// PREDICATE: a site's resolved `chq-…` token(s) PASS when some CSS rule
// effective at the 390 phone frame -- a `<=700px` narrow-media rule (the
// house idiom, reused from `core.ts`'s `narrowMediaRules`) OR an
// unconditional top-level rule -- declares `min-width`/`width` >= 44px on a
// selector reaching the token, or the token carries a `tap-floor-exempt:`
// comment in the grammar `core.ts`'s `hasExemptionForToken` already reads.
//
// Reuses every parsing primitive from `./core.js` (DEC-613: a second copy
// of a vocabulary is a trap with a delay fuse) -- no new comment-stripping,
// brace-walking, or exemption grammar is written here.
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import {
  chqTokensFromAttrs,
  classlessTagSites,
  hasExemptionForToken,
  narrowMediaRules,
  selectorMentionsToken,
  SPA_CLASS_ATTR_RE,
  SSR_CLASS_ATTR_RE,
  stripTsxComments,
  topLevelRulesWithExemption,
} from './core.js';

export const WIDTH_FLOOR_PX = 44;

const INTERACTIVE_TAGS = ['button', 'a', 'select'] as const;

/** Presence-only "does this tag carry a class attribute at all" tests for
 * `classlessTagSites`'s ancestor walk -- SPA only ever writes `className=`
 * (mirrors `spa-classless.ts`'s private `SPA_HAS_CLASS_ATTR_RE`, re-declared
 * here rather than imported since that module doesn't export it); SSR (a
 * few Hono-JSX views shared with the SPA) admits either spelling, mirroring
 * `core.ts`'s `SSR_CLASS_ATTR_RE` grammar. */
export const SPA_HAS_CLASS_ATTR_RE = /\bclassName\s*=/;
export const SSR_HAS_CLASS_ATTR_RE = /\bclass(?:Name)?\s*=/;

/** One glyph-only (or empty-with-aria-label) interactive-control site --
 * a control whose rendered content cannot supply width the way ordinary
 * label text does. */
export interface GlyphOnlySite {
  readonly file: string; // relative to repoRoot
  readonly line: number;
  readonly tag: string;
  readonly reason: 'single-glyph' | 'empty-with-aria-label';
  /** The site's own `chq-…` tokens if its tag carries a class attribute at
   * all; otherwise its nearest enclosing element's tokens, found by the
   * same depth-only tag-stack walk `core.ts`'s `classlessTagSites` already
   * performs for the SSR classless-anchor / SPA classless-control lenses.
   * Empty when neither the site nor any ancestor carries a `chq-…` token. */
  readonly tokens: readonly string[];
}

/** True when `text` (already stripped of markup) is exactly one Unicode
 * code point and that code point is not alphanumeric -- a bare `✕`, `→`,
 * `»`, but not `X`, `1`, or a two-character glyph pair like `⋮⋮`, which
 * legitimately reads as a drag handle rather than a tap target this lens
 * grades (the disabled-token drag-handle exception DESIGN-RULINGS.md
 * carries elsewhere). */
function isSingleNonAlnumGlyph(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;
  const codePoints = [...trimmed];
  if (codePoints.length !== 1) return false;
  return !/[a-zA-Z0-9]/.test(trimmed);
}

/** Strips every nested tag's markup (opening/closing/self-closing) while
 * KEEPING that tag's own text content -- so `<span aria-hidden>✕</span>`
 * still reads as the bare glyph `✕`, matching the house idiom that a
 * decoration wrapper doesn't hide a control's real content from this class
 * of scanner (`declaredHeightPx`/`hasFlexCenter` etc. all work the same
 * way, one level up). A JSX expression (`{icon}`) is left as literal text on
 * purpose -- it is neither empty nor a bare glyph, so it naturally falls
 * outside this population rather than needing a special case. */
function visibleText(inner: string): string {
  return inner.replace(/<[^>]*>/g, '').trim();
}

function hasAriaLabel(attrs: string): boolean {
  return /\baria-label(?:ledby)?\s*=/.test(attrs);
}

/** Every glyph-only / empty-with-aria-label interactive-control site in
 * `src` (already comment-stripped), keyed on its own class tokens or (when
 * classless) its nearest enclosing element's, via `classlessTagSites`. */
export function findGlyphOnlySites(
  src: string,
  classAttrRe: RegExp,
  hasClassAttrRe: RegExp,
): Array<{ line: number; tag: string; reason: GlyphOnlySite['reason']; tokens: readonly string[] }> {
  const out: Array<{ line: number; tag: string; reason: GlyphOnlySite['reason']; tokens: readonly string[] }> = [];

  // Ancestor lookup for classless sites, keyed by line -- the same walk
  // `spa-classless.ts`/`ssr.ts`'s classless lenses already perform, reused
  // rather than forked a second time (DEC-613).
  const classlessByLine = new Map<number, readonly string[]>();
  for (const site of classlessTagSites(src, [...INTERACTIVE_TAGS, 'input'], hasClassAttrRe, classAttrRe)) {
    classlessByLine.set(site.line, site.tokens);
  }

  const lineOf = (index: number): number => src.slice(0, index).split('\n').length;

  // Single unified tag scan, one tag (open, self-closing, or close) per
  // match, walked left to right -- deliberately NOT the more obvious
  // "match an opener then non-greedily search ahead for its own closer in
  // one regex" shape, because that shape dead-ends on a self-closing
  // occurrence (no valid `</tag>` for a match that swallows the `/>`
  // itself) and the resulting backtrack can walk the match all the way
  // out to some UNRELATED later closing tag instead of correctly failing
  // closed. Attrs use `(?:=>|[^>])*?` rather than the simpler `[^>]*` this
  // directory's other scanners use for TOKEN extraction only: an inline
  // `onClick={() => …}` handler's arrow contains a literal `>` that a
  // plain `[^>]*` would treat as the tag's own close.
  const tagRe = new RegExp(
    `<\\/(${INTERACTIVE_TAGS.join('|')})>` + `|` + `<(${INTERACTIVE_TAGS.join('|')})\\b((?:=>|[^>])*?)(\\/)?>`,
    'g',
  );
  let m: RegExpExecArray | null;
  // Pending opener per tag name -- this codebase never nests a `button`/
  // `a`/`select` inside another of the SAME tag name (the "no same-tag
  // nesting in practice" idiom every sibling scanner here relies on), so a
  // single pending-opener slot per tag name is enough; a later opener of
  // the same name before a closer is treated as replacing an orphaned one.
  const pending = new Map<string, { index: number; attrs: string; line: number }>();
  while ((m = tagRe.exec(src)) !== null) {
    const closingName = m[1];
    if (closingName !== undefined) {
      const open = pending.get(closingName);
      if (open === undefined) continue;
      pending.delete(closingName);
      const inner = src.slice(open.index, m.index);
      const text = visibleText(inner);
      let reason: GlyphOnlySite['reason'] | undefined;
      if (isSingleNonAlnumGlyph(text)) reason = 'single-glyph';
      else if (text.length === 0 && hasAriaLabel(open.attrs)) reason = 'empty-with-aria-label';
      if (!reason) continue;
      const ownTokens = chqTokensFromAttrs(open.attrs, classAttrRe);
      const tokens = ownTokens.length > 0 ? ownTokens : (classlessByLine.get(open.line) ?? []);
      out.push({ line: open.line, tag: closingName, reason, tokens });
      continue;
    }
    const openName = m[2] as string;
    const attrs = m[3] ?? '';
    const selfClosing = m[4] === '/';
    const line = lineOf(m.index);
    if (selfClosing) {
      // No children at all -- empty by construction, qualifies exactly
      // when it carries an aria-label/aria-labelledby (the colour-swatch
      // cycle button shape: `<button aria-label="…" … />`).
      if (!hasAriaLabel(attrs)) continue;
      const ownTokens = chqTokensFromAttrs(attrs, classAttrRe);
      const tokens = ownTokens.length > 0 ? ownTokens : (classlessByLine.get(line) ?? []);
      out.push({ line, tag: openName, reason: 'empty-with-aria-label', tokens });
    } else {
      pending.set(openName, { index: m.index + m[0].length, attrs, line });
    }
  }

  // input[type=button|submit]: always self-closing (void element), never
  // has child text -- its only possible label is `value=`, so it qualifies
  // here exactly when it has NO non-empty `value` and DOES carry an
  // aria-label/aria-labelledby.
  const inputRe = /<input\b((?:=>|[^>])*?)\/?>/g;
  while ((m = inputRe.exec(src)) !== null) {
    const attrs = m[1] ?? '';
    if (!/type\s*=\s*"(?:button|submit)"/.test(attrs)) continue;
    const valueMatch = attrs.match(/\bvalue\s*=\s*"([^"]*)"/);
    const hasVisibleValue = !!valueMatch && (valueMatch[1] ?? '').trim().length > 0;
    if (hasVisibleValue) continue;
    if (!hasAriaLabel(attrs)) continue;
    const line = lineOf(m.index);
    const ownTokens = chqTokensFromAttrs(attrs, classAttrRe);
    const tokens = ownTokens.length > 0 ? ownTokens : (classlessByLine.get(line) ?? []);
    out.push({ line, tag: 'input', reason: 'empty-with-aria-label', tokens });
  }

  return out.sort((a, b) => a.line - b.line);
}

/** Every glyph-only site across `tsxFiles`, attributed back to its file. */
export function findGlyphOnlySitesAcrossFiles(
  tsxFiles: string[],
  repoRoot: string,
  classAttrRe: RegExp,
  hasClassAttrRe: RegExp,
): GlyphOnlySite[] {
  const out: GlyphOnlySite[] = [];
  for (const path of tsxFiles) {
    const src = stripTsxComments(readFileSync(path, 'utf-8'));
    const label = relative(repoRoot, path);
    for (const site of findGlyphOnlySites(src, classAttrRe, hasClassAttrRe)) {
      out.push({ file: label, ...site });
    }
  }
  return out;
}

/** The smallest-fails/largest-passes declared `min-width`/`width` px value
 * test: true when SOME declared value in `body` is >= 44px (mirrors
 * `core.ts`'s `hasMinHeightFloor`, generalised to the width properties). */
export function hasWidthFloor(body: string): boolean {
  const re = /(?:min-width|width)\s*:\s*(\d+(?:\.\d+)?)px/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    if (Number(m[1]) >= WIDTH_FLOOR_PX) return true;
  }
  return false;
}

/** True when `token` clears the width floor SOMEWHERE across `cssTexts` --
 * a top-level rule, or a `<=700px` narrow-media rule (both effective at the
 * 390 phone frame) -- reaching it with a declared `min-width`/`width` >=
 * 44px, or carries a named `tap-floor-exempt:` comment. */
export function tokenClearsWidthFloor(token: string, cssTexts: string[]): boolean {
  for (const raw of cssTexts) {
    if (hasExemptionForToken(raw, token)) return true;
    for (const { selector, body } of topLevelRulesWithExemption(raw)) {
      if (selectorMentionsToken(selector, token) && hasWidthFloor(body)) return true;
    }
    for (const { selector, body } of narrowMediaRules(raw, 700)) {
      if (selectorMentionsToken(selector, token) && hasWidthFloor(body)) return true;
    }
  }
  return false;
}

/** Every glyph-only site with no token clearing the width floor, reported
 * as `<file>:<line> — <tag> .<tokens> — <reason>` (or `<file>:<line> —
 * <tag> (no chq- token) — <reason>` when neither the site itself nor any
 * ancestor carries one -- always an offender, since nothing could ever key
 * a CSS rule to it). */
export function findWidthFloorOffenders(sites: GlyphOnlySite[], cssTexts: string[]): string[] {
  const offenders: string[] = [];
  for (const site of sites) {
    if (site.tokens.length === 0) {
      offenders.push(`${site.file}:${site.line} — <${site.tag}> (no chq- token) — ${site.reason}`);
      continue;
    }
    const cleared = site.tokens.some((t) => tokenClearsWidthFloor(t, cssTexts));
    if (cleared) continue;
    offenders.push(`${site.file}:${site.line} — <${site.tag}> .${site.tokens.join('.')} — ${site.reason}`);
  }
  return offenders.sort();
}

export { SPA_CLASS_ATTR_RE, SSR_CLASS_ATTR_RE };
