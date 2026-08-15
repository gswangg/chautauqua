// SPA mirror of test/batch-cap-declaration.scan.test.ts (DEC-422, amendment
// wave 2): a batch/collection cap a control collects toward or discloses
// ("N of MAX") must be declared exactly once, in pure core
// (src/domain/**), and reach the SPA ONLY through a re-export module under
// app/src/lib/ (batch-caps.ts, file-caps.ts, text-caps.ts, ...) -- never as
// a `const MAX_WHATEVER = <number>` literal hand-typed inside a page or
// component. This scan enumerates every non-test .ts/.tsx file under
// app/src and fails if any of them declares its own `const
// MAX_[A-Z0-9_]* = <number>` literal, the same offense the w2-a finding
// (PlanEditor.tsx's local `MAX_CRITERIA = 7`) demonstrated: a cap that
// exists only in the browser is a suggestion, not an enforced cap.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_SRC_ROOT = join(HERE); // this file lives at app/src/

/** Every .ts/.tsx file under `root`, excluding test files. */
function allSourceFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    if (!/\.tsx?$/.test(entry.name)) continue;
    if (entry.name.includes('.test.')) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

// Same generic fingerprint as the server-side scan: `const MAX_WHATEVER =
// 20` or `export const MAX_WHATEVER: number = 100`, with or without a type
// annotation. Never matches `import { MAX_X } from '...'` (no `const NAME
// =` shape) and never matches `export { MAX_X } from '...'` (a re-export,
// the exact shape app/src/lib/batch-caps.ts uses -- no `=` at all).
const LOCAL_BATCH_CAP_DECL_RE = /const\s+(MAX_[A-Z0-9_]*)\s*(?::\s*\w+)?\s*=\s*[0-9]/g;

// A name ending in _LENGTH/_MAX_LEN is a text-length bound, not a
// batch/collection count -- same partition as the server-side scan's
// isTextLengthName, kept for symmetry even though app/src's local
// `_LENGTH` constants (if any) are a separate class this file doesn't own.
function isTextLengthName(name: string): boolean {
  return /_LENGTH$|_MAX_LEN$/.test(name);
}

function findLocalBatchCapDeclarations(src: string): string[] {
  return [...src.matchAll(LOCAL_BATCH_CAP_DECL_RE)]
    .filter((m) => !isTextLengthName(m[1] as string))
    .map((m) => m[0]);
}

describe('no app/src/**/*.{ts,tsx} module hand-declares a batch/count cap literal (DEC-422, amendment wave 2)', () => {
  const APP_FILES = allSourceFiles(APP_SRC_ROOT);

  it('scanned more than one app/src file, of both .ts and .tsx', () => {
    expect(APP_FILES.length).toBeGreaterThan(10);
    expect(APP_FILES.some((p) => p.endsWith('.ts'))).toBe(true);
    expect(APP_FILES.some((p) => p.endsWith('.tsx'))).toBe(true);
  });

  it('no app/src file declares its own batch cap literal', () => {
    const offenders: string[] = [];
    for (const path of APP_FILES) {
      const src = readFileSync(path, 'utf-8');
      const found = findLocalBatchCapDeclarations(src);
      if (found.length > 0) offenders.push(`${relative(HERE, path)}: ${found.join(', ')}`);
    }
    expect(
      offenders,
      `app/src files hand-declaring a batch cap literal (a SPA cap must reach the app only through app/src/lib/):\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  // Vacuous-scan tripwire: if allSourceFiles silently returned nothing (a
  // broken glob/path after a directory rename), the "no offenders" result
  // above would be trivially true.
  it('vacuous-scan tripwire: the app/src scan walked a non-empty file set', () => {
    expect(APP_FILES.length).toBeGreaterThan(50);
  });

  // Negative control, both ways: a synthetic app-local declaration IS
  // detected, so a rewrite of the regex can't silently stop flagging the
  // real shape; a synthetic import of the same name is NOT flagged, so the
  // detector doesn't confuse "imported" with "declared".
  it('the detector flags a synthetic app-local declaration but not an import of the same name', () => {
    const violating = `const MAX_WIDGETS = 5;\nfunction f() { return MAX_WIDGETS; }`;
    expect(findLocalBatchCapDeclarations(violating)).toEqual(['const MAX_WIDGETS = 5']);

    const clean = `import { MAX_WIDGETS } from '../../lib/batch-caps';\nfunction f() { return MAX_WIDGETS; }`;
    expect(findLocalBatchCapDeclarations(clean)).toEqual([]);
  });

  // Negative control: a re-export (the exact shape app/src/lib/batch-caps.ts
  // uses to cross the app/ -> src/ boundary) is NOT flagged -- it carries no
  // `= <number>` at all.
  it('the detector does not flag a re-export of the same name', () => {
    const reexport = `export { MAX_WIDGETS } from '../../../src/domain/widgets';`;
    expect(findLocalBatchCapDeclarations(reexport)).toEqual([]);
  });

  // Positive control: this repo's own known offense (before the fix) would
  // have looked exactly like this -- confirms the detector isn't matching
  // nothing on real code shape.
  it('positive control: the detector recognizes the exact shape of the fixed PlanEditor.tsx offense', () => {
    const fixed = `const MAX_CRITERIA = 7;`;
    expect(findLocalBatchCapDeclarations(fixed)).toEqual(['const MAX_CRITERIA = 7']);
  });
});
