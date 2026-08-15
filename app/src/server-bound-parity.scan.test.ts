// DEC-660/DEC-160 (wave-53 amendment): one declaration per server-enforced
// bound. Every SPA surface that needs the compose recipient cap or the
// bulk-ZIP archive caps crosses the app/ -> src/ boundary through the named
// modules (app/src/lib/merge-fields.ts for MAX_COMPOSE_RECIPIENTS,
// src/domain/files.ts for the archive caps) rather than hand-copying the
// literal into a private const. This scan enumerates every .ts/.tsx file
// under app/src (readdirSync, mirroring pagination-summary.scan.test.ts
// rather than a hand-listed manifest) and fails if any file declares its
// own `const NAME = <number literal>` for one of these bound names.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
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

// Server-enforced bound names that must be declared exactly once, in pure
// core, and reached from the SPA only through an import.
const BOUND_NAMES = ['RECIPIENT_CAP', 'MAX_COMPOSE_RECIPIENTS', 'ARCHIVE_MAX_FILES', 'ARCHIVE_MAX_TOTAL_BYTES'];

function ownDeclarationRegex(name: string): RegExp {
  // `const NAME = <number literal>` — with or without a type annotation,
  // never matching an `import { NAME }` line (no `=` immediately preceded
  // by `from` handling needed since import statements don't have this
  // "const NAME =" shape at all).
  return new RegExp(`const\\s+${name}\\s*(?::\\s*\\w+)?\\s*=\\s*[0-9]`);
}

function findOwnDeclarations(src: string): string[] {
  const offenders: string[] = [];
  for (const name of BOUND_NAMES) {
    if (ownDeclarationRegex(name).test(src)) offenders.push(name);
  }
  return offenders;
}

describe('server-enforced bounds are declared once, in pure core (DEC-660/DEC-160 wave-53 amendment)', () => {
  const SOURCE_FILES = allSourceFiles(HERE);

  it('scanned more than one source file', () => {
    expect(SOURCE_FILES.length).toBeGreaterThan(5);
  });

  it('no app/src/**/*.{ts,tsx} file declares its own literal for a server-enforced bound', () => {
    const offenders: string[] = [];
    for (const path of SOURCE_FILES) {
      const src = readFileSync(path, 'utf-8');
      const names = findOwnDeclarations(src);
      if (names.length > 0) offenders.push(`${path}: ${names.join(', ')}`);
    }
    expect(
      offenders,
      `files hand-declaring a server-enforced bound instead of importing it:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  // Synthetic negative control: proves the regex actually catches the
  // violating shape and does not false-positive on a plain import.
  it('the detector flags a violating declaration and ignores an import line', () => {
    const violating = `const RECIPIENT_CAP = 100;\nfunction f() { return RECIPIENT_CAP; }`;
    expect(findOwnDeclarations(violating)).toEqual(['RECIPIENT_CAP']);

    const clean = `import { MAX_COMPOSE_RECIPIENTS } from '../../lib/merge-fields';\nfunction f() { return MAX_COMPOSE_RECIPIENTS; }`;
    expect(findOwnDeclarations(clean)).toEqual([]);
  });
});
