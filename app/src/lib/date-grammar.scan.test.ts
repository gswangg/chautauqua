// Calendar-date grammar ban (DEC-963). app/src/lib/dates.ts is the ONE home
// for date formatting in the SPA (formatDate/formatDateOnly/formatDateTime/
// formatDateTimeInZone/formatDayLabel/formatRelative*). This is a re-
// runnable source-scan test (DEC-808 idiom: enumerate via readdirSync with
// { recursive: true }, never a hand-listed manifest) that walks every
// app/src/**/*.{ts,tsx} file, excludes app/src/lib/dates.ts itself and any
// *.test.* file, and fails NAMING the offending file+line if it finds:
//   - `toLocaleDateString(`, `toLocaleTimeString(`, or `toLocaleString(` --
//     these re-interpret a UTC-midnight calendar-date instant in the
//     viewer's local timezone (off-by-one bug) and/or produce a
//     locale-dependent grammar.
//   - an `Intl.DateTimeFormat(...)` call whose option bag carries
//     `dateStyle` or `timeStyle` -- these delegate the whole format grammar
//     to the locale, which is exactly what dates.ts no longer does.
//   - an `Intl.DateTimeFormat(undefined, ...)` call whose option bag
//     carries `day`, `month`, or `year` -- an implicit-locale DATE format,
//     the historical formatDateOnly bug this scan guards against.
//
// Deliberately still ALLOWED (not banned by this scan):
//   - a fixed-locale call, e.g. eventSwitcherState.ts's 'en-US' timezone-
//     validity probe, or SubmissionDetailPage.tsx's explicit 'en-US'
//     formatter -- these pin a locale so the output cannot vary with the
//     reader's ambient locale.
//   - a timeZoneName-only Intl.DateTimeFormat lookup (comms/icsChip.ts) --
//     it reads a zone's abbreviation, not a calendar-date grammar.
// The ban is on implicit-locale DATE formatting, not on Intl itself.
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
 * quoting a banned call is never mistaken for a real call. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

export interface Violation {
  file: string;
  line: number;
  text: string;
}

/** Scans a single file's (comment-stripped) source for banned calendar-date grammar. */
export function scanForViolations(file: string, source: string): Violation[] {
  const violations: Violation[] = [];
  const lines = stripComments(source).split('\n');
  lines.forEach((lineText, idx) => {
    const lineNo = idx + 1;
    const bannedMethod = /\.(toLocaleDateString|toLocaleTimeString|toLocaleString)\(/.test(lineText);

    let bannedIntl = false;
    const intlCallRe = /Intl\.DateTimeFormat\(([^)]*)\)/g;
    let m: RegExpExecArray | null;
    while ((m = intlCallRe.exec(lineText)) !== null) {
      const args = m[1] ?? '';
      const hasDateOrTimeStyle = /\b(dateStyle|timeStyle)\b/.test(args);
      const isUndefinedLocale = /^\s*undefined\s*,/.test(args);
      const hasDayMonthYear = /\b(day|month|year)\b\s*:/.test(args);
      if (hasDateOrTimeStyle || (isUndefinedLocale && hasDayMonthYear)) {
        bannedIntl = true;
      }
    }

    if (bannedMethod || bannedIntl) {
      violations.push({ file, line: lineNo, text: lineText.trim() });
    }
  });
  return violations;
}

describe('calendar-date grammar has one home (DEC-963)', () => {
  it('finds no banned toLocale*/implicit-locale Intl.DateTimeFormat calls outside lib/dates.ts', () => {
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
    expect(violations, `banned date-format call found outside lib/dates.ts:\n${report}`).toEqual([]);
  });

  it('sanity: the scanner detects the pre-fix patterns', () => {
    const violations = scanForViolations('fake.tsx', [
      'const a = date.toLocaleDateString();',
      'const b = date.toLocaleTimeString();',
      'const c = date.toLocaleString(undefined, { dateStyle: "medium" });',
      'const d = new Intl.DateTimeFormat(undefined, { timeZone: "UTC", year: "numeric", month: "numeric", day: "numeric" }).format(date);',
      'const e = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);',
    ].join('\n'));
    expect(violations.length).toBe(5);
  });

  it('sanity: the scanner allows the deliberately-permitted patterns', () => {
    const violations = scanForViolations('fake.ts', [
      "// example quoting toLocaleDateString( in a comment must not trip the scan",
      "const zone = new Intl.DateTimeFormat('en-US', { timeZone, hour12: false }).resolvedOptions().timeZone;",
      "const label = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short', timeZone }).formatToParts(date);",
    ].join('\n'));
    expect(violations).toEqual([]);
  });
});
