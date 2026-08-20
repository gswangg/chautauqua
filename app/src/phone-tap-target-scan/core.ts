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

export function tapTargetTagTokens(src: string, classAttrRe: RegExp = SPA_CLASS_ATTR_RE): string[] {
  const out = new Set<string>();
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
  // Optional leading exemption comment, then selector, then { body }.
  const re = /(?:\/\*\s*tap-floor-exempt:[^*]*\*\/\s*)?([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(withoutMedia)) !== null) {
    const exempt = m[0].trimStart().startsWith('/*');
    const selector = stripComments(m[1] ?? '').trim();
    const body = stripComments(m[2] ?? '');
    if (!selector) continue;
    rules.push({ selector, body, exempt });
  }
  return rules;
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

export function selectorMentionsToken(selector: string, token: string): boolean {
  return new RegExp(`\\.${escapeRe(token)}\\b`).test(selector);
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
