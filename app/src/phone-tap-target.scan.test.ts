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
function tapTargetTagTokens(src: string): string[] {
  const out = new Set<string>();
  const tagRe = /<(input|select|button|a)\b([^>]*)>/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(src)) !== null) {
    const tag = m[1];
    const attrs = m[2] ?? '';
    const classMatch = attrs.match(/className\s*=\s*(\{[^}]*\}|"[^"]*")/);
    if (!classMatch) continue;
    const classText = classMatch[1] ?? '';
    const tokens = [...classText.matchAll(/chq-[a-z0-9-]+/g)].map((t) => t[0]);
    if (tag === 'a' && !tokens.includes('chq-btn')) continue;
    for (const t of tokens) out.add(t);
  }
  return [...out];
}

/** Strips every @media block (top-level-only parsing, per house idiom). */
function stripMedia(css: string): string {
  return css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\}[^{}]*)*\}/g, '');
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
