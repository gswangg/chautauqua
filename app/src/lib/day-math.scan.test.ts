// DEC-831 amendment (wave 54): day-in-milliseconds arithmetic has one home.
// app/src/lib/dates.ts owns daysUntil, daysAgo, and epochDayIndex -- the
// three readers of "how far apart are these two instants, in days". Four
// independently hand-rolled copies of the same divisor (Math.floor,
// Math.round x2, Math.ceil) answered "days ago" differently for the same
// instant (the w54 mandate's "19 days vs 17 days for the same deadline;
// actual 18"). This is a re-runnable source-scan test (DEC-808 idiom:
// enumerate via readdirSync with { recursive: true }, never a hand-listed
// manifest) that walks every app/src/**/*.{ts,tsx} file, excludes
// app/src/lib/dates.ts itself and any *.test.* file, and fails NAMING the
// offending file+line if it finds a literal day-in-milliseconds divisor:
// 86_400_000, 86400000, `24 * 60 * 60 * 1000`, or `1000 * 60 * 60 * 24`.
//
// Deliberately NOT exempted by file/path -- there is no exemption ledger
// here. A per-file allow-list would just be permission for the fifth copy
// of the same disagreeing formula; every call site outside dates.ts must
// either import daysAgo/daysUntil/epochDayIndex or use a genuinely
// different constant.
//
// The one thing this scan does NOT flag: a day-in-ms literal SCALED by
// another factor (e.g. `7 * 24 * 60 * 60 * 1000`, Comms.tsx/RecentSends.tsx's
// SEVEN_DAYS_MS lookback window). That expression's value is seven days,
// not one -- it is not the "days ago"/"days until" divisor this scan
// guards, and daysAgo/daysUntil/epochDayIndex have no way to express it.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_SRC = join(HERE, '..'); // app/src
const DATES_FILE = join(HERE, 'dates.ts'); // app/src/lib/dates.ts

/** Every *.ts/*.tsx file under app/src, enumerated rather than named (DEC-808). */
function allSourceFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !/\.(ts|tsx)$/.test(entry.name)) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

/** Strips // line comments and /* *\/ block comments so a decision note
 * quoting a banned literal is never mistaken for a real use. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

export interface Violation {
  file: string;
  line: number;
  text: string;
}

const NUMERIC_PATTERNS = [/86_400_000/g, /(?<!\d)86400000(?!\d)/g];
const EXPR_PATTERNS = [
  /24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/g,
  /1000\s*\*\s*60\s*\*\s*60\s*\*\s*24/g,
];

/** Scans a single file's (comment-stripped) source for a literal
 * day-in-milliseconds divisor. */
export function scanForViolations(file: string, source: string): Violation[] {
  const violations: Violation[] = [];
  const lines = stripComments(source).split('\n');
  lines.forEach((lineText, idx) => {
    const lineNo = idx + 1;
    for (const pattern of [...NUMERIC_PATTERNS, ...EXPR_PATTERNS]) {
      pattern.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(lineText)) !== null) {
        const before = lineText.slice(0, m.index);
        // Skip a match that is itself scaled by a preceding factor, e.g.
        // the `7 *` in `7 * 24 * 60 * 60 * 1000` -- that's a week
        // constant, not the one-day divisor this scan bans.
        if (/\*\s*$/.test(before)) continue;
        violations.push({ file, line: lineNo, text: lineText.trim() });
        break;
      }
    }
  });
  return violations;
}

describe('day-in-milliseconds arithmetic has one home (DEC-831)', () => {
  it('finds no literal day-ms divisor outside lib/dates.ts', () => {
    const files = allSourceFiles(APP_SRC).filter((f) => f !== DATES_FILE && !/\.test\./.test(f));
    expect(files.length).toBeGreaterThan(5);

    const violations: Violation[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf-8');
      violations.push(...scanForViolations(file, source));
    }

    const report = violations
      .map((v) => `${relative(APP_SRC, v.file)}:${v.line}: ${v.text}`)
      .join('\n');
    expect(violations, `literal day-ms divisor found outside lib/dates.ts:\n${report}`).toEqual([]);
  });

  it('sanity: the scanner detects the pre-fix patterns', () => {
    const violations = scanForViolations('fake.ts', [
      'const a = Math.floor((now - ms) / 86_400_000);',
      'const b = Math.round((now - ms) / 86400000);',
      'const c = Math.floor(diff / (24 * 60 * 60 * 1000));',
      'const d = diff / (1000 * 60 * 60 * 24);',
    ].join('\n'));
    expect(violations.length).toBe(4);
  });

  it('sanity: the scanner allows a scaled (non-one-day) constant', () => {
    const violations = scanForViolations('fake.ts', [
      'const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;',
      '// a comment quoting 86400000 must not trip the scan',
    ].join('\n'));
    expect(violations).toEqual([]);
  });
});
