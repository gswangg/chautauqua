// DEC-478 (amendment, wave 62): MAX_IMPORT_ROWS moved from
// src/server/repo/contacts/import.ts (a drizzle-importing repo module the
// SPA cannot import) to src/domain/contacts.ts (pure core), so
// app/src/pages/contacts/ImportWizard.tsx can disclose the cap where the
// file is chosen, not only in the 400 the server returns at the end.
//
// Structure-custodian decomposition (contacts.ts contention hotspot):
// contacts.ts is now a re-export barrel over src/domain/contacts-parts/*;
// the literal declaration lives in domain/contacts-parts/import.ts.
//
// This scan walks every non-test .ts/.tsx file under src/ and fails if more
// than one of them declares `const MAX_IMPORT_ROWS = <number>` -- a
// `const MAX_IMPORT_ROWS = someIdentifier` re-export (e.g.
// src/routes/api/contacts/import.ts's `= repo.MAX_IMPORT_ROWS`) is not a
// second declaration; it resolves to the one value below.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = join(HERE, '..', 'src');

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

// Only a literal-valued declaration counts -- `const MAX_IMPORT_ROWS =
// repo.MAX_IMPORT_ROWS;` (a re-export) does not match `=\s*[0-9]`.
const DECL_RE = /const\s+MAX_IMPORT_ROWS\s*(?::\s*\w+)?\s*=\s*[0-9]/;

describe('MAX_IMPORT_ROWS is declared exactly once, in pure core (DEC-478, amendment wave 62)', () => {
  const SRC_FILES = allSourceFiles(SRC_ROOT);

  it('scanned a non-empty file set (vacuous-scan tripwire)', () => {
    expect(SRC_FILES.length).toBeGreaterThan(50);
  });

  it('exactly one src/**/*.{ts,tsx} file declares `const MAX_IMPORT_ROWS = <number>`, and it is under src/domain', () => {
    const declaring: string[] = [];
    for (const path of SRC_FILES) {
      const src = readFileSync(path, 'utf-8');
      if (DECL_RE.test(src)) declaring.push(path);
    }
    const relPaths = declaring.map((p) => relative(SRC_ROOT, p));
    expect(relPaths, `MAX_IMPORT_ROWS declared in: ${relPaths.join(', ')}`).toEqual([
      'domain/contacts-parts/import.ts',
    ]);
  });

  // Negative control: the repo module's `export { MAX_IMPORT_ROWS };`
  // re-export and the route module's `= repo.MAX_IMPORT_ROWS` re-export are
  // both present but neither is a second declaration.
  it('the repo and route re-exports are present but are not counted as declarations', () => {
    const repoSrc = readFileSync(join(SRC_ROOT, 'server', 'repo', 'contacts', 'import.ts'), 'utf-8');
    expect(repoSrc).toMatch(/export\s*\{\s*MAX_IMPORT_ROWS\s*\}/);
    expect(DECL_RE.test(repoSrc)).toBe(false);

    const routeSrc = readFileSync(join(SRC_ROOT, 'routes', 'api', 'contacts', 'import.ts'), 'utf-8');
    expect(routeSrc).toMatch(/const MAX_IMPORT_ROWS = repo\.MAX_IMPORT_ROWS/);
    expect(DECL_RE.test(routeSrc)).toBe(false);
  });
});
