// DEC-700 (wave-53 amendment): api.ts is the ONE place a mutating request is
// issued, and every successful mutation is supposed to bump the shared
// mutationSignal so exception badges derived from server state know to
// refetch (see mutationSignal.ts). request() does this once, at :123-125,
// for every one of its callers (apiGet/apiList/apiPost/apiPatch/apiPut/
// apiDelete). But two helpers in this file bypass request() on purpose --
// apiUpload (multipart, can't set a manual content-type) and apiPostBlob
// (DEC-160 bulk download) -- and so bypassed the bump too, until this wave.
//
// Rather than hand-list "the four helpers that call bumpMutationVersion" (the
// thing that let apiUpload drift silently), this scan reads api.ts from disk,
// finds every EXPORTED function whose body issues a non-GET fetch (either a
// literal `fetch(` call with a non-GET method, or by delegating to
// `request()` with a non-GET method), and asserts each one's body contains
// `bumpMutationVersion(` -- directly, or transitively via a call to
// `request(` (which itself is proven to bump, above) -- or is named in
// EXEMPT_HELPERS with a written reason. A new mutating helper added without a
// bump or a reason fails this scan.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { apiUpload } from './api';
import { useMutationVersion } from './mutationSignal';

const API_TS_PATH = join(__dirname, 'api.ts');

// DEC-160: apiPostBlob's POST body is a filter (which rows to zip), not a
// write -- the endpoint it calls performs no mutation, so there is nothing
// for a badge to go stale over.
//
// DEC-154/DEC-874: signOut()'s POST /logout destroys the session and then
// hard-navigates via window.location.assign('/login'). Every subscriber to
// mutationSignal is torn down by that navigation, so there is no consumer
// left to refetch; bumping would only fire refetches that race the teardown
// and 401 against the just-destroyed session. It also deliberately bypasses
// request() because /logout carries no /api/v1 prefix.
//
// These two are the only deliberate exemptions from the rule.
const EXEMPT_HELPERS = new Set(['apiPostBlob', 'signOut']);

interface ParsedFunction {
  name: string;
  body: string;
}

// Lightweight brace-matching extractor: finds `export function NAME<...>(...)`
// or `export async function NAME<...>(...)` declarations and captures their
// full body by counting braces from the first `{` after the signature.
function parseExportedFunctions(source: string): ParsedFunction[] {
  const out: ParsedFunction[] = [];
  const re = /export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*(?:<[^(]*>)?\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    const name = match[1];
    if (name === undefined) continue;
    const braceStart = source.indexOf('{', match.index);
    if (braceStart === -1) continue;
    let depth = 0;
    let i = braceStart;
    for (; i < source.length; i++) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}') {
        depth--;
        if (depth === 0) break;
      }
    }
    out.push({ name, body: source.slice(braceStart, i + 1) });
  }
  return out;
}

// A function "issues a non-GET fetch" if it either:
//  - calls fetch(...) directly with a method that is not GET (or omitted,
//    since fetch() defaults to GET so an explicit non-GET method is required
//    here -- every literal fetch( call site in this file sets one), or
//  - delegates to request(path, { method: '<NON-GET>', ... }).
function issuesNonGetMutation(body: string): boolean {
  const hasLiteralFetch = /\bfetch\(/.test(body);
  const hasNonGetMethodLiteral = /method:\s*['"](POST|PATCH|PUT|DELETE)['"]/.test(body);
  if (hasLiteralFetch && hasNonGetMethodLiteral) return true;

  const requestCallsWithMethod = [...body.matchAll(/\brequest<[^>]*>\(\s*path\s*,\s*\{([^}]*)\}/gs)];
  for (const call of requestCallsWithMethod) {
    const inner = call[1];
    if (inner !== undefined && /method:\s*['"](POST|PATCH|PUT|DELETE)['"]/.test(inner)) return true;
  }
  return false;
}

function reachesBump(body: string): boolean {
  return body.includes('bumpMutationVersion(') || /\brequest[<(]/.test(body);
}

describe('DEC-700: every mutating helper in api.ts reaches bumpMutationVersion (or is a written exemption)', () => {
  const source = readFileSync(API_TS_PATH, 'utf8');
  const fns = parseExportedFunctions(source);

  // Guard against the scan silently finding nothing because the regex
  // stopped matching the file's shape.
  it('found the known exported helpers (sanity check the parser still matches api.ts)', () => {
    const names = fns.map((f) => f.name);
    expect(names).toEqual(
      expect.arrayContaining(['apiGet', 'apiList', 'apiPost', 'apiPatch', 'apiPut', 'apiDelete', 'apiPostBlob', 'apiUpload']),
    );
  });

  it('no unguarded mutating helper exists outside EXEMPT_HELPERS', () => {
    const offenders: string[] = [];
    for (const fn of fns) {
      if (!issuesNonGetMutation(fn.body)) continue;
      if (EXEMPT_HELPERS.has(fn.name)) continue;
      if (!reachesBump(fn.body)) offenders.push(fn.name);
    }
    expect(offenders).toEqual([]);
  });

  it('EXEMPT_HELPERS names exactly the two written exceptions and no more', () => {
    // Kept as an explicit list so a third exemption cannot be added without
    // this pin (and the reason block above it) being edited on purpose.
    expect([...EXEMPT_HELPERS]).toEqual(['apiPostBlob', 'signOut']);
  });
});

describe('DEC-700: apiUpload bumps the shared mutation signal (behavioural)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('advances the version on a successful (201) upload, and does not on a failing (4xx) one', async () => {
    const { result } = renderHook(() => useMutationVersion());
    const versionBefore = result.current;

    const okFetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'f1' }), { status: 201 }));
    vi.stubGlobal('fetch', okFetchMock);
    await apiUpload('/submissions/s1/files', new FormData());
    const versionAfterSuccess = result.current;
    expect(versionAfterSuccess).toBeGreaterThan(versionBefore);

    const failFetchMock = vi.fn(
      async () => new Response(JSON.stringify({ error: { code: 'invalid', message: 'bad file' } }), { status: 422 }),
    );
    vi.stubGlobal('fetch', failFetchMock);
    await expect(apiUpload('/submissions/s1/files', new FormData())).rejects.toThrow();
    expect(result.current).toBe(versionAfterSuccess);
  });
});
