// A batch/collection cap (a bare `MAX_*` count, not a text-length bound --
// see test/text-cap-declaration.scan.test.ts, which owns the `_LENGTH`/
// `_MAX_LEN` shapes) belongs in pure core (src/domain/**), declared exactly
// once, so a route or repo module the SPA cannot import from can never
// hide a `const MAX_SOMETHING = <number>` literal (DEC-422, amendment
// waves 59 and 67). This scan enumerates every non-test .ts AND .tsx file
// under src/routes AND src/server/repo (wave-67 amendment: the population
// widened past src/routes once the same hazard turned up one directory
// over) and fails if any of them declares its own `const MAX_[A-Z0-9_]* =
// <number>` literal instead of importing one from src/domain/**, aside
// from a categorical name-suffix exemption for internal query bounds and a
// short list of named, live allowlist entries.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROUTES_ROOT = join(HERE, '..', 'src', 'routes');
const REPO_ROOT = join(HERE, '..', 'src', 'server', 'repo');
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

// A generic fingerprint for a route/repo-local batch/count cap: `const
// MAX_WHATEVER = 20` or `export const MAX_WHATEVER: number = 100`, with or
// without a type annotation. Never matches an `import { MAX_X } from '...'`
// line (import statements don't carry the `const NAME =` shape), and never
// matches `const MAX_X = someIdentifier` (a re-export of a value declared
// elsewhere, e.g. `export const MAX_IMPORT_ROWS = repo.MAX_IMPORT_ROWS;`).
const LOCAL_BATCH_CAP_DECL_RE = /const\s+(MAX_[A-Z0-9_]*)\s*(?::\s*\w+)?\s*=\s*[0-9]/g;

// A name ending in _LENGTH/_MAX_LEN is a text-length bound, owned by the
// sibling test/text-cap-declaration.scan.test.ts -- excluded here by name
// so the two scans partition the same generic `const MAX_*`/`const NAME_*`
// declaration shape rather than both claiming (or both missing) it.
function isTextLengthName(name: string): boolean {
  return /_LENGTH$|_MAX_LEN$/.test(name);
}

function findLocalBatchCapDeclarations(src: string): string[] {
  return [...src.matchAll(LOCAL_BATCH_CAP_DECL_RE)]
    .filter((m) => !isTextLengthName(m[1] as string))
    .map((m) => m[0]);
}

function declaredNames(src: string): string[] {
  return [...src.matchAll(LOCAL_BATCH_CAP_DECL_RE)]
    .filter((m) => !isTextLengthName(m[1] as string))
    .map((m) => m[1] as string);
}

// Categorical exemption: these name suffixes bound an internal query (how
// many rows one SELECT reads before its bounded-scan+throw guard fires),
// never a product cap a control collects toward or discloses ("N of MAX")
// -- so they are exempt by shape, not by a per-file allowlist entry that
// would rot as new ones are added (wave-67 amendment's stated reason: a
// categorical suffix exemption outlives a per-file allowlist).
const QUERY_BOUND_SUFFIXES = ['_SCAN', '_ROWS', '_WRITES', '_ASSIGNMENTS', '_PLACEMENTS', '_STATEMENTS_PER_REQUEST'];

function isQueryBoundName(name: string): boolean {
  return QUERY_BOUND_SUFFIXES.some((suffix) => name.endsWith(suffix));
}

// Named, live allowlist: entries that are neither a query-bound-suffix name
// nor a product cap with a pure-core home, each with its own reason.
const ALLOWLIST: { file: string; reason: string }[] = [
  {
    file: join(ROUTES_ROOT, 'api', 'validators.ts'),
    reason:
      "MAX_EPOCH_MS bounds a JSON-field's epoch-ms *value* shape (a wire-format/Date range check), not a batch/collection cap any control collects toward -- there is no pure-core 'cap' concept for it to move to.",
  },
  {
    file: join(REPO_ROOT, 'contacts', 'history.ts'),
    reason:
      'MAX_CONTACT_HISTORY_SUBMISSIONS and MAX_CONTACT_HISTORY_EMAILS bound how many rows one contact-history read returns (a bounded-scan slice, same shape as the _SCAN/_ROWS suffix class) -- not a product cap any control collects toward or discloses.',
  },
  {
    file: join(REPO_ROOT, 'public', 'bounds.ts'),
    reason:
      "MAX_PUBLIC_PAGE bounds how deep a public feed's pagination may page (an anti-scrape/anti-abuse read-side bound), not a product cap a control collects toward -- never rendered as 'N of MAX_PUBLIC_PAGE'.",
  },
];

describe('no src/routes|server/repo/**/*.{ts,tsx} module hand-declares a batch/count cap literal (DEC-422, amendments waves 59+67)', () => {
  const ROUTE_FILES = allSourceFiles(ROUTES_ROOT);
  const REPO_FILES = allSourceFiles(REPO_ROOT);
  const SCANNED_FILES = [...ROUTE_FILES, ...REPO_FILES];
  const DOMAIN_FILES = allSourceFiles(DOMAIN_ROOT);

  it('scanned more than one route file, of both .ts and .tsx', () => {
    expect(ROUTE_FILES.length).toBeGreaterThan(1);
    expect(ROUTE_FILES.some((p) => p.endsWith('.ts'))).toBe(true);
    expect(ROUTE_FILES.some((p) => p.endsWith('.tsx'))).toBe(true);
  });

  // Tripwire (wave-67 amendment): the repo half of the population must be
  // non-empty, or the widened scan is silently only scanning src/routes
  // again -- e.g. a broken path after a directory rename.
  it('the repo half of the scanned population is non-empty', () => {
    expect(REPO_FILES.length).toBeGreaterThan(10);
  });

  it('every allowlist entry still names a live file', () => {
    for (const entry of ALLOWLIST) {
      expect(() => statSync(entry.file), `allowlisted file no longer exists: ${entry.file}`).not.toThrow();
    }
  });

  it('no src/routes|server/repo file (outside the exemptions) declares its own batch cap literal', () => {
    const allowlistedFiles = new Set(ALLOWLIST.map((e) => e.file));
    const offenders: string[] = [];
    for (const path of SCANNED_FILES) {
      if (allowlistedFiles.has(path)) continue;
      const src = readFileSync(path, 'utf-8');
      const names = declaredNames(src);
      const found = findLocalBatchCapDeclarations(src);
      const nonExempt = found.filter((_, i) => !isQueryBoundName(names[i] as string));
      if (nonExempt.length > 0) offenders.push(`${relative(HERE, path)}: ${nonExempt.join(', ')}`);
    }
    expect(offenders, `route/repo files hand-declaring a batch cap literal:\n${offenders.join('\n')}`).toEqual([]);
  });

  // The allowlisted files DO still declare their named literal -- confirms
  // the allowlist is excusing a real, present declaration, not a stale
  // entry for something already moved/deleted.
  it('every allowlisted file still declares the literal the allowlist excuses', () => {
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

  // Positive control: the query-bound suffix exemption is excusing REAL
  // declarations (e.g. MAX_FILE_LIBRARY_SCAN, MAX_TASK_ASSIGNMENT_WRITES),
  // not matching nothing.
  it('positive control: at least one repo file declares a query-bound-suffix name the exemption excuses', () => {
    let found = 0;
    for (const path of REPO_FILES) {
      const src = readFileSync(path, 'utf-8');
      found += declaredNames(src).filter(isQueryBoundName).length;
    }
    expect(found).toBeGreaterThan(0);
  });

  // Vacuous-scan tripwire: if allSourceFiles silently returned nothing (a
  // broken glob/path after a directory rename), every "no offenders" result
  // above would be trivially true. Guard against that directly.
  it('vacuous-scan tripwire: the routes scan, the repo scan and the domain scan all walked a non-empty file set', () => {
    expect(ROUTE_FILES.length).toBeGreaterThan(10);
    expect(REPO_FILES.length).toBeGreaterThan(10);
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

  // Both-ways negative control for the suffix exemption: a synthetic
  // _SCAN-suffixed declaration is exempted from the offender list, but a
  // synthetic product-cap declaration with no exempt suffix is still
  // flagged.
  it('the suffix exemption excuses a synthetic *_SCAN declaration but not a synthetic product-cap declaration', () => {
    const exemptSrc = `const MAX_WIDGET_SCAN = 500;`;
    const exemptNames = declaredNames(exemptSrc);
    expect(exemptNames).toEqual(['MAX_WIDGET_SCAN']);
    expect(exemptNames.every(isQueryBoundName)).toBe(true);

    const nonExemptSrc = `const MAX_WIDGETS_PER_EVENT = 500;`;
    const nonExemptNames = declaredNames(nonExemptSrc);
    expect(nonExemptNames).toEqual(['MAX_WIDGETS_PER_EVENT']);
    expect(nonExemptNames.every(isQueryBoundName)).toBe(false);
  });
});
