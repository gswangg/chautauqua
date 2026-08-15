// DEC-660 (wave-53 amendment): every server-enforced numeric bound the SPA
// restates has exactly one declaration in pure core, reached through a
// named app/ -> src/ boundary module. This scan enumerates every .ts/.tsx
// file under app/src (readdirSync, mirroring pagination-summary.scan.test.ts
// rather than a hand-listed manifest) and fails if:
//   (1) any file declares its own `const NAME_CAP = <number>` or
//       `const NAME_MAX_... = <number>` literal instead of importing one, or
//   (2) any file other than the named crossings (merge-fields.ts, plural.ts,
//       file-caps.ts) imports a known server-enforced bound directly from
//       '../../../src/domain/*' rather than through its named crossing.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Every .ts/.tsx file under app/src, excluding test files. */
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

// A generic fingerprint for a locally-declared numeric cap: `const
// SOME_CAP = 100` or `const SOME_MAX_THING = 25`, with or without a type
// annotation. Never matches an `import { X } from '...'` line, since import
// statements don't carry the `const NAME =` shape.
const LOCAL_CAP_DECL_RE = /const\s+[A-Z][A-Z0-9_]*(?:_CAP|_MAX_[A-Z0-9_]+)\s*(?::\s*\w+)?\s*=\s*[0-9]/g;

function findLocalCapDeclarations(src: string): string[] {
  const matches = src.match(LOCAL_CAP_DECL_RE) ?? [];
  return matches;
}

// The only app-side modules permitted to cross the app/ -> src/domain/**
// boundary for a server-enforced numeric bound (DEC-660's named crossings).
const ALLOWED_CROSSINGS = new Set<string>([
  join('lib', 'merge-fields.ts'),
  join('lib', 'plural.ts'),
  join('lib', 'file-caps.ts'),
]);

// Known server-enforced bound export names -- if one of these is imported
// straight from src/domain/** by a file other than its named crossing, the
// crossing has been bypassed.
const BOUND_EXPORT_NAMES = ['MAX_COMPOSE_RECIPIENTS', 'ARCHIVE_MAX_FILES', 'ARCHIVE_MAX_TOTAL_BYTES', 'ARCHIVE_PEAK_MULTIPLIER'];

const DOMAIN_IMPORT_RE = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"][^'"]*\/src\/domain\/[^'"]*['"]/g;

function findBypassedCrossings(src: string): string[] {
  const offenders: string[] = [];
  for (const match of src.matchAll(DOMAIN_IMPORT_RE)) {
    const names = match[1]!.split(',').map((s) => s.trim()).filter(Boolean);
    for (const name of names) {
      if (BOUND_EXPORT_NAMES.includes(name)) offenders.push(name);
    }
  }
  return offenders;
}

describe('server-enforced numeric bounds cross the app/ -> src/ boundary through a named module only (DEC-660 wave-53 amendment)', () => {
  const SOURCE_FILES = allSourceFiles(HERE);

  it('scanned more than one source file', () => {
    expect(SOURCE_FILES.length).toBeGreaterThan(5);
  });

  it('no app/src/**/*.{ts,tsx} file declares its own numeric cap literal', () => {
    const offenders: string[] = [];
    for (const path of SOURCE_FILES) {
      const src = readFileSync(path, 'utf-8');
      const found = findLocalCapDeclarations(src);
      if (found.length > 0) offenders.push(`${relative(HERE, path)}: ${found.join(', ')}`);
    }
    expect(offenders, `files hand-declaring a numeric cap literal:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('only the named crossings import a server-enforced bound directly from src/domain', () => {
    const offenders: string[] = [];
    for (const path of SOURCE_FILES) {
      const label = relative(HERE, path);
      if (ALLOWED_CROSSINGS.has(label)) continue;
      const src = readFileSync(path, 'utf-8');
      const bypassed = findBypassedCrossings(src);
      if (bypassed.length > 0) offenders.push(`${label}: ${bypassed.join(', ')}`);
    }
    expect(
      offenders,
      `files importing a server-enforced bound straight from src/domain instead of a named crossing:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  // Synthetic negative controls: prove the detectors catch the violating
  // shape and do not false-positive on a clean crossing import.
  it('the local-cap detector flags a violating declaration and ignores an import line', () => {
    const violating = `const RECIPIENT_CAP = 100;\nfunction f() { return RECIPIENT_CAP; }`;
    expect(findLocalCapDeclarations(violating)).toEqual(['const RECIPIENT_CAP = 1']);

    const clean = `import { MAX_COMPOSE_RECIPIENTS } from '../../lib/merge-fields';\nfunction f() { return MAX_COMPOSE_RECIPIENTS; }`;
    expect(findLocalCapDeclarations(clean)).toEqual([]);
  });

  it('the crossing-bypass detector flags a direct src/domain import and ignores a named-crossing import', () => {
    const bypassing = `import { ARCHIVE_MAX_FILES } from '../../../../src/domain/files';`;
    expect(findBypassedCrossings(bypassing)).toEqual(['ARCHIVE_MAX_FILES']);

    const viaLib = `import { ARCHIVE_MAX_FILES } from '../../lib/file-caps';`;
    expect(findBypassedCrossings(viaLib)).toEqual([]);
  });
});
