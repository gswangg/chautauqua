// DEC-660/DEC-180 (wave-55 amendment): one declaration per server-enforced
// bound. Every SPA surface that needs a server-enforced numeric bound
// crosses the app/ -> src/ boundary through a named module rather than
// hand-copying the literal into a private const. This scan enumerates every
// .ts/.tsx file under app/src (readdirSync, mirroring pagination-summary.
// scan.test.ts rather than a hand-listed manifest) and fails if any file
// declares its own `const NAME = <number literal>` for one of these bound
// names -- where the population of bound names is itself DERIVED (DEC-180
// w52's rule: no hand-listed population) by scanning the server's own
// pure-core modules for `export const NAME = <number literal>`, rather than
// a hand-listed array that silently omits most of the server's caps.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
// app/src -> app -> repo root
const REPO_ROOT = join(HERE, '..', '..');

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

/** Every .ts/.tsx file under a pure-core root, excluding test files. */
function allPureCoreFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) continue;
    if (entry.name.includes('.test.')) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out;
}

// Matches `export const NAME = <number literal...>` -- the declaration
// shape, never an `export { NAME } from '...'` re-export barrel line (no
// `=` immediately after the name in that shape).
const EXPORT_CONST_NUMBER_RE = /export\s+const\s+([A-Z][A-Z0-9_]*)\s*(?::\s*\w+)?\s*=\s*[0-9]/g;

/** Pure function over source text: names of every `export const NAME = <number>`. */
function deriveNamesFromSource(src: string): string[] {
  const names: string[] = [];
  for (const match of src.matchAll(EXPORT_CONST_NUMBER_RE)) {
    names.push(match[1]!);
  }
  return names;
}

// The server-side pure-core roots this scan derives its bound-name
// population from (DEC-660 wave-55 amendment's task scope): src/domain/**,
// src/lib/**, src/forms/validate.ts, src/server/repo/**/bounds.ts. These
// are the modules a named app/ -> src/ boundary crossing is expected to
// import from.
function deriveServerBoundNames(): string[] {
  const files: string[] = [
    ...allPureCoreFiles(join(REPO_ROOT, 'src', 'domain')),
    ...allPureCoreFiles(join(REPO_ROOT, 'src', 'lib')),
    join(REPO_ROOT, 'src', 'forms', 'validate.ts'),
  ];
  // src/server/repo/**/bounds.ts -- any file literally named bounds.ts,
  // wherever it sits under src/server/repo.
  for (const entry of readdirSync(join(REPO_ROOT, 'src', 'server', 'repo'), {
    withFileTypes: true,
    recursive: true,
  })) {
    if (entry.isFile() && entry.name === 'bounds.ts') {
      files.push(join(entry.parentPath, entry.name));
    }
  }

  const names = new Set<string>();
  for (const file of files) {
    const src = readFileSync(file, 'utf-8');
    for (const name of deriveNamesFromSource(src)) names.add(name);
  }
  return [...names].sort();
}

function ownDeclarationRegex(name: string): RegExp {
  // `const NAME = <number literal>` -- with or without a type annotation,
  // never matching an `import { NAME }` line (no `=` immediately preceded
  // by `from` handling needed since import statements don't have this
  // "const NAME =" shape at all).
  return new RegExp(`const\\s+${name}\\s*(?::\\s*\\w+)?\\s*=\\s*[0-9]`);
}

function findOwnDeclarations(src: string, boundNames: string[]): string[] {
  const offenders: string[] = [];
  for (const name of boundNames) {
    if (ownDeclarationRegex(name).test(src)) offenders.push(name);
  }
  return offenders;
}

describe('server-enforced bounds are declared once, in pure core (DEC-660/DEC-180 wave-55 amendment)', () => {
  const SOURCE_FILES = allSourceFiles(HERE);
  const BOUND_NAMES = deriveServerBoundNames();

  it('scanned more than one source file', () => {
    expect(SOURCE_FILES.length).toBeGreaterThan(5);
  });

  it('derived more than a handful of server-enforced bound names', () => {
    // A regression guard on the derivation itself: if this collapses to a
    // tiny number, the pure-core scan roots resolved wrong and the whole
    // test would vacuously pass.
    expect(BOUND_NAMES.length).toBeGreaterThan(20);
  });

  it('no app/src/**/*.{ts,tsx} file declares its own literal for a server-enforced bound', () => {
    const offenders: string[] = [];
    for (const path of SOURCE_FILES) {
      const src = readFileSync(path, 'utf-8');
      const names = findOwnDeclarations(src, BOUND_NAMES);
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
    expect(findOwnDeclarations(violating, ['RECIPIENT_CAP'])).toEqual(['RECIPIENT_CAP']);

    const clean = `import { MAX_COMPOSE_RECIPIENTS } from '../../lib/merge-fields';\nfunction f() { return MAX_COMPOSE_RECIPIENTS; }`;
    expect(findOwnDeclarations(clean, ['MAX_COMPOSE_RECIPIENTS'])).toEqual([]);
  });

  // Synthetic control on the DERIVATION itself (DEC-660 w55 item 4): a
  // brand-new server module declaring a brand-new cap must (a) be picked up
  // by deriveNamesFromSource, and (b) then make an unimported SPA literal
  // of that name fail the own-declaration check -- proving the population
  // is genuinely derived at test time, not a frozen snapshot.
  it('a synthetic server module with a new cap makes an unimported SPA literal fail', () => {
    const syntheticServerModule = `export const TOTALLY_NEW_SYNTHETIC_CAP = 77;\n`;
    const derived = deriveNamesFromSource(syntheticServerModule);
    expect(derived).toContain('TOTALLY_NEW_SYNTHETIC_CAP');

    const syntheticSpaFile = `const TOTALLY_NEW_SYNTHETIC_CAP = 77;\nfunction f() { return TOTALLY_NEW_SYNTHETIC_CAP; }`;
    expect(findOwnDeclarations(syntheticSpaFile, derived)).toEqual(['TOTALLY_NEW_SYNTHETIC_CAP']);
  });
});
