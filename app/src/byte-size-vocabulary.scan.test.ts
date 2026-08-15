// DEC-020 (wave-55 amendment): formatBytes lives in exactly one place —
// src/domain/files.ts — and every SPA surface crosses the app/ -> src/
// boundary through app/src/pages/content/format.ts (same style as
// server-bound-parity.scan.test.ts's BOUND_NAMES scan). This scan enumerates
// every .ts/.tsx file under app/src (readdirSync, mirroring
// server-bound-parity.scan.test.ts rather than a hand-listed manifest) and
// fails if any file other than the one named crossing declares its own
// byte-unit array (e.g. `['B', 'KB', 'MB', 'GB']`) or its own
// formatBytes/format*Size helper.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));

// The ONE file allowed to declare formatBytes: it exists solely to
// re-export the pure-core implementation across the app/ -> src/ boundary.
const ALLOWED_CROSSING = join(HERE, 'pages', 'content', 'format.ts');

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

// Matches a DECLARATION of formatBytes/formatFileSize/formatSize/etc —
// `function formatBytes(...)` or `const formatFileSize = ...` — never a
// plain call site (`formatBytes(x)`), so importing and calling the shared
// helper never trips this scan.
const FORMAT_SIZE_HELPER_RE =
  /(?:\bfunction\s+(?:formatBytes|format\w*Size)\s*\()|(?:\b(?:const|let|var)\s+(?:formatBytes|format\w*Size)\s*=)/;

// Matches a byte-unit array literal such as ['B', 'KB', 'MB', 'GB'] or
// ["B", "KB", "MB"] in either quote style, with or without a trailing GB.
const BYTE_UNIT_ARRAY_RE = /\[\s*['"]B['"]\s*,\s*['"]KB['"]\s*,\s*['"]MB['"]/;

describe('the byte-size vocabulary is declared once, in pure core (DEC-020 wave-55 amendment)', () => {
  const SOURCE_FILES = allSourceFiles(HERE);

  it('scanned more than one source file', () => {
    expect(SOURCE_FILES.length).toBeGreaterThan(5);
  });

  it('the one allowed crossing (pages/content/format.ts) exists and is scanned', () => {
    expect(SOURCE_FILES).toContain(ALLOWED_CROSSING);
  });

  it('no app/src file other than the named crossing declares its own byte-unit array or formatBytes/format*Size helper', () => {
    const offenders: string[] = [];
    for (const path of SOURCE_FILES) {
      if (path === ALLOWED_CROSSING) continue;
      const src = readFileSync(path, 'utf-8');
      if (FORMAT_SIZE_HELPER_RE.test(src) || BYTE_UNIT_ARRAY_RE.test(src)) {
        offenders.push(relative(HERE, path));
      }
    }
    expect(offenders).toEqual([]);
  });

  // Negative control (both directions): the matchers themselves must fire
  // on the shapes they're meant to catch, and must NOT fire on an import of
  // formatBytes (which every legitimate consumer does).
  it('negative control: the matchers fire on a local declaration but not on an import', () => {
    const localFunctionDecl = `function formatBytes(bytes: number): string { return String(bytes); }`;
    const localArrowDecl = `const formatFileSize = (bytes: number) => String(bytes);`;
    const localUnitArray = `const units = ['B', 'KB', 'MB', 'GB'];`;
    const legitimateImport = `import { formatBytes } from '../content/format';`;

    expect(FORMAT_SIZE_HELPER_RE.test(localFunctionDecl)).toBe(true);
    expect(FORMAT_SIZE_HELPER_RE.test(localArrowDecl)).toBe(true);
    expect(BYTE_UNIT_ARRAY_RE.test(localUnitArray)).toBe(true);

    expect(FORMAT_SIZE_HELPER_RE.test(legitimateImport)).toBe(false);
    expect(BYTE_UNIT_ARRAY_RE.test(legitimateImport)).toBe(false);
  });
});
