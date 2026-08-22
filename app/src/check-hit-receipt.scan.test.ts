// DEC-393 wave-124 amendment (task v12m-w14-k): the exemption comment above
// `input[type='checkbox'], input[type='radio'], .chq-check` in styles.css
// claims "the phone tap floor is met by padding on the label around it, not
// by inflating the box" -- a claim about MARKUP. It was false for the
// row-selection checkbox on ContactsTable/SubmissionsTable (and, once
// derived rather than hand-listed, ComposeWizard/SessionList too): those
// sites rendered `<input className="chq-check">` bare inside a `<td>`/`<th>`
// with no `<label>` wrap at all. The fix wraps every such site in a real
// `<label className="chq-check-hit">`; this is the receipt (DEC-991 shape)
// that the reason is now true, checked directly against the TSX rather than
// trusted from prose.
//
// DEC-991 (task v12m-w11-te): the walk above was blind to ARIA-role tables.
// TaskView.tsx renders its rows as `<span role="columnheader">`/`<span
// role="cell">`, never `<td>`/`<th>` -- a real HTML table would fail axe's
// row/cell semantics on this markup, so the pack draws the table with ARIA
// roles on generic elements instead (Chautauqua Speakers.dc.html's task
// tables). The population walk below now treats an opening tag that itself
// carries `role="cell"`, `role="gridcell"`, or `role="columnheader"` as a
// cell ancestor exactly like `<td>`/`<th>` -- same source-text, same
// naive tag-depth technique, generalised to the tag name(s) that this FILE
// actually uses for that role (derived per file via `ariaCellTagNames`,
// never hand-listed) so an unrelated same-named element elsewhere in the
// file that does NOT carry the role still tracks correctly for nesting
// depth without being mistaken for a cell.
//
// POPULATION (DEC-808, derived not hand-listed): every `.chq-check` site
// across `app/src/**/*.tsx` (test files excluded) that is rendered directly
// as a `<td>`/`<th>` cell's own control, OR directly as the control of an
// element carrying `role="cell"|"gridcell"|"columnheader"` -- i.e. the JSX
// immediately containing the `className="chq-check"` input, walking
// outward, opens on `<td`/`<th`/a role-cell tag before it opens on
// `<label`. A site already wrapped in a `<label ...>` (the option-list/
// toggle idiom used everywhere else in the tree) is OUT of population --
// that label already reaches the floor on its own text/children, which is
// not this scan's concern.
//
// This scan's own population-derivation walks the SOURCE TEXT (not a JSX
// AST), so it looks for the nearest preceding unclosed `<td`/`<th`/role-cell
// tag/`<label` opening tag before each `.chq-check` occurrence, by naive
// tag-depth tracking -- adequate here because every population member and
// every exempt (label-wrapped) member in this tree is written as plain,
// unconditionally-nested JSX with no `dangerouslySetInnerHTML`/portal
// indirection.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEC_385, DEC_393, DEC_808, DEC_991 } from '../../src/decisions';
import { stripCssComments } from '../../test/helpers/strip-css-comments';
import { allCssFiles } from './phone-tap-target-scan/core';

void DEC_393; // this scan's whole reason to exist: the wave-124 "make the reason true" clause
void DEC_808; // population is enumerated from the TSX, never a hand-listed manifest
void DEC_991; // receipt shape: a scan the exemption reason itself points at
void DEC_385; // the floor lives in styles.css's ONE terminal max-width block only

const HERE = dirname(fileURLToPath(import.meta.url)); // app/src
const REPO_ROOT = join(HERE, '..', '..');

/** Every `.tsx` file under `root`, excluding test files, enumerated rather than named (DEC-808). */
export function allTsxFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.tsx') || entry.name.includes('.test.')) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

export interface CheckSite {
  file: string;
  /** 1-indexed line of the `className="chq-check` (or `chq-check "` mid-list) occurrence. */
  line: number;
  /** Nearest enclosing opening tag found walking backward: 'td' | 'th' | 'ariaCell' | 'label' | null.
   * 'ariaCell' means the nearest tracked ancestor is an element that itself carries
   * `role="cell"|"gridcell"|"columnheader"` (DEC-991) -- an ARIA-table cell that isn't a literal
   * `<td>`/`<th>`. */
  nearestOpenTag: 'td' | 'th' | 'ariaCell' | 'label' | null;
  /** True only when `nearestOpenTag === 'label'` and that label's own `className` carries
   * `chq-check-hit` -- i.e. the wrapper THIS fix adds, as opposed to a pre-existing option-list/
   * toggle label (`chq-checkbox-label`, `chq-check-label`, `chq-comms-toggle`, ...). A site whose
   * nearest ancestor is a check-hit label is still a table-cell site: the wrapper doesn't erase
   * membership, it's the fix. */
  nearestLabelIsCheckHit: boolean;
  /** DEC-393 wave-26 amendment. Meaningful ONLY when `nearestOpenTag === 'label' &&
   * !nearestLabelIsCheckHit` (a plain, pre-existing label wrap) -- true when that wrapping label
   * neither (a) resolves, via its own `className`, to a CSS rule (top-level or inside an
   * `@media (max-width: N)` block with N >= 390) declaring `min-height >= 44px`, NOR (b) carries
   * any non-whitespace text child or non-input element child besides the checkbox itself. An
   * empty, unfloored label is exactly as bare a hit box as an unwrapped input -- "wrapped in a
   * `<label>`" is not on its own a reason to leave the population. Always `false` for a
   * `td`/`th`/`ariaCell`/check-hit-label site (those are graded on the existing criteria only). */
  labelIsBare: boolean;
}

const CHECK_CLASS_RE = /className=(?:"[^"]*\bchq-check\b[^"]*"|'[^']*\bchq-check\b[^']*')/g;
const ARIA_CELL_ROLE_RE = /\brole=(?:"(?:cell|gridcell|columnheader)"|'(?:cell|gridcell|columnheader)')/;
/** Every element (any tag name) that itself opens carrying the role attribute this scan treats as
 * an ARIA-table cell -- used to derive, per file, which tag name(s) that file uses for its ARIA
 * table (DEC-991: derived, never hand-listed; DEC-808). */
const ARIA_CELL_TAG_RE = /<([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*?\brole=(?:"(?:cell|gridcell|columnheader)"|'(?:cell|gridcell|columnheader)')[^>]*?>/g;

function escapeForAlternation(name: string): string {
  return name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Tag names this file's own source uses to carry `role="cell"|"gridcell"|"columnheader"`
 * (e.g. `{'span'}` for TaskView.tsx). Empty for a file with no ARIA table. */
export function ariaCellTagNames(content: string): Set<string> {
  const names = new Set<string>();
  const re = new RegExp(ARIA_CELL_TAG_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) names.add(m[1] as string);
  return names;
}

// --- DEC-393 wave-26 amendment: is a plain (non-check-hit) label wrap actually bare? ------
//
// styles.css's `input[type='checkbox'], input[type='radio'], .chq-check` exemption comment
// claimed "the phone tap floor is met by the LABEL wrapping the box" for every non-check-hit
// label-wrapped `.chq-check` -- a claim this file's negative control encoded unconditionally.
// Measured false at SubmissionDetailPage.tsx:1715: `<label className="chq-visible-toggle">`
// wraps ONLY the bare checkbox, no text, no other child, and `.chq-visible-toggle` (styles.css)
// declared no min-height at any width -- an 18x18 hit box exactly like an unwrapped input.
// `.chq-comms-toggle` (comms.css) and `.chq-checkbox-label` (styles.css) likewise declare no
// floor, but every site in the tree that uses them wraps real label text ("Required", "Include
// reviewer feedback", a track name, ...) beside the input -- DESIGN-RULINGS.md:189's own reason
// for the padding/width half of the floor ("without padding the hit box is only as wide as the
// text") is exactly why that text content, not the wrapping `<label>` itself, is what reaches
// the floor there. `.chq-check-label` (speakers.css) instead reaches the floor directly, via its
// own `min-height:44px` rule. A label wrap is therefore bare -- still IN population -- only when
// it has NEITHER a floored class NOR real content of its own.

/** Nearest enclosing `<label ...>` opening tag before `checkIndex` (naive backward tag-depth
 * walk over `<label>`/`</label>` only, matching this file's house technique), returning its own
 * `className` attribute value and the raw source text of its content up to (not including) the
 * matching `</label>`. Returns `null` if no `<label` is open at `checkIndex` (should not happen
 * for a call site already confirmed by `nearestOpenAncestor` to have a label ancestor). */
export function labelWrapDetails(content: string, checkIndex: number): { className: string; inner: string } | null {
  const prefix = content.slice(0, checkIndex);
  const openRe = /<label\b([^>]*)>/g;
  const closeRe = /<\/label>/g;
  const opens: Array<{ pos: number; end: number; attrs: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = openRe.exec(prefix)) !== null) {
    opens.push({ pos: m.index, end: m.index + m[0].length, attrs: m[1] ?? '' });
  }
  const closePositions: number[] = [];
  while ((m = closeRe.exec(prefix)) !== null) closePositions.push(m.index);
  for (const c of closePositions) {
    for (let i = opens.length - 1; i >= 0; i--) {
      if ((opens[i] as { pos: number }).pos < c) {
        opens.splice(i, 1);
        break;
      }
    }
  }
  const nearest = opens[opens.length - 1];
  if (!nearest) return null;
  const classMatch = nearest.attrs.match(/className\s*=\s*"([^"]*)"/);
  const className = classMatch ? (classMatch[1] ?? '') : '';
  const rest = content.slice(nearest.end);
  const closeMatch = /<\/label>/.exec(rest);
  const inner = closeMatch ? rest.slice(0, closeMatch.index) : rest;
  return { className, inner };
}

/** Wave-28 (DEC-999 amendment): strips every self-closing `<input .../>` tag from `text`,
 * brace-depth aware so a `>` inside a JSX attribute expression (e.g. `onChange={() =>
 * handler()}`'s arrow, or any other `{...}` containing `>`) does not get mistaken for the tag's
 * own closing `/>`. A naive `[^>]*` stops at the FIRST `>`, which for a real multi-line
 * `<input ... onChange={() => ...} />` is the arrow's `>`, not the tag close -- leaving the
 * rest of the real (empty) input tag's text in the label's "content", which made every such
 * label read as non-bare. Walks forward from each `<input` looking for the first `/>` that
 * occurs at brace-depth 0. */
function stripInputTags(text: string): string {
  let out = '';
  let i = 0;
  for (;;) {
    const start = text.indexOf('<input', i);
    if (start === -1) {
      out += text.slice(i);
      break;
    }
    out += text.slice(i, start);
    let j = start;
    let depth = 0;
    let end = -1;
    while (j < text.length) {
      const ch = text[j];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      else if (depth === 0 && ch === '/' && text[j + 1] === '>') {
        end = j + 2;
        break;
      }
      j++;
    }
    if (end === -1) {
      // Malformed/unterminated tag -- should not happen in real JSX; bail rather than loop.
      out += text.slice(start);
      break;
    }
    i = end;
  }
  return out;
}

/** True when a label's `inner` content (as returned by `labelWrapDetails`) carries at least one
 * non-whitespace text child or non-input element child besides the checkbox: strips every
 * self-closing `<input .../>` tag (brace-depth aware -- see `stripInputTags`) and every JSX
 * comment (`{/* ... *\/}`), then checks whether anything non-whitespace remains -- any surviving
 * text OR any other tag's angle bracket counts. */
export function labelHasRealContent(inner: string): boolean {
  const withoutInputs = stripInputTags(inner);
  const withoutJsxComments = withoutInputs.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  return withoutJsxComments.trim().length > 0;
}

/** Every top-level (non-@media) `selector { body }` rule in already-comment-stripped `css`.
 * Mirrors phone-tap-target-scan/core.ts's `stripMedia`/rule-pair idiom (brace-depth matched, no
 * nested-quantifier backtracking hazard), rebuilt here rather than imported because this scan
 * needs BOTH the top-level rules AND every `@media (max-width: N)` rule regardless of N (see
 * `mediaMaxWidthRules` below) -- the shared `narrowMediaRules` only returns rules under a caller-
 * chosen ceiling, the opposite of the N >= 390 floor this scan needs. */
function topLevelRules(css: string): Array<{ selector: string; body: string }> {
  const ranges: Array<[number, number]> = [];
  const openRe = /@media[^{]*\{/g;
  let m: RegExpExecArray | null;
  while ((m = openRe.exec(css)) !== null) {
    let i = m.index + m[0].length;
    let depth = 1;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') depth--;
      i++;
    }
    ranges.push([m.index, i]);
    openRe.lastIndex = i;
  }
  let withoutMedia = '';
  let last = 0;
  for (const [start, end] of ranges) {
    withoutMedia += css.slice(last, start);
    last = end;
  }
  withoutMedia += css.slice(last);
  const out: Array<{ selector: string; body: string }> = [];
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  while ((m = ruleRe.exec(withoutMedia)) !== null) {
    out.push({ selector: (m[1] ?? '').trim(), body: m[2] ?? '' });
  }
  return out;
}

/** Every `selector { body }` rule inside an `@media (max-width: Npx)` block, for every N found
 * (unfiltered -- the caller filters by N), in already-comment-stripped `css`. */
function mediaMaxWidthRules(css: string): Array<{ selector: string; body: string; maxWidth: number }> {
  const out: Array<{ selector: string; body: string; maxWidth: number }> = [];
  const mediaRe = /@media[^{]*max-width:\s*(\d+)px[^{]*\{/g;
  let mm: RegExpExecArray | null;
  while ((mm = mediaRe.exec(css)) !== null) {
    const maxWidth = Number(mm[1]);
    const bodyStart = mm.index + mm[0].length;
    let depth = 1;
    let i = bodyStart;
    for (; i < css.length && depth > 0; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') depth--;
    }
    const block = css.slice(bodyStart, i - 1);
    const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = ruleRe.exec(block)) !== null) {
      out.push({ selector: (m[1] ?? '').trim(), body: m[2] ?? '', maxWidth });
    }
  }
  return out;
}

const TOKEN_BOUNDARY_MIN_HEIGHT_RE = /min-height\s*:\s*(\d+(?:\.\d+)?)px/;

function tokenHasFloorInRules(rules: Array<{ selector: string; body: string }>, token: string): boolean {
  const tokenRe = new RegExp(`\\.${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`);
  for (const r of rules) {
    if (!tokenRe.test(r.selector)) continue;
    const heightMatch = TOKEN_BOUNDARY_MIN_HEIGHT_RE.exec(r.body);
    if (heightMatch && Number(heightMatch[1]) >= 44) return true;
  }
  return false;
}

/** True when ANY class token in `className` resolves, in ANY of `cssContents` (raw, NOT yet
 * comment-stripped -- stripped here via the shared `stripCssComments` helper, never a private
 * stripper), to a CSS rule declaring `min-height >= 44px`, either at the top level (applies at
 * every width, e.g. `.chq-check-label`) or inside an `@media (max-width: N)` block with
 * `N >= 390` (applies at the 390 phone frame width the campaign grades). */
export function classResolvesToPhoneFloor(cssContents: string[], className: string): boolean {
  const tokens = className.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  for (const raw of cssContents) {
    const css = stripCssComments(raw);
    const top = topLevelRules(css);
    const media = mediaMaxWidthRules(css).filter((r) => r.maxWidth >= 390);
    for (const token of tokens) {
      if (tokenHasFloorInRules(top, token) || tokenHasFloorInRules(media, token)) return true;
    }
  }
  return false;
}

interface OpenAncestor {
  tag: 'td' | 'th' | 'ariaCell' | 'label';
  isCheckHitLabel: boolean;
}

/** Walks backward from `index` in `text`, tracking td/th/label/[ariaTagNames] open/close tags, and
 * returns the innermost tag still open at `index` -- i.e. the nearest ancestor among {td, th,
 * ariaCell, label} -- along with whether that ancestor (if a label) carries `chq-check-hit`. Tags
 * of other kinds (and instances of an `ariaTagNames` tag that do NOT themselves carry the role
 * attribute -- e.g. a plain unrelated `<span>` in a file that elsewhere uses `<span role="cell">`)
 * are tracked only enough to keep nesting depth correct; they are never reported as the ancestor. */
export function nearestOpenAncestor(text: string, index: number, ariaTagNames: ReadonlySet<string> = new Set()): OpenAncestor | null {
  const prefix = text.slice(0, index);
  const trackedNames = ['td', 'th', 'label', ...ariaTagNames];
  const alt = trackedNames.map(escapeForAlternation).join('|');
  const openRe = new RegExp(`<(${alt})\\b([^>]*?)(/?)>`, 'g');
  const closeRe = new RegExp(`</(${alt})>`, 'g');

  type AncestorKind = 'td' | 'th' | 'ariaCell' | 'label' | 'other';
  const stack: Array<{ tag: string; ancestorKind: AncestorKind; isCheckHitLabel: boolean }> = [];
  const events: Array<{ pos: number; kind: 'open' | 'close'; tag: string; ancestorKind?: AncestorKind; isCheckHitLabel?: boolean }> = [];
  let m: RegExpExecArray | null;
  while ((m = openRe.exec(prefix)) !== null) {
    const tagName = m[1] as string;
    const attrs = m[2] ?? '';
    const selfClosing = m[3] === '/';
    if (selfClosing) continue; // e.g. `<span role="columnheader" aria-hidden="true" />` -- opens and closes at once, no net ancestor
    let ancestorKind: AncestorKind;
    if (tagName === 'td' || tagName === 'th') ancestorKind = tagName;
    else if (tagName === 'label') ancestorKind = 'label';
    else ancestorKind = ARIA_CELL_ROLE_RE.test(attrs) ? 'ariaCell' : 'other';
    events.push({
      pos: m.index,
      kind: 'open',
      tag: tagName,
      ancestorKind,
      isCheckHitLabel: ancestorKind === 'label' && /\bchq-check-hit\b/.test(attrs),
    });
  }
  while ((m = closeRe.exec(prefix)) !== null) {
    events.push({ pos: m.index, kind: 'close', tag: m[1] as string });
  }
  events.sort((a, b) => a.pos - b.pos);
  for (const e of events) {
    if (e.kind === 'open') {
      stack.push({ tag: e.tag, ancestorKind: e.ancestorKind as AncestorKind, isCheckHitLabel: e.isCheckHitLabel ?? false });
    } else {
      const i = stack.map((s) => s.tag).lastIndexOf(e.tag);
      if (i !== -1) stack.splice(i, 1);
    }
  }
  const top = stack[stack.length - 1];
  if (!top || top.ancestorKind === 'other') return null;
  return { tag: top.ancestorKind, isCheckHitLabel: top.isCheckHitLabel };
}

/** Every `.chq-check` site in `content`, tagged with its nearest {td,th,ariaCell,label} ancestor.
 * `cssContents` (default empty -- unused by call sites that never resolve a plain label wrap,
 * e.g. the ARIA-table unit tests below) is passed to `classResolvesToPhoneFloor` for the DEC-393
 * wave-26 `labelIsBare` disposition of a plain, non-check-hit label wrap. */
export function findCheckSites(fileLabel: string, content: string, cssContents: string[] = []): CheckSite[] {
  const out: CheckSite[] = [];
  const ariaTagNames = ariaCellTagNames(content);
  const re = new RegExp(CHECK_CLASS_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const line = content.slice(0, m.index).split('\n').length;
    const ancestor = nearestOpenAncestor(content, m.index, ariaTagNames);
    const isPlainLabel = ancestor?.tag === 'label' && !ancestor.isCheckHitLabel;
    let labelIsBare = false;
    if (isPlainLabel) {
      const details = labelWrapDetails(content, m.index);
      const floored = details ? classResolvesToPhoneFloor(cssContents, details.className) : false;
      const hasContent = details ? labelHasRealContent(details.inner) : false;
      labelIsBare = !floored && !hasContent;
    }
    out.push({
      file: fileLabel,
      line,
      nearestOpenTag: ancestor?.tag ?? null,
      nearestLabelIsCheckHit: ancestor?.tag === 'label' && ancestor.isCheckHitLabel,
      labelIsBare,
    });
  }
  return out;
}

/** Population: every `.chq-check` site whose nearest {td,th,ariaCell,label} ancestor is `td`/`th`/
 * `ariaCell` directly, is a `.chq-check-hit` label -- i.e. it is a table cell's (HTML or ARIA) own
 * control that has (now) no OTHER label reaching the tap floor -- OR is a plain (non-check-hit)
 * label wrap that `labelIsBare` (DEC-393 wave-26 amendment) found to be neither floored by its own
 * class nor carrying real content of its own. A site inside any OTHER label -- one that IS floored
 * or DOES carry real content -- is excluded: that label already reaches the floor on its own. */
export function inCellPopulation(sites: CheckSite[]): CheckSite[] {
  return sites.filter(
    (s) =>
      s.nearestOpenTag === 'td' ||
      s.nearestOpenTag === 'th' ||
      s.nearestOpenTag === 'ariaCell' ||
      s.nearestLabelIsCheckHit ||
      s.labelIsBare,
  );
}

function loadSites(): CheckSite[] {
  const cssContents = allCssFiles(HERE).map((f) => readFileSync(f, 'utf-8'));
  const out: CheckSite[] = [];
  for (const abs of allTsxFiles(HERE)) {
    const content = readFileSync(abs, 'utf-8');
    if (!content.includes('chq-check')) continue;
    out.push(...findCheckSites(relative(REPO_ROOT, abs), content, cssContents));
  }
  return out;
}

/** True if the line at `line` (1-indexed) in `abs`'s content is inside a `<label
 * className="chq-check-hit">` -- i.e. within [line-2, line] a `chq-check-hit` label opens and has
 * not yet closed. Deliberately narrow: this scan's wrapped sites are always written with the
 * `<label className="chq-check-hit">` opening tag 1-2 lines above the input. */
export function isWrappedInCheckHit(content: string, line: number): boolean {
  const lines = content.split('\n');
  for (let i = Math.max(0, line - 4); i < line; i++) {
    if ((lines[i] ?? '').includes('chq-check-hit')) return true;
  }
  return false;
}

describe('check-hit receipt: every in-cell .chq-check is wrapped in .chq-check-hit (DEC-393 wave-124 amendment)', () => {
  const allSites = loadSites();
  const population = inCellPopulation(allSites);

  it('population is non-vacuous (positive control)', () => {
    expect(population.length).toBeGreaterThan(0);
  });

  it('the two TaskView.tsx ARIA-table .chq-check sites are found and wrapped, by exact count', () => {
    // TaskView.tsx has exactly four `.chq-check`-class-attribute occurrences (select-all header,
    // per-row select) -- two are the real `<input className="chq-check chq-taskview-check">`
    // sites, the other two are the `<label className="chq-check-hit">` wrapper's OWN opening tag
    // (CHECK_CLASS_RE's `\bchq-check\b` also matches inside "chq-check-hit" at the hyphen
    // boundary; this is pre-existing scan behaviour, unchanged here). Exact line list, not just
    // non-zero, so a future site silently falling OUT of this bucket (e.g. reverting to a `<td>`)
    // is caught here.
    const taskViewSites = allSites.filter((s) => s.file === 'app/src/pages/speakers/TaskView.tsx');
    expect(taskViewSites.map((s) => s.line)).toEqual([568, 571, 591, 594]);

    // The two real input sites (571, 594): nearest ancestor is the `.chq-check-hit` label itself
    // (DEC-393 wave-124 shape) -- the widened `ariaCell` ancestor one level further out is what
    // proves the label is genuinely wrapping a table-cell site in the first place (proved directly
    // against the file's raw, unwrapped ARIA markup in the `nearestOpenAncestor` unit block below).
    const inputSites = taskViewSites.filter((s) => s.line === 571 || s.line === 594);
    for (const s of inputSites) {
      expect(s.nearestOpenTag).toBe('label');
      expect(s.nearestLabelIsCheckHit).toBe(true);
      expect(population.some((p) => p.file === s.file && p.line === s.line)).toBe(true);
    }

    // The two label-open-tag "sites" (568, 591): scanned mid-tag, before their own `<label ...>`
    // closes, so their nearest ancestor is the enclosing `<span role="columnheader"|"cell">` --
    // this IS the DEC-991 widened ariaCell ancestor, proving the widened walk is what admits the
    // label wrap to population membership at all (it is not itself unwrapped, so it is excluded
    // from `unwrapped in-cell .chq-check site` by `isWrappedInCheckHit` finding its own text).
    const labelTagSites = taskViewSites.filter((s) => s.line === 568 || s.line === 591);
    for (const s of labelTagSites) {
      expect(s.nearestOpenTag).toBe('ariaCell');
    }
  });

  it('a non-check-hit label-wrapped .chq-check is excluded from population ONLY when it is actually floored or has real content -- never unconditionally (DEC-393 wave-26 amendment)', () => {
    const otherLabelWrapped = allSites.filter((s) => s.nearestOpenTag === 'label' && !s.nearestLabelIsCheckHit);
    expect(otherLabelWrapped.length).toBeGreaterThan(0);
    // Every one of the tree's real, current option-list/toggle sites carries either a floored
    // wrapping class or real text/element content -- so this remains, empirically, a full
    // exclusion today (the check is CHECKED per-site below, not just non-vacuous).
    for (const s of otherLabelWrapped) {
      expect(s.labelIsBare, `${s.file}:${s.line} graded bare -- should be floored or carry content`).toBe(false);
      expect(population.some((p) => p.file === s.file && p.line === s.line)).toBe(false);
    }
    // A bare label wrap (no floor, no content) is NOT vacuously excluded -- it takes the
    // population, per the synthetic controls in the `unit: labelIsBare` block below.
  });

  it('anti-vacuity (DEC-999 wave-28 amendment): the classifier finds both real bare-box labels named by class token, independent of whether they are floored', () => {
    // The wave-27/28 `labelHasRealContent` vacuity: a naive `[^>]*` input-tag stripper stops at
    // the FIRST `>` it meets, which for a real multi-line `<input ... onChange={() => ...} />`
    // is the arrow's `>`, not the tag's own close -- so it always found "real content" left over
    // and could never classify a real site as bare. This assertion is corpus-keyed (not a
    // fixture): it looks the two known real bare-box labels up by their stable class token and
    // requires labelIsBare to be reachable for the un-floored one, so a stripper regression that
    // silently empties the population again fails loudly here instead of just going quiet.
    // Looks up a site by the STABLE CLASS TOKEN of its own wrapping label (not merely "some
    // non-check-hit label in this file" -- ImportWizard.tsx alone has several) -- keyed on
    // content per DEC-999's own ruling (a scan's self-referential anchor is keyed on content,
    // never a source line number that a legitimate edit can move).
    function findSiteByLabelClassToken(fileSuffix: string, classToken: string): { site: CheckSite; content: string; checkIndex: number } {
      const abs = allTsxFiles(HERE).find((f) => f.endsWith(fileSuffix));
      expect(abs, `no .tsx file ending in ${fileSuffix} found under app/src`).toBeDefined();
      const content = readFileSync(abs as string, 'utf-8');
      const re = new RegExp(CHECK_CLASS_RE.source, 'g');
      let m: RegExpExecArray | null;
      while ((m = re.exec(content)) !== null) {
        const details = labelWrapDetails(content, m.index);
        if (details?.className.split(/\s+/).includes(classToken)) {
          const line = content.slice(0, m.index).split('\n').length;
          const site = allSites.find((s) => s.file.endsWith(fileSuffix) && s.line === line);
          expect(site, `${fileSuffix}:${line} (.${classToken}) must appear in allSites`).toBeDefined();
          return { site: site as CheckSite, content, checkIndex: m.index };
        }
      }
      throw new Error(`no .chq-check site found wrapped by a label carrying class token ${classToken} in ${fileSuffix}`);
    }

    // .chq-contacts-import-review-skip (ImportWizard.tsx) -- this task's own CSS change floors
    // it (contacts-panels.css's terminal max-width:700px block), so at HEAD it is correctly OUT
    // of `inCellPopulation` via the floor path (labelIsBare === false). The anti-vacuity claim is
    // proved directly against the stripper instead: labelHasRealContent must return false for
    // this site's own multi-line onChange input, independent of the floor.
    {
      const { site, content, checkIndex } = findSiteByLabelClassToken(
        'pages/contacts/ImportWizard.tsx',
        'chq-contacts-import-review-skip',
      );
      expect(site.labelIsBare, `${site.file}:${site.line} (.chq-contacts-import-review-skip) is now floored, so it must be OUT via the floor path`).toBe(false);
      const details = labelWrapDetails(content, checkIndex);
      expect(details, `${site.file}:${site.line} label wrap details must resolve`).not.toBeNull();
      expect(
        labelHasRealContent(details?.inner ?? 'unreachable'),
        `${site.file}:${site.line} (.chq-contacts-import-review-skip) must strip its own multi-line onChange input to empty`,
      ).toBe(false);
    }

    // .chq-visible-toggle (SubmissionDetailPage.tsx) -- already floored on main (wave-26 lane),
    // so it is correctly OUT of population via the floor, not via content. The vacuity bug this
    // amendment fixes is specifically that `labelHasRealContent` never returned false for either
    // site's un-stripped multi-line `onChange={() => ...}` input; assert that directly here so a
    // regression that re-breaks the stripper is caught even for an already-floored site.
    {
      const { site, content, checkIndex } = findSiteByLabelClassToken(
        'pages/submissions/SubmissionDetailPage.tsx',
        'chq-visible-toggle',
      );
      expect(site.labelIsBare, `${site.file}:${site.line} (.chq-visible-toggle) is floored on main, so it must be OUT via the floor path`).toBe(false);
      const details = labelWrapDetails(content, checkIndex);
      expect(details, `${site.file}:${site.line} label wrap details must resolve`).not.toBeNull();
      expect(
        labelHasRealContent(details?.inner ?? 'unreachable'),
        `${site.file}:${site.line} (.chq-visible-toggle) must strip its own multi-line onChange input to empty`,
      ).toBe(false);
    }
  });

  it('every in-cell .chq-check site is wrapped in .chq-check-hit', () => {
    const unwrapped: CheckSite[] = [];
    for (const site of population) {
      const abs = join(REPO_ROOT, site.file);
      const content = readFileSync(abs, 'utf-8');
      if (!isWrappedInCheckHit(content, site.line)) unwrapped.push(site);
    }
    expect(unwrapped, `unwrapped in-cell .chq-check sites:\n${unwrapped.map((s) => `  ${s.file}:${s.line}`).join('\n')}`).toEqual([]);
  });

  describe('unit: nearestOpenAncestor', () => {
    it('finds td as the nearest ancestor for a bare table-cell checkbox', () => {
      const text = '<td>\n  <input className="chq-check" />\n</td>';
      expect(nearestOpenAncestor(text, text.indexOf('<input'))).toEqual({ tag: 'td', isCheckHitLabel: false });
    });

    it('finds th as the nearest ancestor for a bare header-cell checkbox', () => {
      const text = '<th>\n  <input className="chq-check" />\n</th>';
      expect(nearestOpenAncestor(text, text.indexOf('<input'))).toEqual({ tag: 'th', isCheckHitLabel: false });
    });

    it('finds a non-check-hit label as the nearest ancestor when an option-list label wraps the input inside a td (out of population)', () => {
      const text = '<td>\n  <label className="chq-checkbox-label">\n    <input className="chq-check" />\n  </label>\n</td>';
      expect(nearestOpenAncestor(text, text.indexOf('<input'))).toEqual({ tag: 'label', isCheckHitLabel: false });
    });

    it('finds the check-hit label as the nearest ancestor once wrapped, flagged isCheckHitLabel', () => {
      const text = '<td>\n  <label className="chq-check-hit">\n    <input className="chq-check" />\n  </label>\n</td>';
      expect(nearestOpenAncestor(text, text.indexOf('<input'))).toEqual({ tag: 'label', isCheckHitLabel: true });
    });

    it('returns null when neither td, th, nor label encloses the site', () => {
      const text = '<div>\n  <input className="chq-check" />\n</div>';
      expect(nearestOpenAncestor(text, text.indexOf('<input'))).toBeNull();
    });

    it('DEC-991: finds ariaCell as the nearest ancestor for a bare checkbox inside role="cell"', () => {
      const text = '<span role="cell">\n  <input className="chq-check" />\n</span>';
      expect(nearestOpenAncestor(text, text.indexOf('<input'), ariaCellTagNames(text))).toEqual({
        tag: 'ariaCell',
        isCheckHitLabel: false,
      });
    });

    it('DEC-991: finds ariaCell for role="gridcell" and role="columnheader" too, and for a non-span tag', () => {
      const gridcell = '<div role="gridcell">\n  <input className="chq-check" />\n</div>';
      expect(nearestOpenAncestor(gridcell, gridcell.indexOf('<input'), ariaCellTagNames(gridcell))).toEqual({
        tag: 'ariaCell',
        isCheckHitLabel: false,
      });
      const columnheader = '<span role="columnheader">\n  <input className="chq-check" />\n</span>';
      expect(nearestOpenAncestor(columnheader, columnheader.indexOf('<input'), ariaCellTagNames(columnheader))).toEqual({
        tag: 'ariaCell',
        isCheckHitLabel: false,
      });
    });

    it('DEC-991: a check-hit label nested inside a role="cell" span still resolves to the label (the wrap), not ariaCell', () => {
      const text = '<span role="cell">\n  <label className="chq-check-hit">\n    <input className="chq-check" />\n  </label>\n</span>';
      expect(nearestOpenAncestor(text, text.indexOf('<input'), ariaCellTagNames(text))).toEqual({
        tag: 'label',
        isCheckHitLabel: true,
      });
    });

    it('DEC-991: an unrelated same-named element with no role attribute is not mistaken for ariaCell (tracked for depth only)', () => {
      // The file uses <span role="cell"> elsewhere, so 'span' is a tracked tag name -- but THIS
      // span carries no role, so it must not be reported as an ancestor at all.
      const text = '<table><tr><span role="cell">x</span></tr></table>\n<span>\n  <input className="chq-check" />\n</span>';
      const tags = ariaCellTagNames(text);
      expect(tags.has('span')).toBe(true);
      expect(nearestOpenAncestor(text, text.lastIndexOf('<input'), tags)).toBeNull();
    });
  });

  describe('unit: ariaCellTagNames (DEC-991, DEC-808 derived-not-hand-listed population)', () => {
    it('is non-vacuous, by exact count, for TaskView.tsx\'s real ARIA table', () => {
      const content = readFileSync(join(REPO_ROOT, 'app/src/pages/speakers/TaskView.tsx'), 'utf-8');
      expect([...ariaCellTagNames(content)]).toEqual(['span']);
    });

    it('is empty for a file with no role="cell"/"gridcell"/"columnheader" element', () => {
      expect([...ariaCellTagNames('<td><input className="chq-check" /></td>')]).toEqual([]);
    });
  });

  describe('unit: inCellPopulation / isWrappedInCheckHit (synthetic positive control so the population can never go vacuous)', () => {
    it('a synthetic bare td/th site, a check-hit-wrapped site, and a BARE plain-label site are in population; a floored/content-bearing other-label site is not', () => {
      const sites: CheckSite[] = [
        { file: 'fixture.tsx', line: 1, nearestOpenTag: 'td', nearestLabelIsCheckHit: false, labelIsBare: false },
        { file: 'fixture.tsx', line: 2, nearestOpenTag: 'label', nearestLabelIsCheckHit: false, labelIsBare: false },
        { file: 'fixture.tsx', line: 3, nearestOpenTag: 'label', nearestLabelIsCheckHit: true, labelIsBare: false },
        { file: 'fixture.tsx', line: 4, nearestOpenTag: 'label', nearestLabelIsCheckHit: false, labelIsBare: true },
      ];
      const pop = inCellPopulation(sites);
      expect(pop).toEqual([
        { file: 'fixture.tsx', line: 1, nearestOpenTag: 'td', nearestLabelIsCheckHit: false, labelIsBare: false },
        { file: 'fixture.tsx', line: 3, nearestOpenTag: 'label', nearestLabelIsCheckHit: true, labelIsBare: false },
        { file: 'fixture.tsx', line: 4, nearestOpenTag: 'label', nearestLabelIsCheckHit: false, labelIsBare: true },
      ]);
    });

    it('isWrappedInCheckHit finds the wrapper within the preceding lines', () => {
      const content = ['<td>', '  <label className="chq-check-hit">', '    <input className="chq-check" />'].join('\n');
      expect(isWrappedInCheckHit(content, 3)).toBe(true);
    });

    it('isWrappedInCheckHit is false with no wrapper present', () => {
      const content = ['<td>', '    <input className="chq-check" />'].join('\n');
      expect(isWrappedInCheckHit(content, 2)).toBe(false);
    });
  });

  describe('unit: labelWrapDetails / labelHasRealContent / classResolvesToPhoneFloor / findCheckSites labelIsBare (DEC-393 wave-26 amendment -- an empty <label> is not a tap target)', () => {
    it('labelWrapDetails finds the wrapping label\'s className and the raw inner content between the input and the close tag', () => {
      const text = '<td>\n  <label className="chq-x-fake-toggle">\n    <input type="checkbox" className="chq-check" />\n    Some text\n  </label>\n</td>';
      const details = labelWrapDetails(text, text.indexOf('<input'));
      expect(details?.className).toBe('chq-x-fake-toggle');
      expect(details?.inner.trim()).toContain('Some text');
    });

    it('labelHasRealContent is true for a text child beside the input, false for the input alone (whitespace only)', () => {
      const withText = '\n    <input type="checkbox" className="chq-check" />\n    Confirmed\n  ';
      const bare = '\n    <input type="checkbox" className="chq-check" />\n  ';
      expect(labelHasRealContent(withText)).toBe(true);
      expect(labelHasRealContent(bare)).toBe(false);
    });

    it('labelHasRealContent is true for a non-input element child beside the input (e.g. a status chip)', () => {
      const withElement = '\n    <input type="checkbox" className="chq-check" />\n    <span className="chq-x-fake-chip">On</span>\n  ';
      expect(labelHasRealContent(withElement)).toBe(true);
    });

    it('classResolvesToPhoneFloor is true for a top-level (all-widths) min-height:44px rule, e.g. speakers.css\'s real .chq-check-label', () => {
      const css = '.chq-check-label {\n  display: flex;\n  align-items: center;\n  min-height: 44px;\n}\n';
      expect(classResolvesToPhoneFloor([css], 'chq-check-label')).toBe(true);
    });

    it('classResolvesToPhoneFloor is true for a rule inside an @media (max-width: N>=390) block', () => {
      const css = '@media (max-width: 700px) {\n  .chq-x-fake-toggle {\n    min-height: 44px;\n  }\n}\n';
      expect(classResolvesToPhoneFloor([css], 'chq-x-fake-toggle')).toBe(true);
    });

    it('classResolvesToPhoneFloor is false for a rule inside an @media (max-width: N<390) block -- never reached at the 390 phone frame', () => {
      const css = '@media (max-width: 380px) {\n  .chq-x-fake-toggle {\n    min-height: 44px;\n  }\n}\n';
      expect(classResolvesToPhoneFloor([css], 'chq-x-fake-toggle')).toBe(false);
    });

    it('classResolvesToPhoneFloor is false when the class declares no min-height, or only a sub-44px one, at any width', () => {
      const css = '.chq-x-fake-toggle {\n  display: flex;\n  gap: 8px;\n}\n.chq-x-fake-toggle-2 {\n  min-height: 30px;\n}\n';
      expect(classResolvesToPhoneFloor([css], 'chq-x-fake-toggle')).toBe(false);
      expect(classResolvesToPhoneFloor([css], 'chq-x-fake-toggle-2')).toBe(false);
    });

    it('classResolvesToPhoneFloor ignores a min-height mentioned only inside a CSS comment (DEC-989 evasion shape)', () => {
      const css = '/* .chq-x-fake-toggle { min-height: 44px; } -- retired, no rule, no markup left */\n.chq-x-fake-toggle {\n  display: flex;\n}\n';
      expect(classResolvesToPhoneFloor([css], 'chq-x-fake-toggle')).toBe(false);
    });

    it('findCheckSites: labelIsBare is FALSE for a floored empty label (synthetic positive control: an empty floored label is OUT)', () => {
      const tsx = '<td>\n  <label className="chq-x-fake-floored-toggle">\n    <input type="checkbox" className="chq-check" />\n  </label>\n</td>';
      const css = '@media (max-width: 700px) {\n  .chq-x-fake-floored-toggle {\n    min-height: 44px;\n  }\n}\n';
      const sites = findCheckSites('fixture.tsx', tsx, [css]);
      expect(sites).toHaveLength(1);
      expect(sites[0]?.nearestOpenTag).toBe('label');
      expect(sites[0]?.nearestLabelIsCheckHit).toBe(false);
      expect(sites[0]?.labelIsBare).toBe(false);
      expect(inCellPopulation(sites)).toEqual([]);
    });

    it('findCheckSites: labelIsBare is TRUE for an empty, unfloored label (synthetic positive control: an empty unfloored label is IN)', () => {
      const tsx = '<td>\n  <label className="chq-x-fake-unfloored-toggle">\n    <input type="checkbox" className="chq-check" />\n  </label>\n</td>';
      const sites = findCheckSites('fixture.tsx', tsx, []);
      expect(sites).toHaveLength(1);
      expect(sites[0]?.nearestOpenTag).toBe('label');
      expect(sites[0]?.nearestLabelIsCheckHit).toBe(false);
      expect(sites[0]?.labelIsBare).toBe(true);
      expect(inCellPopulation(sites)).toHaveLength(1);
    });

    it('findCheckSites: labelIsBare is FALSE for an unfloored label carrying real text content (matches the tree\'s real option-list/toggle idiom)', () => {
      const tsx = '<td>\n  <label className="chq-x-fake-unfloored-toggle">\n    <input type="checkbox" className="chq-check" />\n    Include reviewer feedback\n  </label>\n</td>';
      const sites = findCheckSites('fixture.tsx', tsx, []);
      expect(sites).toHaveLength(1);
      expect(sites[0]?.labelIsBare).toBe(false);
      expect(inCellPopulation(sites)).toEqual([]);
    });
  });
});
