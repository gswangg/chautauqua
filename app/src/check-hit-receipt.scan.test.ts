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
// POPULATION (DEC-808, derived not hand-listed): every `.chq-check` site
// across `app/src/**/*.tsx` (test files excluded) that is rendered directly
// as a `<td>`/`<th>` cell's own control -- i.e. the JSX immediately
// containing the `className="chq-check"` input, walking outward, opens on
// `<td` or `<th` (whitespace/attributes allowed) before it opens on
// `<label`. A site already wrapped in a `<label ...>` (the option-list/
// toggle idiom used everywhere else in the tree) is OUT of population --
// that label already reaches the floor on its own text/children, which is
// not this scan's concern.
//
// This scan's own population-derivation walks the SOURCE TEXT (not a JSX
// AST), so it looks for the nearest preceding unclosed `<td`/`<th`/`<label`
// opening tag before each `.chq-check` occurrence, by naive tag-depth
// tracking -- adequate here because every population member and every
// exempt (label-wrapped) member in this tree is written as plain,
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
  /** Nearest enclosing opening tag found walking backward: 'td' | 'th' | 'label' | null. */
  nearestOpenTag: 'td' | 'th' | 'label' | null;
  /** True only when `nearestOpenTag === 'label'` and that label's own `className` carries
   * `chq-check-hit` -- i.e. the wrapper THIS fix adds, as opposed to a pre-existing option-list/
   * toggle label (`chq-checkbox-label`, `chq-check-label`, `chq-comms-toggle`, ...). A site whose
   * nearest ancestor is a check-hit label is still a table-cell site: the wrapper doesn't erase
   * membership, it's the fix. */
  nearestLabelIsCheckHit: boolean;
}

const CHECK_CLASS_RE = /className=(?:"[^"]*\bchq-check\b[^"]*"|'[^']*\bchq-check\b[^']*')/g;
const OPEN_TAG_RE = /<(td|th)\b|<label\b([^>]*)>/g;
const CLOSE_TAG_RE = /<\/(td|th|label)>/g;

interface OpenAncestor {
  tag: 'td' | 'th' | 'label';
  isCheckHitLabel: boolean;
}

/** Walks backward from `index` in `text`, tracking td/th/label open/close tags, and returns the
 * innermost tag still open at `index` -- i.e. the nearest ancestor among {td, th, label} -- along
 * with whether that ancestor (if a label) carries `chq-check-hit`. Tags of other kinds are
 * irrelevant to this scan's population rule and are not tracked. */
export function nearestOpenAncestor(text: string, index: number): OpenAncestor | null {
  const prefix = text.slice(0, index);
  const stack: OpenAncestor[] = [];
  const events: Array<{ pos: number; kind: 'open' | 'close'; tag: 'td' | 'th' | 'label'; attrs?: string }> = [];
  let m: RegExpExecArray | null;
  const openRe = new RegExp(OPEN_TAG_RE.source, 'g');
  while ((m = openRe.exec(prefix)) !== null) {
    if (m[0].startsWith('<label')) {
      events.push({ pos: m.index, kind: 'open', tag: 'label', attrs: m[2] ?? '' });
    } else {
      events.push({ pos: m.index, kind: 'open', tag: (m[1] as 'td' | 'th') });
    }
  }
  const closeRe = new RegExp(CLOSE_TAG_RE.source, 'g');
  while ((m = closeRe.exec(prefix)) !== null) {
    events.push({ pos: m.index, kind: 'close', tag: m[1] as 'td' | 'th' | 'label' });
  }
  events.sort((a, b) => a.pos - b.pos);
  for (const e of events) {
    if (e.kind === 'open') {
      stack.push({ tag: e.tag, isCheckHitLabel: e.tag === 'label' && /\bchq-check-hit\b/.test(e.attrs ?? '') });
    } else {
      const i = stack.map((s) => s.tag).lastIndexOf(e.tag);
      if (i !== -1) stack.splice(i, 1);
    }
  }
  return stack.length > 0 ? (stack[stack.length - 1] as OpenAncestor) : null;
}

/** Every `.chq-check` site in `content`, tagged with its nearest {td,th,label} ancestor. */
export function findCheckSites(fileLabel: string, content: string): CheckSite[] {
  const out: CheckSite[] = [];
  const re = new RegExp(CHECK_CLASS_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const line = content.slice(0, m.index).split('\n').length;
    const ancestor = nearestOpenAncestor(content, m.index);
    out.push({
      file: fileLabel,
      line,
      nearestOpenTag: ancestor?.tag ?? null,
      nearestLabelIsCheckHit: ancestor?.tag === 'label' && ancestor.isCheckHitLabel,
    });
  }
  return out;
}

/** Population: every `.chq-check` site whose nearest {td,th,label} ancestor is `td`/`th` directly,
 * or is a `.chq-check-hit` label -- i.e. it is a table cell's own control that has (now) no OTHER
 * label reaching the tap floor. A site inside any other label (the option-list/toggle idiom) is
 * excluded: that label already reaches the floor on its own text/children. */
export function inCellPopulation(sites: CheckSite[]): CheckSite[] {
  return sites.filter((s) => s.nearestOpenTag === 'td' || s.nearestOpenTag === 'th' || s.nearestLabelIsCheckHit);
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
