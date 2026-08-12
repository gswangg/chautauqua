// DEC-524: app/src/lib/dates.ts is the ONLY date-input <-> epoch converter
// in the admin SPA. This is a re-runnable source-scan test (per DEC-518 --
// enumerate by globbing the tree, never a hand-listed manifest) that walks
// every app/src/**/*.{ts,tsx} file, excludes app/src/lib/dates.ts itself and
// any *.test.* file, and fails NAMING the offending file+line if it finds a
// reimplementation of one of dates.ts's own patterns:
//   - `new Date(<expr containing 'T00:00:00'>)` -- the dateInputToMs pattern
//   - `<identifier>.getTime()` where identifier isn't part of a chained
//     `new Date(...).getTime()` -- the msToDateInput/raw-conversion pattern
//   - `.toISOString().slice(0, 10)` -- the msToDateInput pattern
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_SRC = join(HERE, '..'); // app/src
const DATES_FILE = join(HERE, 'dates.ts'); // app/src/lib/dates.ts

function walkSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...walkSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

export interface Violation {
  file: string;
  line: number;
  text: string;
}

/** Scans a single file's source for date-input <-> epoch conversions that duplicate lib/dates.ts. */
export function scanForViolations(file: string, source: string): Violation[] {
  const violations: Violation[] = [];
  const lines = source.split('\n');
  lines.forEach((lineText, idx) => {
    const lineNo = idx + 1;
    // Pattern 1: `new Date(` whose argument is a template/interpolation
    // containing the 'T00:00:00' date-only-midnight marker (the
    // dateInputToMs reimplementation, e.g. `new Date(`${v}T00:00:00.000Z`)`).
    const templateT0000 = /new Date\([^)]*T00:00:00[^)]*\)/.test(lineText);
    // Pattern 2: a `new Date(...).getTime()` chain, or a bare identifier
    // immediately followed by `.getTime()` -- the msToDateInput/raw-epoch
    // reimplementation. `new Date(x).getTime()` is the identifier `x`'s
    // instant read directly off a freshly-constructed Date, unvalidated;
    // `someVar.getTime()` is the same read one step removed.
    const chainedGetTime = /new Date\([^)]*\)\.getTime\(\)/.test(lineText);
    const bareGetTime = /\b[A-Za-z_$][\w$]*\.getTime\(\)/.test(lineText) && !chainedGetTime;
    // Pattern 3: .toISOString().slice(0, 10) -- the msToDateInput reimplementation.
    const isoSlice = /\.toISOString\(\)\.slice\(\s*0\s*,\s*10\s*\)/.test(lineText);

    if (templateT0000 || chainedGetTime || bareGetTime || isoSlice) {
      violations.push({ file, line: lineNo, text: lineText.trim() });
    }
  });
  return violations;
}

describe('date-input/epoch conversion has one home (DEC-524)', () => {
  it('finds no reimplementation of dates.ts patterns outside lib/dates.ts', () => {
    const files = walkSourceFiles(APP_SRC).filter((f) => f !== DATES_FILE && !/\.test\./.test(f));
    expect(files.length).toBeGreaterThan(0);

    const violations: Violation[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf-8');
      violations.push(...scanForViolations(file, source));
    }

    const report = violations
      .map((v) => `${relative(APP_SRC, v.file)}:${v.line}: ${v.text}`)
      .join('\n');
    expect(violations, `date-input/epoch reimplementation found outside lib/dates.ts:\n${report}`).toEqual([]);
  });

  it('sanity: the scanner itself detects the pre-fix patterns', () => {
    const violations = scanForViolations('fake.tsx', [
      'const x = new Date(`${value}T00:00:00.000Z`).getTime();',
      'const y = new Date(ms).toISOString().slice(0, 10);',
      'const z = dueDate.length > 0 ? new Date(dueDate).getTime() : undefined;',
    ].join('\n'));
    expect(violations.length).toBeGreaterThan(0);
  });
});
