// DEC-941: every irreversible SPA delete goes through the shared
// ConfirmDialog (components/ConfirmDialog.tsx) rather than firing on click.
// This scans every non-test source file under app/src for a CALL to
// `apiDelete(` -- matched by a word-boundary regex (`\bapiDelete\b\s*(?:<[^>]*>)?\s*\(`)
// so a generic call (`apiDelete<{ deleted: number }>(`), a spaced generic
// (`apiDelete <T>(`), and a bare no-generic call all count, while a mere
// mention of the identifier with no call parens (e.g. an import line's
// `apiDelete,`) does not -- and requires the module to import ConfirmDialog
// too. An unguarded call site outside the hard-coded allow-list fails this
// scan. The only modules allowed to call apiDelete without ConfirmDialog are
// the two restore-not-destroy recusal "undo" flows, hard-coded here by name
// so the exemption can't silently grow.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_SRC = HERE; // app/src

// Matches `apiDelete(`, `apiDelete<T>(`, `apiDelete <T>(` -- any call site,
// with or without a generic type argument list, with or without whitespace
// before the opening paren. Does NOT match a bare identifier mention with
// no call parens (e.g. an import line's `apiDelete,`).
const API_DELETE_CALL = /\bapiDelete\b\s*(?:<[^>]*>)?\s*\(/;

// ReviewerQueue.tsx / Scorecard.tsx call apiDelete only to UNDO a recusal
// (restore, not destroy), so they're the sole confirmed exemptions. Every
// other apiDelete( call site imports ConfirmDialog (DEC-941 wave 56).
const ALLOWED_UNGUARDED = new Set(['pages/review/ReviewerQueue.tsx', 'pages/review/Scorecard.tsx']);

function walkSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...walkSourceFiles(full));
    } else if ((name.endsWith('.ts') || name.endsWith('.tsx')) && !name.includes('.test.')) {
      out.push(full);
    }
  }
  return out;
}

describe('DEC-941: every apiDelete(...) call site imports ConfirmDialog (or is an allow-listed exemption)', () => {
  it('no unguarded apiDelete(...) call site exists outside the hard-coded allow-list', () => {
    const offenders: string[] = [];
    for (const file of walkSourceFiles(APP_SRC)) {
      const relPath = relative(APP_SRC, file);
      // lib/api.ts is apiDelete's own DEFINITION ('export function
      // apiDelete<T>(path...') -- the regex's generic-aware match also
      // matches a declaration's parameter list, but a declaration is not a
      // call site and has nothing to confirm.
      if (relPath === 'lib/api.ts') continue;
      const source = readFileSync(file, 'utf8');
      if (!API_DELETE_CALL.test(source)) continue;
      if (source.includes("from '../../components/ConfirmDialog'") || source.includes("from '../components/ConfirmDialog'")) {
        continue;
      }
      if (ALLOWED_UNGUARDED.has(relPath)) continue;
      offenders.push(relPath);
    }
    expect(offenders).toEqual([]);
  });

  it('the allow-list only names the confirmed restore-not-destroy exemptions', () => {
    expect([...ALLOWED_UNGUARDED].sort()).toEqual(
      ['pages/review/ReviewerQueue.tsx', 'pages/review/Scorecard.tsx'].sort(),
    );
  });

  // Negative control: proves the regex catches all three spellings named in
  // DEC-941 and does NOT count a bare identifier mention (e.g. an import
  // line) as a call site.
  it('the matcher catches every apiDelete( spelling but not a bare import mention', () => {
    expect(API_DELETE_CALL.test('await apiDelete(`/tracks/${id}`);')).toBe(true);
    expect(API_DELETE_CALL.test('await apiDelete<{ deleted: number }>(`/rooms/${id}`);')).toBe(true);
    expect(API_DELETE_CALL.test('await apiDelete <T>(`/breaks/${id}`);')).toBe(true);
    // An import line mentions the identifier with no call parens -- not a
    // call site.
    expect(API_DELETE_CALL.test("import { apiDelete, apiPost } from '../../lib/api';")).toBe(false);
  });
});
