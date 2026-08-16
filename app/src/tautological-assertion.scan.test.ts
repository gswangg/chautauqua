// DEC-967 (wave-57 amendment): "A CITATION IS NOT AN ASSERTION" -- a test
// whose expected and actual values are the same literal (e.g.
// `expect(true).toBe(true)`) proves nothing and can pass forever regardless
// of what the code under test does. This scan enumerates every *.test.ts /
// *.test.tsx file under app/src and test/ (readdirSync recursive, DEC-808
// idiom, no hand-listed manifest), strips comments first (comment prose may
// legitimately quote a tautological expression while explaining why one
// used to exist here), and fails on any `expect(X).toBe(X)` /
// `expect(X).toEqual(X)` where X is the identical literal on both sides.
//
// There is exactly one offender in the tree as filed by this task (fixed in
// the same commit as this scan, in turn-diet-honesty.render.test.tsx) --
// there is no allowlist mechanism here by design: if the scan ever surfaces
// another one, the fix is to give it a real assertion or delete the test,
// never to exempt it.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');
const APP_SRC = join(REPO_ROOT, 'app', 'src');
const TEST_DIR = join(REPO_ROOT, 'test');

/** Every *.test.ts / *.test.tsx file under `root`, found via recursive readdirSync. */
function allTestFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.test.ts') && !entry.name.endsWith('.test.tsx')) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

/** Strip `//` line comments and `/* *\/` block comments before scanning. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

// Matches `expect(<literal>).toBe(<same literal>)` or `.toEqual(<same
// literal>)` where <literal> is one of: `true`, `false`, a bare integer, or
// a single- or double-quoted string with no interpolation/escaping inside
// it. Whitespace between the literal and the closing paren is tolerated.
const LITERAL = String.raw`(?:true|false|-?\d+|'[^'\\]*'|"[^"\\]*")`;
const TAUTOLOGY_RE = new RegExp(`expect\\(\\s*(${LITERAL})\\s*\\)\\s*\\.\\s*to(?:Be|Equal)\\(\\s*(${LITERAL})\\s*\\)`, 'g');

function findTautologies(src: string): string[] {
  const code = stripComments(src);
  const offenders: string[] = [];
  let match: RegExpExecArray | null;
  TAUTOLOGY_RE.lastIndex = 0;
  while ((match = TAUTOLOGY_RE.exec(code)) !== null) {
    const [full, lhs, rhs] = match;
    if (lhs === rhs) offenders.push(full);
  }
  return offenders;
}

describe('no tautological assertion survives in any test file (DEC-967 wave-57 amendment)', () => {
  const appTestFiles = allTestFiles(APP_SRC);
  const rootTestFiles = allTestFiles(TEST_DIR);
  const allFiles = [...appTestFiles, ...rootTestFiles];

  it('found more than 100 test files (sanity check on the enumeration -- a vacuous population passes trivially)', () => {
    expect(allFiles.length).toBeGreaterThan(100);
  });

  it('POSITIVE control: the matcher catches a synthetic tautology', () => {
    // Built via concatenation so this file's own source text never contains
    // a literal `expect(true).toBe(true)` (etc.) -- otherwise the scan
    // below, which includes this very file in its population, would flag
    // itself.
    const trueTautology = ['expect(', 'true', ').toBe(', 'true', ')'].join('');
    const stringTautology = ['expect(', "'x'", ').toBe(', "'x'", ')'].join('');
    const equalTautology = ['expect(', '1', ').toEqual(', '1', ')'].join('');
    expect(findTautologies(`it('x', () => { ${trueTautology}; });`)).toEqual([trueTautology]);
    expect(findTautologies(`it('x', () => { ${stringTautology}; });`)).toEqual([stringTautology]);
    expect(findTautologies(`it('x', () => { ${equalTautology}; });`)).toEqual([equalTautology]);
  });

  it('NEGATIVE control: a real assertion is not matched', () => {
    expect(findTautologies("it('x', () => { expect(getValue()).toBe(true); });")).toEqual([]);
    expect(findTautologies("it('x', () => { expect(result.title).toBe('New Title'); });")).toEqual([]);
    expect(findTautologies("it('x', () => { expect(a).toEqual(b); });")).toEqual([]);
    // A tautology mentioned only in prose (a comment) must not trip the scan.
    const trueTautology = ['expect(', 'true', ').toBe(', 'true', ')'].join('');
    expect(findTautologies(`// old code used to say ${trueTautology} here\nit('x', () => { expect(1).toBe(2); });`)).toEqual([]);
  });

  for (const file of allFiles) {
    const rel = relative(REPO_ROOT, file);
    it(`${rel} has no tautological assertion`, () => {
      const src = readFileSync(file, 'utf-8');
      const offenders = findTautologies(src);
      if (offenders.length > 0) {
        throw new Error(`${rel} has a tautological assertion:\n${offenders.map((o) => `  ${o}`).join('\n')}`);
      }
      expect(offenders).toEqual([]);
    });
  }
});
