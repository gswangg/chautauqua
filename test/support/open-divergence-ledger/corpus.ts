// Open-divergence ledger corpus (DEC-099, task w11-td; decomposed from
// test/open-divergence-ledger.scan.test.ts, task custodian-test_open_
// divergence_ledger_scan_test_ts, wave 35 -- contention decomposition, no
// behavior change). This module holds the FILESYSTEM population walk: every
// *.md file under docs/design/audit, enumerated rather than named (DEC-808),
// walked RECURSIVELY (DEC-099 wave-24 amendment) so a nested directory
// cannot hide rows from the population (DEC-367/DEC-808 "a directory is not
// a population") -- and the derived ALL_ROWS/OPEN_ROWS this scan's ratchet
// grades. See test/open-divergence-ledger.scan.test.ts for the full
// population/ratchet rationale.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveRowsFromLines, type DivergenceRow } from './grammar';

const HERE = dirname(fileURLToPath(import.meta.url)); // test/support/open-divergence-ledger/
export const REPO_ROOT = join(HERE, '..', '..', '..');
export const AUDIT_DIR = join(REPO_ROOT, 'docs', 'design', 'audit');

/** Every *.md file under docs/design/audit, enumerated rather than named
 * (DEC-808), walked RECURSIVELY (DEC-099 wave-24 amendment) so a nested
 * directory (e.g. docs/design/audit/settings-v12/) cannot hide rows from
 * the population -- per DEC-367/DEC-808 "a directory is not a population".
 * Returns paths relative to AUDIT_DIR (POSIX-joined) so nested files carry
 * a directory separator while flat-directory files keep their bare name,
 * preserving the existing flat rows' exact file:line keys. */
export function auditFiles(dir: string = AUDIT_DIR): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const e of entries) {
    if (e.isDirectory()) {
      const nested = auditFiles(join(dir, e.name));
      for (const n of nested) out.push(`${e.name}/${n}`);
    } else if (e.isFile() && e.name.endsWith('.md')) {
      out.push(e.name);
    }
  }
  return out.sort();
}

export function rowsInFile(fileName: string): DivergenceRow[] {
  const full = join(AUDIT_DIR, fileName);
  const relFile = relative(REPO_ROOT, full);
  const lines = readFileSync(full, 'utf-8').split('\n');
  return deriveRowsFromLines(relFile, lines);
}

export const ALL_ROWS: DivergenceRow[] = auditFiles().flatMap(rowsInFile);
export const OPEN_ROWS: DivergenceRow[] = ALL_ROWS.filter((r) => !r.adjudicated);
