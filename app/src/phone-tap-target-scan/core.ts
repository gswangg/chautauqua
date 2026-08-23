// Shared CSS/TSX parsing primitives for the phone tap-target floor scan
// (DEC-253 amendment, DEC-367 floor -- wave 25 / task w25-d).
//
// Extracted from phone-tap-target.scan.test.ts (custodian decomposition,
// wave v12m-w8) with NO behavior change: every function below is byte-for-
// byte the same logic that used to live directly in the test file. Split
// out because that file had grown into a repeated merge-conflict hotspot
// (882 lines, touched by nearly every phone-floor lane). This module carries
// no `describe`/`it` blocks of its own -- it is pure scanning machinery,
// reused by the SPA population (this file's sibling test), the
// row-action-anchor evasion lens (anchor-floor.ts), and the SSR widening
// (ssr.ts).
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url)); // app/src/phone-tap-target-scan
export const REPO_ROOT = join(HERE, '..', '..', '..');
export const TAP_FLOOR_PX = 44;

/** Every *.css file under app/src, enumerated rather than named (DEC-808). */
export function allCssFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.css')) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

/** Every *.tsx file under app/src, excluding *.test.tsx (DEC-976/DEC-808). */
export function allTsxFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.tsx')) continue;
    if (entry.name.includes('.test.')) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

export function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Strips `//` line comments and `/* *\/` block comments from TSX source. */
export function stripTsxComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/** Every distinct `chq-…` token found in a class position on an
 * `<input`/`<select`/`<button` tag, or on an `<a>` tag whose class list also
 * carries `chq-btn` (an anchor styled as a button-face). Tag bodies are
 * captured non-greedily up to the next `>` -- adequate for the plain
 * `className="..."`/`className={...条件...}` attribute shapes this codebase
 * uses on form controls (no `>` literal inside those attribute values). */
export const SPA_CLASS_ATTR_RE = /className\s*=\s*(\{[^}]*\}|"[^"]*")/;
/** Hono JSX (every src/** SSR view) writes the DOM attribute name, `class`,
 * where React writes `className`. Same attribute, same token grammar -- so
 * the SSR population passes this variant into the SAME extractor rather
 * than growing a second one (DEC-613: a second copy of a vocabulary is a
 * trap with a delay fuse). `className` stays accepted here too: a few SSR
 * views are shared with the SPA. */
export const SSR_CLASS_ATTR_RE = /\bclass(?:Name)?\s*=\s*(\{[^}]*\}|"[^"]*")/;

/** `anchorNeedsBtnToken` (default `true`) is a PARAMETER, not a fork and not
 * a widened shared default (DEC-613 wave-139): on the SPA, `.chq-btn` is the
 * control primitive that carries the floor, so a bare `<a>` with no
 * `chq-btn` token is decoration, correctly dropped. On the SSR surfaces
 * there is no such primitive -- a bare `<a>` IS the control (DEC-393 +
 * DEC-976 wave-138) -- so `ssr.ts`'s `allSsrTapTargetTokens` is the ONLY
 * caller that passes `{ anchorNeedsBtnToken: false }`. Every SPA call site
 * keeps today's behaviour byte-for-byte by relying on the default.
 *
 * `summary` (v12m-w19-d, DEC-393): a `<details>/<summary>` disclosure's
 * `<summary>` IS the control -- there is no button primitive for it the way
 * `.chq-btn` is for anchors, so it needs no `anchorNeedsBtnToken`-shaped
 * qualification; any `chq-…` class found directly on a `<summary>` tag is
 * admitted unconditionally, same as `input`/`select`/`button`. */
export function tapTargetTagTokens(
  src: string,
  classAttrRe: RegExp = SPA_CLASS_ATTR_RE,
  opts: { anchorNeedsBtnToken?: boolean } = {},
): string[] {
  const anchorNeedsBtnToken = opts.anchorNeedsBtnToken ?? true;
  const out = new Set<string>();
  const tagRe = /<(input|select|button|a|summary)\b([^>]*)>/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(src)) !== null) {
    const tag = m[1];
    const attrs = m[2] ?? '';
    const classMatch = attrs.match(classAttrRe);
    if (!classMatch) continue;
    const classText = classMatch[1] ?? '';
    const tokens = [...classText.matchAll(/chq-[a-z0-9-]+/g)].map((t) => t[0]);
    if (tag === 'a' && anchorNeedsBtnToken && !tokens.includes('chq-btn')) continue;
    for (const t of tokens) out.add(t);
  }
  return [...out];
}

/** Strips every @media block (top-level-only parsing, per house idiom).
 * Brace-depth is tracked with a linear scan that SKIPS over `/* … *\/`
 * comment bodies rather than a nested-quantifier regex -- a comment
 * containing literal template braces (comms.css's `{{ h.when }}` sample
 * text) desynchronises brace counting and sends the old
 * `(?:[^{}]*\{[^{}]*\}[^{}]*)*` pattern into catastrophic backtracking on a
 * ~2000-line file. This fixes the shared scanner, not comms.css. */
export function stripMedia(css: string): string {
  const ranges: Array<[number, number]> = [];
  const openRe = /@media[^{]*\{/g;
  let m: RegExpExecArray | null;
  while ((m = openRe.exec(css)) !== null) {
    let i = m.index + m[0].length;
    let depth = 1;
    while (i < css.length && depth > 0) {
      if (css.startsWith('/*', i)) {
        const end = css.indexOf('*/', i + 2);
        i = end === -1 ? css.length : end + 2;
        continue;
      }
      if (css[i] === '{') depth++;
      else if (css[i] === '}') depth--;
      i++;
    }
    ranges.push([m.index, i]);
    openRe.lastIndex = i;
  }
  let out = '';
  let last = 0;
  for (const [start, end] of ranges) {
    out += css.slice(last, start);
    last = end;
  }
  out += css.slice(last);
  return out;
}

/** Every top-level (not inside @media) `selector { body }` rule, PLUS any
 * inline exemption comment sitting immediately above it (no code between the
 * comment's closer and the selector's opener, only whitespace). Comments are
 * stripped from `body`/`selector` but the exemption text is captured intact
 * from the original (unstripped) text. */
export function topLevelRulesWithExemption(
  css: string,
): Array<{ selector: string; body: string; exempt: boolean }> {
  const withoutMedia = stripMedia(css);
  const rules: Array<{ selector: string; body: string; exempt: boolean }> = [];
  // The text ahead of a selector can carry ZERO OR MORE leading block
  // comments (the house idiom stacks an explanatory paragraph, sometimes a
  // horizontal-rule banner, above the actual exemption comment -- see
  // styles.css's `.chq-check` and chrome.css.ts's `.chq-visually-hidden`),
  // so the raw pre-selector text is captured whole here rather than trying
  // to special-case a single optional exemption comment inline. Whether the
  // rule is exempt is then a property of THAT text, decided below.
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(withoutMedia)) !== null) {
    const rawSelectorText = m[1] ?? '';
    const exempt = lastLeadingCommentIsExempt(rawSelectorText);
    const selector = stripComments(rawSelectorText).trim();
    const body = stripComments(m[2] ?? '');
    if (!selector) continue;
    rules.push({ selector, body, exempt });
  }
  return rules;
}

/** True only when the LAST block comment inside `rawSelectorText` is a
 * literal `/* tap-floor-exempt: … *\/` comment sitting immediately above the
 * selector -- no code between the comment's closer and the selector's
 * opener, only whitespace. Earlier, unrelated comments in the same stack
 * (a section banner, an explanatory paragraph) do not count on their own,
 * and do not prevent a REAL exemption comment that follows them from being
 * recognised: only the comment directly adjacent to the selector decides.
 *
 * This replaces the earlier `m[0].trimStart().startsWith('/*')` predicate,
 * which called ANY leading block comment exempt (the optional exemption
 * group in the old combined regex was allowed not to match, after which the
 * selector-capture group swallowed whatever comment preceded it) -- and
 * which a naive `m[0]`-prefix fix would still get wrong on a STACK of
 * comments, since the real exemption comment is not necessarily the first
 * one (wave v12m-w13-p finding, DEC-367). */
function lastLeadingCommentIsExempt(rawSelectorText: string): boolean {
  const commentRe = /\/\*[\s\S]*?\*\//g;
  let last: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;
  while ((m = commentRe.exec(rawSelectorText)) !== null) last = m;
  if (!last) return false;
  const afterLastComment = rawSelectorText.slice(last.index + last[0].length);
  if (afterLastComment.trim() === '') return false; // nothing (no selector) follows this comment
  return /^\/\*\s*tap-floor-exempt:/.test(last[0]);
}

/** Every `selector { body }` rule inside an `@media (max-width: Npx)` block
 * where N <= `maxN`, matching braces so a nested rule doesn't truncate the
 * block (mirrors phone-label-source.scan.test.ts's idiom). */
export function narrowMediaRules(css: string, maxN: number): Array<{ selector: string; body: string }> {
  const stripped = stripComments(css);
  const out: Array<{ selector: string; body: string }> = [];
  const mediaRe = /@media[^{]*max-width:\s*(\d+)px[^{]*\{/g;
  let mm: RegExpExecArray | null;
  while ((mm = mediaRe.exec(stripped)) !== null) {
    const width = Number(mm[1]);
    const bodyStart = mm.index + mm[0].length;
    let depth = 1;
    let i = bodyStart;
    for (; i < stripped.length && depth > 0; i++) {
      if (stripped[i] === '{') depth++;
      else if (stripped[i] === '}') depth--;
    }
    if (width > maxN) continue;
    const block = stripped.slice(bodyStart, i - 1);
    const re = /([^{}]+)\{([^{}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(block)) !== null) {
      out.push({ selector: (m[1] ?? '').trim(), body: m[2] ?? '' });
    }
  }
  return out;
}

/** The smallest declared `height`/`min-height` px value in `body`, or
 * undefined if neither is declared (non-px units, e.g. `auto`/`100%`, are
 * ignored -- they don't establish a fixed sub-floor height). */
export function declaredHeightPx(body: string): number | undefined {
  const re = /(?:^|[;{\s])(?:min-height|height)\s*:\s*(\d+(?:\.\d+)?)px/g;
  let smallest: number | undefined;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const v = Number(m[1]);
    if (smallest === undefined || v < smallest) smallest = v;
  }
  return smallest;
}

/** Whether a top-level rule's selector (possibly a comma list) contains a
 * bare `.token` selector (not compounded/descendant -- the plain class
 * shape this codebase uses to style form controls directly). */
export function selectorDeclaresBareClass(selector: string, token: string): boolean {
  return selector
    .split(',')
    .map((s) => s.trim())
    .includes(`.${token}`);
}

export function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** True when `selector` mentions `.token` as a real class boundary --
 * compounded (`.chq-btn.is-on`) or pseudo-suffixed (`.chq-btn:hover`)
 * matches, but a hyphen-extended class that merely shares the token as a
 * prefix (`.chq-btn-primary` against token `chq-btn`) does not. `\b` alone
 * is insufficient here: `-` is a non-word character, so `\b` matches INSIDE
 * a hyphenated class name and every class that is a hyphen-prefix of
 * another wrongly resolves against the shorter token's rule (DEC-937 wave
 * v12m-w15-g finding). The negative lookahead excludes any following word
 * character OR hyphen, so only a true boundary (nothing, `.`, `:`, `[`,
 * whitespace, `,`, `>`, `+`, `~`) counts as a match. */
export function selectorMentionsToken(selector: string, token: string): boolean {
  return new RegExp(`\\.${escapeRe(token)}(?![\\w-])`).test(selector);
}

export function hasMinHeightFloor(body: string): boolean {
  const re = /min-height\s*:\s*(\d+(?:\.\d+)?)px/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    if (Number(m[1]) >= TAP_FLOOR_PX) return true;
  }
  return false;
}

export function hasFlexCenter(body: string): boolean {
  return /display\s*:\s*flex/.test(body) && /align-items\s*:\s*center/.test(body);
}

export function horizontalPaddingNonZero(body: string): boolean {
  const nonZero = (v: string) => {
    const t = v.trim();
    return t !== '0' && t !== '0px';
  };
  for (const m of body.matchAll(/padding-(?:left|right|inline)\s*:\s*([^;]+)/g)) {
    if (nonZero(m[1] ?? '')) return true;
  }
  for (const m of body.matchAll(/(?<![\w-])padding\s*:\s*([^;]+)/g)) {
    const parts = (m[1] ?? '').trim().split(/\s+/).filter(Boolean);
    const horiz =
      parts.length <= 1
        ? [parts[0]]
        : parts.length === 2 || parts.length === 3
          ? [parts[1]]
          : [parts[1], parts[3]];
    if (horiz.some((v) => v !== undefined && nonZero(v))) return true;
  }
  return false;
}

/** True if a `/* tap-floor-exempt: … *\/` comment sits immediately above a
 * selector mentioning `token`, anywhere in `raw` (top-level or inside a
 * media block) -- mirrors the file's existing exemption idiom. */
export function hasExemptionForToken(raw: string, token: string): boolean {
  const re = new RegExp(
    `\\/\\*\\s*tap-floor-exempt:[^*]*\\*\\/\\s*[^{}]*\\.${escapeRe(token)}\\b[^{}]*\\{`,
  );
  return re.test(raw);
}

// --- Classless-tag population walk (wave v12m-w10, task w10-na) ----------
//
// `ssr.ts`'s `classlessAnchorSites` (wave v12m-w17, task w17-c) was the
// first instrument built to see a control with no class token at all --
// hardcoded to a single tag (`a`) and a single attribute grammar
// (`SSR_CLASS_ATTR_RE`). `spa-classless.ts` (wave v12m-w10, task w10-na)
// needs the SAME depth-only tag-stack walk over a WIDER tag set
// ({a, Link, NavLink, button, select, textarea, input}) and the SPA's own
// `className=`-only attribute grammar. Rather than fork the walk a second
// time (DEC-613: a second copy of a vocabulary is a trap with a delay
// fuse), the walk itself moves here, parameterised on the tag set and the
// class-attribute grammar; `ssr.ts`'s `classlessAnchorSites` now delegates
// to this function with `['a']` and keeps its own byte-identical "has a
// class attribute at all" presence test (`hasClassAttrRe`, independent of
// `classAttrRe`'s stricter value-shape grammar, exactly as it always was).

export interface ClasslessTagSite {
  readonly line: number;
  readonly tag: string;
  /** The nearest enclosing element's chq- tokens, walking outward through
   * the tag stack until one carries at least one. Empty when no ancestor
   * (all the way to the file's top level) carries any chq- token. */
  readonly tokens: readonly string[];
  /** The site's own opening-tag attribute text (wave v12m-w40, task w40-e):
   * lets a caller filter on the tag's OWN attributes -- e.g. an
   * `<input type="hidden">`, which is inert and has no hit box, is not a
   * tap-target population member at all -- without a second tag walk. */
  readonly attrs: string;
}

/** Every opening JSX tag in `src` (self-closing or not), matched in source
 * order, mirroring `ssr.ts`'s original inline `ANY_TAG_RE`. Comments must
 * already be stripped by the caller (`stripTsxComments`). */
const ANY_TAG_RE = /<(\/)?([A-Za-z][\w.]*)([^>]*)>/g;

/** Every distinct `chq-…` token found in a class position in `attrs`,
 * matched via `classAttrRe` (`SPA_CLASS_ATTR_RE` or `SSR_CLASS_ATTR_RE`). */
export function chqTokensFromAttrs(attrs: string, classAttrRe: RegExp): string[] {
  const classMatch = attrs.match(classAttrRe);
  if (!classMatch) return [];
  const classText = classMatch[1] ?? '';
  return [...classText.matchAll(/chq-[a-z0-9-]+/g)].map((t) => t[0]);
}

/** Every opening tag in `tagNames` (self-closing or not) in `src` (already
 * comment-stripped) declaring no class attribute matching `hasClassAttrRe`,
 * keyed on its nearest enclosing element's chq- token via a depth-only
 * tag-stack walk forward through the file (DEC-808: walked, never a
 * hand-listed file/line set). `classAttrRe` is used only to extract chq-
 * tokens off an ANCESTOR tag that does carry a class attribute --
 * `hasClassAttrRe` alone decides whether the SUBJECT tag itself is
 * classless, matching `ssr.ts`'s original `!/\bclass(?:Name)?\s*=/`
 * presence-only check byte-for-byte. */
export function classlessTagSites(
  src: string,
  tagNames: readonly string[],
  hasClassAttrRe: RegExp,
  classAttrRe: RegExp,
): ClasslessTagSite[] {
  const tagSet = new Set(tagNames);
  const out: ClasslessTagSite[] = [];
  const stack: string[][] = [];
  ANY_TAG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ANY_TAG_RE.exec(src)) !== null) {
    const closing = m[1] === '/';
    const tagName = m[2] as string;
    const attrs = m[3] ?? '';
    if (closing) {
      stack.pop();
      continue;
    }
    const selfClosing = /\/\s*$/.test(attrs);
    if (tagSet.has(tagName) && !hasClassAttrRe.test(attrs)) {
      let tokens: string[] = [];
      for (let i = stack.length - 1; i >= 0; i--) {
        const frame = stack[i];
        if (frame && frame.length > 0) {
          tokens = frame;
          break;
        }
      }
      const line = src.slice(0, m.index).split('\n').length;
      out.push({ line, tag: tagName, tokens, attrs });
    }
    if (!selfClosing) stack.push(chqTokensFromAttrs(attrs, classAttrRe));
  }
  return out;
}
