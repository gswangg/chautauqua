// A server-enforced text-length cap belongs in pure core (src/domain/**),
// declared exactly once, so a route module can never hide a `const
// X_LENGTH = <number>` literal that the client has no way to import (DEC-422,
// w57-c). This scan enumerates every .ts file under src/routes and fails if
// any of them declares its own `const NAME_LENGTH = <number>` or `const
// NAME_MAX_LEN = <number>` literal instead of importing one from
// src/domain/**.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROUTES_ROOT = join(HERE, '..', 'src', 'routes');
const DOMAIN_ROOT = join(HERE, '..', 'src', 'domain');

/**
 * Every .ts/.tsx file under `root`, excluding test files. `.tsx` is
 * included alongside `.ts` because a cap can be hand-declared in a route's
 * SSR view/render module (a `.tsx` file) just as easily as in its handler
 * (DEC-124, w59-a) -- a `.ts`-only walker made that shape invisible.
 */
function allSourceFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) continue;
    if (entry.name.includes('.test.')) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

// A generic fingerprint for a locally-declared text-length cap: `const
// SOME_LENGTH = 2000` or `const SOME_MAX_LEN = 500`, with or without a type
// annotation. Never matches an `import { X } from '...'` line, since import
// statements don't carry the `const NAME =` shape.
const LOCAL_TEXT_CAP_DECL_RE = /const\s+[A-Z][A-Z0-9_]*(?:_LENGTH|_MAX_LEN)\s*(?::\s*\w+)?\s*=\s*[0-9]/g;

function findLocalTextCapDeclarations(src: string): string[] {
  return src.match(LOCAL_TEXT_CAP_DECL_RE) ?? [];
}

describe('no src/routes/**/*.ts module hand-declares a text-length cap literal (DEC-422, w57-c)', () => {
  const ROUTE_FILES = allSourceFiles(ROUTES_ROOT);
  const DOMAIN_FILES = allSourceFiles(DOMAIN_ROOT);

  it('scanned more than one route file', () => {
    expect(ROUTE_FILES.length).toBeGreaterThan(1);
  });

  it('no src/routes file declares its own text-length cap literal', () => {
    const offenders: string[] = [];
    for (const path of ROUTE_FILES) {
      const src = readFileSync(path, 'utf-8');
      const found = findLocalTextCapDeclarations(src);
      if (found.length > 0) offenders.push(`${relative(HERE, path)}: ${found.join(', ')}`);
    }
    expect(offenders, `route files hand-declaring a text-length cap literal:\n${offenders.join('\n')}`).toEqual([]);
  });

  // Positive control: src/domain modules genuinely declare their caps this
  // way -- the detector isn't simply matching nothing.
  it('positive control: src/domain declares at least one text-length cap the detector recognizes', () => {
    let found = 0;
    for (const path of DOMAIN_FILES) {
      const src = readFileSync(path, 'utf-8');
      found += findLocalTextCapDeclarations(src).length;
    }
    expect(found).toBeGreaterThan(0);
  });

  // Negative control: a synthetic route-local declaration IS detected, so a
  // rewrite of the regex can't silently stop flagging the real shape.
  it('the detector flags a synthetic route-local declaration', () => {
    const violating = `const MAX_WIDGET_LENGTH = 500;\nfunction f() { return MAX_WIDGET_LENGTH; }`;
    expect(findLocalTextCapDeclarations(violating)).toEqual(['const MAX_WIDGET_LENGTH = 5']);

    const clean = `import { MAX_WIDGET_LENGTH } from '../domain/widget';\nfunction f() { return MAX_WIDGET_LENGTH; }`;
    expect(findLocalTextCapDeclarations(clean)).toEqual([]);
  });

  // Control: a synthetic offender planted in a `.tsx` file under
  // src/routes IS picked up by allSourceFiles -- the walker isn't
  // silently `.ts`-only (that's exactly how CFP_ABSTRACT_MAX_LENGTH sat
  // undetected in submit-views.tsx for this long, DEC-124 w59-a).
  it('allSourceFiles finds a synthetic .tsx offender under src/routes', () => {
    const tsxFiles = ROUTE_FILES.filter((p) => p.endsWith('.tsx'));
    expect(tsxFiles.length).toBeGreaterThan(0);

    const violating = `const CFP_WIDGET_MAX_LEN = 1200;\nfunction f() { return CFP_WIDGET_MAX_LEN; }`;
    expect(findLocalTextCapDeclarations(violating)).toEqual(['const CFP_WIDGET_MAX_LEN = 1']);
  });
});

// ---------------------------------------------------------------------------
// DEC-425 wave-67 amendment: a `const MAX_X = <number>` declaration isn't the
// only way a route hand-types a cap -- a bound can be written straight into
// its own comparison AND its refusal message, with no named constant at all
// (src/routes/api/submissions.ts's `raw.length > 1000` /
// src/routes/review/recusals.ts's `body.reason.length > 500`, both fixed
// this wave). This second detector flags a bare numeric literal sitting
// inside an `ApiError(...)` call's string arguments (message OR fields
// values) when that string also carries a cap-shaped keyword -- the
// declaration-scan above can't see this shape because there's no `const`.
// ---------------------------------------------------------------------------

/** Every complete `new ApiError(...)` call's argument-list text, balancing
 * parens/strings so a nested `{ field: "..." }` object doesn't truncate the
 * scan early. */
function findApiErrorCallBlocks(src: string): string[] {
  const blocks: string[] = [];
  const marker = 'new ApiError(';
  let idx = 0;
  while ((idx = src.indexOf(marker, idx)) !== -1) {
    let i = idx + marker.length;
    let depth = 1;
    let inStr: string | null = null;
    const start = i;
    while (i < src.length && depth > 0) {
      const ch = src[i];
      if (inStr) {
        if (ch === '\\') {
          i += 2;
          continue;
        }
        if (ch === inStr) inStr = null;
      } else {
        if (ch === '"' || ch === "'" || ch === '`') inStr = ch;
        else if (ch === '(') depth++;
        else if (ch === ')') depth--;
      }
      i++;
    }
    blocks.push(src.slice(start, i - 1));
    idx = i;
  }
  return blocks;
}

// Cap-shaped keyword vocabulary, case-insensitive, word-bounded.
const CAP_KEYWORD_RE = /\b(max|at most|exceed|exceeds|no more than|up to|limit)\b/i;
const STRING_LITERAL_RE = /(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;

/** Strips `${...}` interpolation spans so a template-literal message built
 * from an imported constant (`` `Max ${MAX_X}` ``) doesn't itself read as a
 * hand-typed digit -- only a LITERAL digit character in the source string
 * counts. */
function stripInterpolations(s: string): string {
  return s.replace(/\$\{[^}]*\}/g, '');
}

function findRefusalNumberLiterals(src: string): string[] {
  const out: string[] = [];
  for (const block of findApiErrorCallBlocks(src)) {
    STRING_LITERAL_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = STRING_LITERAL_RE.exec(block))) {
      const raw = m[2] ?? '';
      if (/\d/.test(stripInterpolations(raw)) && CAP_KEYWORD_RE.test(raw)) {
        out.push(raw);
      }
    }
  }
  return out;
}

// RULE, not a scope: an `ApiError(...)` call may NEVER hand-type a
// cap-shaped numeric literal in its message or fields text. Every bound
// named in a refusal sentence must be interpolated from an imported
// constant (src/domain/**, or a single home like src/server/repo/public/
// bounds.ts for a param range) so the enforced value and the described
// value can never drift apart (DEC-425 wave-67; DEC-487 wave-10 closed the
// last live exemption -- src/routes/api/embeds.ts's `limit` refusal now
// interpolates MIN_EMBED_LIMIT/MAX_EMBED_LIMIT). An allowlist entry here is
// a live named exception to that rule, not a place to park a known gap on
// a schedule -- if a genuine new exemption is ever needed it must state
// which invariant makes the interpolation impossible, not merely which
// wave will get to it.
const REFUSAL_NUMBER_ALLOWLIST: { file: string; reason: string }[] = [];

describe('no src/routes/**/*.{ts,tsx} ApiError call hand-types a cap-shaped numeric literal (DEC-425, wave 67 amendment)', () => {
  const ROUTE_FILES = allSourceFiles(ROUTES_ROOT);

  it('every allowlist entry still names a live file', () => {
    for (const entry of REFUSAL_NUMBER_ALLOWLIST) {
      expect(() => statSync(entry.file), `allowlisted file no longer exists: ${entry.file}`).not.toThrow();
    }
  });

  it('no src/routes ApiError call (outside the named allowlist) hand-types a cap-shaped numeric literal', () => {
    const allowlistedFiles = new Set(REFUSAL_NUMBER_ALLOWLIST.map((e) => e.file));
    const offenders: string[] = [];
    for (const path of ROUTE_FILES) {
      if (allowlistedFiles.has(path)) continue;
      const src = readFileSync(path, 'utf-8');
      const found = findRefusalNumberLiterals(src);
      if (found.length > 0) offenders.push(`${relative(HERE, path)}: ${found.join(' | ')}`);
    }
    expect(
      offenders,
      `ApiError calls hand-typing a cap-shaped numeric literal:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  // The allowlist is empty: every ApiError refusal in src/routes now
  // interpolates its cap-shaped number from an imported constant, so an
  // empty allowlist is the passing state, not a gap.
  it('the allowlist is empty -- no live exemption from the interpolated-constant rule', () => {
    expect(REFUSAL_NUMBER_ALLOWLIST).toEqual([]);
  });

  // Vacuous-scan tripwire.
  it('vacuous-scan tripwire: the routes scan walked a non-empty file set', () => {
    expect(ROUTE_FILES.length).toBeGreaterThan(10);
  });

  // Both-ways negative control: a synthetic hand-typed refusal built with a
  // literal digit IS flagged; the identical sentence built by interpolating
  // an imported constant is NOT.
  it('the detector flags a hand-typed refusal literal but not the same sentence built from an interpolated constant', () => {
    const violating = `throw new ApiError("invalid", "ids must not exceed 1000 entries", { ids: "Max 1000" });`;
    expect(findRefusalNumberLiterals(violating)).toEqual(['ids must not exceed 1000 entries', 'Max 1000']);

    const clean =
      'throw new ApiError("invalid", `ids must not exceed ${MAX_IDS} entries`, { ids: `Max ${MAX_IDS}` });';
    expect(findRefusalNumberLiterals(clean)).toEqual([]);
  });

  // Confirms the keyword gate itself: a numeric literal with NO cap-shaped
  // keyword nearby (e.g. an id/count echoed back, not a bound) is not
  // flagged -- the detector isn't just "any digit in an ApiError string".
  it('a bare digit with no cap-shaped keyword is not flagged', () => {
    const clean = `throw new ApiError("not_found", "Submission 42 not found", { id: "42" });`;
    expect(findRefusalNumberLiterals(clean)).toEqual([]);
  });
});
