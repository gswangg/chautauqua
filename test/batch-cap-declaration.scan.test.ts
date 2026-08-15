// A batch/collection cap (a bare `MAX_*` count, not a text-length bound --
// see test/text-cap-declaration.scan.test.ts, which owns the `_LENGTH`/
// `_MAX_LEN` shapes) belongs in pure core (src/domain/**), declared exactly
// once, so a route module the SPA cannot import from can never hide a
// `const MAX_SOMETHING = <number>` literal (DEC-422, amendment wave 59).
// This scan enumerates every non-test .ts AND .tsx file under src/routes
// and fails if any of them declares its own `const MAX_[A-Z0-9_]* =
// <number>` literal instead of importing one from src/domain/**, aside
// from one named, live allowlist entry.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROUTES_ROOT = join(HERE, '..', 'src', 'routes');
const DOMAIN_ROOT = join(HERE, '..', 'src', 'domain');

/** Every .ts/.tsx file under `root`, excluding test files. */
function allSourceFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    if (!/\.tsx?$/.test(entry.name)) continue;
    if (entry.name.includes('.test.')) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

// A generic fingerprint for a route-local batch/count cap: `const
// MAX_WHATEVER = 20` or `export const MAX_WHATEVER: number = 100`, with or
// without a type annotation. Never matches an `import { MAX_X } from '...'`
// line (import statements don't carry the `const NAME =` shape), and never
// matches `const MAX_X = someIdentifier` (a re-export of a value declared
// elsewhere, e.g. `export const MAX_IMPORT_ROWS = repo.MAX_IMPORT_ROWS;`).
const LOCAL_BATCH_CAP_DECL_RE = /const\s+MAX_[A-Z0-9_]*\s*(?::\s*\w+)?\s*=\s*[0-9]/g;

function findLocalBatchCapDeclarations(src: string): string[] {
  return src.match(LOCAL_BATCH_CAP_DECL_RE) ?? [];
}

// The ONE named, live allowlist entry: MAX_EPOCH_MS is a JSON-field shape
// bound (the largest epoch-ms value a `Date`/wire-format field can carry),
// not a product cap any control collects toward (never rendered as "N of
// MAX_EPOCH_MS", never disabled at a count) -- so it has no pure-core
// "batch cap" home to move to.
const ALLOWLIST: { file: string; reason: string }[] = [
  {
    file: join(ROUTES_ROOT, 'api', 'validators.ts'),
    reason:
      "MAX_EPOCH_MS bounds a JSON-field's epoch-ms *value* shape (a wire-format/Date range check), not a batch/collection cap any control collects toward -- there is no pure-core 'cap' concept for it to move to.",
  },
];

describe('no src/routes/**/*.{ts,tsx} module hand-declares a batch/count cap literal (DEC-422, amendment wave 59)', () => {
  const ROUTE_FILES = allSourceFiles(ROUTES_ROOT);
  const DOMAIN_FILES = allSourceFiles(DOMAIN_ROOT);

  it('scanned more than one route file, of both .ts and .tsx', () => {
    expect(ROUTE_FILES.length).toBeGreaterThan(1);
    expect(ROUTE_FILES.some((p) => p.endsWith('.ts'))).toBe(true);
    expect(ROUTE_FILES.some((p) => p.endsWith('.tsx'))).toBe(true);
  });

  it('every allowlist entry still names a live file', () => {
    for (const entry of ALLOWLIST) {
      expect(() => statSync(entry.file), `allowlisted file no longer exists: ${entry.file}`).not.toThrow();
    }
  });

  it('no src/routes file (outside the named allowlist) declares its own batch cap literal', () => {
    const allowlistedFiles = new Set(ALLOWLIST.map((e) => e.file));
    const offenders: string[] = [];
    for (const path of ROUTE_FILES) {
      if (allowlistedFiles.has(path)) continue;
      const src = readFileSync(path, 'utf-8');
      const found = findLocalBatchCapDeclarations(src);
      if (found.length > 0) offenders.push(`${relative(HERE, path)}: ${found.join(', ')}`);
    }
    expect(offenders, `route files hand-declaring a batch cap literal:\n${offenders.join('\n')}`).toEqual([]);
  });

  // The allowlisted file DOES still declare MAX_EPOCH_MS -- confirms the
  // allowlist is excusing a real, present declaration, not a stale entry
  // for something already moved/deleted.
  it('the allowlisted file still declares the literal the allowlist excuses', () => {
    for (const entry of ALLOWLIST) {
      const src = readFileSync(entry.file, 'utf-8');
      expect(
        findLocalBatchCapDeclarations(src).length,
        `${relative(HERE, entry.file)} no longer declares a batch cap literal -- remove its allowlist entry`,
      ).toBeGreaterThan(0);
    }
  });

  // Positive control: src/domain modules genuinely declare batch caps this
  // way -- the detector isn't simply matching nothing.
  it('positive control: src/domain declares at least one batch cap literal the detector recognizes', () => {
    let found = 0;
    for (const path of DOMAIN_FILES) {
      const src = readFileSync(path, 'utf-8');
      found += findLocalBatchCapDeclarations(src).length;
    }
    expect(found).toBeGreaterThan(0);
  });

  // Vacuous-scan tripwire: if allSourceFiles silently returned nothing (a
  // broken glob/path after a directory rename), every "no offenders" result
  // above would be trivially true. Guard against that directly.
  it('vacuous-scan tripwire: both the routes scan and the domain scan walked a non-empty file set', () => {
    expect(ROUTE_FILES.length).toBeGreaterThan(10);
    expect(DOMAIN_FILES.length).toBeGreaterThan(5);
  });

  // Negative control, both ways: a synthetic route-local declaration IS
  // detected, so a rewrite of the regex can't silently stop flagging the
  // real shape; a synthetic import of the same name is NOT flagged, so the
  // detector doesn't confuse "imported" with "declared".
  it('the detector flags a synthetic route-local declaration but not an import of the same name', () => {
    const violating = `const MAX_WIDGETS = 5;\nfunction f() { return MAX_WIDGETS; }`;
    expect(findLocalBatchCapDeclarations(violating)).toEqual(['const MAX_WIDGETS = 5']);

    const clean = `import { MAX_WIDGETS } from '../domain/widgets';\nfunction f() { return MAX_WIDGETS; }`;
    expect(findLocalBatchCapDeclarations(clean)).toEqual([]);
  });
});
