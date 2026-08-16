// DEC-383 (wave-60 amendment): V11's B8 interaction-state and motion
// standard (docs/design/DESIGN-RULINGS.md:108-177) landed in the admin SPA
// at wave 58 (app/src/interaction-states.scan.test.ts), but that scan's
// population is declared as "every .css under app/src" -- it cannot see the
// server-rendered half of the product at all. This is that half's scan.
//
// Per DEC-367/DEC-808 doctrine ("a population defined by a directory misses
// the other half of the product"), the population here is a PROPERTY --
// every module under src/ whose source exports a `*_CSS` template literal
// constant -- discovered by reading file CONTENTS, never by a path prefix
// plus a filename suffix. A file named foo.css.ts that stopped exporting a
// *_CSS constant would silently drop out (correctly); a file that started
// exporting one from an unexpected path would be picked up (correctly).
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..');
const SRC = join(REPO_ROOT, 'src');

const EXPORTS_CSS_CONST_RE = /export const [A-Z][A-Z0-9_]*_CSS\s*=/;

/** Every .ts/.tsx file under `root`, found via recursive readdirSync. */
function allSourceFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    if (!/\.tsx?$/.test(entry.name)) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

/** Every module under src/ whose CONTENTS export a `*_CSS` template
 *  literal constant -- the population is a property (what the module
 *  exports), not a path/suffix convention. */
function cssModules(root: string): string[] {
  return allSourceFiles(root).filter((f) => EXPORTS_CSS_CONST_RE.test(readFileSync(f, 'utf-8')));
}

/** Strips /* ... *\/ block comments (comment prose legitimately names
 *  banned tokens while explaining why they're banned). */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '');
}

const ALLOWED_TRANSITION_PROPERTIES = new Set(['background-color', 'border-color', 'color', 'opacity']);

const TRANSITION_ALL_RE = /transition(?:-property)?\s*:\s*all\b/;
// `ease-in` alone, never as a prefix of `ease-in-out` (a negative lookahead
// excludes the compound so the two checks are independent).
const EASE_IN_RE = /\bease-in\b(?!-out)/;
const EASE_IN_OUT_RE = /\bease-in-out\b/;

/** Every property named in a `transition:`/`transition-property:`
 *  declaration, ignoring `var(...)` timing/easing arguments and the
 *  transition-only keywords (none, all -- all is caught separately). */
function transitionedProperties(css: string): string[] {
  const props: string[] = [];
  const re = /transition(?:-property)?\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    const body = m[1] ?? '';
    for (const part of body.split(',')) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const propName = trimmed.split(/\s+/)[0] ?? '';
      if (!propName || propName === 'none' || propName === 'all') continue;
      if (propName.startsWith('var(')) continue;
      props.push(propName);
    }
  }
  return props;
}

interface Violations {
  transitionAll: boolean;
  badProperties: string[];
  easeIn: boolean;
  easeInOut: boolean;
}

function scanBans(css: string): Violations {
  const withoutComments = stripComments(css);
  return {
    transitionAll: TRANSITION_ALL_RE.test(withoutComments),
    badProperties: transitionedProperties(withoutComments).filter((p) => !ALLOWED_TRANSITION_PROPERTIES.has(p)),
    easeIn: EASE_IN_RE.test(withoutComments),
    easeInOut: EASE_IN_OUT_RE.test(withoutComments),
  };
}

describe('SSR *_CSS module population (DEC-367/DEC-808 doctrine)', () => {
  const modules = cssModules(SRC);

  it('found well above one *_CSS-exporting module under src/ (sanity check on the enumeration)', () => {
    expect(modules.length).toBeGreaterThan(5);
  });

  it('includes src/views/theme.ts (THEME_CSS is the shared SSR sheet every surface inlines)', () => {
    expect(modules).toContain(join(SRC, 'views', 'theme.ts'));
  });
});

describe('SSR interaction-state bans (DEC-383, wave-60 amendment) -- every *_CSS module', () => {
  const modules = cssModules(SRC);

  for (const file of modules) {
    const rel = relative(REPO_ROOT, file);
    const css = readFileSync(file, 'utf-8');
    const v = scanBans(css);

    it(`${rel} never transitions "all"`, () => {
      expect(v.transitionAll).toBe(false);
    });

    it(`${rel} only transitions background-color/border-color/color/opacity`, () => {
      expect(v.badProperties).toEqual([]);
    });

    it(`${rel} contains no ease-in`, () => {
      expect(v.easeIn).toBe(false);
    });

    it(`${rel} contains no ease-in-out`, () => {
      expect(v.easeInOut).toBe(false);
    });
  }
});

describe('SSR interaction-state positive requirements -- src/views/theme.ts only', () => {
  const themePath = join(SRC, 'views', 'theme.ts');
  const raw = readFileSync(themePath, 'utf-8');
  const css = stripComments(raw);

  it('declares the four B8 tiers (primary/secondary/tertiary/disabled hover+active rules)', () => {
    expect(css).toMatch(/\.chq-btn-primary:hover\s*\{\s*background:\s*var\(--chq-brand-hover\)/);
    expect(css).toMatch(/\.chq-btn-primary:active\s*\{\s*background:\s*var\(--chq-brand-active\)/);
    expect(css).toMatch(/\.chq-btn-secondary:hover\s*\{\s*background:\s*var\(--chq-secondary-hover\)/);
    expect(css).toMatch(/\.chq-btn-secondary:active\s*\{\s*background:\s*var\(--chq-secondary-active\)/);
    expect(css).toMatch(/\.chq-btn-tertiary:hover\s*\{\s*color:\s*var\(--chq-brand-hover\)/);
    expect(css).toMatch(/\.chq-btn-tertiary:active\s*\{\s*color:\s*var\(--chq-brand-active\)/);
    // Disabled: no hover state at all -- rest colour stays on hover/active too.
    expect(css).toMatch(/button:disabled,\s*\.chq-btn:disabled/);
    expect(css).toMatch(/cursor:\s*default/);
  });

  it('declares the motion duration tokens', () => {
    expect(css).toMatch(/--chq-motion-color:\s*120ms/);
    expect(css).toMatch(/--chq-ease-state:\s*ease-out/);
  });

  it('declares a prefers-reduced-motion block that re-binds the duration tokens', () => {
    const match = css.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n  \}\n/);
    expect(match).not.toBeNull();
    const body = match?.[1] ?? '';
    expect(body).toMatch(/--chq-motion-color:\s*0ms/);
  });

  it('carries -webkit-tap-highlight-color: transparent', () => {
    expect(css).toMatch(/-webkit-tap-highlight-color:\s*transparent/);
  });

  it('narrows the generic a:hover off button-classed anchors', () => {
    expect(css).toMatch(/a:not\(\.chq-btn\):hover/);
    // The old unnarrowed selector -- a bare "a:hover" starting a rule's
    // selector list -- must be gone: it would have repainted a
    // .chq-btn-primary anchor's on-brand label to the hover brand on its
    // unchanged brand fill (dark-on-dark). A compound selector like
    // ".chq-nav a:hover" does not start the line with "a:hover", so it is
    // unaffected by this check.
    expect(css).not.toMatch(/^\s*a:hover\s*\{/m);
  });

  it('.chq-btn base rule transitions colour only (no transition:all, no ease-in/-out)', () => {
    const v = scanBans(raw);
    expect(v.transitionAll).toBe(false);
    expect(v.badProperties).toEqual([]);
    expect(v.easeIn).toBe(false);
    expect(v.easeInOut).toBe(false);
  });
});

describe('negative controls (DEC-989/DEC-941 doctrine: prove the matchers see a real violation)', () => {
  const banFixture = `
    .offender {
      transition: all 200ms ease-in-out;
    }
  `;

  it('flags transition: all', () => {
    expect(scanBans(banFixture).transitionAll).toBe(true);
  });

  it('flags a disallowed transitioned property', () => {
    const propFixture = `
      .offender-2 {
        transition: left 200ms ease-in-out, top 200ms ease-in-out;
      }
    `;
    expect(scanBans(propFixture).badProperties).toEqual(['left', 'top']);
  });

  it('flags ease-in-out', () => {
    expect(scanBans(banFixture).easeInOut).toBe(true);
  });

  it('flags bare ease-in', () => {
    const easeInFixture = `.offender-3 { transition: color 120ms ease-in; }`;
    expect(scanBans(easeInFixture).easeIn).toBe(true);
  });

  it('a clean fixture reports no ban violations', () => {
    const clean = `
      .fine {
        transition: background-color var(--chq-motion-color) var(--chq-ease-state);
      }
      @media (prefers-reduced-motion: reduce) {
        :root { --chq-motion-color: 0ms; }
      }
    `;
    const v = scanBans(clean);
    expect(v.transitionAll).toBe(false);
    expect(v.badProperties).toEqual([]);
    expect(v.easeIn).toBe(false);
    expect(v.easeInOut).toBe(false);
  });

  it('the *_CSS export matcher flags a real fixture and skips a plain constant', () => {
    const hasCss = `export const FOO_CSS = \`.a { color: red; }\`;`;
    const noCss = `export const FOO_BAR = 'not a stylesheet';`;
    expect(EXPORTS_CSS_CONST_RE.test(hasCss)).toBe(true);
    expect(EXPORTS_CSS_CONST_RE.test(noCss)).toBe(false);
  });
});
