// DEC-664 (wave 59 amendment): ONE send-failure reporter, and it names the
// reason. Every send route computes a per-recipient `{ email, message }`
// failure entry (never just an address) -- this scan enumerates every
// non-test module under app/src that works with a SendResult-shaped
// `failed` array (an `{ email: string; message: string }[]`) and requires
// it to render/derive through the shared reporter -- either the
// components/SendFailures.tsx list-of-rows component or the
// lib/sendResult.ts `failureLines` toast helper -- rather than hand-
// rolling a bare `f.email` list that discards the server's reason.
// Mirrors byte-size-vocabulary.scan.test.ts's readdirSync-driven
// population + allowlist shape.
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

// Matches the SendResult failure shape itself -- either the inline type
// `{ email: string; message: string }[]` (still hand-copied in a couple of
// call sites rather than importing SendResult) or a reference to the
// SendResult type name. A file that declares or types against this shape
// works with a per-recipient failure list.
const FAILED_SHAPE_RE = /email:\s*string;\s*message:\s*string\s*\}\s*\[\s*\]/;
const SEND_RESULT_REF_RE = /\bSendResult\b/;

// A module is only required to route through the shared reporter if it
// actually reaches into the failed array itself -- a bare `.failed`
// property access (`res.failed`, `summary.failed`, `sendResult?.failed`).
// Combined with the shape/type check above, this excludes lookalikes such
// as RecentSends.tsx's `statusCounts.failed` (a plain count, no
// SendResult type or {email,message} shape in that file) while still
// catching every site that touches the real failure array -- whether it
// renders it inline (a regression this scan exists to catch) or hands it
// to the shared component/helper (the compliant state).
const FAILED_ACCESS_RE = /\.failed\b/;

// The two blessed ways to consume a failed list: importing the shared
// list component, or the shared toast-line helper. Declaring either
// import satisfies the scan regardless of how it's used downstream.
const SHARED_REPORTER_IMPORT_RE =
  /import\s*\{[^}]*\b(?:SendFailures|failureLines)\b[^}]*\}\s*from\s*['"][^'"]*(?:SendFailures|sendResult)['"]/;

// Files allowed to declare/render the failed shape without importing the
// shared reporter, each with a reason that does not expire:
//  - lib/sendResult.ts: the reporter's own module (SendResult type +
//    describeSendResult + failureLines all live here; it cannot import
//    itself).
//  - components/SendFailures.tsx: the shared list component's own
//    implementation; it IS the reporter, not a consumer of it.
const ALLOWLIST = new Set(
  [join(HERE, 'lib', 'sendResult.ts'), join(HERE, 'components', 'SendFailures.tsx')].map((p) => relative(HERE, p)),
);

describe('the ONE send-failure reporter names the reason (DEC-664 wave-59 amendment)', () => {
  const SOURCE_FILES = allSourceFiles(HERE);

  it('scanned more than one source file', () => {
    expect(SOURCE_FILES.length).toBeGreaterThan(5);
  });

  it('the shared reporter and component both exist and are scanned', () => {
    const rel = SOURCE_FILES.map((p) => relative(HERE, p));
    expect(rel).toContain(join('lib', 'sendResult.ts'));
    expect(rel).toContain(join('components', 'SendFailures.tsx'));
  });

  it('every module that renders/derives a SendResult failed list imports the shared reporter', () => {
    const offenders: string[] = [];
    for (const path of SOURCE_FILES) {
      const rel = relative(HERE, path);
      if (ALLOWLIST.has(rel)) continue;
      const src = readFileSync(path, 'utf-8');
      const inPopulation = (FAILED_SHAPE_RE.test(src) || SEND_RESULT_REF_RE.test(src)) && FAILED_ACCESS_RE.test(src);
      if (!inPopulation) continue;
      if (!SHARED_REPORTER_IMPORT_RE.test(src)) {
        offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });

  // Vacuous-scan tripwire: the population must actually be non-empty on
  // this tree, or the scan above is proving nothing.
  it('the population is non-empty (vacuous-scan tripwire)', () => {
    const population = SOURCE_FILES.filter((path) => {
      const rel = relative(HERE, path);
      if (ALLOWLIST.has(rel)) return false;
      const src = readFileSync(path, 'utf-8');
      return (FAILED_SHAPE_RE.test(src) || SEND_RESULT_REF_RE.test(src)) && FAILED_ACCESS_RE.test(src);
    });
    expect(population.length).toBeGreaterThan(0);
  });

  // Negative controls (both directions): a synthetic module that renders a
  // bare `f.email` list with no `.message` and no shared import IS caught;
  // a compliant module that imports the shared helper is NOT.
  it('negative control: a bare address-only render is caught, a compliant module is not', () => {
    const offender = `
      import type { SendResult } from '../../lib/sendResult';
      function render(result: SendResult) {
        return result.failed?.map((f) => f.email).join(', ');
      }
    `;
    const compliant = `
      import { SendFailures } from '../../components/SendFailures';
      import type { SendResult } from '../../lib/sendResult';
      function render(result: SendResult) {
        return <SendFailures failed={result.failed ?? []} />;
      }
    `;
    const compliantHelper = `
      import { failureLines } from '../../lib/sendResult';
      import type { SendResult } from '../../lib/sendResult';
      function render(result: SendResult) {
        console.log(result.failed?.length);
        return failureLines(result);
      }
    `;

    const inPopulation = (src: string) =>
      (FAILED_SHAPE_RE.test(src) || SEND_RESULT_REF_RE.test(src)) && FAILED_ACCESS_RE.test(src);

    expect(inPopulation(offender)).toBe(true);
    expect(SHARED_REPORTER_IMPORT_RE.test(offender)).toBe(false);

    expect(inPopulation(compliant)).toBe(true);
    expect(SHARED_REPORTER_IMPORT_RE.test(compliant)).toBe(true);

    expect(inPopulation(compliantHelper)).toBe(true);
    expect(SHARED_REPORTER_IMPORT_RE.test(compliantHelper)).toBe(true);
  });
});
