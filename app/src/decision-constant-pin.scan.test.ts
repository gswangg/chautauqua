// DEC-976 wave-126 amendment: the DEC_NNN constants exported from
// src/decisions.ts (via src/decisions-data/part*.ts) are ONE mutable
// string each -- the swarm scribe overwrites them wave over wave for
// whichever ruling is newest. PhoneAgenda.dock-membership.render.test.tsx
// pinned four assertions directly against DEC_576 / DEC_380's live text and
// went red for a reason that had nothing to do with the agenda dock: the
// scribe rewrote DEC_576 for an unrelated wave-125 ruling. The durable
// homes for a ruling's TEXT are the append-only src/decisions-data/DEC-*.md
// amendment files and DEVIATIONS.md -- never the mutable one-liner.
//
// This scan enumerates EVERY test file under app/src/**/*.test.ts(x) and
// test/**/*.test.ts (readdirSync, DEC-808: never a hand-listed manifest)
// and fails on any assertion that matches a DEC_NNN identifier directly
// against a string/regex literal: expect(DEC_NNN).toMatch(...),
// .toContain(...), .toBe(...). Importing a DEC_NNN constant purely for a
// `void DEC_NNN;` provenance marker (compile-checked dependency, no text
// assertion) stays legal and must not be flagged -- only the TEXT
// assertion shape is the defect.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');

// The exact shape this scan forbids: expect(DEC_NNN).<matcher>(...) where
// <matcher> is one of the three text/regex assertion methods named in the
// ruling. A `void DEC_NNN;` provenance marker, a bare import, or DEC_NNN
// used as an argument to some OTHER function never matches this pattern.
const PIN_PATTERN = /expect\(\s*(DEC_\d{3})\s*\)\s*\.\s*(toMatch|toContain|toBe)\s*\(/g;

interface Offender {
  file: string;
  constant: string;
  matcher: string;
}

/** Scans one file's TEXT CONTENT (not the filesystem) for the forbidden
 * expect(DEC_NNN).<matcher>(...) shape. Exported at module scope so both
 * the real-tree scan below and the synthetic non-vacuity tripwire call the
 * identical function -- one scanner, never a drifting duplicate. */
function findPinOffenders(fileLabel: string, content: string): Offender[] {
  const offenders: Offender[] = [];
  for (const match of content.matchAll(PIN_PATTERN)) {
    offenders.push({ file: fileLabel, constant: match[1] as string, matcher: match[2] as string });
  }
  return offenders;
}

/** Every *.test.ts / *.test.tsx file under `root`, relative-path-labelled,
 * excluding nothing -- test files are exactly the population this scan
 * grades (DEC-808: enumerate, never hand-list). */
function allTestFiles(root: string, label: string): { label: string; full: string }[] {
  const out: { label: string; full: string }[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    if (!/\.test\.tsx?$/.test(entry.name)) continue;
    const full = join(entry.parentPath, entry.name);
    out.push({ label: `${label}/${relative(root, full).split(sep).join('/')}`, full });
  }
  return out;
}

const APP_SRC_ROOT = join(REPO_ROOT, 'app', 'src');
const TEST_ROOT = join(REPO_ROOT, 'test');

const TEST_FILES = [
  ...allTestFiles(APP_SRC_ROOT, 'app/src'),
  ...allTestFiles(TEST_ROOT, 'test'),
];

describe('DEC-976 wave-126: a DEC_NNN registry constant is never the target of a text/regex assertion', () => {
  it('enumerates a non-trivial population under both app/src and test (DEC-808: not a hand-list)', () => {
    expect(TEST_FILES.length).toBeGreaterThan(100);
    expect(TEST_FILES.some((f) => f.label.startsWith('app/src/'))).toBe(true);
    expect(TEST_FILES.some((f) => f.label.startsWith('test/'))).toBe(true);
  });

  it('the scanner catches a SYNTHETIC offender it constructs itself -- a non-vacuity tripwire that is not a live product finding (DEC-967 wave-124)', () => {
    // Built from concatenated fragments, never a literal occurrence of the
    // forbidden call shape in THIS file's own source -- otherwise the
    // real-tree scan below (which reads this very file's text) would flag
    // its own tripwire fixture as a live offender.
    const call = ['expect', '(', 'DEC_999', ')', '.', 'toMatch', '(', '/some ruling text/', ')', ';'].join('');
    const synthetic = [
      "import { DEC_999 } from '../../src/decisions';",
      '',
      "it('pins a ruling directly against the mutable constant', () => {",
      `  ${call}`,
      '});',
    ].join('\n');
    const offenders = findPinOffenders('synthetic-fixture.test.ts', synthetic);
    expect(offenders).toHaveLength(1);
    expect(offenders[0]).toEqual({ file: 'synthetic-fixture.test.ts', constant: 'DEC_999', matcher: 'toMatch' });
  });

  it('the scanner does NOT flag a `void DEC_NNN;` provenance marker (legal: compile-checked dependency, no text assertion)', () => {
    const synthetic = [
      "import { DEC_999 } from '../../src/decisions';",
      'void DEC_999; // compile-checked provenance marker only',
      '',
      "it('renders something the ruling requires', () => {",
      "  expect(screen.getByText('Something')).toBeInTheDocument();",
      '});',
    ].join('\n');
    const offenders = findPinOffenders('synthetic-void-fixture.test.ts', synthetic);
    expect(offenders).toHaveLength(0);
  });

  it('also does not flag toContain/toBe against something OTHER than a DEC_NNN identifier, or a DEC_NNN used as a plain argument', () => {
    const synthetic = [
      "const label = someHelper(DEC_999);",
      "expect(label).toContain('Something');",
      "expect(renderedText).toBe('Publish schedule');",
    ].join('\n');
    const offenders = findPinOffenders('synthetic-nonmatch-fixture.test.ts', synthetic);
    expect(offenders).toHaveLength(0);
  });

  it('no test file in app/src/**/*.test.ts(x) or test/**/*.test.ts pins a DEC_NNN constant with a text/regex assertion', () => {
    const offenders: Offender[] = [];
    for (const { label, full } of TEST_FILES) {
      const content = readFileSync(full, 'utf-8');
      offenders.push(...findPinOffenders(label, content));
    }

    if (offenders.length > 0) {
      const report = offenders
        .map((o) => `  ${o.file}: expect(${o.constant}).${o.matcher}(...)`)
        .join('\n');
      throw new Error(
        `Found ${offenders.length} DEC_NNN registry-constant text pin(s). These constants are ` +
          `mutable and get overwritten wave over wave by the swarm scribe -- assert against the ` +
          `durable src/decisions-data/DEC-*.md amendment (or DEVIATIONS.md) instead:\n${report}`,
      );
    }

    expect(offenders).toHaveLength(0);
  });
});
