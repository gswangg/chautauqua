// A server-enforced text-length cap belongs in pure core (src/domain/**),
// declared exactly once, so a route module can never hide a `const
// X_LENGTH = <number>` literal that the client has no way to import (DEC-422,
// w57-c). This scan enumerates every .ts file under src/routes and fails if
// any of them declares its own `const NAME_LENGTH = <number>` or `const
// NAME_MAX_LEN = <number>` literal instead of importing one from
// src/domain/**.
import { readdirSync, readFileSync } from 'node:fs';
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
