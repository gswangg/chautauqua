// Control font vocabulary guard (DEC-577 amendment, task-w44-a).
//
// font-family is not inherited into form controls (<button>, <input>,
// <select>, <textarea>) by any UA -- a class rule applied to one of those
// elements that sets a type register (font-size or font-weight) but never
// declares font-family silently computes the UA default face next to the
// app's Figtree/Familjen Grotesk neighbours the moment nothing upstream
// supplies one. This scan ENUMERATES (never hand-lists, per house
// convention) every `chq-…` class token applied to a <button>/<input>/
// <select>/<textarea> element anywhere in app/src/**/*.tsx, then checks
// every top-level rule in app/src/styles.css whose selector names one of
// those classes: if it declares font-size or font-weight without also
// declaring font-family (or the `font` shorthand), it is an offender.
//
// This is deliberately per-class-rule, not "does the element compute a
// family via some other cascading rule" -- a class-level control-font
// contract is what keeps a class safe to use standalone (composed with
// other markup, moved to a new element) without silently regressing.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const STYLES_PATH = join(HERE, 'styles.css');
const STYLES_CSS = readFileSync(STYLES_PATH, 'utf-8');

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

/** Every top-level (not inside @media) `selector { body }` rule in styles.css. */
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

describe('control font vocabulary contract (DEC-577 amendment)', () => {
  const TSX_FILES = allTsxFiles(HERE);

  it('found more than one tsx file to scan', () => {
    // Guards the enumeration itself: if readdirSync ever returned nothing,
    // the control-class set below would be empty and every assertion
    // would vacuously pass.
    expect(TSX_FILES.length).toBeGreaterThan(5);
  });

  it('every className token applied to a form control has a matching CSS rule that declares font-family when it sets a type register', () => {
    const controlClasses = new Set<string>();
    for (const path of TSX_FILES) {
      const src = readFileSync(path, 'utf-8');
      for (const token of controlClassTokens(src)) controlClasses.add(token);
    }
    expect(controlClasses.size).toBeGreaterThan(5);

    const offenders: string[] = [];
    for (const { selector, body } of topLevelRules(STYLES_CSS)) {
      if (!selector || selector.startsWith('@')) continue;
      const selectorClasses = [...selector.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map((m) => m[1]!);
      const matched = selectorClasses.filter((c) => controlClasses.has(c));
      if (matched.length === 0) continue;

      const hasFontSize = /font-size\s*:/.test(body);
      const hasFontWeight = /font-weight\s*:/.test(body);
      const hasFontFamily = /font-family\s*:/.test(body) || /\bfont\s*:/.test(body);
      if ((hasFontSize || hasFontWeight) && !hasFontFamily) {
        offenders.push(`"${selector}" (font-size/font-weight set, no font-family)`);
      }
    }
    expect(
      offenders,
      `control-class rules with a type register but no font-family:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
