// Control font vocabulary guard (DEC-577 amendment, DEC-808 wave-99
// amendment, task v12m-w2-d).
//
// font-family is not inherited into form controls (<button>, <input>,
// <select>, <textarea>) by any UA -- a class rule applied to one of those
// elements that sets a type register (font-size or font-weight) but never
// declares font-family silently computes the UA default face next to the
// app's Figtree/Familjen Grotesk neighbours the moment nothing upstream
// supplies one. This scan ENUMERATES (never hand-lists, per house
// convention) every `chq-…` class token applied to a <button>/<input>/
// <select>/<textarea> element anywhere in app/src/**/*.tsx, then checks
// every top-level rule in every CSS SOURCE in the DERIVED population below
// whose selector names one of those classes: if it declares font-size or
// font-weight without also declaring font-family (or the `font`
// shorthand), it is an offender.
//
// DEC-808 wave-99 amendment: the population used to be exactly ONE file,
// app/src/styles.css. That made every cluster sheet (review.css,
// settings.css, content.css, comms.css, contacts-panels.css,
// submissions.css, speakers.css, forms.css, overview.css, …) and every SSR
// sheet (src/views/theme.ts's THEME_CSS, src/routes/auth.css.ts,
// src/routes/public/cfp.css.ts, src/routes/docs-site.css.ts,
// src/routes/portal/portal.css.ts, src/routes/public/css/*.css.ts, …)
// invisible to this guard -- exactly the sheets the 44px-floor waves have
// been adding font-size/font-weight to. The population is now DERIVED:
// every `*.css` file under app/src, plus every module under src/ that
// EXPORTS a `*_CSS` template-literal string constant (found by reading
// exports, never a `src/**/*.css.ts` filename glob -- that glob drops
// src/views/theme.ts, which is plain .ts).
//
// This is deliberately per-class-rule, not "does the element compute a
// family via some other cascading rule" -- a class-level control-font
// contract is what keeps a class safe to use standalone (composed with
// other markup, moved to a new element) without silently regressing.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url)); // app/src
const REPO_ROOT = resolve(HERE, '..', '..');
const SRC_ROOT = join(REPO_ROOT, 'src');

/** Every file under `root` whose name ends with `ext` (recursive). */
function allFiles(root: string, ext: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith(ext)) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

/** Every *.tsx file under app/src, excluding test files. */
function allTsxFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.tsx')) continue;
    if (entry.name.includes('.test.')) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

const CONTROL_TAG_RE = /<(button|input|select|textarea)\b([^>]*)>/gs;

/**
 * Every distinct `chq-…` class token found in a className attribute of a
 * <button>/<input>/<select>/<textarea> tag, across a literal string
 * (`className="a b"`), a template literal, or a conditional expression
 * (any quoted/backtick-delimited literal segment inside a `{...}` value).
 */
function controlClassTokens(src: string): Set<string> {
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = CONTROL_TAG_RE.exec(src)) !== null) {
    const attrs = m[2] ?? '';
    const classNameMatch = attrs.match(/className\s*=\s*(\{[^}]*\}|"[^"]*"|`[^`]*`)/s);
    if (!classNameMatch) continue;
    const raw = classNameMatch[1]!;
    const literals =
      raw.startsWith('"') || raw.startsWith('`')
        ? [raw]
        : raw.match(/"[^"]*"|`[^`]*`/g) ?? [];
    for (const lit of literals) {
      for (const token of lit.replace(/[`"]/g, '').split(/\s+/).filter(Boolean)) {
        if (token.startsWith('chq-')) out.add(token);
      }
    }
  }
  return out;
}

/** Every top-level (not inside @media) `selector { body }` rule in a CSS text. */
function topLevelRules(css: string): Array<{ selector: string; body: string }> {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const withoutMedia = withoutComments.replace(
    /@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g,
    '',
  );
  const rules: Array<{ selector: string; body: string }> = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(withoutMedia)) !== null) {
    rules.push({ selector: (m[1] ?? '').trim(), body: m[2] ?? '' });
  }
  return rules;
}

/**
 * One CSS input: a label (the file path, for offender messages) plus the
 * literal CSS text to scan.
 */
type CssSource = { label: string; css: string };

/** Every `*.css` file under app/src -- a CSS source in its own right. */
function appSrcCssSources(): CssSource[] {
  return allFiles(HERE, '.css').map((path) => ({
    label: path,
    css: readFileSync(path, 'utf-8'),
  }));
}

const CSS_EXPORT_RE = /export const ([A-Za-z0-9_]*_CSS)\s*=\s*`([\s\S]*?)`;/;

/**
 * Every module under src/ that EXPORTS a `*_CSS` template-literal string
 * constant. Derived by reading exports, never a `src/**\/*.css.ts` filename
 * glob -- src/views/theme.ts exports THEME_CSS and is plain .ts, so a glob
 * on the `.css.ts` suffix silently drops it (DEC-808 wave-99 amendment).
 */
function srcCssExportSources(): CssSource[] {
  const out: CssSource[] = [];
  const candidates = allFiles(SRC_ROOT, '.ts').concat(allFiles(SRC_ROOT, '.tsx'));
  for (const path of candidates) {
    if (path.includes('.test.')) continue;
    const src = readFileSync(path, 'utf-8');
    const m = CSS_EXPORT_RE.exec(src);
    if (!m) continue;
    // The captured body is the literal CSS text of the exported constant,
    // verbatim (including any `${OTHER_CSS}` interpolation tokens -- those
    // name another module's own exported constant, itself enumerated and
    // scanned separately as that file, so leaving the token in place here
    // never double-counts a rule: `${...}` never matches the rule regex).
    out.push({ label: path, css: m[2]! });
  }
  return out;
}

describe('control font vocabulary contract (DEC-577 amendment, DEC-808 wave-99 amendment)', () => {
  const TSX_FILES = allTsxFiles(HERE);
  const APP_CSS_SOURCES = appSrcCssSources();
  const SRC_CSS_SOURCES = srcCssExportSources();
  const ALL_CSS_SOURCES = [...APP_CSS_SOURCES, ...SRC_CSS_SOURCES];

  it('found more than one tsx file to scan', () => {
    // Guards the enumeration itself: if readdirSync ever returned nothing,
    // the control-class set below would be empty and every assertion
    // would vacuously pass.
    expect(TSX_FILES.length).toBeGreaterThan(5);
  });

  it('the derived CSS population is not smaller than the single-file population it replaced, and names both known members', () => {
    // Vacuous-population tripwire (DEC-808 wave-99 amendment): before this
    // wave the population was exactly 1 file (styles.css). If a future
    // refactor breaks the export-derivation and it silently falls back to
    // near-nothing, this catches it before the offender scan below goes
    // vacuously green.
    expect(ALL_CSS_SOURCES.length).toBeGreaterThanOrEqual(1);
    expect(APP_CSS_SOURCES.some((s) => s.label.endsWith('app/src/styles.css'))).toBe(true);
    expect(SRC_CSS_SOURCES.some((s) => s.label.endsWith('src/views/theme.ts'))).toBe(true);
  });

  it('every className token applied to a form control has a matching CSS rule that declares font-family when it sets a type register', () => {
    const controlClasses = new Set<string>();
    for (const path of TSX_FILES) {
      const src = readFileSync(path, 'utf-8');
      for (const token of controlClassTokens(src)) controlClasses.add(token);
    }
    expect(controlClasses.size).toBeGreaterThan(5);

    const offenders: string[] = [];
    for (const { label, css } of ALL_CSS_SOURCES) {
      for (const { selector, body } of topLevelRules(css)) {
        if (!selector || selector.startsWith('@')) continue;
        const selectorClasses = [...selector.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map((m) => m[1]!);
        const matched = selectorClasses.filter((c) => controlClasses.has(c));
        if (matched.length === 0) continue;

        const hasFontSize = /font-size\s*:/.test(body);
        const hasFontWeight = /font-weight\s*:/.test(body);
        const hasFontFamily = /font-family\s*:/.test(body) || /\bfont\s*:/.test(body);
        if ((hasFontSize || hasFontWeight) && !hasFontFamily) {
          offenders.push(`${label}: "${selector}" (font-size/font-weight set, no font-family)`);
        }
      }
    }

    // DEC-808 wave-99 amendment: seeded at the measured truth under the
    // newly-derived population (34, all in sheets an unmerged v12m-*
    // branch already owns -- see docs/design/audit/control-font-population-v12.md
    // for the enumeration and per-offender owner). toBeLessThanOrEqual so
    // this can only tighten as owning branches land their fixes, never
    // silently widen.
    const CEILING = 34;
    expect(
      offenders.length,
      `control-class rules with a type register but no font-family:\n${offenders.join('\n')}`,
    ).toBeLessThanOrEqual(CEILING);
  });
});
