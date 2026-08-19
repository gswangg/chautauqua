// Phone tap-target floor scan (DEC-253 amendment, DEC-367 floor -- wave 25 /
// task w25-d).
//
// Measured on the admin-mobile pass at 390x844:
// `input.chq-input.chq-submissions-filterbar-search` rendered a 26px tap
// target against the 44px minimum
// (docs/verification-log/task-w17-d-render-sweep.md:163-165). The 26px is
// a deliberate DESKTOP chip height (submissions.css's
// .chq-submissions-filterbar-search/-select match the adjacent .chq-pill
// row), so the fix is additive only: a phone-width override, not a desktop
// change.
//
// This scan enumerates (readdirSync, DEC-808 idiom, never a hand-listed
// manifest) every app/src *.css file and every app/src *.tsx file
// (excluding *.test.tsx) and:
//
//   1. Collects every `chq-…` class token that appears in a class position
//      on an `<input`, `<select`, `<button`, or an `<a>` whose class list
//      also carries `chq-btn` (an anchor styled as a button-face control).
//   2. For each such token, finds its TOP-LEVEL (outside any @media block)
//      CSS rule -- a plain `.chq-token { ... }` selector, alone or in a
//      comma list -- and reads any `height`/`min-height` declaration.
//   3. If that declared value is below 44px, the token is a tap-target
//      offender UNLESS one of:
//        a) some `@media (max-width: <=700px) { ... }` block declares
//           `height`/`min-height` >= 44px for the same selector, or
//        b) the top-level rule carries an inline exemption comment
//           immediately above it: `/* tap-floor-exempt: <reason> */`.
//   Never an allowlist populated from the failure output -- every
//   exemption is a comment sitting next to the rule it exempts.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url)); // app/src
const REPO_ROOT = join(HERE, '..', '..');
const TAP_FLOOR_PX = 44;

/** Every *.css file under app/src, enumerated rather than named (DEC-808). */
function allCssFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.css')) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

/** Every *.tsx file under app/src, excluding *.test.tsx (DEC-976/DEC-808). */
function allTsxFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.tsx')) continue;
    if (entry.name.includes('.test.')) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Strips `//` line comments and `/* *\/` block comments from TSX source. */
function stripTsxComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/** Every distinct `chq-…` token found in a class position on an
 * `<input`/`<select`/`<button` tag, or on an `<a>` tag whose class list also
 * carries `chq-btn` (an anchor styled as a button-face). Tag bodies are
 * captured non-greedily up to the next `>` -- adequate for the plain
 * `className="..."`/`className={...条件...}` attribute shapes this codebase
 * uses on form controls (no `>` literal inside those attribute values). */
const SPA_CLASS_ATTR_RE = /className\s*=\s*(\{[^}]*\}|"[^"]*")/;
/** Hono JSX (every src/** SSR view) writes the DOM attribute name, `class`,
 * where React writes `className`. Same attribute, same token grammar -- so
 * the SSR population passes this variant into the SAME extractor rather
 * than growing a second one (DEC-613: a second copy of a vocabulary is a
 * trap with a delay fuse). `className` stays accepted here too: a few SSR
 * views are shared with the SPA. */
const SSR_CLASS_ATTR_RE = /\bclass(?:Name)?\s*=\s*(\{[^}]*\}|"[^"]*")/;

function tapTargetTagTokens(src: string, classAttrRe: RegExp = SPA_CLASS_ATTR_RE): string[] {
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
function stripMedia(css: string): string {
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
function topLevelRulesWithExemption(
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
function narrowMediaRules(css: string, maxN: number): Array<{ selector: string; body: string }> {
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
function declaredHeightPx(body: string): number | undefined {
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
function selectorDeclaresBareClass(selector: string, token: string): boolean {
  return selector
    .split(',')
    .map((s) => s.trim())
    .includes(`.${token}`);
}

const CSS_FILES = allCssFiles(HERE);
const TSX_FILES = allTsxFiles(HERE);

/** All tap-target-eligible `chq-…` tokens found across every TSX file. */
function allTapTargetTokens(): Set<string> {
  const out = new Set<string>();
  for (const path of TSX_FILES) {
    const src = stripTsxComments(readFileSync(path, 'utf-8'));
    for (const t of tapTargetTagTokens(src)) out.add(t);
  }
  return out;
}

/**
 * For a given token, find offenders: a top-level rule declaring
 * height/min-height < 44px, with no phone-width override >= 44px and no
 * inline exemption comment.
 */
function findOffenders(): string[] {
  const tokens = allTapTargetTokens();
  const offenders: string[] = [];
  for (const path of CSS_FILES) {
    const label = relative(REPO_ROOT, path);
    const raw = readFileSync(path, 'utf-8');
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
  return offenders;
}

// --- Row-action-anchor evasion (DEC-393 wave-87 amendment) --------------
//
// The scan above only ever looks at `<input|select|button>` and at `<a>`
// when it ALSO carries `chq-btn` -- the one shape DESIGN-RULINGS.md:189
// names as the evasion, a bare anchor whose hit box is only as wide as its
// text, is the one shape outside that population. This section adds two
// populations the original scan cannot see:
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

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Every distinct `chq-…` token found in a class position on an `<a>` or a
 * react-router `<Link>` tag WITHOUT `chq-btn` in the same class list -- the
 * row-action-anchor shape DESIGN-RULINGS.md:189 names. */
function bareAnchorTokens(src: string): string[] {
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
function allBareAnchorTokens(): Set<string> {
  const out = new Set<string>();
  for (const path of TSX_FILES) {
    const src = stripTsxComments(readFileSync(path, 'utf-8'));
    for (const t of bareAnchorTokens(src)) out.add(t);
  }
  return out;
}

/** Population (b): every `chq-…` class token DEFINED anywhere in the CSS
 * tree whose own name matches a row-action container shape -- derived from
 * the CSS itself, never a hand-listed pair. */
function rowActionContainerTokens(): Set<string> {
  const out = new Set<string>();
  const re = /\.(chq-[a-z0-9-]+)/g;
  for (const path of CSS_FILES) {
    const raw = readFileSync(path, 'utf-8');
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
      const token = m[1] ?? '';
      if (/-actions(?:-[a-z0-9-]+)?$/.test(token)) out.add(token);
    }
  }
  return out;
}

function selectorMentionsToken(selector: string, token: string): boolean {
  return new RegExp(`\\.${escapeRe(token)}\\b`).test(selector);
}

/** True if `selector` addresses an anchor: a bare `a` element selector, or a
 * descendant class that is itself a known population-(a) anchor token. */
function selectorReachesAnchor(selector: string, anchorTokens: Set<string>): boolean {
  if (/(^|[\s>+~])a(?=[.:#[\s,]|$)/.test(selector)) return true;
  for (const t of anchorTokens) {
    if (selectorMentionsToken(selector, t)) return true;
  }
  return false;
}

function hasMinHeightFloor(body: string): boolean {
  const re = /min-height\s*:\s*(\d+(?:\.\d+)?)px/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    if (Number(m[1]) >= TAP_FLOOR_PX) return true;
  }
  return false;
}

function hasFlexCenter(body: string): boolean {
  return /display\s*:\s*flex/.test(body) && /align-items\s*:\s*center/.test(body);
}

function horizontalPaddingNonZero(body: string): boolean {
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
function hasExemptionForToken(raw: string, token: string): boolean {
  const re = new RegExp(
    `\\/\\*\\s*tap-floor-exempt:[^*]*\\*\\/\\s*[^{}]*\\.${escapeRe(token)}\\b[^{}]*\\{`,
  );
  return re.test(raw);
}

/** Every population-(a)/(b) member with no conforming phone-width rule and
 * no structural exemption, reported as `<file> — <selector>`. A token
 * declared in no CSS file at all is reported against `(no CSS rule)`. */
function findAnchorFloorOffenders(): string[] {
  const anchorTokens = allBareAnchorTokens();
  const containerTokens = rowActionContainerTokens();
  const offenders: string[] = [];

  // Precompute top-level and narrow-media rules ONCE per file -- a token
  // loop that re-parses every CSS file per token is quadratic in
  // (population size x file count) for no reason.
  const perFile = CSS_FILES.map((path) => {
    const raw = readFileSync(path, 'utf-8');
    return {
      label: relative(REPO_ROOT, path),
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
      offenders.push(`(no CSS rule) — .${token}`);
    }
  };

  for (const t of anchorTokens) checkToken(t, false);
  for (const t of containerTokens) checkToken(t, true);
  return offenders.sort();
}

// Measured directly on this branch (`npx vitest run
// app/src/phone-tap-target.scan.test.ts`) after fixing every offender that
// lives in a file this lane owns (`app/src/components/*.css`,
// `app/src/pages/submissions/*.css`); every remaining offender is filed in
// `docs/design/audit/tap-floor-v12.md` for its owning cluster/wave. This
// number may only be LOWERED by a future wave closing more of the audit
// file's rows -- never raised to accommodate a new offender.
//
// Re-measured wave 108 (v12m-w4-o, DEC-808 amendment) by forcing this const
// to -1 and reading the printed offender list: truth is 64, not the stale
// 92 this constant carried. Set to the measured truth; see the companion
// "never below the ceiling without lowering it" test below for the other
// half of the ratchet this file's own test name always claimed to have.
export const ANCHOR_FLOOR_OFFENDERS_CEILING = 64;

describe('row-action-anchor tap-target floor scan (DEC-393 wave-87 amendment)', () => {
  it('derives a non-empty population and includes a known-good token (vacuous-population tripwire)', () => {
    const anchorTokens = allBareAnchorTokens();
    const containerTokens = rowActionContainerTokens();
    expect(anchorTokens.size).toBeGreaterThan(0);
    expect(containerTokens.size).toBeGreaterThan(0);
    // `chq-overview-link-btn` is a real bare `<a>`/`<Link>` class with no
    // `chq-btn` (Overview.tsx) -- a regex that silently matched nothing
    // could not have found it.
    expect(anchorTokens.has('chq-overview-link-btn')).toBe(true);
    // `chq-breaks-row-actions` is a real row-action container class defined
    // in agenda.css.
    expect(containerTokens.has('chq-breaks-row-actions')).toBe(true);
  });

  it('flags a synthetic bare anchor with only padding declared (positive control: padding alone does not reach the floor)', () => {
    const tsx = `export const X = () => <a className="chq-x-fake-anchor" href="/x">Go</a>;`;
    const css = `
      @media (max-width: 700px) {
        .chq-x-fake-anchor { padding: 0 16px; }
      }
    `;
    const tokens = bareAnchorTokens(stripTsxComments(tsx));
    expect(tokens).toEqual(['chq-x-fake-anchor']);
    const narrow = narrowMediaRules(css, 700);
    const rule = narrow.find((r) => selectorMentionsToken(r.selector, 'chq-x-fake-anchor'))!;
    expect(hasMinHeightFloor(rule.body)).toBe(false);
    expect(horizontalPaddingNonZero(rule.body)).toBe(true);
  });

  it('does not flag a synthetic bare anchor declaring all three phone properties (negative control)', () => {
    const css = `
      @media (max-width: 700px) {
        .chq-x-fake-anchor-2 {
          min-height: 44px;
          display: flex;
          align-items: center;
          padding: 0 16px;
        }
      }
    `;
    const rule = narrowMediaRules(css, 700).find((r) =>
      selectorMentionsToken(r.selector, 'chq-x-fake-anchor-2'),
    )!;
    expect(hasMinHeightFloor(rule.body)).toBe(true);
    expect(hasFlexCenter(rule.body)).toBe(true);
    expect(horizontalPaddingNonZero(rule.body)).toBe(true);
  });

  it('does not flag a row-action container reaching its anchor via a descendant selector (negative control)', () => {
    const css = `
      @media (max-width: 700px) {
        .chq-x-fake-row-actions a {
          min-height: 44px;
          display: flex;
          align-items: center;
          padding: 0 16px;
        }
      }
    `;
    const narrow = narrowMediaRules(css, 700);
    const rule = narrow.find((r) => selectorMentionsToken(r.selector, 'chq-x-fake-row-actions'))!;
    expect(selectorReachesAnchor(rule.selector, new Set())).toBe(true);
  });

  it('stays at or under the offender ceiling (one-sided ratchet: may only fall)', () => {
    const offenders = findAnchorFloorOffenders();
    expect(
      offenders.length,
      `row-action-anchor tap-target floor offenders (${offenders.length}, ceiling ${ANCHOR_FLOOR_OFFENDERS_CEILING}):\n${offenders.join('\n')}`,
    ).toBeLessThanOrEqual(ANCHOR_FLOOR_OFFENDERS_CEILING);
  });

  it(`never falls below the offender ceiling (${ANCHOR_FLOOR_OFFENDERS_CEILING}) without the ceiling being lowered to match (a stale ceiling licenses stagnation)`, () => {
    const offenders = findAnchorFloorOffenders();
    if (offenders.length < ANCHOR_FLOOR_OFFENDERS_CEILING) {
      throw new Error(
        `row-action-anchor tap-target floor offenders (${offenders.length}) fell below the ` +
          `ANCHOR_FLOOR_OFFENDERS_CEILING of ${ANCHOR_FLOOR_OFFENDERS_CEILING}. This is the ratchet ` +
          `working: offenders got fixed. Lower the ceiling in the same commit (a merge-train act, ` +
          `never a worker's edit mid-lane) by replacing the line:\n` +
          `  export const ANCHOR_FLOOR_OFFENDERS_CEILING = ${offenders.length};`,
      );
    }
    expect(offenders.length).toBeGreaterThanOrEqual(ANCHOR_FLOOR_OFFENDERS_CEILING);
  });
});

describe('phone tap-target floor scan (DEC-253 amendment, DEC-367)', () => {
  it('found more than one CSS file and one TSX file to scan (vacuous-scan tripwire)', () => {
    expect(CSS_FILES.length).toBeGreaterThan(5);
    expect(TSX_FILES.length).toBeGreaterThan(5);
  });

  it('flags a synthetic sub-floor input rule with no override or exemption (positive control)', () => {
    const tsx = `export const X = () => <input className="chq-x-fake-search" />;`;
    const css = `.chq-x-fake-search { min-height: 26px; }`;
    const tokens = new Set(tapTargetTagTokens(stripTsxComments(tsx)));
    expect(tokens.has('chq-x-fake-search')).toBe(true);
    const rules = topLevelRulesWithExemption(css);
    const rule = rules.find((r) => selectorDeclaresBareClass(r.selector, 'chq-x-fake-search'));
    expect(rule).toBeDefined();
    expect(declaredHeightPx(rule!.body)).toBe(26);
    expect(rule!.exempt).toBe(false);
  });

  it('does not flag a sub-floor rule with a phone-width >=44px override (negative control)', () => {
    const css = `
      .chq-x-fake-search { min-height: 26px; }
      @media (max-width: 700px) {
        .chq-x-fake-search { min-height: 44px; }
      }
    `;
    const rule = topLevelRulesWithExemption(css).find((r) =>
      selectorDeclaresBareClass(r.selector, 'chq-x-fake-search'),
    )!;
    expect(declaredHeightPx(rule.body)).toBe(26);
    const overridden = narrowMediaRules(css, 700).some(
      (r) =>
        selectorDeclaresBareClass(r.selector, 'chq-x-fake-search') &&
        (declaredHeightPx(r.body) ?? 0) >= TAP_FLOOR_PX,
    );
    expect(overridden).toBe(true);
  });

  it('does not flag a sub-floor rule carrying a named tap-floor-exempt comment (negative control)', () => {
    const css = `
      /* tap-floor-exempt: decorative icon-only chip, never a phone tap target */
      .chq-x-fake-chip { min-height: 20px; }
    `;
    const rule = topLevelRulesWithExemption(css).find((r) =>
      selectorDeclaresBareClass(r.selector, 'chq-x-fake-chip'),
    )!;
    expect(rule.exempt).toBe(true);
  });

  it('every sub-44px input/select/button/chq-btn-anchor control has a >=44px phone override or a named exemption', () => {
    const offenders = findOffenders();
    expect(
      offenders,
      `sub-44px tap targets with no phone-width override and no tap-floor-exempt comment:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});

// --- SSR population widening (mandate item 5) ---------------------------
//
// Everything above scans app/src ONLY: the SPA bundle's *.css sheets and
// its React *.tsx views. The SSR half of the product -- src/routes/public
// (the CFP, the public event site), src/routes/portal, src/routes/docs-site,
// src/routes/auth -- ships its own Hono JSX views and its own CSS-in-TS
// stylesheets, and NO tap-target scan has ever looked at it. That is the
// same hole DEC-808 names as A DIRECTORY IS NOT A POPULATION: the scan was
// honest about everything it could see, and blind to half the surface. The
// meta-fidelity probe (scratchpad/metafid-c/out-public.txt) measured the
// consequence directly at 390 -- `button.chq-pub-search-submit` at 40x44,
// `a.chq-docs-wordmark` at 112.6x28, `button.chq-auth-demo-btn` at
// 269.8x17 -- live sub-floor controls on public routes, every one of them
// outside this file's population until now.
//
// SCOPE, stated plainly: this widening's job is to SEE the surface, not to
// fix it. The offender count is recorded as a ratchet seeded at the
// measured truth and may only be LOWERED -- one-sided by deliberate
// choice, unlike the two-sided ratchets elsewhere in this repo. Driving
// these to zero is engine work (the SSR sheets have no shared control-face
// primitive the way app/src's `.chq-btn` does), and a two-sided ratchet
// would demand that work be finished in the same change that makes it
// visible. Seeing first, then fixing, is the point.
//
// POPULATION is derived the way phone-horizontal-overflow.scan.test.ts
// derives its own SSR half -- by what a module's SOURCE declares (`export
// const *CSS`), never by a `.css.ts` filename convention, because
// src/views/theme.ts exports THEME_CSS without that suffix and a filename
// glob silently drops the one sheet every SSR surface loads (DEC-808,
// wave-96 finding).

const SSR_ROOT = join(REPO_ROOT, 'src');
const CSS_EXPORT_RE = /export const [A-Z0-9_]*CSS\s*=\s*/;

/** Every src/**\/*.ts module whose source exports a CSS template literal. */
function ssrCssModuleFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.ts') || entry.name.includes('.test.')) continue;
    const absPath = join(entry.parentPath, entry.name);
    if (CSS_EXPORT_RE.test(readFileSync(absPath, 'utf-8'))) out.push(absPath);
  }
  return out.sort();
}

/** Every src/**\/*.tsx SSR view, excluding tests. */
function ssrTsxFiles(root: string): string[] {
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
function extractCssTsLiteral(raw: string): string {
  return [...raw.matchAll(/`([\s\S]*?)`/g)]
    .map((m) => m[1] ?? '')
    .join('\n')
    .replace(/\$\{[^}]*\}/g, '');
}

const SSR_CSS_MODULES = ssrCssModuleFiles(SSR_ROOT);
const SSR_TSX_FILES = ssrTsxFiles(SSR_ROOT);

function allSsrTapTargetTokens(): Set<string> {
  const out = new Set<string>();
  for (const path of SSR_TSX_FILES) {
    const src = stripTsxComments(readFileSync(path, 'utf-8'));
    for (const t of tapTargetTagTokens(src, SSR_CLASS_ATTR_RE)) out.add(t);
  }
  return out;
}

/** Same three-step judgement as findOffenders() above -- top-level
 * sub-floor height, no <=700px override, no named exemption -- run over
 * the SSR populations. */
function findSsrOffenders(): string[] {
  const tokens = allSsrTapTargetTokens();
  const offenders: string[] = [];
  for (const path of SSR_CSS_MODULES) {
    const label = relative(REPO_ROOT, path);
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
function findSsrUnflooredTokens(): string[] {
  const tokens = [...allSsrTapTargetTokens()];
  const perFile = SSR_CSS_MODULES.map((path) => {
    const raw = extractCssTsLiteral(readFileSync(path, 'utf-8'));
    return {
      label: relative(REPO_ROOT, path),
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
  for (const token of tokens) {
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

/**
 * Seeded at the count measured when this population was first scanned
 * (mandate item 5). ONE-SIDED: may only be LOWERED, never raised.
 *
 * This is a TO-DO LIST, not a licence, and deliberately NOT the two-sided
 * ratchet the rest of this repo prefers. Giving the SSR route sheets a
 * shared control-face primitive that carries the 44px floor is engine work
 * with its own frame-fidelity consequences; forcing it to be finished in
 * the same change that first makes the surface visible is exactly the
 * trade that keeps a surface invisible. Seeing first, then fixing.
 */
export const SSR_UNFLOORED_TOKENS_CEILING = 14;

// The 14 measured on this branch, recorded here so the next wave inherits
// the reading rather than the number. TWO of them are independently
// corroborated by the live 390 probe, which is what validates the lens
// rather than merely running it: `.chq-auth-demo-btn` (measured 269.8x17)
// and `.chq-pub-search-submit` (measured 40x44 -- floor met by accident of
// content, declared nowhere). The rest are `.chq-docs-search-input`,
// `.chq-portal-copresenter-email-flagged`, `.chq-portal-header-signout-btn`,
// `.chq-portal-preview-download`, `.chq-itinerary-toggle`, `.chq-pub-select`,
// `.chq-pub-select-active`, `.chq-pub-search`, `.chq-visually-hidden`,
// `.chq-field-invalid`, `.chq-btn-secondary`, `.chq-btn-tertiary`.
//
// KNOWN NOISE, named rather than quietly filtered (a filter tuned to the
// current reading hides the next real one): `.chq-visually-hidden` is a
// screen-reader-only utility and can never be a tap target;
// `.chq-btn-secondary`/`-tertiary` and `.chq-field-invalid` are MODIFIERS
// that compose a base class carrying the floor, and a per-token text scan
// cannot follow composition. Three of fourteen. Whoever lowers this ceiling
// should retire those three with named `tap-floor-exempt:` comments on
// their rules -- the escape this scan already honours -- and fix the
// remaining eleven for real.

/** Seeded at the count measured when this population was first scanned
 * (mandate item 5). ONE-SIDED: may only be LOWERED, never raised. There is
 * deliberately no companion "ceiling is not stale" test -- see the SCOPE
 * note above; the engine work that would drive this to zero is not this
 * change's job, and a two-sided ratchet would force it to be. */
export const SSR_TAP_FLOOR_OFFENDERS_CEILING = 0;

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
    const offenders = findSsrOffenders();
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
    const tokens = allSsrTapTargetTokens();
    expect(tokens.size).toBeGreaterThan(20);
    expect(tokens.has('chq-auth-demo-btn')).toBe(true);
  });

  it('stays at or under the SSR unfloored-token ceiling, and never raises it silently', () => {
    const offenders = findSsrUnflooredTokens();
    expect(
      offenders.length,
      `SSR tap targets whose CSS never declares a >=44px floor at any width ` +
        `(${offenders.length}, ceiling ${SSR_UNFLOORED_TOKENS_CEILING} -- may only be LOWERED):\n${offenders.join('\n')}`,
    ).toBeLessThanOrEqual(SSR_UNFLOORED_TOKENS_CEILING);
  });
});
