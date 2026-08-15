// DEC-369 amendment (w51-d): a completed-write confirmation is announced
// (`role="status"`) but must never wear the refusal box (`.chq-error` /
// `.chq-error-banner`) -- the two registers this codebase declares are
// `.chq-toast` for "this succeeded" and `.chq-error`/`.chq-error-banner` for
// "this failed". This scans every non-test *.tsx file under app/src for a
// JSX element that carries BOTH `role="status"` and a className token of
// `chq-error` or `chq-error-banner`, following the house convention of
// enumerating the whole tree (never a hand-list of pages) so a future page
// reintroducing the mixed vocabulary trips it without the scan needing to
// know that page's name in advance.
//
// `role="alert"` (a live refusal announcement) is unaffected -- this rule is
// specifically about the STATUS role, which this codebase reserves for
// success/neutral confirmations, wearing the error box.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_SRC = HERE; // app/src

/** Every *.tsx file under app/src, excluding test files, keyed by its path
 * relative to app/src (posix separators). */
function allSourceFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.tsx')) continue;
    if (entry.name.includes('.test.')) continue;
    const full = join(entry.parentPath, entry.name);
    out.push(relative(root, full).split(sep).join('/'));
  }
  return out.sort();
}

const SOURCE_FILES = allSourceFiles(APP_SRC);

// A JSX opening tag, captured whole (attributes only, no children) so both
// `role=` and `className=` can be read off the same element regardless of
// attribute order or how many other attributes sit between them. Matches
// self-closing and non-self-closing forms alike.
const OPEN_TAG_RE = /<[A-Za-z][\w.]*\s+([^>]*?)\/?>/g;

function attrValue(attrs: string, name: string): string | null {
  const m = attrs.match(new RegExp(`\\b${name}=(?:"([^"]*)"|'([^']*)')`));
  if (!m) return null;
  return m[1] ?? m[2] ?? '';
}

function classTokens(attrs: string): Set<string> {
  const value = attrValue(attrs, 'className');
  if (value === null) return new Set();
  return new Set(value.split(/\s+/).filter(Boolean));
}

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split('\n').length;
}

interface Offense {
  file: string;
  line: number;
  classes: string;
}

const ERROR_TOKENS = new Set(['chq-error', 'chq-error-banner']);

function scanFile(relFile: string, source: string): Offense[] {
  const offenses: Offense[] = [];
  let m: RegExpExecArray | null;
  OPEN_TAG_RE.lastIndex = 0;
  while ((m = OPEN_TAG_RE.exec(source))) {
    const attrs = m[1] ?? '';
    const role = attrValue(attrs, 'role');
    if (role !== 'status') continue;
    const tokens = classTokens(attrs);
    const hit = [...tokens].filter((t) => ERROR_TOKENS.has(t));
    if (hit.length > 0) {
      offenses.push({ file: relFile, line: lineOf(source, m.index), classes: hit.join(' ') });
    }
  }
  return offenses;
}

describe('DEC-369 amendment: role="status" confirmations never carry the refusal box', () => {
  it('visits at least 15 source files (vacuous-scan tripwire)', () => {
    expect(SOURCE_FILES.length).toBeGreaterThanOrEqual(15);
  });

  it('flags a synthetic element mixing role="status" with chq-error (negative-control tripwire)', () => {
    const synthetic = '<div className="chq-error" role="status">Added Jordan Alvarez.</div>';
    expect(scanFile('__synthetic__.tsx', synthetic)).toEqual([
      { file: '__synthetic__.tsx', line: 1, classes: 'chq-error' },
    ]);
  });

  for (const relFile of SOURCE_FILES) {
    it(`${relFile}: no element carries both role="status" and chq-error/chq-error-banner`, () => {
      const source = readFileSync(join(APP_SRC, relFile), 'utf8');
      const offenses = scanFile(relFile, source);
      expect(
        offenses,
        offenses.map((o) => `${o.file}:${o.line}: className carries ${o.classes}`).join('\n'),
      ).toEqual([]);
    });
  }
});
