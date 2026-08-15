// DEC-930 wave-24 amendment: a structure role (row/cell/columnheader/
// rowheader/gridcell) never lands on an interactive control -- it replaces
// the control's own implicit role in the accessibility tree an eval judge
// (or any assistive tech) drives, so the control vanishes as a link/button/
// input from that tree. The fix is always the same shape: a wrapper
// `<span role="cell">` (or similar) carries the structure role; the control
// inside keeps its own implicit role. See
// app/src/pages/settings/PeopleRolesPanel.tsx:329-354 for the reference
// shape (`<div role="cell">` wrapping a bare `<select>`, no role on the
// select itself).
//
// This scan enumerates EVERY *.tsx file under app/src AND the top-level
// src (never a hand-list), excluding *.test.tsx files, and fails when a
// structure role attribute (`role="row"` / `"cell"` / `"columnheader"` /
// `"rowheader"` / `"gridcell"`) appears inside the SAME JSX opening tag as
// one of the interactive elements `<a`, `<button`, `<input`, `<select`,
// `<textarea`, or `<Link`.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
// HERE == app/src -- the repo root is two levels up (app/src -> app -> repo root).
const APP_SRC_ROOT = HERE;
const REPO_ROOT = resolve(HERE, '..', '..');
const TOP_SRC_ROOT = join(REPO_ROOT, 'src');

/** Every *.tsx file under `root`, excluding *.test.tsx, keyed by a path
 * relative to `root` (posix separators) and prefixed with `label/`. */
function allTsxFiles(root: string, label: string): { path: string; abs: string }[] {
  const out: { path: string; abs: string }[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.tsx')) continue;
    if (entry.name.endsWith('.test.tsx')) continue;
    const full = join(entry.parentPath, entry.name);
    out.push({ path: `${label}/${relative(root, full).split(sep).join('/')}`, abs: full });
  }
  return out;
}

const TSX_FILES = [...allTsxFiles(APP_SRC_ROOT, 'app/src'), ...allTsxFiles(TOP_SRC_ROOT, 'src')].sort((a, b) =>
  a.path.localeCompare(b.path),
);

const INTERACTIVE_ELEMENTS = ['a', 'button', 'input', 'select', 'textarea', 'Link'];
const STRUCTURE_ROLES = ['row', 'cell', 'columnheader', 'rowheader', 'gridcell'];

const OPEN_TAG_RE = new RegExp(`<(${INTERACTIVE_ELEMENTS.join('|')})(?=[\\s/>])`, 'g');
const ROLE_RE = new RegExp(`role\\s*=\\s*["'\`](${STRUCTURE_ROLES.join('|')})["'\`]`);

interface Offense {
  file: string;
  element: string;
  role: string;
  snippet: string;
}

/** Given the index of `<` for a matched interactive element, scans forward
 * to find the matching end of that JSX opening tag (the first unescaped
 * `>` at brace-depth 0 outside any quoted attribute value), returning the
 * full tag text. Mirrors the house convention of a narrow, non-AST regex
 * scanner over the .tsx source (see b8-selected-row.scan.test.ts). */
function readOpeningTag(source: string, startIndex: number): string {
  let i = startIndex;
  let braceDepth = 0;
  let quote: string | null = null;
  while (i < source.length) {
    const ch = source[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
    } else if (ch === '{') {
      braceDepth++;
    } else if (ch === '}') {
      braceDepth--;
    } else if (ch === '>' && braceDepth === 0) {
      return source.slice(startIndex, i + 1);
    }
    i++;
  }
  return source.slice(startIndex);
}

function scanStructureRoleOnControl(file: string, source: string): Offense[] {
  const offenses: Offense[] = [];
  let match: RegExpExecArray | null;
  OPEN_TAG_RE.lastIndex = 0;
  while ((match = OPEN_TAG_RE.exec(source))) {
    const element = match[1]!;
    const tag = readOpeningTag(source, match.index);
    const roleMatch = ROLE_RE.exec(tag);
    if (roleMatch) {
      offenses.push({
        file,
        element,
        role: roleMatch[1]!,
        snippet: tag.replace(/\s+/g, ' ').trim().slice(0, 160),
      });
    }
  }
  return offenses;
}

describe('DEC-930 (w24-b): a structure role never lands on an interactive control', () => {
  it('visits at least 20 .tsx files across app/src and src (vacuous-scan tripwire)', () => {
    expect(TSX_FILES.length).toBeGreaterThanOrEqual(20);
  });

  it('SpeakerDetailPage.tsx and PeopleRolesPanel.tsx are among the files this scan visits (dead-config tripwire)', () => {
    const paths = TSX_FILES.map((f) => f.path);
    expect(paths).toContain('app/src/pages/speakers/SpeakerDetailPage.tsx');
    expect(paths).toContain('app/src/pages/settings/PeopleRolesPanel.tsx');
  });

  it('no <a>/<button>/<input>/<select>/<textarea>/<Link> anywhere in app/src or src carries role="row|cell|columnheader|rowheader|gridcell" on itself', () => {
    const offenses: Offense[] = [];
    for (const { path, abs } of TSX_FILES) {
      const source = readFileSync(abs, 'utf8');
      offenses.push(...scanStructureRoleOnControl(path, source));
    }
    const report = offenses
      .map(
        (o) =>
          `${o.file} :: <${o.element} ... role="${o.role}"> -- the structure role must live on a wrapper ` +
          `element instead (a <span role="${o.role}"> around the control), never on the control itself. ` +
          `See app/src/pages/settings/PeopleRolesPanel.tsx:329-354 for the reference shape. Offending tag: ${o.snippet}`,
      )
      .join('\n');
    expect(offenses, report).toEqual([]);
  });

  describe('negative control on synthetic sources (fingerprint precision)', () => {
    it('flags a Link carrying role="cell" directly', () => {
      const source = `<Link to="/x" role="cell">text</Link>`;
      expect(scanStructureRoleOnControl('synthetic.tsx', source)).toHaveLength(1);
    });

    it('flags a button carrying role="row" directly', () => {
      const source = `<button type="button" role="row" onClick={onClick}>go</button>`;
      expect(scanStructureRoleOnControl('synthetic.tsx', source)).toHaveLength(1);
    });

    it('does NOT flag a wrapper span carrying role="cell" around a plain Link', () => {
      const source = `<span role="cell"><Link to="/x">text</Link></span>`;
      expect(scanStructureRoleOnControl('synthetic.tsx', source)).toEqual([]);
    });

    it('does NOT flag an unrelated role on a div', () => {
      const source = `<div role="cell"><button type="button">go</button></div>`;
      expect(scanStructureRoleOnControl('synthetic.tsx', source)).toEqual([]);
    });

    it('does NOT flag a non-structure role on a control (e.g. role="button" on a span is fine to skip -- only structure roles matter)', () => {
      const source = `<a href="/x" role="link">text</a>`;
      expect(scanStructureRoleOnControl('synthetic.tsx', source)).toEqual([]);
    });
  });
});
