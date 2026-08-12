// w6-h: the desktop-leak bug class (a phone-only block with no top-level
// display:none, so it renders unstyled underneath the desktop layout —
// verified twice already: .chq-contacts-pipeline-phone-list in
// ContactsApp.newContact.render.test.tsx, and every .chq-phone-* rule in
// app/src/pages/agenda/agenda.css, which this test's first run caught
// unwrapped at top level with real flex/grid display values and no @media
// gate at all). jsdom does not evaluate @media rules or apply external
// stylesheets (mirroring app/src/shell-geometry.test.ts and
// ContactsApp.newContact.render.test.tsx), so this is a source-scan: every
// *.css under app/src/** plus the SSR stylesheet template-literal modules
// (*.css.ts under src/routes/**) is read as text, and every class selector
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
const ROUTES_SRC = join(HERE, '..', '..', 'src', 'routes');

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

const PHONE_SELECTOR_RE = /\.[A-Za-z0-9_-]*phone[A-Za-z0-9_-]*/g;

interface CssSource {
  file: string;
  css: string;
}

function loadSources(): CssSource[] {
  const sources: CssSource[] = [];
  for (const file of walk(APP_SRC, '.css')) {
    sources.push({ file, css: stripComments(readFileSync(file, 'utf-8')) });
  }
  for (const file of walk(ROUTES_SRC, '.css.ts')) {
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
  it('found at least 5 phone-named selectors across app/src/**/*.css and src/routes/**/*.css.ts (regex sanity floor)', () => {
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
      }
    });
  }
});
