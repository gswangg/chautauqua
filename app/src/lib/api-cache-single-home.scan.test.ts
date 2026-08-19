// DEC_013 D21: 'the cache lives INSIDE the one client'. app/src/lib/api.ts
// is the sole holder of the SWR read cache (its module-level `readCache =
// new Map<string, unknown>()`); nothing else under app/src may grow a
// second, independent response cache -- a second Map would mean two
// invalidation clocks and the D19 cross-event switch (DEC-728) could read a
// payload the first cache already knew was stale.
//
// Heuristic (deliberately a plain text scan, no parser dependency added):
//   1. A "module-level cache Map" is a line at column 0 (no leading
//      whitespace -- i.e. not inside a function/component body) shaped
//      `const <ident> = new Map<string, ...>(` -- generic-typed on a string
//      key, matching how a URL-keyed response cache is declared.
//   2. It only counts as a RESPONSE CACHE (not, say, a lookup table built at
//      module scope for some other reason) if it is "cache/peek-shaped":
//      either the declared identifier itself matches /cache|peek/i, or the
//      same file also declares a function/const whose name matches
//      /peek|cache/i (api.ts's peekCachedRead/cacheSet/cacheKey satisfy
//      this for readCache).
// Exactly one file may satisfy both, and it must be app/src/lib/api.ts.
//
// Also pins the negative half directly: app/src/lib/useCachedRead.ts (the
// React binding one level up) must contain neither `new Map(` nor `fetch(`
// -- the second check is redundant with one-api-client.scan.test.ts's own
// assertion (that scan greps raw lines including comments) but is cheap
// insurance kept local to this file.
//
// A negative control feeds a synthetic second-cache snippet directly into
// the detection function (not written to a real file) and proves it is
// classified as a module-level cache Map, so the "exactly one" assertion
// above is not vacuously true.

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEC_013 } from '../../../src/decisions';
void DEC_013;

const HERE = dirname(fileURLToPath(import.meta.url)); // app/src/lib
const APP_SRC = join(HERE, '..'); // app/src

const SOURCE_EXTENSIONS = ['.ts', '.tsx'];

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

const CACHE_SHAPED_RE = /\b\w*(cache|peek)\w*\b/i;

/** Every module-level (column-0) `const <ident> = new Map<string, ...>(`
 * declaration in `source`. */
function moduleLevelStringMapDecls(source: string): string[] {
  const re = /^const\s+([A-Za-z_$][\w$]*)\s*=\s*new Map<\s*string\s*,/gm;
  const idents: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    idents.push(m[1] ?? '');
  }
  return idents;
}

/** True if `source` declares a module-level string-keyed Map that is also
 * cache/peek-shaped, per the header's two-part heuristic. */
function hasCacheShapedModuleMap(source: string): boolean {
  const idents = moduleLevelStringMapDecls(source);
  if (idents.length === 0) return false;
  if (idents.some((ident) => CACHE_SHAPED_RE.test(ident))) return true;
  // Fallback: the file declares some other function/const whose name is
  // cache/peek-shaped (api.ts's peekCachedRead/cacheSet/cacheKey satisfy
  // this even though the ident 'readCache' alone would already match).
  const declRe = /\b(?:function|const)\s+([A-Za-z_$][\w$]*)\s*[=(]/g;
  let m: RegExpExecArray | null;
  while ((m = declRe.exec(source)) !== null) {
    const name = m[1] ?? '';
    if (CACHE_SHAPED_RE.test(name)) return true;
  }
  return false;
}

const FILES = scanTargets(APP_SRC);
const API_LIB = join(HERE, 'api.ts');
const USE_CACHED_READ = join(HERE, 'useCachedRead.ts');

describe('cache single-home scan (DEC_013): the read cache lives inside app/src/lib/api.ts only', () => {
  it('found more than five source files to scan', () => {
    expect(FILES.length).toBeGreaterThan(5);
  });

  it('exactly one file declares a cache-shaped module-level string Map, and it is lib/api.ts', () => {
    const offenders = FILES.filter((f) => hasCacheShapedModuleMap(readFileSync(f, 'utf-8'))).map((f) =>
      relative(APP_SRC, f),
    );
    expect(offenders).toEqual(['lib/api.ts']);
  });

  it('lib/api.ts really does declare the cache Map (population non-vacuous)', () => {
    expect(hasCacheShapedModuleMap(readFileSync(API_LIB, 'utf-8'))).toBe(true);
    expect(moduleLevelStringMapDecls(readFileSync(API_LIB, 'utf-8'))).toEqual(['readCache']);
  });

  it('useCachedRead.ts contains no new Map( and no fetch( token', () => {
    const source = readFileSync(USE_CACHED_READ, 'utf-8');
    expect(source.includes('new Map(')).toBe(false);
    expect(source.includes('fetch(')).toBe(false);
  });

  it('negative control: a synthetic second cache file is classified as a module-level cache Map', () => {
    const synthetic = `
// pretend second cache module
const secondaryCache = new Map<string, unknown>();

export function peekSecondary(key: string): unknown {
  return secondaryCache.get(key);
}
`;
    expect(hasCacheShapedModuleMap(synthetic)).toBe(true);
    expect(moduleLevelStringMapDecls(synthetic)).toEqual(['secondaryCache']);
  });

  it('negative control: a non-cache-shaped module-level string Map (a plain lookup table) is NOT flagged', () => {
    const synthetic = `
const labelById = new Map<string, string>();
labelById.set('a', 'Alpha');
`;
    expect(hasCacheShapedModuleMap(synthetic)).toBe(false);
  });

  it('negative control: a function-scoped (indented) new Map<string, is NOT flagged as module-level', () => {
    const synthetic = `
export function buildCache() {
  const cacheOfThings = new Map<string, unknown>();
  return cacheOfThings;
}
`;
    expect(hasCacheShapedModuleMap(synthetic)).toBe(false);
  });
});
