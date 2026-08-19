// Docked-band self-declaration sweep (DEC-576 amendment, wave 98; task w1-f).
//
// THE GAP (docs/design/audit/review-v12.md finding 1): the shell suppresses
// the phone tab bar via two selectors --
//   `.chq-shell:has(.chq-phone-dock) .chq-tabbar`        (styles.css:2300)
//   `.chq-main:has([data-chq-phone-dock]) ~ .chq-tabbar` (styles.css:430)
// -- so a page whose docked footer is a page-local class (legitimately so,
// when its measured button height differs from the shared `.chq-phone-dock`
// geometry) must OPT IN by carrying the shared class name itself or by
// setting the `data-chq-phone-dock` attribute somewhere on its page. A page
// that docks a footer without either declaration renders a phone frame with
// BOTH the dock and the tab bar mounted -- a frame no 390 drawing shows.
//
// POPULATION (DEC-808, enumerated, never hand-listed): every `*.css` under
// app/src, read with readdirSync. Inside each file's `@media (max-width:
// ...)` blocks, every class selector whose declaration body has BOTH
//   - `position: sticky` or `position: fixed`, AND `bottom: 0`
//   - a `border-top` declaration
// is a docked footer band, identified by its own geometry (the same
// full-bleed sticky-bottom-band shape every existing phone dock in this
// tree uses) rather than by a name containing "dock" -- a page could name
// its class anything.
//
// For each such class, its renderer(s) are found by grepping every non-test
// `*.tsx` under app/src for the class name as a whole token. A class
// literally named `chq-phone-dock` trivially satisfies "applies
// chq-phone-dock on the same element" (it IS that class) -- this is how the
// shared scaffold class itself passes without special-casing. Otherwise the
// renderer file must contain the token `chq-phone-dock` (as a class) or the
// string `data-chq-phone-dock` somewhere in the same file.
//
// RATCHET: none. This scan enumerates a small, closed geometric shape
// (docked footers) rather than a large pre-existing defect population, so
// it asserts zero offenders outright rather than seeding a ceiling above
// the measured count -- a ceiling above the truth is a licence (field guide
// w95). Any offender this scan finds outside Scorecard.tsx's file scope is
// recorded, with an owner, in docs/design/audit/phone-dock-declaration-v12.md
// instead of being allow-listed here.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url)); // app/src/
const REPO_ROOT = join(HERE, '..', '..');
const APP_SRC_ROOT = join(HERE);

// -- Population enumeration (DEC-808) ---------------------------------------

function enumerateFiles(root: string, suffix: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(suffix)) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

const CSS_FILES = enumerateFiles(APP_SRC_ROOT, '.css').filter((f) => !f.endsWith('.css.ts'));
const TSX_FILES = enumerateFiles(APP_SRC_ROOT, '.tsx').filter((f) => !f.includes('.test.'));

// -- Brace-matching parser (same method as phone-cascade-order.scan.test.ts) -

interface BlockNode {
  header: string;
  depth: number;
  parent: BlockNode | null;
  bodyStart: number;
  bodyEnd: number;
  startLine: number;
  closeLine: number;
}

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

function buildLineStarts(text: string): number[] {
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') starts.push(i + 1);
  }
  return starts;
}

function indexToLine(lineStarts: number[], idx: number): number {
  let lo = 0;
  let hi = lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lineStarts[mid]! <= idx) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

/** Walks the comment-stripped text and returns every `{...}` block,
 * brace-matched top to bottom. Throws on unbalanced braces -- a malformed
 * CSS file should fail loudly, not be silently skipped. All body slices are
 * taken from the SAME stripped string the offsets were computed on. */
function parseBlocks(strippedText: string): BlockNode[] {
  const lineStarts = buildLineStarts(strippedText);
  const nodes: BlockNode[] = [];
  const stack: BlockNode[] = [];
  let bufStart = 0;

  for (let i = 0; i < strippedText.length; i++) {
    const c = strippedText[i];
    if (c === '{') {
      const header = strippedText.slice(bufStart, i);
      const node: BlockNode = {
        header,
        depth: stack.length,
        parent: stack.length ? stack[stack.length - 1]! : null,
        bodyStart: i + 1,
        bodyEnd: -1,
        startLine: indexToLine(lineStarts, i),
        closeLine: -1,
      };
      nodes.push(node);
      stack.push(node);
      bufStart = i + 1;
    } else if (c === '}') {
      const node = stack.pop();
      if (!node) throw new Error('unbalanced braces (unmatched "}")');
      node.bodyEnd = i;
      node.closeLine = indexToLine(lineStarts, i);
      bufStart = i + 1;
    }
  }
  if (stack.length) throw new Error('unbalanced braces at EOF (unmatched "{")');
  return nodes;
}

function isSelectorHeader(header: string): boolean {
  const t = header.trim();
  if (!t) return false;
  if (t.includes('$') || t.includes('`')) return false;
  if (t.startsWith('@')) return false;
  return true;
}

function isMediaMaxWidth(header: string): boolean {
  return /@media\s*\(\s*max-width\s*:/.test(header);
}

function declaredValues(bodyText: string): Map<string, string> {
  const props = new Map<string, string>();
  for (const part of bodyText.split(';')) {
    const t = part.trim();
    if (!t) continue;
    const idx = t.indexOf(':');
    if (idx === -1) continue;
    const prop = t.slice(0, idx).trim().toLowerCase();
    const val = t.slice(idx + 1).trim().toLowerCase();
    if (prop) props.set(prop, val);
  }
  return props;
}

/** The last `.class` token in a selector is the element the declared
 * geometry actually lands on (e.g. `.chq-worklist-selecting .chq-bulkbar`
 * docks `.chq-bulkbar`, not its ancestor). */
function targetClass(selector: string): string | null {
  const matches = [...selector.matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].map((m) => m[1]!);
  if (matches.length === 0) return null;
  return matches[matches.length - 1]!;
}

export interface DockedClass {
  className: string;
  selector: string;
  file: string; // repo-relative
  line: number;
}

/** Pure over a (text, fileLabel) pair so fixture strings can drive the
 * positive/negative controls through the identical code path used on real
 * files. */
function findDockedClassesInText(text: string, fileLabel: string): DockedClass[] {
  const clean = stripComments(text);
  const nodes = parseBlocks(clean);
  const found: DockedClass[] = [];

  const mediaBlocks = nodes.filter((n) => n.depth === 0 && isMediaMaxWidth(n.header));
  for (const media of mediaBlocks) {
    const rules = nodes.filter((n) => n.parent === media && isSelectorHeader(n.header));
    for (const rule of rules) {
      const body = clean.slice(rule.bodyStart, rule.bodyEnd);
      const decls = declaredValues(body);
      const position = decls.get('position');
      const bottom = decls.get('bottom');
      const hasBorderTop = decls.has('border-top');
      const isStickyOrFixed = position === 'sticky' || position === 'fixed';
      const isBottomZero = bottom === '0' || bottom === '0px';
      if (isStickyOrFixed && isBottomZero && hasBorderTop) {
        const cls = targetClass(rule.header);
        if (!cls) continue;
        found.push({ className: cls, selector: rule.header.trim().replace(/\s+/g, ' '), file: fileLabel, line: rule.startLine });
      }
    }
  }
  return found;
}

function scanCssFile(absPath: string): DockedClass[] {
  const relFile = relative(REPO_ROOT, absPath);
  const text = readFileSync(absPath, 'utf-8');
  return findDockedClassesInText(text, relFile);
}

const ALL_DOCKED: DockedClass[] = CSS_FILES.flatMap((f) => scanCssFile(f));
// de-duplicate by className (a class may be declared once but this keeps
// the check idempotent if a class is re-declared across files/breakpoints)
const DOCKED_CLASSES: DockedClass[] = Array.from(
  new Map(ALL_DOCKED.map((d) => [d.className, d])).values(),
);

// -- Renderer lookup + declaration check -------------------------------------

interface RendererCheck {
  className: string;
  renderers: string[]; // repo-relative
  declaringRenderers: string[]; // subset that carries chq-phone-dock or data-chq-phone-dock
}

function classTokenRegex(className: string): RegExp {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\w-])${escaped}([^\\w-]|$)`);
}

/** Pure over a map of {label -> fileText} so fixtures can exercise it
 * without touching the filesystem. */
function checkDeclarationInRenderers(
  className: string,
  renderers: Array<{ label: string; text: string }>,
): RendererCheck {
  if (className === 'chq-phone-dock') {
    // The shared scaffold class trivially declares itself.
    return { className, renderers: renderers.map((r) => r.label), declaringRenderers: renderers.map((r) => r.label) };
  }
  const phoneDockToken = classTokenRegex('chq-phone-dock');
  const declaring: string[] = [];
  for (const r of renderers) {
    const hasSharedClass = phoneDockToken.test(r.text);
    const hasDataAttr = r.text.includes('data-chq-phone-dock');
    if (hasSharedClass || hasDataAttr) declaring.push(r.label);
  }
  return { className, renderers: renderers.map((r) => r.label), declaringRenderers: declaring };
}

function findRenderers(className: string): Array<{ label: string; text: string }> {
  const token = classTokenRegex(className);
  const out: Array<{ label: string; text: string }> = [];
  for (const f of TSX_FILES) {
    const text = readFileSync(f, 'utf-8');
    if (token.test(text)) out.push({ label: relative(REPO_ROOT, f), text });
  }
  return out;
}

interface Offender {
  className: string;
  sheet: string;
  line: number;
  renderers: string[];
}

const OFFENDERS: Offender[] = [];
for (const d of DOCKED_CLASSES) {
  const renderers = findRenderers(d.className);
  if (renderers.length === 0) {
    throw new Error(
      `docked-footer class .${d.className} (declared ${d.file}:${d.line}) has NO renderer under app/src -- ` +
        `a dead CSS rule, not a self-declaration gap. Fix the class name mismatch before running this scan.`,
    );
  }
  const check = checkDeclarationInRenderers(d.className, renderers);
  if (check.declaringRenderers.length === 0) {
    OFFENDERS.push({
      className: d.className,
      sheet: `${d.file}:${d.line}`,
      line: d.line,
      renderers: check.renderers,
    });
  }
}

// RATCHET (a ceiling AT the measured truth, never above it -- field guide
// w95): three docked-footer classes outside this lane's file scope are
// still missing a self-declaration --
//   .chq-contacts-import-phone-dock (contacts-panels.css, ImportWizard.tsx)
//   .chq-bulkbar                    (content.css, SessionList.tsx)
//   .chq-review-editor-title-actions (review.css, PlanEditor.tsx)
// -- each recorded, with an owner, in
// docs/design/audit/phone-dock-declaration-v12.md. This lane's own class
// (.chq-review-scorecard-dock) is fixed and explicitly excluded from the
// ceiling below so a future regression in Scorecard.tsx cannot hide inside
// slack meant for the other three. The ceiling may only SHRINK as those
// lanes fix their own files -- never rise to cover a new offender.
const OFFENDER_CEILING = 3;

describe('every page-local phone dock declares itself to the shell (DEC-576 amendment, wave 98)', () => {
  it('enumerates a non-empty, non-trivial population (vacuous-population guard, DEC-808)', () => {
    expect(CSS_FILES.length).toBeGreaterThan(0);
    expect(DOCKED_CLASSES.length).toBeGreaterThan(0);
    expect(DOCKED_CLASSES.some((d) => d.className === 'chq-review-scorecard-dock')).toBe(true);
  });

  it('positive control: a fixture docked footer with no declaration is caught', () => {
    const fixtureCss = `
      @media (max-width: 700px) {
        .fixture-missing-dock {
          position: sticky;
          bottom: 0;
          border-top: 1px solid #000;
        }
      }
    `;
    const found = findDockedClassesInText(fixtureCss, 'fixture.css');
    expect(found.map((f) => f.className)).toEqual(['fixture-missing-dock']);

    const rendererText = `export function Fixture() { return <div className="fixture-missing-dock">hi</div>; }`;
    const check = checkDeclarationInRenderers('fixture-missing-dock', [{ label: 'Fixture.tsx', text: rendererText }]);
    expect(check.declaringRenderers).toEqual([]);
  });

  it('negative control: a fixture docked footer that sets data-chq-phone-dock passes', () => {
    const fixtureCss = `
      @media (max-width: 700px) {
        .fixture-with-declaration {
          position: fixed;
          bottom: 0;
          border-top: 1px solid #000;
        }
      }
    `;
    const found = findDockedClassesInText(fixtureCss, 'fixture.css');
    expect(found.map((f) => f.className)).toEqual(['fixture-with-declaration']);

    const rendererText = `export function Fixture() { return <div className="chq-page" data-chq-phone-dock={isPhone}><div className="fixture-with-declaration">hi</div></div>; }`;
    const check = checkDeclarationInRenderers('fixture-with-declaration', [{ label: 'Fixture.tsx', text: rendererText }]);
    expect(check.declaringRenderers).toEqual(['Fixture.tsx']);
  });

  it('Scorecard.tsx declares .chq-review-scorecard-dock via data-chq-phone-dock', () => {
    const target = DOCKED_CLASSES.find((d) => d.className === 'chq-review-scorecard-dock');
    expect(target).toBeDefined();
    const renderers = findRenderers('chq-review-scorecard-dock');
    const check = checkDeclarationInRenderers('chq-review-scorecard-dock', renderers);
    expect(check.declaringRenderers.length).toBeGreaterThan(0);
  });

  it('this lane\'s own class (.chq-review-scorecard-dock) is never among the offenders', () => {
    expect(OFFENDERS.some((o) => o.className === 'chq-review-scorecard-dock')).toBe(false);
  });

  it(`never exceeds OFFENDER_CEILING (${OFFENDER_CEILING}) undeclared docked-footer classes`, () => {
    if (OFFENDERS.length > OFFENDER_CEILING) {
      const lines = OFFENDERS.map(
        (o) =>
          `.${o.className} · ${o.sheet} · renderer(s): ${o.renderers.join(', ')} · missing BOTH the chq-phone-dock class ` +
          `and the data-chq-phone-dock attribute in every renderer file`,
      );
      throw new Error(
        `${OFFENDERS.length} docked-footer class(es) never declare themselves to the shell's tab-bar-suppression ` +
          `selectors, above OFFENDER_CEILING (${OFFENDER_CEILING}):\n${lines.join('\n')}\nFix in-lane, or record ` +
          `(with an owner) in docs/design/audit/phone-dock-declaration-v12.md if the sheet/renderer belongs to ` +
          `another lane. The ceiling may only SHRINK -- never raise it to cover a new regression.`,
      );
    }
    expect(OFFENDERS.length).toBeLessThanOrEqual(OFFENDER_CEILING);
  });
});
