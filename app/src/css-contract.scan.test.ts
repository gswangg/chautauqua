// CSS token + button-face contract (DEC-937). Two invariants the app's CSS
// vocabulary must never silently violate:
//
//   A) every BARE var(--chq-…) reference (no fallback argument) must
//      resolve to a real declaration — either in styles.css's :root token
//      block, or declared somewhere in the referencing file itself (a
//      locally-scoped custom property). A typo'd/renamed token (e.g.
//      --chq-sunk vs --chq-surface-sunk) otherwise resolves to
//      `transparent`/`initial` silently in the browser with no build-time
//      signal. A var(--chq-foo, <fallback>) call is exempt: the fallback
//      is a deliberate, visible default, not a silent failure.
//
//   B) every top-level (not inside @media) rule whose selector ends in
//      -btn/-button (no pseudo-class suffix) and declares `padding` is a
//      button face and must also declare its own font-family (or a `font`
//      shorthand) — otherwise it inherits the browser default (Arial) next
//      to the app's chosen UI typeface.
//
//   C) (DEC-976) every `chq-…` class token used in a *.tsx file's className
//      (a bare string, a template literal, or a conditional expression) has
//      a matching `.chq-…` rule SOMEWHERE in the app's CSS — including
//      inside an @media block, since a class defined only in a phone
//      override is still defined. A markup token with no matching rule is
//      a bug (typo/renamed class) or dead weight (a leftover className);
//      this invariant makes both build-time failures instead of a silent
//      no-op in the browser. A token that is a deliberate no-style hook
//      (used only as a scroll/query anchor, never meant to carry a rule)
//      must be named in NO_STYLE_HOOK_TOKENS below with its reason — never
//      an allowlist populated from the failure output.
//
// All three scans ENUMERATE every *.css / *.tsx file under app/src via
// readdirSync (mirroring page-measure.test.ts / DEC-808) rather than a
// hand-listed manifest, so a new page's markup and CSS are checked
// automatically.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const STYLES_PATH = join(HERE, 'styles.css');

/** Every *.css file under app/src, enumerated rather than named (DEC-808). */
function allCssFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.css')) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

/** Strips /* ... *\/ block comments so a decision note quoting CSS-shaped
 * text (a selector, a property) is never mistaken for a real rule. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Strips every @media block (top-level-only parsing, per house idiom). */
function stripMedia(css: string): string {
  return stripComments(css).replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\}[^{}]*)*\}/g, '');
}

/** Every top-level `selector { body }` rule, with @media blocks stripped. */
function topLevelRules(css: string): Array<{ selector: string; body: string }> {
  const withoutMedia = stripMedia(css);
  const rules: Array<{ selector: string; body: string }> = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(withoutMedia)) !== null) {
    rules.push({ selector: (m[1] ?? '').trim(), body: m[2] ?? '' });
  }
  return rules;
}

/** Extracts a top-level (not inside an @media block) rule's declaration body by selector. */
function topLevelRuleBody(css: string, selector: string): string {
  const withoutMedia = stripMedia(css);
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = withoutMedia.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  const body = match?.[1];
  if (body === undefined) throw new Error(`no top-level rule found for ${selector}`);
  return body;
}

/**
 * Every distinct `--chq-…` custom-property name referenced via a BARE
 * var(--chq-foo) call (no fallback argument) in the given css text. A
 * var(--chq-foo, <fallback>) call is deliberately self-healing -- the
 * fallback stands in for an undefined token instead of silently resolving
 * to transparent/initial -- so it is out of scope for this contract.
 */
function referencedTokens(css: string): string[] {
  const out = new Set<string>();
  const re = /var\(\s*(--chq-[A-Za-z0-9-]+)\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripComments(css))) !== null) {
    const name = m[1];
    if (name) out.add(name);
  }
  return [...out];
}

/** Whether `token` is declared (as `token:`) anywhere in the given css text. */
function isDeclaredIn(css: string, token: string): boolean {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}\\s*:`).test(css);
}

const CSS_FILES = allCssFiles(HERE);
const STYLES_CSS = readFileSync(STYLES_PATH, 'utf-8');
const ROOT_BODY = topLevelRuleBody(STYLES_CSS, ':root');

// Selector ends in -btn or -button, with no pseudo-class/attribute suffix
// (i.e. it literally ends in that string once trimmed).
const BUTTON_FACE_SELECTOR = /-(btn|button)$/;

function declaresFontFace(body: string): boolean {
  return /font-family\s*:/.test(body) || /font\s*:/.test(body);
}

/** Every *.tsx file under app/src, excluding test files (DEC-976/DEC-808). */
function allTsxFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.tsx')) continue;
    if (entry.name.includes('.test.')) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

/** Strips `//` line comments and `/* *\/` block comments from TSX source. */
function stripTsxComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/**
 * Every `className={...}` / `className="..."` region's raw text, scanned
 * for brace-balance on the `{...}` form so a nested expression (a ternary,
 * a template literal, a function call) is captured in full.
 */
function classNameRegions(src: string): string[] {
  const regions: string[] = [];
  const re = /className\s*=\s*(\{|")/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const opener = m[1];
    const start = re.lastIndex;
    if (opener === '"') {
      const end = src.indexOf('"', start);
      if (end === -1) continue;
      regions.push(src.slice(start, end));
      re.lastIndex = end + 1;
    } else {
      let depth = 1;
      let i = start;
      while (i < src.length && depth > 0) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') depth--;
        i++;
      }
      regions.push(src.slice(start, i - 1));
      re.lastIndex = i;
    }
  }
  return regions;
}

/** Every distinct `chq-…` token found inside className regions of `src`. */
function classNameTokens(src: string): string[] {
  const out = new Set<string>();
  const re = /chq-[a-z0-9-]+/g;
  for (const region of classNameRegions(src)) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(region)) !== null) out.add(m[0]);
  }
  return [...out];
}

/**
 * Deliberate no-style hooks: a `chq-…` className used only as a scroll or
 * query anchor, never meant to carry a rule. One named entry per class,
 * with the reason written beside it — never an allowlist populated from
 * the failure output (DEC-976).
 */
const NO_STYLE_HOOK_TOKENS = new Set<string>([
  // (none identified yet — every markup token found a rule or was deleted)
]);

describe('CSS token + button-face contract (DEC-937)', () => {
  it('found more than one CSS file to scan', () => {
    // Guards the enumeration itself: if readdirSync ever returned nothing,
    // every assertion below would vacuously pass.
    expect(CSS_FILES.length).toBeGreaterThan(5);
  });

  it('every var(--chq-…) reference resolves to a declaration in :root or its own file', () => {
    const offenders: string[] = [];
    for (const path of CSS_FILES) {
      const css = readFileSync(path, 'utf-8');
      const label = relative(HERE, path);
      for (const token of referencedTokens(css)) {
        const declaredGlobally = isDeclaredIn(ROOT_BODY, token);
        const declaredLocally = isDeclaredIn(css, token);
        if (!declaredGlobally && !declaredLocally) {
          offenders.push(`${label}: ${token}`);
        }
      }
    }
    expect(offenders, `undeclared CSS custom properties:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('every button-face rule (selector ends -btn/-button, declares padding) also declares its own font', () => {
    const offenders: string[] = [];
    for (const path of CSS_FILES) {
      const css = readFileSync(path, 'utf-8');
      const label = relative(HERE, path);
      for (const { selector, body } of topLevelRules(css)) {
        // A comma-separated selector list can mix button-face and other
        // names; each individual part is checked.
        const parts = selector.split(',').map((s) => s.trim());
        const isButtonFace = parts.some((s) => BUTTON_FACE_SELECTOR.test(s));
        if (!isButtonFace) continue;
        if (!/padding\s*:/.test(body)) continue;
        if (!declaresFontFace(body)) {
          offenders.push(`${label}: "${selector}"`);
        }
      }
    }
    expect(offenders, `button-face rules with no font-family/font:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('every chq-… className token used in markup has a matching CSS rule (DEC-976)', () => {
    // Defined set: every `.chq-…` class selector appearing anywhere in the
    // union of the CSS files, including inside @media blocks (comments
    // stripped only, media NOT stripped — a phone-only class is defined).
    const defined = new Set<string>();
    for (const path of CSS_FILES) {
      const css = stripComments(readFileSync(path, 'utf-8'));
      const re = /\.(chq-[A-Za-z0-9-]+)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(css)) !== null) {
        const token = m[1];
        if (token) defined.add(token);
      }
    }

    const TSX_FILES = allTsxFiles(HERE);
    expect(TSX_FILES.length).toBeGreaterThan(5);

    const offenders: string[] = [];
    for (const path of TSX_FILES) {
      const src = stripTsxComments(readFileSync(path, 'utf-8'));
      const label = relative(HERE, path);
      for (const token of classNameTokens(src)) {
        if (defined.has(token) || NO_STYLE_HOOK_TOKENS.has(token)) continue;
        offenders.push(`${label}: ${token}`);
      }
    }
    expect(
      offenders,
      `className tokens with no matching CSS rule (add a rule or delete the className):\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
