// Inline-style-beats-phone-rule contract (DEC-919 wave-109 amendment).
//
// The wave-109 amendment to DEC-919 documented a concrete regression class:
// a JSX element carries an inline `style={{ display: 'none' }}` prop, AND a
// stylesheet's `@media (max-width: ...)` block tries to reveal that SAME
// class with its own `display:` declaration -- an inline style ALWAYS
// outranks a stylesheet rule regardless of specificity or source order, so
// the phone reveal can never fire; the element silently never renders at
// the phone width the frame draws it at
// (`docs/probes/metafid-phoneA-2026-08-19.md`, "Submission detail back link
// renders a bare '<' with no label"). This scan makes that class of bug
// impossible to reintroduce silently: it enumerates every non-test *.tsx
// file, finds every JSX `style={{...}}` prop that sets `display`, resolves
// the class list on the SAME element (via its `className="..."` string
// literal), and fails if any of those classes also gets a `display:`
// declaration inside a `@media (...max-width...)` block in any *.css file
// under app/src.
//
// This is a CLOSED rule (no ratchet, like phone-terminal-block.scan): the
// fix for the one known instance (SubmissionDetailPage.tsx) removed the
// inline styles entirely and moved the desktop-hide to a top-level CSS rule
// ahead of the terminal phone block, so the true count today is 0 and stays
// 0 -- a stale ratchet ceiling would just hide the next occurrence.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP_SRC = dirname(fileURLToPath(import.meta.url));

function isTestFile(name: string): boolean {
  return /\.test\.tsx?$/.test(name);
}

/** Every file under `root` matching `extensions`, test files excluded,
 * enumerated via readdirSync (never a hand-listed manifest, DEC-808). */
function enumerateFiles(root: string, extensions: string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    if (!extensions.some((ext) => entry.name.endsWith(ext))) continue;
    if (isTestFile(entry.name)) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

// --- shared brace-matching helpers (CSS side) -------------------------------

/** Strips /* ... *\/ comments -- the field guide's own warning (DEC-613
 * wave-106): a provenance comment that quotes CSS (`.chq-main{padding}`,
 * literal `@media`) desyncs a naive brace-walker unless comments are
 * stripped first. */
function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Index of the `}` matching the `{` at `openIdx`. */
function matchBrace(text: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  throw new Error('unbalanced braces while scanning CSS');
}

/** Bodies of every top-level `@media (...max-width...) { ... }` block in a
 * (comment-stripped) CSS source. */
function maxWidthMediaBodies(cssStripped: string): string[] {
  const bodies: string[] = [];
  const re = /@media[^{]*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cssStripped))) {
    if (/max-width/i.test(m[0])) {
      const openIdx = m.index + m[0].length - 1;
      const closeIdx = matchBrace(cssStripped, openIdx);
      bodies.push(cssStripped.slice(openIdx + 1, closeIdx));
      re.lastIndex = closeIdx + 1;
    }
  }
  return bodies;
}

interface CssRule {
  selector: string;
  body: string;
}

/** Flat list of {selector, body} rules within `text`, recursing into any
 * nested at-rule block (e.g. a nested @media/@supports) so its rules are
 * still found. */
function extractRules(text: string): CssRule[] {
  const rules: CssRule[] = [];
  let i = 0;
  while (i < text.length) {
    const braceIdx = text.indexOf('{', i);
    if (braceIdx === -1) break;
    const selector = text.slice(i, braceIdx).trim();
    const closeIdx = matchBrace(text, braceIdx);
    const body = text.slice(braceIdx + 1, closeIdx);
    if (selector.startsWith('@')) {
      rules.push(...extractRules(body));
    } else if (selector.length > 0) {
      rules.push({ selector, body });
    }
    i = closeIdx + 1;
  }
  return rules;
}

const CLASS_TOKEN_RE = /\.([-\w]+)/g;

/** Every class name that gets a `display:` declaration inside a
 * `@media (...max-width...)` block, across ALL non-test *.css files under
 * `root`. */
function classesWithMaxWidthDisplayRule(root: string): Set<string> {
  const classes = new Set<string>();
  for (const file of enumerateFiles(root, ['.css'])) {
    const stripped = stripCssComments(readFileSync(file, 'utf-8'));
    for (const body of maxWidthMediaBodies(stripped)) {
      for (const rule of extractRules(body)) {
        if (!/display\s*:/.test(rule.body)) continue;
        for (const selectorPart of rule.selector.split(',')) {
          for (const cm of selectorPart.matchAll(CLASS_TOKEN_RE)) {
            classes.add(cm[1]!);
          }
        }
      }
    }
  }
  return classes;
}

// --- shared JSX-side helpers -------------------------------------------------

interface InlineDisplayStyle {
  file: string;
  /** Character index, in the raw file, of the `style={{` token. */
  index: number;
  /** The classes on the SAME JSX element (from its className string
   * literal), or null if the element has no static className. */
  classes: string[] | null;
}

const STYLE_PROP_RE = /style=\{\{/g;
const CLASSNAME_RE = /className=(?:"([^"]*)"|'([^']*)')/;

/** Finds every `style={{...}}` prop that declares `display`, and resolves
 * the enclosing JSX element's className string-literal classes. */
function findInlineDisplayStyles(file: string, raw: string): InlineDisplayStyle[] {
  const out: InlineDisplayStyle[] = [];
  let m: RegExpExecArray | null;
  while ((m = STYLE_PROP_RE.exec(raw))) {
    const openIdx = m.index + m[0].length - 1; // index of the first '{' of the doubled brace
    const closeIdx = matchBrace(raw, openIdx);
    const objectBody = raw.slice(openIdx + 1, closeIdx);
    if (!/display\s*:/.test(objectBody)) continue;

    // Resolve the enclosing tag: the nearest unclosed '<' before this prop.
    const tagStart = raw.lastIndexOf('<', m.index);
    const tagEnd = raw.indexOf('>', closeIdx);
    let classes: string[] | null = null;
    if (tagStart !== -1 && tagEnd !== -1) {
      const tagText = raw.slice(tagStart, tagEnd + 1);
      const cm = tagText.match(CLASSNAME_RE);
      if (cm) {
        classes = (cm[1] ?? cm[2] ?? '').split(/\s+/).filter(Boolean);
      }
    }
    out.push({ file, index: m.index, classes });
  }
  return out;
}

// --- the scan ----------------------------------------------------------------

const REPO_ROOT = join(APP_SRC, '..', '..');

describe('inline style beats every phone rule (DEC-919 wave-109 amendment)', () => {
  it('enumerates a non-empty population of *.tsx files to check (guards against a silently-empty scan) -- the fixed count of live inline display-style offenders is 0, by design (see synthetic controls below for the mechanism)', () => {
    const tsxFiles = enumerateFiles(APP_SRC, ['.tsx']);
    expect(tsxFiles.length).toBeGreaterThan(50);
  });

  it('finds a non-empty population of classes with a max-width-media display rule (guards against a silently-empty CSS side)', () => {
    expect(classesWithMaxWidthDisplayRule(APP_SRC).size).toBeGreaterThan(0);
  });

  it('exactly 0 classes carry BOTH an inline display style and a competing max-width-media display rule (closed rule, no ratchet)', () => {
    const mediaClasses = classesWithMaxWidthDisplayRule(APP_SRC);
    const offenders: string[] = [];
    for (const file of enumerateFiles(APP_SRC, ['.tsx'])) {
      const relPath = relative(REPO_ROOT, file);
      const raw = readFileSync(file, 'utf-8');
      for (const style of findInlineDisplayStyles(relPath, raw)) {
        if (!style.classes) continue;
        for (const cls of style.classes) {
          if (mediaClasses.has(cls)) {
            const line = raw.slice(0, style.index).split('\n').length;
            offenders.push(
              `${relPath}:${line} -- inline style={{display:...}} on className including "${cls}", ` +
                `which also has a display: rule inside a max-width media block (can never be revealed)`
            );
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

// Synthetic controls (house form, mirrors frame-citation.scan.test.ts):
// exercise the extraction/matching logic itself against small fixture
// strings, independent of the real tree, so the rule's positive and
// negative paths are each confirmed directly.
describe('inline-style-phone-override synthetic controls (positive/negative)', () => {
  it('positive control: flags a class with both an inline display style and a competing max-width media rule', () => {
    const cssFixture = stripCssComments(`
      @media (max-width: 700px) {
        .chq-fixture-reveal { display: inline; }
      }
    `);
    const mediaClasses = new Set<string>();
    for (const body of maxWidthMediaBodies(cssFixture)) {
      for (const rule of extractRules(body)) {
        if (!/display\s*:/.test(rule.body)) continue;
        for (const cm of rule.selector.matchAll(CLASS_TOKEN_RE)) mediaClasses.add(cm[1]!);
      }
    }
    expect(mediaClasses.has('chq-fixture-reveal')).toBe(true);

    const tsxFixture = `<span className="chq-fixture-reveal" style={{ display: 'none' }}>x</span>`;
    const [style] = findInlineDisplayStyles('fixture.tsx', tsxFixture);
    expect(style).toBeDefined();
    expect(style!.classes).toEqual(['chq-fixture-reveal']);
    expect(style!.classes!.some((c) => mediaClasses.has(c))).toBe(true);
  });

  it('negative control: an inline display style on a class with NO competing max-width media rule is not flagged', () => {
    const cssFixture = stripCssComments(`
      @media (max-width: 700px) {
        .chq-fixture-unrelated { color: red; }
      }
    `);
    const mediaClasses = new Set<string>();
    for (const body of maxWidthMediaBodies(cssFixture)) {
      for (const rule of extractRules(body)) {
        if (!/display\s*:/.test(rule.body)) continue;
        for (const cm of rule.selector.matchAll(CLASS_TOKEN_RE)) mediaClasses.add(cm[1]!);
      }
    }
    expect(mediaClasses.has('chq-fixture-quiet')).toBe(false);

    const tsxFixture = `<span className="chq-fixture-quiet" style={{ display: 'none' }}>x</span>`;
    const [style] = findInlineDisplayStyles('fixture.tsx', tsxFixture);
    expect(style).toBeDefined();
    expect(style!.classes).toEqual(['chq-fixture-quiet']);
    expect(style!.classes!.some((c) => mediaClasses.has(c))).toBe(false);
  });

  it('negative control: a class inside an inert (no max-width) media block does not flag', () => {
    // e.g. @media (min-width: 900px) -- not a phone override target at all.
    const cssFixture = stripCssComments(`
      @media (min-width: 900px) {
        .chq-fixture-desktop-only { display: block; }
      }
    `);
    const mediaClasses = new Set<string>();
    for (const body of maxWidthMediaBodies(cssFixture)) {
      for (const rule of extractRules(body)) {
        if (!/display\s*:/.test(rule.body)) continue;
        for (const cm of rule.selector.matchAll(CLASS_TOKEN_RE)) mediaClasses.add(cm[1]!);
      }
    }
    expect(mediaClasses.size).toBe(0);
  });
});
