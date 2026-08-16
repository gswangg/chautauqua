// DEC-383 (wave-58 amendment): V11's interaction-state and motion standard
// (docs/design/DESIGN-RULINGS.md:108-177, "B8 — Interaction-states
// standard") bans `transition: all` (it catches the focus ring and any
// layout property along for the ride), restricts every transitioned
// property to the colour-only set the spec actually animates, bans
// `ease-in`/`ease-in-out` (only `ease-out` for state and the geometry
// cubic-bezier are in the palette), and requires a
// `prefers-reduced-motion: reduce` block that re-binds the duration
// tokens rather than adding a parallel rule set.
//
// The population is every stylesheet the SPA bundles: app/src/**/*.css,
// found via readdirSync (a PROPERTY of the tree), never a hand-listed
// manifest (DEC-367/DEC-808 doctrine — a directory sweep that misses a
// file that exports the same shape is not a population; here the
// population genuinely IS "every .css under app/src", so the recursive
// sweep is complete by construction).
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_SRC = HERE;

/** Every .css file under `root`, found via recursive readdirSync. */
function allCssFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.css')) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
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
    // Split on top-level commas (multiple transitions), then take the
    // first whitespace-delimited token of each as the property name.
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

function scan(css: string): Violations {
  const withoutComments = stripComments(css);
  return {
    transitionAll: TRANSITION_ALL_RE.test(withoutComments),
    badProperties: transitionedProperties(withoutComments).filter((p) => !ALLOWED_TRANSITION_PROPERTIES.has(p)),
    easeIn: EASE_IN_RE.test(withoutComments),
    easeInOut: EASE_IN_OUT_RE.test(withoutComments),
  };
}

describe('SPA interaction-state / motion standard (DEC-383, wave-58 amendment)', () => {
  const files = allCssFiles(APP_SRC);

  it('found more than 20 stylesheets under app/src (sanity check on the enumeration)', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  for (const file of files) {
    const rel = relative(join(APP_SRC, '..', '..'), file);
    const css = readFileSync(file, 'utf-8');
    const v = scan(css);

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

  it('app/src/styles.css declares a prefers-reduced-motion block', () => {
    const stylesPath = join(APP_SRC, 'styles.css');
    const css = stripComments(readFileSync(stylesPath, 'utf-8'));
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  });

  describe('negative control (DEC-989/DEC-941 wave-56 doctrine: prove the matcher sees a real violation)', () => {
    const fixture = `
      .offender {
        transition: all 200ms ease-in-out;
      }
    `;

    it('flags transition: all', () => {
      expect(scan(fixture).transitionAll).toBe(true);
    });

    it('flags the disallowed implicit property set (transition: all names no property, so the property check is exercised by a second fixture)', () => {
      const propFixture = `
        .offender-2 {
          transition: left 200ms ease-in-out, top 200ms ease-in-out;
        }
      `;
      expect(scan(propFixture).badProperties).toEqual(['left', 'top']);
    });

    it('flags ease-in-out', () => {
      expect(scan(fixture).easeInOut).toBe(true);
    });

    it('flags bare ease-in', () => {
      const easeInFixture = `.offender-3 { transition: color 120ms ease-in; }`;
      expect(scan(easeInFixture).easeIn).toBe(true);
    });

    it('a clean fixture reports no violations', () => {
      const clean = `
        .fine {
          transition: background-color var(--chq-motion-color) var(--chq-ease-state);
        }
        @media (prefers-reduced-motion: reduce) {
          :root { --chq-motion-color: 0ms; }
        }
      `;
      const v = scan(clean);
      expect(v.transitionAll).toBe(false);
      expect(v.badProperties).toEqual([]);
      expect(v.easeIn).toBe(false);
      expect(v.easeInOut).toBe(false);
    });
  });

  // wave-64 (DEC-851 applied to motion tokens): a declared duration/easing
  // token with no reader is a lie -- the -exit trio (color-exit/appear-
  // exit/geometry-exit) sat unread from wave-58 through wave-63 before
  // being deleted in this wave. Every --chq-motion-*/--chq-ease-* token
  // DECLARED in the :root block must appear as a var(...) consumer
  // somewhere else under app/src, or the declaration is dead and should be
  // deleted instead of carried forward.
  describe('every declared --chq-motion-*/--chq-ease-* token has a reader (DEC-851 wave-64)', () => {
    const stylesPath = join(APP_SRC, 'styles.css');
    const rawCss = readFileSync(stylesPath, 'utf-8');
    const css = stripComments(rawCss);

    // Declarations: `--chq-motion-foo: ...;` inside the :root block, not a
    // var(--chq-motion-foo) consumption site.
    const DECLARATION_RE = /--(chq-motion-[a-z-]+|chq-ease-[a-z-]+)\s*:/g;
    // Consumption: var(--chq-motion-foo) or var(--chq-motion-foo, fallback).
    const CONSUMPTION_RE = /var\(\s*--(chq-motion-[a-z-]+|chq-ease-[a-z-]+)\s*[,)]/g;

    function declaredTokens(source: string): Set<string> {
      const out = new Set<string>();
      let m: RegExpExecArray | null;
      const re = new RegExp(DECLARATION_RE);
      while ((m = re.exec(source)) !== null) out.add(m[1]!);
      return out;
    }

    function consumedTokens(source: string): Set<string> {
      const out = new Set<string>();
      let m: RegExpExecArray | null;
      const re = new RegExp(CONSUMPTION_RE);
      while ((m = re.exec(source)) !== null) out.add(m[1]!);
      return out;
    }

    // All app/src CSS files feed the "does anything read this?" question --
    // a token declared in styles.css can legitimately be spent in a page
    // stylesheet like review.css, not only in styles.css itself.
    const allSpaCss = allCssFiles(APP_SRC)
      .map((f) => stripComments(readFileSync(f, 'utf-8')))
      .join('\n');

    const declared = declaredTokens(css);
    const consumed = consumedTokens(allSpaCss);

    it('the declared-token population is non-empty (sanity check on the regex)', () => {
      expect(declared.size).toBeGreaterThan(0);
    });

    for (const token of [...declared].sort()) {
      it(`--${token} declared in styles.css has at least one var() reader under app/src`, () => {
        expect(consumed.has(token)).toBe(true);
      });
    }

    it('negative control: a declared-but-unread token makes this check fail (DEC-989/DEC-941 doctrine)', () => {
      const declaredOnly = declaredTokens(':root { --chq-motion-unread-fixture: 999ms; }');
      const consumedElsewhere = consumedTokens('.thing { color: blue; }');
      expect(consumedElsewhere.has([...declaredOnly][0]!)).toBe(false);
    });
  });
});
