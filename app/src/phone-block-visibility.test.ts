// w6-h: the desktop-leak bug class (a phone-only block with no top-level
// display:none, so it renders unstyled underneath the desktop layout —
// verified twice already: .chq-contacts-pipeline-phone-list in
// ContactsApp.newContact.render.test.tsx, and every .chq-phone-* rule in
// app/src/pages/agenda/agenda.css, which this test's first run caught
// unwrapped at top level with real flex/grid display values and no @media
// gate at all). jsdom does not evaluate @media rules or apply external
// stylesheets (mirroring app/src/shell-geometry.test.ts and
// ContactsApp.newContact.render.test.tsx), so this is a source-scan: every
// *.css under app/src/** plus every SSR stylesheet template-literal module
// under src/** (derived from source content -- any module whose text
// exports a CSS template-literal constant, DEC-808; not a `.css.ts`
// filename convention, which misses src/views/theme.ts) is read as text,
// and every class selector
// containing a `phone` segment must either have NO top-level (outside any
// @media) rule at all — meaning it only exists inside a phone-width query
// and inherits its parent's hidden state — or its top-level rule must
// declare `display: none` and no other display value.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_SRC = HERE;
// DEC-808 (wave-96 finding): rooting only at src/routes misses src/views/**
// entirely -- src/views/theme.ts (THEME_CSS) is loaded by every SSR surface
// and was invisible to this scan. Repointed at src/ so the same walk covers
// both src/routes/**/*.css.ts and src/views/**/*.css.ts (and any future
// sibling) instead of a hand-listed subdirectory.
const ROUTES_SRC = join(HERE, '..', '..', 'src');

/** Selectors that are genuinely rendered (and thus must be visible) at
 * BOTH desktop and phone widths, so they are exempt from the top-level
 * hidden-or-absent rule. Each entry names the reason so the exemption is
 * reviewable, not a silent escape hatch. */
export const NOT_PHONE_ONLY: Array<[selector: string, reason: string]> = [];

function walk(dir: string, suffix: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p, suffix));
    else if (entry.endsWith(suffix)) out.push(p);
  }
  return out;
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Strips every top-level @media {...} block, mirroring shell-geometry.
 * test.ts / ContactsApp.newContact.render.test.tsx's topLevelRuleBody
 * helper (one level of nested braces inside @media). */
function stripMedia(css: string): string {
  return css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\}[^{}]*)*\}/g, '');
}

/** All declaration bodies of rules whose selector text is immediately
 * followed by `{` (i.e. the selector is standalone, or the last entry in a
 * comma-separated list) outside any @media block. Empty array means the
 * selector has no top-level rule at all. */
function topLevelRuleBodies(withoutMediaCss: string, selector: string): string[] {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'g');
  const bodies: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(withoutMediaCss))) {
    const body = m[1];
    if (body !== undefined) bodies.push(body);
  }
  return bodies;
}

/** Extracts the body text of every @media block in the source whose
 * condition mentions a phone-width max-width breakpoint (700px or 900px,
 * the two breakpoints used across app/src/**). Mirrors stripMedia's one-
 * level-of-nesting brace matching, but keeps the block body instead of
 * discarding it. */
function extractPhoneMediaBodies(css: string): string {
  const re = /@media([^{]*)\{((?:[^{}]*\{[^{}]*\}[^{}]*)*)\}/g;
  let out = '';
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    const condition = m[1];
    const body = m[2];
    if (
      condition !== undefined &&
      body !== undefined &&
      /max-width:\s*(700|900)px/.test(condition)
    ) {
      out += `${body}\n`;
    }
  }
  return out;
}

/** Whether `selector` has at least one rule (standalone, or last in a
 * comma-separated list) inside `cssText`. Reuses topLevelRuleBodies'
 * regex shape rather than adding a second parser. */
function hasRuleFor(cssText: string, selector: string): boolean {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`${escaped}\\s*\\{`);
  return re.test(cssText);
}

const PHONE_SELECTOR_RE = /\.[A-Za-z0-9_-]*phone[A-Za-z0-9_-]*/g;

/** Selectors that top-level-hide with `display: none` but genuinely have
 * no rule of their own inside any phone media query in the same file —
 * e.g. because their phone-width visibility rule lives on a compound
 * selector (a parent or sibling) rather than the bare class. Each entry
 * names the reason so the exemption is reviewable, not a silent escape
 * hatch. Empty is the preferred/expected state. */
export const NO_PHONE_RULE_OK: Array<[selector: string, reason: string]> = [
  [
    '.chq-comms-phone-landing',
    'DEC-621: the base selector never gets its own phone-width display rule — ' +
      'Comms.tsx (line ~251) always renders the element with a second class, ' +
      "chq-comms-phone-landing-show, added alongside it before the visitor picks a " +
      'destination; that co-applied class carries the display:flex rule inside the ' +
      '700px media query. Verified end-to-end in Comms.phone.render.test.tsx.',
  ],
];
const NO_PHONE_RULE_OK_SELECTORS = new Set(NO_PHONE_RULE_OK.map(([selector]) => selector));

interface CssSource {
  file: string;
  css: string;
}

// DEC-808: population derived from module SOURCE (does it export a CSS
// template-literal constant?), not from a `.css.ts` filename convention --
// src/views/theme.ts exports THEME_CSS without that suffix and a filename
// glob silently drops it.
function cssExportFiles(root: string): string[] {
  return walk(root, '.ts').filter((file) => !file.includes('.test.') && !file.endsWith('.css.ts.d.ts'));
}

function loadSources(): CssSource[] {
  const sources: CssSource[] = [];
  for (const file of walk(APP_SRC, '.css')) {
    sources.push({ file, css: stripComments(readFileSync(file, 'utf-8')) });
  }
  for (const file of cssExportFiles(ROUTES_SRC)) {
    const raw = readFileSync(file, 'utf-8');
    const match = raw.match(/export const \w+_CSS = `([\s\S]*?)`;/);
    const body = match?.[1];
    if (body === undefined) continue; // no exported CSS template literal in this file
    sources.push({ file, css: stripComments(body) });
  }
  return sources;
}

const SOURCES = loadSources();
const NOT_PHONE_ONLY_SELECTORS = new Set(NOT_PHONE_ONLY.map(([selector]) => selector));

describe('phone-block visibility invariant (w6-h)', () => {
  it('the CSS-export module population is derived from source content, not a filename glob (DEC-808)', () => {
    // Measured on main: 16 modules export a CSS template-literal constant
    // under src/ (15 *.css.ts sheets plus src/views/theme.ts).
    expect(cssExportFiles(ROUTES_SRC).length).toBeGreaterThanOrEqual(15);
  });

  it('the CSS-export module population includes src/views/theme.ts (positive control)', () => {
    expect(cssExportFiles(ROUTES_SRC).some((p) => p.endsWith(join('src', 'views', 'theme.ts')))).toBe(true);
  });

  it('found at least 5 phone-named selectors across app/src/**/*.css and src/**/*.css.ts (regex sanity floor)', () => {
    const all = new Set<string>();
    for (const { css } of SOURCES) {
      for (const m of css.match(PHONE_SELECTOR_RE) ?? []) all.add(m);
    }
    expect(all.size).toBeGreaterThanOrEqual(5);
  });

  for (const { file, css } of SOURCES) {
    const selectors = new Set(css.match(PHONE_SELECTOR_RE) ?? []);
    if (selectors.size === 0) continue;
    const withoutMedia = stripMedia(css);
    const phoneMediaBodies = extractPhoneMediaBodies(css);

    describe(file, () => {
      for (const selector of selectors) {
        it(`${selector} is hidden-or-absent at top level (or allowlisted)`, () => {
          if (NOT_PHONE_ONLY_SELECTORS.has(selector)) {
            return; // exempt: genuinely rendered at both widths, see NOT_PHONE_ONLY
          }
          const bodies = topLevelRuleBodies(withoutMedia, selector);
          if (bodies.length === 0) {
            return; // no top-level rule at all: inherits its parent's hidden state
          }
          const combined = bodies.join('\n');
          const displayDeclarations = combined.match(/display:\s*[^;]+/g) ?? [];
          expect(
            displayDeclarations.length > 0,
            `${file}: ${selector} has a top-level rule with no display declaration ` +
              `(body: ${JSON.stringify(combined)}) — a phone-only class must be ` +
              `display:none at top level or have no top-level rule at all`,
          ).toBe(true);
          for (const decl of displayDeclarations) {
            expect(
              decl.trim(),
              `${file}: ${selector}'s top-level rule declares "${decl.trim()}" ` +
                `instead of "display: none" — desktop will render this phone-only block`,
            ).toMatch(/^display:\s*none$/);
          }
        });

        it(`${selector}'s top-level display:none is switched back on inside a phone media query (or allowlisted)`, () => {
          if (NOT_PHONE_ONLY_SELECTORS.has(selector) || NO_PHONE_RULE_OK_SELECTORS.has(selector)) {
            return; // exempt: see NOT_PHONE_ONLY / NO_PHONE_RULE_OK
          }
          const bodies = topLevelRuleBodies(withoutMedia, selector);
          const combined = bodies.join('\n');
          const topLevelHidesIt = /display:\s*none\s*(;|$)/.test(combined);
          if (!topLevelHidesIt) {
            return; // nothing to switch back on: no top-level display:none rule
          }
          expect(
            hasRuleFor(phoneMediaBodies, selector),
            `${file}: ${selector} is display:none at top level but has no rule of its ` +
              `own inside any phone media query (max-width: 700px|900px) in this file — ` +
              `it is hidden at every width, not just desktop. Either add its phone-width ` +
              `rule inside the existing media block, or add a reasoned entry to ` +
              `NO_PHONE_RULE_OK if its visibility rule genuinely lives on a compound ` +
              `selector instead.`,
          ).toBe(true);
        });
      }
    });
  }
});
