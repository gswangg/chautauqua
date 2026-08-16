// DEC-660 (wave-55 amendment) + DEC-180's w52 rule: every server-enforced
// numeric bound the SPA restates has exactly one declaration in pure core,
// reached through a named app/ -> src/ boundary module. This scan
// enumerates every .ts/.tsx file under app/src (readdirSync, mirroring
// pagination-summary.scan.test.ts rather than a hand-listed manifest) and
// fails if:
//   (1) any file declares its own `const NAME_CAP = <number>` or
//       `const NAME_MAX_... = <number>` literal instead of importing one,
//   (2) any file other than the named crossings (merge-fields.ts,
//       plural.ts, file-caps.ts, batch-caps.ts, domain-caps.ts) imports a
//       server-enforced bound directly from '../../../src/domain/*' rather
//       than through its named crossing, or
//   (3) any file other than the crossing modules HARD-CODES the same
//       numeric literal as a distinctive server-enforced cap in
//       user-visible copy, without importing the cap through its named
//       app/ -> src/ boundary module.
//
// The population of bound names for (1) and (2) is DERIVED (DEC-180 w52's
// rule) by scanning src/domain/** for `export const NAME = <number
// literal>`, rather than a hand-listed array that silently omits most of
// the server's caps.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
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

// Matches `export const NAME = <number literal...>` -- the declaration
// shape, never an `export { NAME } from '...'` re-export barrel line.
const EXPORT_CONST_NUMBER_RE = /export\s+const\s+([A-Z][A-Z0-9_]*)\s*(?::\s*\w+)?\s*=\s*([0-9][^;\n]*)/g;

/** Pure function over source text: {name, rawValueExpr} for every `export const NAME = <number>`. */
function deriveDeclarationsFromSource(src: string): { name: string; valueExpr: string }[] {
  const out: { name: string; valueExpr: string }[] = [];
  for (const match of src.matchAll(EXPORT_CONST_NUMBER_RE)) {
    out.push({ name: match[1]!, valueExpr: match[2]!.trim() });
  }
  return out;
}

/** Every server-enforced bound declared directly under src/domain/**. */
function deriveDomainBoundDeclarations(): { name: string; valueExpr: string }[] {
  const out: { name: string; valueExpr: string }[] = [];
  for (const entry of readdirSync(join(REPO_ROOT, 'src', 'domain'), { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) continue;
    if (entry.name.includes('.test.')) continue;
    const src = readFileSync(join(entry.parentPath, entry.name), 'utf-8');
    out.push(...deriveDeclarationsFromSource(src));
  }
  return out;
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
  join('lib', 'batch-caps.ts'), // DEC-422 wave-67 amendment's crossing
  join('lib', 'domain-caps.ts'), // DEC-660 wave-55 amendment's crossing (this task)
]);

const DOMAIN_IMPORT_RE = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"][^'"]*\/src\/domain\/[^'"]*['"]/g;

function findBypassedCrossings(src: string, boundExportNames: string[]): string[] {
  const offenders: string[] = [];
  for (const match of src.matchAll(DOMAIN_IMPORT_RE)) {
    const names = match[1]!.split(',').map((s) => s.trim()).filter(Boolean);
    for (const name of names) {
      if (boundExportNames.includes(name)) offenders.push(name);
    }
  }
  return offenders;
}

// --- (3) hard-coded-literal-in-copy check -----------------------------
//
// Only a curated subset of the derived src/domain/** caps is distinctive
// enough in VALUE to check for a hard-coded literal without false-positive
// risk -- a bare `100` or `50` shows up constantly in unrelated copy (page
// sizes, percentages, css). Values excluded here, and why:
//   - Any single- or two-digit value (6, 12, 20, 25, 40, 50) is far too
//     common in unrelated numeric copy (list lengths, percentages, css
//     px/rem values) to attribute to one specific cap.
//   - 100 and 200 are shared by several unrelated caps (MAX_COMPOSE_
//     RECIPIENTS, MAX_PORTAL_INVITE_RECIPIENTS, MAX_BREAKS_PER_EVENT,
//     MAX_FORM_FIELDS, ...) as well as generic percentages -- ambiguous
//     even before counting unrelated copy.
//   - 300 and 1000 (MAX_ITINERARY_IDS, MAX_SUBMISSION_TRACK_IDS) were
//     probed and found live, unrelated occurrences in app/src copy and
//     comments (a "300 words max" placeholder hint, a code comment
//     quoting the server's own 'Max 1000' field-error message) -- exactly
//     the false-positive risk this check must not create.
// Kept in the distinctive set: MAX_EMAIL_LENGTH (254, RFC 5321's exact
// address-length ceiling, never seen elsewhere in app/src) and
// MAX_PASSWORD_LENGTH (128, never seen elsewhere in app/src either).
const DISTINCTIVE_COPY_CAPS = new Set<string>(['MAX_EMAIL_LENGTH', 'MAX_PASSWORD_LENGTH']);

/** Strip `//` line comments and `/* *\/` block comments before scanning copy. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function findHardcodedDistinctiveCaps(
  src: string,
  domainDeclarations: { name: string; valueExpr: string }[],
): string[] {
  const code = stripComments(src);
  const offenders: string[] = [];
  for (const { name, valueExpr } of domainDeclarations) {
    if (!DISTINCTIVE_COPY_CAPS.has(name)) continue;
    // Only a plain integer-literal declaration (not an expression like
    // `25 * BYTES_PER_MB`) is safe to fingerprint as a bare number.
    if (!/^[0-9]+$/.test(valueExpr)) continue;
    const literalRe = new RegExp(`\\b${valueExpr}\\b`);
    if (literalRe.test(code)) offenders.push(name);
  }
  return offenders;
}

describe('server-enforced numeric bounds cross the app/ -> src/ boundary through a named module only (DEC-660 wave-55 amendment)', () => {
  const SOURCE_FILES = allSourceFiles(HERE);
  const DOMAIN_DECLARATIONS = deriveDomainBoundDeclarations();
  const BOUND_EXPORT_NAMES = DOMAIN_DECLARATIONS.map((d) => d.name);

  it('scanned more than one source file', () => {
    expect(SOURCE_FILES.length).toBeGreaterThan(5);
  });

  it('derived more than a handful of src/domain bound names', () => {
    expect(BOUND_EXPORT_NAMES.length).toBeGreaterThan(20);
  });

  it('no app/src/**/*.tsx file declares its own numeric cap literal', () => {
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
      const bypassed = findBypassedCrossings(src, BOUND_EXPORT_NAMES);
      if (bypassed.length > 0) offenders.push(`${label}: ${bypassed.join(', ')}`);
    }
    expect(
      offenders,
      `files importing a server-enforced bound straight from src/domain instead of a named crossing:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('no app/src/**/*.tsx file hard-codes a distinctive server-enforced cap literal in copy', () => {
    const offenders: string[] = [];
    for (const path of SOURCE_FILES) {
      if (!path.endsWith('.tsx')) continue;
      const label = relative(HERE, path);
      if (ALLOWED_CROSSINGS.has(label)) continue;
      const src = readFileSync(path, 'utf-8');
      const found = findHardcodedDistinctiveCaps(src, DOMAIN_DECLARATIONS);
      if (found.length > 0) offenders.push(`${label}: ${found.join(', ')}`);
    }
    expect(
      offenders,
      `files hard-coding a distinctive server-enforced cap literal instead of importing it:\n${offenders.join('\n')}`,
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
    expect(findBypassedCrossings(bypassing, ['ARCHIVE_MAX_FILES'])).toEqual(['ARCHIVE_MAX_FILES']);

    const viaLib = `import { ARCHIVE_MAX_FILES } from '../../lib/file-caps';`;
    expect(findBypassedCrossings(viaLib, ['ARCHIVE_MAX_FILES'])).toEqual([]);
  });

  // Synthetic control on the DERIVATION itself (DEC-660 w55 item 4): a
  // synthetic server module declaring a new distinctive cap must be picked
  // up by the derivation, and an unimported SPA literal matching that
  // cap's value must then fail the hard-coded-copy check.
  it('a synthetic server module with a new distinctive cap makes an unimported SPA literal fail', () => {
    const syntheticServerModule = `export const SYNTHETIC_DISTINCTIVE_CAP = 9137;\n`;
    const declarations = deriveDeclarationsFromSource(syntheticServerModule);
    expect(declarations).toEqual([{ name: 'SYNTHETIC_DISTINCTIVE_CAP', valueExpr: '9137' }]);

    // Simulate DISTINCTIVE_COPY_CAPS containing the synthetic name by
    // calling the underlying literal-match logic directly.
    const syntheticSpaFile = `<p>You may add up to 9137 items.</p>`;
    const literalRe = new RegExp(`\\b${declarations[0]!.valueExpr}\\b`);
    expect(literalRe.test(stripComments(syntheticSpaFile))).toBe(true);

    // And a comment-only mention must NOT trip the detector.
    const commentOnly = `// the server enforces 9137 as its ceiling\nconst x = 1;`;
    expect(literalRe.test(stripComments(commentOnly))).toBe(false);
  });
});
