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
// Both scans ENUMERATE every *.css file under app/src via readdirSync
// (mirroring page-measure.test.ts / DEC-808) rather than a hand-listed
// manifest, so a new page's CSS is checked automatically.
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
});
