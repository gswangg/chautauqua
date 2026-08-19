// Focus-treatment population scan (DEC-409, wave: the speakers focus-ring
// defect).
//
// DEC-409 says "The 2px olive focus ring is declared in both stylesheet
// roots, and no rule may remove an outline". Two halves of that were never
// scanned, and a user found the gap on the v12 speakers surfaces:
//
//   1. Declaring the ring is not enough. A control the browser DRAWS ITSELF
//      -- a checkbox, a radio, a select left on the platform's own widget --
//      also draws the PLATFORM's own focus treatment, inside the house ring.
//      That is the "native focus ring" an organizer reads on the page: the
//      task view's row selectors were the last browser-drawn controls in the
//      product (`accent-color` tints a native widget, it does not replace
//      it), so a keyboard tab painted an OS box with its own inner edge
//      wrapped in the olive square. The house ring can only be the ONLY
//      focus mark on a control the design system draws.
//
//   2. Nothing checked that a NEW SSR surface reaches THEME_CSS at all. The
//      SPA has one root (app/src/main.tsx imports styles.css once, so every
//      route inherits it); the SSR half has one shell per surface family,
//      each of which must inline <ThemeStyles /> itself. A shell that forgot
//      would ship a whole surface with no focus ring and no tokens -- the
//      same class of bug c1915812 fixed inside the SPA when TaskView loaded
//      its own stylesheet only.
//
// Populations are DERIVED (DEC-808 idiom), never hand-listed: the CSS roots
// are named because there are exactly two of them and DEC-409 names them;
// every other population walks the tree. Exemptions are comments sitting in
// the file they exempt, never an allowlist in this test.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ssrCssSources } from '../../test/helpers/ssr-css-sources';

const HERE = dirname(fileURLToPath(import.meta.url)); // app/src
const REPO_ROOT = join(HERE, '..', '..');
const SRC_DIR = join(REPO_ROOT, 'src');

/** The SPA stylesheet root -- app/src/main.tsx imports it once for every
 * route, so this file is the SPA's whole focus vocabulary. */
const SPA_ROOT = join(HERE, 'styles.css');
/** The SSR stylesheet root -- src/views/theme.ts's THEME_CSS (DEC-371), one
 * inlined string shared by every SSR surface. */
const SSR_ROOT = join(SRC_DIR, 'views', 'theme.ts');

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** THEME_CSS's own text, so the SSR root is read as CSS rather than as TS. */
function themeCssText(): string {
  const source = readFileSync(SSR_ROOT, 'utf8');
  const match = /export const THEME_CSS = `([\s\S]*?)`;/.exec(source);
  const css = match?.[1];
  if (css === undefined) throw new Error('THEME_CSS template literal not found in src/views/theme.ts');
  return css;
}

interface CssRule {
  selector: string;
  body: string;
}

/** Every `selector { body }` pair, comments stripped and attribute-selector
 * quoting normalised (`input[type='checkbox']` in the SPA sheet vs
 * `input[type=checkbox]` in THEME_CSS name the same control). */
function rules(css: string): CssRule[] {
  const out: CssRule[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  const text = stripComments(css);
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const rawSelector = match[1] ?? '';
    const selector = rawSelector.replace(/\[([^\]]*)\]/g, (_all, inner: string) => `[${inner.replace(/['"]/g, '')}]`);
    out.push({ selector: selector.trim().replace(/\s+/g, ' '), body: match[2] ?? '' });
  }
  return out;
}

const ROOTS: ReadonlyArray<{ label: string; css: string }> = [
  { label: 'app/src/styles.css (SPA root)', css: readFileSync(SPA_ROOT, 'utf8') },
  { label: 'src/views/theme.ts THEME_CSS (SSR root)', css: themeCssText() },
];

describe('focus treatment: the design ring is declared in both stylesheet roots (DEC-409)', () => {
  for (const root of ROOTS) {
    it(`${root.label} declares the 2px olive :focus-visible ring`, () => {
      const ring = rules(root.css).find(
        (rule) => rule.selector === ':focus-visible' && /outline:\s*2px\s+solid\s+var\(--chq-brand\)/.test(rule.body),
      );
      expect(ring, `no bare ':focus-visible { outline: 2px solid var(--chq-brand) }' rule in ${root.label}`).toBeTruthy();
      expect(ring?.body, `${root.label}'s focus ring must carry the 2px offset the other root uses`).toMatch(
        /outline-offset:\s*2px/,
      );
    });
  }
});

// A control the browser draws itself also draws the browser's own focus
// treatment. These are the families that would otherwise ship a platform
// widget -- a select's OS caret box, a checkbox's OS tick box, a radio's OS
// dot -- so each root must take all three over with appearance:none. Text
// inputs, textareas, date and file inputs are NOT in this list: their focus
// affordance is the outline on a plain box, which the ring above already
// owns, and appearance:none on a date/file input would strip the picker
// affordance itself.
const BROWSER_DRAWN_CONTROLS = ['select', 'input[type=checkbox]', 'input[type=radio]'] as const;

describe('focus treatment: no root leaves a browser-drawn control to paint its own ring', () => {
  for (const root of ROOTS) {
    for (const control of BROWSER_DRAWN_CONTROLS) {
      it(`${root.label} takes over ${control}`, () => {
        const taken = rules(root.css).some(
          (rule) =>
            rule.selector
              .split(',')
              .map((part) => part.trim())
              .includes(control) && /(^|[^-])appearance:\s*none/.test(rule.body),
        );
        expect(
          taken,
          `${control} is still a platform widget in ${root.label} -- it will draw the OS focus treatment inside the house ring`,
        ).toBe(true);
      });
    }
  }
});

/** Every app/src stylesheet plus every SSR *_CSS module -- the whole CSS
 * population, derived on both sides. */
function allCssSources(): Array<{ path: string; text: string }> {
  const out: Array<{ path: string; text: string }> = [];
  for (const entry of readdirSync(HERE, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.css')) continue;
    const full = join(entry.parentPath, entry.name);
    out.push({ path: relative(REPO_ROOT, full), text: readFileSync(full, 'utf8') });
  }
  for (const source of ssrCssSources()) {
    out.push({ path: relative(REPO_ROOT, source.path), text: source.text });
  }
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

describe('focus treatment: no rule removes a focus outline (DEC-409)', () => {
  it('no :focus / :focus-visible rule anywhere sets outline: none or 0', () => {
    const offenders: string[] = [];
    for (const source of allCssSources()) {
      for (const rule of rules(source.text)) {
        if (!rule.selector.includes(':focus')) continue;
        if (!/outline(?:-style)?:\s*(none|0)\b/.test(rule.body)) continue;
        offenders.push(`${source.path}: ${rule.selector}`);
      }
    }
    expect(offenders, `focus rules that strip the ring:\n${offenders.join('\n')}`).toEqual([]);
  });
});

/** Every module under src/ that emits a whole HTML document. A shell that
 * ships a surface must inline the SSR root, directly (<ThemeStyles />) or
 * through the shared wrapper that does (<BaseStyles />, public/shell.tsx).
 * A document that legitimately carries no design system says so in its own
 * text with a `focus-treatment-exempt:` comment. */
function documentShells(): Array<{ path: string; text: string }> {
  const out: Array<{ path: string; text: string }> = [];
  for (const entry of readdirSync(SRC_DIR, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) continue;
    const full = join(entry.parentPath, entry.name);
    const text = readFileSync(full, 'utf8');
    if (!/<html\b/.test(text)) continue;
    out.push({ path: relative(REPO_ROOT, full), text });
  }
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

describe('focus treatment: every SSR document shell reaches the SSR root (DEC-371)', () => {
  it('finds the SSR shells by walking src/, not from a list', () => {
    // A guard on the guard: if this ever reads zero, the walk broke and the
    // assertion below would pass vacuously.
    expect(documentShells().length).toBeGreaterThan(5);
  });

  it('every document shell inlines THEME_CSS or names why it does not', () => {
    const offenders: string[] = [];
    for (const shell of documentShells()) {
      if (/ThemeStyles|BaseStyles/.test(shell.text)) continue;
      if (/focus-treatment-exempt:/.test(shell.text)) continue;
      offenders.push(shell.path);
    }
    expect(
      offenders,
      `SSR document shells with no THEME_CSS and no named exemption (a surface would ship with no focus ring):\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------
// Ring GEOMETRY (user-filed, v12 review). The treatment was right and the
// geometry was cramped: a bare-text control with no inline padding
// shrink-wraps its focus outline (and any hover box) around the glyphs,
// which is what read as a native ring in the first place. The house answer
// is equal-and-opposite cancelled padding -- `padding-inline: N` cancelled
// by `margin-inline: -N` -- so the ring and the hit box gain N px while no
// glyph moves and no layout rhythm shifts, plus the control radius so the
// ring is rounded rather than a hard rectangle.
//
// These pins hold the two halves that can silently break:
//   1. the pair must stay EQUAL and OPPOSITE. A padding without its
//      cancellation moves every glyph in the row; a cancellation without
//      its padding is a control reaching into its neighbours for nothing.
//   2. the ring must be rounded from the shared control token, never a
//      hand-written radius.
// The third half -- adjacent siblings whose separation the cancellation
// eats -- cannot be read off CSS text (it needs layout), so it is measured
// in the browser instead: scratchpad harness collide.mjs flags any two
// focusable controls whose boxes end up less than 2px apart. That is the
// check that caught the two-session identity cell regression.
// ---------------------------------------------------------------------
interface IdiomFamily {
  readonly root: string;
  readonly selector: string;
  readonly px: number;
}

const CANCELLED_PADDING_FAMILIES: readonly IdiomFamily[] = [
  { root: 'app/src/styles.css (SPA root)', selector: '.chq-link-button', px: 6 },
  { root: 'app/src/styles.css (SPA root)', selector: '.chq-btn-tertiary', px: 6 },
  { root: 'src/views/theme.ts THEME_CSS (SSR root)', selector: '.chq-btn-tertiary', px: 6 },
];

function ruleFor(rootLabel: string, selector: string): CssRule | undefined {
  const root = ROOTS.find((r) => r.label === rootLabel);
  if (!root) throw new Error(`no stylesheet root labelled ${rootLabel}`);
  return rules(root.css).find((rule) =>
    rule.selector
      .split(',')
      .map((part) => part.trim())
      .includes(selector),
  );
}

/** The inline (left/right) padding a rule declares, via either the
 * `padding` shorthand's second value or `padding-inline`. */
function inlinePadding(body: string): number | null {
  const inline = /padding-inline:\s*(-?\d+)px/.exec(body);
  if (inline) return Number(inline[1]);
  const shorthand = /padding:\s*(?:0|-?[\d.]+(?:px|rem))\s+(-?\d+)px\s*;/.exec(body);
  if (shorthand) return Number(shorthand[1]);
  return null;
}

function inlineMargin(body: string): number | null {
  const inline = /margin-inline:\s*(-?\d+)px/.exec(body);
  return inline ? Number(inline[1]) : null;
}

describe('focus treatment: the cancelled-padding idiom stays equal and opposite', () => {
  for (const family of CANCELLED_PADDING_FAMILIES) {
    it(`${family.selector} in ${family.root} pads ${family.px}px inline and cancels it exactly`, () => {
      const rule = ruleFor(family.root, family.selector);
      expect(rule, `${family.selector} has no own rule in ${family.root}`).toBeTruthy();
      const padding = inlinePadding(rule!.body);
      const margin = inlineMargin(rule!.body);
      expect(padding, `${family.selector} declares no inline padding -- its ring will shrink-wrap the glyphs`).toBe(
        family.px,
      );
      expect(
        margin,
        `${family.selector} pads ${String(padding)}px inline but does not cancel it -- every glyph in its row moves`,
      ).toBe(-family.px);
    });
  }

  it('the SPA quiet-action families round their ring from the shared control token', () => {
    for (const selector of ['.chq-link-button']) {
      const rule = ruleFor('app/src/styles.css (SPA root)', selector);
      expect(rule?.body, `${selector} draws a hard-cornered ring`).toMatch(/border-radius:\s*var\(--chq-r-ctl\)/);
    }
    // .chq-btn-tertiary inherits the same token through .chq-btn, which
    // every instance carries (no bare .chq-btn-tertiary exists in the app).
    const btn = ruleFor('app/src/styles.css (SPA root)', '.chq-btn');
    expect(btn?.body).toMatch(/border-radius:\s*var\(--chq-r-ctl\)/);
  });
});
