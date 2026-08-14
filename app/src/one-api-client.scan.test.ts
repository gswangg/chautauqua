// DEC-013 (wave-14 amendment): app/src/lib/api.ts is the ONLY fetch wrapper
// the SPA talks to /api/v1 through. app/src/api/client.ts used to be a
// second, divergent fetch wrapper (its own ApiError class shaped
// {status, body}) with zero production callers -- deleted outright, no
// re-export or deprecation shim left behind (w14-g).
//
// This scan enumerates every non-test file under app/src (DEC-808 idiom --
// never a hand-listed manifest) and asserts:
//   1. exactly one file contains a `fetch(` call against the API prefix
//      (`/api/v1` or a template literal built from an API_PREFIX-style
//      constant), and it is app/src/lib/api.ts;
//   2. the only other production `fetch(` call site in app/src is
//      App.tsx's POST to '/logout' -- allowlisted by name because it is not
//      under /api/v1, so the prefixed helper cannot express it. The scan
//      matches on the '/logout' string literal, not on surrounding code, so
//      it tolerates whatever shape App.tsx's signOut ends up taking (a
//      sibling task is editing it);
//   3. no file under app/src declares a second `class ApiError`.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));

const SOURCE_EXTENSIONS = ['.ts', '.tsx'];

/** Every source file under app/src, excluding test files. */
function scanTargets(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    if (!SOURCE_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) continue;
    if (entry.name.includes('.test.')) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

const FILES = scanTargets(HERE);

const API_LIB = join(HERE, 'lib', 'api.ts');
const APP_TSX = join(HERE, 'App.tsx');

/** Lines in `source` that contain a `fetch(` call. */
function fetchCallLines(source: string): string[] {
  return source.split('\n').filter((line) => /\bfetch\(/.test(line));
}

describe('one API client scan (DEC-013): app/src/lib/api.ts is the only fetch wrapper', () => {
  it('found more than five source files to scan', () => {
    // Guards the enumeration itself: if readdirSync ever returned nothing
    // (or nearly nothing), every assertion below would vacuously pass.
    expect(FILES.length).toBeGreaterThan(5);
  });

  it('exactly one file makes fetch() calls against the API prefix, and it is lib/api.ts', () => {
    const apiPrefixOffenders = FILES.filter((f) => {
      if (f === API_LIB) return false;
      const lines = fetchCallLines(readFileSync(f, 'utf-8'));
      return lines.some((line) => line.includes('/api/v1'));
    });
    expect(apiPrefixOffenders.map((f) => relative(HERE, f))).toEqual([]);
    expect(fetchCallLines(readFileSync(API_LIB, 'utf-8')).length).toBeGreaterThan(0);
  });

  it('the only other production fetch() call site is App.tsx POST /logout', () => {
    for (const file of FILES) {
      if (file === API_LIB) continue;
      const lines = fetchCallLines(readFileSync(file, 'utf-8'));
      if (lines.length === 0) continue;
      expect(file, `unexpected fetch() call site: ${relative(HERE, file)}`).toBe(APP_TSX);
      expect(
        lines.some((line) => line.includes('/logout')),
        `App.tsx fetch() call(s) must reference '/logout', got: ${lines.join(' | ')}`,
      ).toBe(true);
    }
  });

  it('no file under app/src declares a second `class ApiError`', () => {
    const declarers = FILES.filter((f) => /\bclass ApiError\b/.test(readFileSync(f, 'utf-8')));
    expect(declarers.map((f) => relative(HERE, f))).toEqual([API_LIB].map((f) => relative(HERE, f)));
  });
});
