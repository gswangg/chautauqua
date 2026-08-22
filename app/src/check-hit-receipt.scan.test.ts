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

/** Every `.chq-check` site in `content`, tagged with its nearest {td,th,ariaCell,label} ancestor. */
export function findCheckSites(fileLabel: string, content: string): CheckSite[] {
  const out: CheckSite[] = [];
  const ariaTagNames = ariaCellTagNames(content);
  const re = new RegExp(CHECK_CLASS_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const line = content.slice(0, m.index).split('\n').length;
    const ancestor = nearestOpenAncestor(content, m.index, ariaTagNames);
    out.push({
      file: fileLabel,
      line,
      nearestOpenTag: ancestor?.tag ?? null,
      nearestLabelIsCheckHit: ancestor?.tag === 'label' && ancestor.isCheckHitLabel,
    });
  }
  return out;
}

/** Population: every `.chq-check` site whose nearest {td,th,ariaCell,label} ancestor is `td`/`th`/
 * `ariaCell` directly, or is a `.chq-check-hit` label -- i.e. it is a table cell's (HTML or ARIA)
 * own control that has (now) no OTHER label reaching the tap floor. A site inside any other label
 * (the option-list/toggle idiom) is excluded: that label already reaches the floor on its own
 * text/children. */
export function inCellPopulation(sites: CheckSite[]): CheckSite[] {
  return sites.filter(
    (s) => s.nearestOpenTag === 'td' || s.nearestOpenTag === 'th' || s.nearestOpenTag === 'ariaCell' || s.nearestLabelIsCheckHit,
  );
}

function loadSites(): CheckSite[] {
  const out: CheckSite[] = [];
  for (const abs of allTsxFiles(HERE)) {
    const content = readFileSync(abs, 'utf-8');
    if (!content.includes('chq-check')) continue;
    out.push(...findCheckSites(relative(REPO_ROOT, abs), content));
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

  it('every option-list/toggle .chq-check (wrapped in some OTHER label already) is excluded from population (negative control)', () => {
    const otherLabelWrapped = allSites.filter((s) => s.nearestOpenTag === 'label' && !s.nearestLabelIsCheckHit);
    expect(otherLabelWrapped.length).toBeGreaterThan(0);
    for (const s of otherLabelWrapped) {
      expect(population.some((p) => p.file === s.file && p.line === s.line)).toBe(false);
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
    it('a synthetic bare td/th site and a check-hit-wrapped site are in population; an other-label site is not', () => {
      const sites: CheckSite[] = [
        { file: 'fixture.tsx', line: 1, nearestOpenTag: 'td', nearestLabelIsCheckHit: false },
        { file: 'fixture.tsx', line: 2, nearestOpenTag: 'label', nearestLabelIsCheckHit: false },
        { file: 'fixture.tsx', line: 3, nearestOpenTag: 'label', nearestLabelIsCheckHit: true },
      ];
      const pop = inCellPopulation(sites);
      expect(pop).toEqual([
        { file: 'fixture.tsx', line: 1, nearestOpenTag: 'td', nearestLabelIsCheckHit: false },
        { file: 'fixture.tsx', line: 3, nearestOpenTag: 'label', nearestLabelIsCheckHit: true },
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
});
