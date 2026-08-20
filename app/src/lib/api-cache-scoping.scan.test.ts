// DEC_024 D21: URL-keying IS event scoping. useCachedRead.ts / api.ts's
// read cache (DEC_013) is keyed on the exact request URL string, so the D19
// cross-event switch (DEC-728 wave-108, landing as v12m-w4-s) can only ever
// serve one event's payload under another if some cached-read call site
// builds its path WITHOUT the event id baked into the URL — a page that
// swaps `eventId` in React state but keeps requesting the same string would
// silently keep painting the old event's cached rows.
//
// This scan walks every non-test .ts/.tsx file under app/src (DEC-808
// derive-never-hand-list idiom -- readdirSync recursive, never a manifest),
// strips comments with the same lightweight scanner
// spa-fetch-swallow-honesty.scan.test.ts uses (so a commented-out call never
// counts), and finds every call to `apiGetCached(`, `apiListCached(`,
// `useCachedGet(`, `useCachedList(` (tolerating a `<T>` type argument).
//
// Path resolution (stated once, deterministically):
//   - If the call's first argument is itself a string/template literal, that
//     literal's raw source text (unevaluated -- we never need to run
//     `${...}` interpolations, only see whether `/events/${` appears in the
//     source) IS the one candidate path.
//   - If the first argument is a bare identifier, we follow exactly one hop:
//     `const <identifier> = useMemo(...)` declared earlier in the same
//     file. Rather than trying to prove which expression inside that
//     useMemo is "the" returned path (arbitrarily deep JS), we collect
//     EVERY string/template literal inside the useMemo(...) call's argument
//     list that starts with '/' (i.e. looks like a URL path, not a param
//     key or JSON.stringify field name) and treat each as a candidate path.
//     This is deliberately coarse -- it can over-collect (an unrelated
//     '/'-prefixed literal elsewhere in the same useMemo) but can never
//     under-collect the real path, and over-collection only produces MORE
//     candidates to satisfy the scoping rule, never fewer, so it cannot
//     mask a genuinely unscoped read.
//
// Every candidate path must either contain the substring `/events/${` (the
// call is keyed on the current event's id) or match an entry in the
// ORG_SCOPED_CACHED_READS ledger below (a written, one-line reason why this
// read's answer legitimately does not vary by event).
//
// Two tripwires, same shape as the sibling scans:
//   1. the derived population of calls must be non-empty (a regex that
//      stopped matching would otherwise pass vacuously);
//   2. a stale ledger entry (its marker substring matches no extracted
//      candidate path) FAILS the suite -- the ledger must track reality,
//      not accumulate.
//
// A negative control feeds a synthetic snippet with an event-varying but
// unkeyed cached read directly into the extraction/compliance functions
// (not written to a real file) and proves it is reported as a violation.

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEC_024 } from '../../../src/decisions';
void DEC_024;

const HERE = dirname(fileURLToPath(import.meta.url)); // app/src/lib

const SOURCE_EXTENSIONS = ['.ts', '.tsx'];
const CACHED_READ_FNS = ['apiGetCached', 'apiListCached', 'useCachedGet', 'useCachedList'];

/** Every source file under app/src, excluding test files (DEC-808 idiom). */
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

// Same comment-stripping convention as spa-fetch-swallow-honesty.scan.test.ts:
// strips // and /* */ comments (replacing with spaces/blank, keeping
// newlines so offsets stay meaningful) while leaving string/template
// literal contents untouched.
function stripComments(src: string): string {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const c2 = src[i + 1];
    if (c === '/' && c2 === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && c2 === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        out += src[i] === '\n' ? '\n' : ' ';
        i++;
      }
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      out += c;
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === '\\' && i + 1 < n) {
          out += (src[i] ?? '') + (src[i + 1] ?? '');
          i += 2;
          continue;
        }
        out += src[i] ?? '';
        i++;
      }
      if (i < n) {
        out += src[i];
        i++;
      }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

function matchParenBlock(src: string, openParenIdx: number): number {
  let depth = 1;
  let i = openParenIdx + 1;
  while (i < src.length && depth > 0) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')') depth--;
    i++;
  }
  return i; // index just past the matching close paren
}

/** Index of the first top-level comma inside `src[start..end)`, or `end` if
 * none (single-argument call). Tracks quote state so a comma inside a
 * string/template literal is never mistaken for an argument separator, and
 * paren/brace/bracket depth so a comma inside a nested call is skipped. */
function firstTopLevelComma(src: string, start: number, end: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = start; i < end; i++) {
    const c = src[i];
    if (quote) {
      if (c === '\\') {
        i++;
        continue;
      }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      quote = c;
      continue;
    }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    else if (c === ',' && depth === 0) return i;
  }
  return end;
}

/** Every string/template literal in `src[start..end)` whose raw contents
 * start with '/' (looks like a URL path, not a param key or field name). */
function pathLikeLiterals(src: string, start: number, end: number): string[] {
  const out: string[] = [];
  const region = src.slice(start, end);
  const re = /(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(region)) !== null) {
    const raw = m[2] ?? '';
    if (raw.startsWith('/')) out.push(raw);
  }
  return out;
}

interface CachedReadCall {
  fn: string;
  candidatePaths: string[];
}

/** Extracts every cached-read call in `source` (already comment-stripped)
 * with its resolved candidate path(s), per the header's resolution rule. */
function extractCachedReadCalls(source: string): CachedReadCall[] {
  const calls: CachedReadCall[] = [];
  const callRe = new RegExp(`\\b(${CACHED_READ_FNS.join('|')})\\s*(?:<[^(]*>)?\\s*\\(`, 'g');
  let m: RegExpExecArray | null;
  while ((m = callRe.exec(source)) !== null) {
    const fn = m[1] ?? '';
    // Skip the function's own declaration (`export async function
    // apiGetCached<T>(...)` in api.ts itself) -- a declaration is not a
    // call site and has no "candidate path" to resolve.
    const before = source.slice(Math.max(0, m.index - 20), m.index);
    if (/\bfunction\s*$/.test(before)) continue;
    const openParenIdx = m.index + m[0].length - 1;
    const closeIdx = matchParenBlock(source, openParenIdx);
    const commaIdx = firstTopLevelComma(source, openParenIdx + 1, closeIdx - 1);
    const argSource = source.slice(openParenIdx + 1, commaIdx).trim();

    const literalMatch = /^(['"`])((?:\\.|(?!\1)[^\\])*)\1$/.exec(argSource);
    if (literalMatch) {
      calls.push({ fn, candidatePaths: [literalMatch[2] ?? ''] });
      continue;
    }

    // Bare-identifier arg: follow the one-hop `const <ident> = useMemo(...)`
    // binding and collect every '/'-prefixed literal inside it.
    const ident = /^[A-Za-z_$][\w$]*$/.exec(argSource)?.[0];
    if (ident === undefined) {
      calls.push({ fn, candidatePaths: [] });
      continue;
    }
    const bindingRe = new RegExp(`\\bconst\\s+${ident}\\s*=\\s*useMemo\\s*\\(`);
    const bindingMatch = bindingRe.exec(source);
    if (bindingMatch === null) {
      calls.push({ fn, candidatePaths: [] });
      continue;
    }
    const memoOpenParenIdx = bindingMatch.index + bindingMatch[0].length - 1;
    const memoCloseIdx = matchParenBlock(source, memoOpenParenIdx);
    calls.push({ fn, candidatePaths: pathLikeLiterals(source, memoOpenParenIdx + 1, memoCloseIdx - 1) });
  }
  return calls;
}

const ORG_SCOPED_CACHED_READS: { marker: string; reason: string }[] = [
  {
    marker: '/contacts?',
    reason: 'the contacts directory is an org-scoped read -- the roster does not vary by event, so it is deliberately not keyed on /events/${eventId}',
  },
];

function isEventScoped(path: string): boolean {
  return path.includes('/events/${');
}

function ledgerEntryFor(path: string): { marker: string; reason: string } | undefined {
  return ORG_SCOPED_CACHED_READS.find((entry) => path.includes(entry.marker));
}

const APP_SRC = join(HERE, '..'); // app/src/lib/.. -> app/src
// useCachedRead.ts (this scan's own subject) is the implementation of the
// hook -- its `apiGetCached<T>(p)` / `apiListCached<T>(p)` delegate calls
// pass the hook's own `path` PARAMETER, an identifier with no local
// useMemo binding to resolve (the real path is constructed by the
// hook's CALLER, which is what the scan actually needs to check). Excluded
// here the same way api.ts's own declarations are excluded above, so the
// scan measures consumers, not the plumbing between them.
const FILES = scanTargets(APP_SRC).filter((f) => f !== join(HERE, 'useCachedRead.ts'));

interface FileCalls {
  file: string;
  calls: CachedReadCall[];
}

const ALL_CALLS: FileCalls[] = FILES.map((file) => ({
  file,
  calls: extractCachedReadCalls(stripComments(readFileSync(file, 'utf-8'))),
})).filter((entry) => entry.calls.length > 0);

describe('cached-read scoping scan (DEC_024): URL-keying is event scoping', () => {
  it('found at least one cached-read call site to scan (population non-vacuous)', () => {
    const total = ALL_CALLS.reduce((sum, entry) => sum + entry.calls.length, 0);
    expect(total).toBeGreaterThan(0);
  });

  it('every cached-read call site resolves to at least one candidate path', () => {
    for (const { file, calls } of ALL_CALLS) {
      for (const call of calls) {
        expect(
          call.candidatePaths.length,
          `${relative(HERE, file)}: ${call.fn}(...) call did not resolve to any candidate path -- ` +
            `the scan's one-hop useMemo resolution failed to find a '/'-prefixed literal`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('every candidate path is either event-keyed (/events/${) or ledgered as org-scoped', () => {
    const offenders: string[] = [];
    for (const { file, calls } of ALL_CALLS) {
      for (const call of calls) {
        for (const path of call.candidatePaths) {
          if (isEventScoped(path)) continue;
          if (ledgerEntryFor(path) !== undefined) continue;
          offenders.push(`${relative(HERE, file)}: ${call.fn}(...) candidate path "${path}" is neither event-keyed nor ledgered`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no ORG_SCOPED_CACHED_READS ledger entry is stale (its marker must match a real extracted candidate path)', () => {
    const allPaths = ALL_CALLS.flatMap((entry) => entry.calls.flatMap((call) => call.candidatePaths));
    const stale = ORG_SCOPED_CACHED_READS.filter((entry) => !allPaths.some((path) => path.includes(entry.marker)));
    expect(stale.map((entry) => entry.marker)).toEqual([]);
  });

  it('negative control: an event-varying, unkeyed cached read is reported', () => {
    const synthetic = stripComments(`
      function Widget({ eventId }: { eventId: string }) {
        const speakerPath = useMemo(() => \`/speakers/\${eventId}\`, [eventId]);
        const directory = useCachedGet<Speaker>(speakerPath, 'Failed to load speaker');
        return directory;
      }
    `);
    const calls = extractCachedReadCalls(synthetic);
    expect(calls.length).toBe(1);
    const [call] = calls;
    expect(call).toBeDefined();
    expect(call!.candidatePaths).toContain('/speakers/${eventId}');
    const violating = call!.candidatePaths.filter((path) => !isEventScoped(path) && ledgerEntryFor(path) === undefined);
    expect(violating, 'the synthetic /speakers/${eventId} read varies by event but is not keyed under /events/${ and carries no ledger entry').toEqual([
      '/speakers/${eventId}',
    ]);
  });

  it('negative control: a literal-argument call resolves directly (no useMemo hop needed)', () => {
    const synthetic = stripComments(`
      const row = apiGetCached<Row>('/events/\${eventId}/agenda');
    `);
    const calls = extractCachedReadCalls(synthetic);
    expect(calls).toEqual([{ fn: 'apiGetCached', candidatePaths: ['/events/${eventId}/agenda'] }]);
    const [call] = calls;
    expect(call).toBeDefined();
    expect(isEventScoped(call!.candidatePaths[0]!)).toBe(true);
  });
});
