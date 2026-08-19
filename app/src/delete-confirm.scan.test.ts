// DEC-941: every irreversible SPA delete goes through the shared
// ConfirmDialog (components/ConfirmDialog.tsx) rather than firing on click.
// This scans every non-test source file under app/src for a CALL to
// `apiDelete(` -- matched by a word-boundary regex (`\bapiDelete\b\s*(?:<[^>]*>)?\s*\(`)
// so a generic call (`apiDelete<{ deleted: number }>(`), a spaced generic
// (`apiDelete <T>(`), and a bare no-generic call all count, while a mere
// mention of the identifier with no call parens (e.g. an import line's
// `apiDelete,`) does not -- and requires the module to import ConfirmDialog
// too. An unguarded call site outside the hard-coded allow-list fails this
// scan. The only modules allowed to call apiDelete without ConfirmDialog are
// the two restore-not-destroy recusal "undo" flows, hard-coded here by name
// so the exemption can't silently grow.
//
// DEC-518/wave-91: a custodian decomposition can split one module (owning
// both the apiDelete call AND the pendingX/<ConfirmDialog> render) into a
// hook (state + apiDelete) and a sibling view (JSX + <ConfirmDialog>). Both
// this scan and the pendingX-arming scan below resolve the guard/arming
// check across that PAIR -- a module connected via a relative import edge
// to a file in this population -- rather than per-file, so the split
// doesn't strand either half as a false offender. This is NOT an allow-list:
// the pairing is derived from the same import graph every module is walked
// through, so a genuinely unguarded module (whose paired files also lack
// the guard) is still reported -- exercised below by a synthetic negative
// control.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_SRC = HERE; // app/src

// Matches `apiDelete(`, `apiDelete<T>(`, `apiDelete <T>(` -- any call site,
// with or without a generic type argument list, with or without whitespace
// before the opening paren. Does NOT match a bare identifier mention with
// no call parens (e.g. an import line's `apiDelete,`).
const API_DELETE_CALL = /\bapiDelete\b\s*(?:<[^>]*>)?\s*\(/;

// ReviewerQueue.tsx / Scorecard.tsx call apiDelete only to UNDO a recusal
// (restore, not destroy), so they're the sole confirmed exemptions. Every
// other apiDelete( call site imports ConfirmDialog (DEC-941 wave 56), either
// directly or through its paired module (wave 91).
const ALLOWED_UNGUARDED = new Set(['pages/review/ReviewerQueue.tsx', 'pages/review/Scorecard.tsx']);

function walkSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...walkSourceFiles(full));
    } else if ((name.endsWith('.ts') || name.endsWith('.tsx')) && !name.includes('.test.')) {
      out.push(full);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Import-pair graph (wave 91): a module can be paired with a custodian
// sibling that was split out of the same file. Pairing follows RELATIVE
// import specifiers only (`from './x'`, `from '../y'`) -- resolved against
// the walked file set -- and is symmetric: if A imports B, A and B are each
// other's pair partners, regardless of which one owns which half of the
// original module's responsibilities.
// ---------------------------------------------------------------------------
const IMPORT_SPEC = /from\s+['"](\.[^'"]+)['"]/g;

function resolveImportSpec(fromFile: string, spec: string, fileSet: Set<string>): string | null {
  const base = resolve(dirname(fromFile), spec);
  for (const suffix of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
    const candidate = base + suffix;
    if (fileSet.has(candidate)) return candidate;
  }
  return null;
}

function buildImportPairs(files: string[]): Map<string, Set<string>> {
  const fileSet = new Set(files);
  const pairs = new Map<string, Set<string>>();
  const addPair = (a: string, b: string) => {
    if (!pairs.has(a)) pairs.set(a, new Set());
    pairs.get(a)!.add(b);
  };
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    IMPORT_SPEC.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = IMPORT_SPEC.exec(source))) {
      const resolved = resolveImportSpec(file, m[1] as string, fileSet);
      if (!resolved || resolved === file) continue;
      addPair(file, resolved);
      addPair(resolved, file);
    }
  }
  return pairs;
}

function importsConfirmDialog(source: string): boolean {
  return (
    source.includes("from '../../components/ConfirmDialog'") || source.includes("from '../components/ConfirmDialog'")
  );
}

// Pure, fixture-testable: is `source` guarded, either directly or because
// one of `pairedSources` (the sibling modules it's connected to via the
// import graph) imports ConfirmDialog?
function isApiDeleteGuarded(source: string, pairedSources: string[]): boolean {
  if (importsConfirmDialog(source)) return true;
  return pairedSources.some((s) => importsConfirmDialog(s));
}

describe('DEC-941: every apiDelete(...) call site imports ConfirmDialog (or is an allow-listed exemption)', () => {
  const files = walkSourceFiles(APP_SRC);
  const pairs = buildImportPairs(files);

  it('no unguarded apiDelete(...) call site exists outside the hard-coded allow-list', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const relPath = relative(APP_SRC, file);
      // lib/api.ts is apiDelete's own DEFINITION ('export function
      // apiDelete<T>(path...') -- the regex's generic-aware match also
      // matches a declaration's parameter list, but a declaration is not a
      // call site and has nothing to confirm.
      if (relPath === 'lib/api.ts') continue;
      const source = readFileSync(file, 'utf8');
      if (!API_DELETE_CALL.test(source)) continue;
      const pairedSources = [...(pairs.get(file) ?? [])].map((f) => readFileSync(f, 'utf8'));
      if (isApiDeleteGuarded(source, pairedSources)) continue;
      if (ALLOWED_UNGUARDED.has(relPath)) continue;
      offenders.push(relPath);
    }
    expect(offenders).toEqual([]);
  });

  it('the allow-list only names the confirmed restore-not-destroy exemptions', () => {
    expect([...ALLOWED_UNGUARDED].sort()).toEqual(
      ['pages/review/ReviewerQueue.tsx', 'pages/review/Scorecard.tsx'].sort(),
    );
  });

  // Negative control: proves the regex catches all three spellings named in
  // DEC-941 and does NOT count a bare identifier mention (e.g. an import
  // line) as a call site.
  it('the matcher catches every apiDelete( spelling but not a bare import mention', () => {
    expect(API_DELETE_CALL.test('await apiDelete(`/tracks/${id}`);')).toBe(true);
    expect(API_DELETE_CALL.test('await apiDelete<{ deleted: number }>(`/rooms/${id}`);')).toBe(true);
    expect(API_DELETE_CALL.test('await apiDelete <T>(`/breaks/${id}`);')).toBe(true);
    // An import line mentions the identifier with no call parens -- not a
    // call site.
    expect(API_DELETE_CALL.test("import { apiDelete, apiPost } from '../../lib/api';")).toBe(false);
  });

  // Negative control (wave 91): a synthetic hook module that calls
  // apiDelete unguarded, whose only paired sibling ALSO does not import
  // ConfirmDialog, must still be reported -- pairing resolves a genuine
  // split, it doesn't become a blanket exemption.
  it('a synthetic hook whose importer has no ConfirmDialog is still reported (negative control)', () => {
    const hookSource = "export function useThing() { await apiDelete(`/things/${id}`); }";
    const viewWithoutConfirmDialog = "import { useThing } from './useThing'; export function View() { return null; }";
    expect(isApiDeleteGuarded(hookSource, [viewWithoutConfirmDialog])).toBe(false);
  });

  // Positive control (wave 91): the same shape, but the paired sibling DOES
  // import ConfirmDialog -- proves the pairing isn't just failing everything.
  it('a synthetic hook whose paired view imports ConfirmDialog is guarded (positive control)', () => {
    const hookSource = "export function useThing() { await apiDelete(`/things/${id}`); }";
    const viewWithConfirmDialog =
      "import { ConfirmDialog } from '../../components/ConfirmDialog';\nimport { useThing } from './useThing';";
    expect(isApiDeleteGuarded(hookSource, [viewWithConfirmDialog])).toBe(true);
  });
});

// DEC-941 (wave 60 amendment): a scan asserting a delete is GUARDED by
// ConfirmDialog says nothing about whether the guard can ever OPEN.
// `ViewTabs.tsx` had `pendingDelete && <ConfirmDialog ... />` with
// `setPendingDelete` called at exactly two sites, both passing `null` --
// the dialog above passed every prior scan while being permanently dead.
// This DEAD-CONFIRM check finds every `pendingX &&`/`pendingX ?` gate
// directly in front of a `<ConfirmDialog` render and requires the SAME
// file (or, wave 91, a module PAIRED with it via the relative import
// graph -- see above) to also call `setPendingX(` with an argument that is
// not the literal `null` -- i.e. somewhere the state actually gets ARMED,
// not just disarmed.
const GATE_AND = /\b(pending\w*)\s*&&\s*\(?\s*<ConfirmDialog/g;
const GATE_TERNARY = /\b(pending\w*)\s*\?\s*\(?\s*<ConfirmDialog/g;

function findConfirmDialogGateNames(source: string): string[] {
  const names = new Set<string>();
  for (const re of [GATE_AND, GATE_TERNARY]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(source))) {
      names.add(m[1] as string);
    }
  }
  return [...names];
}

function hasNonNullArmingCall(source: string, pendingName: string): boolean {
  const setterName = `set${(pendingName[0] as string).toUpperCase()}${pendingName.slice(1)}`;
  const callRe = new RegExp(`\\b${setterName}\\(\\s*([^)]*)\\)`, 'g');
  let m: RegExpExecArray | null;
  while ((m = callRe.exec(source))) {
    if ((m[1] as string).trim() !== 'null') return true;
  }
  return false;
}

// Pure, fixture-testable: is the gate `pendingName` armed, either directly
// in `source` or because one of `pairedSources` calls the setter non-null?
function isGateArmed(source: string, pendingName: string, pairedSources: string[]): boolean {
  if (hasNonNullArmingCall(source, pendingName)) return true;
  return pairedSources.some((s) => hasNonNullArmingCall(s, pendingName));
}

describe('DEC-941 (wave 60): every pendingX-gated <ConfirmDialog can actually be armed', () => {
  const files = walkSourceFiles(APP_SRC);
  const pairs = buildImportPairs(files);

  it('every file with a `pendingX && <ConfirmDialog` / `pendingX ? <ConfirmDialog` gate also calls setPendingX(...) with a non-null argument, directly or via a paired module', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const relPath = relative(APP_SRC, file);
      const source = readFileSync(file, 'utf8');
      if (!source.includes('<ConfirmDialog')) continue;
      const pairedSources = [...(pairs.get(file) ?? [])].map((f) => readFileSync(f, 'utf8'));
      for (const name of findConfirmDialogGateNames(source)) {
        if (!isGateArmed(source, name, pairedSources)) {
          offenders.push(`${relPath}:${name}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  // Negative control: a gate whose setter is ONLY ever called with `null`
  // (the exact shape the pre-fix ViewTabs.tsx had) must be flagged.
  it('flags a pendingX gate whose setter is only ever called with null (negative control)', () => {
    const fixture = `
      const [pendingDelete, setPendingDelete] = useState(null);
      function dismiss() { setPendingDelete(null); }
      return (
        <div>
          {pendingDelete && (
            <ConfirmDialog onConfirm={confirmDelete} onCancel={() => setPendingDelete(null)} />
          )}
        </div>
      );
    `;
    const gates = findConfirmDialogGateNames(fixture);
    expect(gates).toEqual(['pendingDelete']);
    expect(hasNonNullArmingCall(fixture, 'pendingDelete')).toBe(false);
  });

  // Positive control: a gate armed by a real setter call (the fixed shape)
  // must NOT be flagged -- proves the matcher isn't just failing everything.
  it('does not flag a properly armed pendingX gate (positive control)', () => {
    const fixture = `
      const [pendingDelete, setPendingDelete] = useState(null);
      function openFor(view) { setPendingDelete(view); }
      return (
        <div>
          <button onClick={() => setPendingDelete(view)}>Delete</button>
          {pendingDelete && (
            <ConfirmDialog onConfirm={confirmDelete} onCancel={() => setPendingDelete(null)} />
          )}
        </div>
      );
    `;
    const gates = findConfirmDialogGateNames(fixture);
    expect(gates).toEqual(['pendingDelete']);
    expect(hasNonNullArmingCall(fixture, 'pendingDelete')).toBe(true);
  });

  // Negative control (wave 91): a synthetic view file with a gate whose
  // ONLY paired sibling also never arms non-null must still be reported --
  // pairing resolves a genuine hook/view split, it doesn't exempt a truly
  // dead gate.
  it('a synthetic view whose paired hook never arms non-null is still reported (negative control)', () => {
    const viewSource = `
      {pendingDelete && (
        <ConfirmDialog onConfirm={confirmDelete} onCancel={() => setPendingDelete(null)} />
      )}
    `;
    const hookOnlyNull = 'function dismiss() { setPendingDelete(null); }';
    expect(isGateArmed(viewSource, 'pendingDelete', [hookOnlyNull])).toBe(false);
  });

  // Positive control (wave 91): the same shape, but the paired hook DOES
  // arm the setter non-null -- proves the split is legible to the scan.
  it('a synthetic view whose paired hook arms non-null is armed (positive control)', () => {
    const viewSource = `
      {pendingDelete && (
        <ConfirmDialog onConfirm={confirmDelete} onCancel={() => setPendingDelete(null)} />
      )}
    `;
    const hookArms = 'function deleteThing(thing) { setPendingDelete({ kind: "thing", thing }); }';
    expect(isGateArmed(viewSource, 'pendingDelete', [hookArms])).toBe(true);
  });
});
