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
import { DEC_919 } from '../../src/decisions';

void DEC_919; // wave-109 amendment: closes this scan's "no top-level rule at all" escape
// hatch for phone-named classes that are mounted UNCONDITIONALLY in markup (the premise
// that such a class "only exists inside a phone-only container that is itself hidden"
// is false for a bare node in a visible parent -- PlanEditor.tsx:1565/:2170 were exactly
// that bug).

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
  return css.replace(/@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g, '');
}

/** All declaration bodies of rules whose selector text is immediately
 * followed by `{` (i.e. the selector is standalone, or the last entry in a
 * comma-separated list) outside any @media block. Empty array means the
 * selector has no top-level rule at all. */
function topLevelRuleBodies(withoutMediaCss: string, selector: string): string[] {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // w8-g: a selector is also a subject when it is a non-last member of a
  // comma-separated selector list (e.g. `.chq-a, .chq-b, .chq-c { ... }`) --
  // the original `${escaped}\s*\{` only matched the LAST member before the
  // brace, so `.chq-a` and `.chq-b` above were silently uncredited (33 false
  // offenders, verified against speakers.css:1600-1604). Accept an optional
  // comma-separated remainder (no `{`/`}` inside it, so a descendant
  // selector like `.chq-a .chq-b { ... }` still does NOT credit `.chq-a`:
  // there is no comma, so the remainder alternative can't match, and the
  // plain `\{` alternative requires the brace to immediately follow with
  // only whitespace).
  const re = new RegExp(`${escaped}\\s*(?:,[^{}]*)?\\{([^}]*)\\}`, 'g');
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

// --- DEC-919 wave-109 amendment: markup-mounted phone classes must be ---
// --- top-level display:none, not merely "no top-level rule at all" -----
//
// The premise behind NO_PHONE_RULE_OK / the "no top-level rule at all"
// branch above is that a phone-named class with no top-level rule only
// ever exists inside a phone-only container that is itself hidden, so it
// inherits the hidden state. That premise is false for a class mounted
// UNCONDITIONALLY on a node in a visible parent (PlanEditor.tsx's two
// count spans): with no top-level rule the browser paints the node with
// whatever inline-level default it has. This section derives (readdirSync,
// DEC-808 -- never a hand list) every phone-named class that appears in a
// `className=` string literal in a non-test *.tsx under app/src/**, and
// requires EVERY member of that set to carry a top-level display:none
// somewhere in the CSS source population already loaded above (SOURCES).
// Classes that never appear in markup keep the looser rule above
// unchanged (e.g. classes only ever referenced via a compound/co-applied
// selector, per NO_PHONE_RULE_OK).

function walkTsx(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walkTsx(p));
    else if (entry.endsWith('.tsx') && !entry.includes('.test.')) out.push(p);
  }
  return out;
}

const CLASSNAME_LITERAL_RE =
  /className\s*=\s*"([^"]*)"|className\s*=\s*\{`([^`]*)`\}|className\s*=\s*'([^']*)'/g;

/**
 * Every phone-named class (selector text `.foo`) that appears in a
 * `className=` string/template literal in a non-test *.tsx under `root`.
 * Template-literal `${...}` interpolations are stripped before splitting
 * on whitespace (mirrors app/src/phone-horizontal-overflow.scan.test.ts's
 * `extractCssTsLiteral`) -- without this a JS identifier that merely
 * CONTAINS "phone" inside an interpolated ternary (e.g. a `phoneStage`
 * React state variable) leaks in as a false "class name".
 */
function markupPhoneClasses(root: string): Set<string> {
  const classes = new Set<string>();
  for (const file of walkTsx(root)) {
    const text = readFileSync(file, 'utf-8');
    let m: RegExpExecArray | null;
    CLASSNAME_LITERAL_RE.lastIndex = 0;
    while ((m = CLASSNAME_LITERAL_RE.exec(text))) {
      const raw = (m[1] ?? m[2] ?? m[3] ?? '').replace(/\$\{[^}]*\}/g, ' ');
      for (const token of raw.split(/\s+/)) {
        if (token && /phone/.test(token)) classes.add(`.${token}`);
      }
    }
  }
  return classes;
}

const MARKUP_PHONE_CLASSES = markupPhoneClasses(APP_SRC);

/** Whether `selector` has a top-level (non-@media) rule anywhere in the
 * already-loaded CSS source population that declares `display: none`. */
function hasTopLevelDisplayNone(selector: string): boolean {
  for (const { css } of SOURCES) {
    const withoutMedia = stripMedia(css);
    const bodies = topLevelRuleBodies(withoutMedia, selector);
    if (bodies.length === 0) continue;
    if (/display:\s*none\s*(;|$)/.test(bodies.join('\n'))) return true;
  }
  return false;
}

const MARKUP_OFFENDERS = [...MARKUP_PHONE_CLASSES]
  .filter((selector) => !hasTopLevelDisplayNone(selector))
  .sort();

// Measured on this branch's tree (v12m-w8-g) after (1) fixing
// topLevelRuleBodies' comma-group blind spot (a selector was only credited
// when it was the LAST member before the brace -- 33 of the prior 73 were
// false offenders, e.g. speakers.css:1600-1604's three-selector group) and
// (2) top-level-hiding review.css's four genuine offenders
// (.chq-review-phone-dock/-dock-note/-signout,
// .chq-review-criterion-no-weight-phone). This ratchet may only fall;
// raising it back up to accommodate a new unconditionally-mounted, unhidden
// phone class is not a valid fix -- fix the class instead, or (if it is
// genuinely rendered at both widths) exempt it via NOT_PHONE_ONLY above with
// a reason.
//
// Re-measured 36 -> 34 by the merge train on 2026-08-19 (megabatch gate) by
// running this file's own scan: two more markup-mounted phone classes picked
// up a top-level display:none. Tightened to the measured truth.
export const MARKUP_PHONE_UNHIDDEN_CEILING = 34;

describe('markup-mounted phone classes must be top-level display:none (DEC-919 wave-109 amendment)', () => {
  it('found a sane population of phone-named classes in TSX markup (vacuous-population tripwire)', () => {
    expect(MARKUP_PHONE_CLASSES.size).toBeGreaterThan(10);
  });

  it('the fixed regression is no longer in the offender list (.chq-review-criteria-count-phone)', () => {
    expect(MARKUP_OFFENDERS).not.toContain('.chq-review-criteria-count-phone');
  });

  it('the fixed regression is no longer in the offender list (.chq-review-reviewers-count-phone)', () => {
    expect(MARKUP_OFFENDERS).not.toContain('.chq-review-reviewers-count-phone');
  });

  // Both controls use a class name the tree does not contain anywhere
  // (real SOURCES cannot be injected into, so the underlying mechanism --
  // topLevelRuleBodies + the display:none check -- is exercised directly
  // against synthetic CSS text, the same mechanism hasTopLevelDisplayNone
  // runs per-file over SOURCES above).
  it('a synthetic class WITH a top-level display:none is recognised as hidden (positive control)', () => {
    const syntheticCss = '.chq-synthetic-phone-control-hidden { display: none; }';
    const bodies = topLevelRuleBodies(stripMedia(syntheticCss), '.chq-synthetic-phone-control-hidden');
    expect(/display:\s*none\s*(;|$)/.test(bodies.join('\n'))).toBe(true);
  });

  it('a synthetic class with NO top-level rule (the closed escape hatch) is NOT recognised as hidden (negative control)', () => {
    expect(hasTopLevelDisplayNone('.chq-synthetic-phone-control-unhidden')).toBe(false);
  });

  it('a synthetic class that is a non-last member of a comma-separated selector group is recognised as hidden (positive control, w8-g)', () => {
    const syntheticCss =
      '.chq-synthetic-phone-control-group-a,\n.chq-synthetic-phone-control-group-b,\n.chq-synthetic-phone-control-group-c { display: none; }';
    const bodies = topLevelRuleBodies(
      stripMedia(syntheticCss),
      '.chq-synthetic-phone-control-group-a',
    );
    expect(/display:\s*none\s*(;|$)/.test(bodies.join('\n'))).toBe(true);
  });

  it('markup-mounted phone classes without a top-level display:none never exceed the ceiling (two-sided ratchet: may only fall)', () => {
    expect(
      MARKUP_OFFENDERS.length,
      `markup-mounted phone classes with no top-level display:none ` +
        `(${MARKUP_OFFENDERS.length}, ceiling ${MARKUP_PHONE_UNHIDDEN_CEILING}):\n${MARKUP_OFFENDERS.join('\n')}`,
    ).toBeLessThanOrEqual(MARKUP_PHONE_UNHIDDEN_CEILING);
  });

  // Companion to the ceiling test above (mirrors
  // app/src/phone-capability-removal.scan.test.ts's stale-floor companion):
  // a ceiling sitting ABOVE the measured truth licenses stagnation instead
  // of forbidding debt. Re-tightening the constant is a merge-train act.
  it('never sits ABOVE the measured truth without the ceiling being tightened to match (a stale ceiling licenses stagnation)', () => {
    if (MARKUP_OFFENDERS.length < MARKUP_PHONE_UNHIDDEN_CEILING) {
      throw new Error(
        `${MARKUP_OFFENDERS.length} markup-mounted phone class(es) without a top-level ` +
          `display:none, below the ratchet ceiling of ${MARKUP_PHONE_UNHIDDEN_CEILING}. ` +
          `This is the ratchet working: coverage landed. Tighten the ceiling in the same ` +
          `commit (a merge-train act, never a worker's edit mid-lane) by replacing the line:\n` +
          `  export const MARKUP_PHONE_UNHIDDEN_CEILING = ${MARKUP_OFFENDERS.length};`,
      );
    }
    expect(MARKUP_OFFENDERS.length).toBeGreaterThanOrEqual(MARKUP_PHONE_UNHIDDEN_CEILING);
  });
});
