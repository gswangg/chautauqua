// Campaign ratchet two-sidedness enforcer (DEC-808 wave-85 amendment; task
// w7-dc). The amendment rules that every campaign ratchet is TWO-SIDED --
// alongside the usual "no more than CEILING" `it` (may only be LOWERED),
// there must be a companion `it` that FAILS when the measured count falls
// BELOW the constant, forcing the constant down in the SAME batch that
// landed the fix, rather than letting it sit stale for twenty waves
// (field guide: "a ceiling above the truth doesn't ratchet, it licenses").
// Nothing enforced this before this file: at least two campaign ratchets
// were one-sided (FRAME_RECEIPT_OFFENDER_CEILING in
// app/src/tautological-assertion.scan.test.ts, CSS_COMMENT_COPY_LEAK_CEILING
// in test/css-comment-copy-leak.scan.test.ts) -- both closed by this same
// task, companion `it`s appended at the end of their owning describe block.
//
// POPULATION (derived, never hand-listed): the union of
// CAMPAIGN_CONSTANT_NAMES, TIER2_CEILING_NAMES and OUT_OF_CAMPAIGN_SCOPE's
// keys, imported from scripts/exit-predicate.ts -- that module is pure (its
// fs/process I/O lives only behind the CLI entry point), so importing it
// from a test is safe, and test/exit-predicate-campaign.test.ts already does
// exactly this. For each name, this file walks test/** and app/src/**
// (readdirSync recursive, no manifest) to find the file(s) declaring
// `[export ]const <NAME> = <int>;` at top level (matching
// scripts/exit-predicate.ts's own CONST_DECL_RE shape -- most declarations
// live in *.test.ts(x), but STARVED_FLEX_TRACK_CEILING is the counter-
// example: declared in app/src/phone-overflow-scan/starved-track-ceiling.ts,
// a plain .ts module, and read/companioned only from the *.test.ts file that
// imports it -- app/src/phone-horizontal-overflow.scan.test.ts. Filtering
// the walk to *.test.ts(x) would silently drop that constant's declaration
// and misreport it as undeclared).
//
// PREDICATE: for each constant, gather every `it(...)` block, in ANY file
// under the same two roots, whose body references the constant by name
// (word-boundary), and classify each such block's assertion direction:
//   - ABOVE  (`expect(measured).toBeLessThan[OrEqual](NAME)`): the usual
//     "no more than NAME" ceiling check.
//   - BELOW  (`expect(measured).toBeGreaterThan[OrEqual](NAME)`, or a thrown
//     Error whose message contains the literal `NAME = ${...}` replacement
//     line): the "does not fall stale below NAME" companion.
//   - EXACT  (`expect(NAME).toBe/toEqual(measured)` or the reverse
//     operand order): a single pinned-equality assertion is BOTH directions
//     at once (DIVERGENCE_CEILING's and EXPECTED_TOTAL_PRE_DEVIATION's
//     shape) and alone satisfies two-sidedness.
// A constant is two-sided iff some `it` anywhere in its reading files
// supplies EXACT, or some `it` supplies ABOVE and some `it` (same file or
// not) supplies BELOW. Offenders are reported as
// `<name> declared at <file> -- read at <file(s)>, no BELOW-direction
// companion`.
//
// NON-VACUITY (DEC-967: never validate a detector by reading the same array
// it grades as its own evidence): the section below writes two FABRICATED
// fixture files to a real tmpdir -- one carrying a one-sided ratchet (must
// be reported by the exact same classifier function this scan's population
// walk uses) and one carrying a two-sided pair (must not be) -- and asserts
// against those functions directly, never against CAMPAIGN_CONSTANT_NAMES
// or TIER2_CEILING_NAMES themselves.
//
// SEED: this gate ships at OFFENDERS.length === 0 -- both known offenders
// are closed in this same commit. There is no ceiling constant here by
// design (DEC-808's own instrument does not get to carry a debt line).

import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CAMPAIGN_CONSTANT_NAMES,
  OUT_OF_CAMPAIGN_SCOPE,
  TIER2_CEILING_NAMES,
} from '../scripts/exit-predicate';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..');
const TEST_DIR = join(REPO_ROOT, 'test');
const APP_SRC_DIR = join(REPO_ROOT, 'app', 'src');

// ---------------------------------------------------------------------------
// Population: the union of every name the campaign exit predicate depends
// on -- derived from scripts/exit-predicate.ts, never hand-listed here.
// ---------------------------------------------------------------------------

export const POPULATION: readonly string[] = Array.from(
  new Set<string>([
    ...CAMPAIGN_CONSTANT_NAMES,
    ...TIER2_CEILING_NAMES,
    ...Object.keys(OUT_OF_CAMPAIGN_SCOPE),
  ]),
).sort();

// ---------------------------------------------------------------------------
// File walk (readdirSync recursive, DEC-808 idiom -- no manifest).
// ---------------------------------------------------------------------------

interface SourceFile {
  readonly abs: string;
  readonly rel: string;
  readonly content: string;
}

function walkTsFiles(root: string): SourceFile[] {
  const out: SourceFile[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) continue;
    const abs = join(entry.parentPath, entry.name);
    out.push({ abs, rel: relative(REPO_ROOT, abs), content: readFileSync(abs, 'utf8') });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Declaration finder -- same shape as scripts/exit-predicate.ts's
// CONST_DECL_RE (top-level `[export ]const NAME = <int>;`), applied per
// name so the offender report can cite the exact declaring file.
// ---------------------------------------------------------------------------

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findDeclaringFiles(files: readonly SourceFile[], name: string): SourceFile[] {
  const re = new RegExp(`^[ \\t]*(?:export\\s+)?const\\s+${escapeRegExp(name)}\\s*=\\s*-?\\d+\\s*;[ \\t]*$`, 'm');
  return files.filter((f) => re.test(f.content));
}

// ---------------------------------------------------------------------------
// `it(...)` block extractor -- brace-balanced via a string/comment/regex
// mask, same technique app/src/tautological-assertion.scan.test.ts's
// buildFrameMask/matchBrace pair uses (DEC-613: reused shape, not a second
// copy of a vocabulary shared elsewhere -- this file's mask/extractor pair
// is not exported by that file, so there is nothing to import).
// ---------------------------------------------------------------------------

function buildMask(code: string): string {
  const REGEX_PRECEDING = new Set([
    '(', ',', '=', ':', ';', '!', '&', '|', '?', '+', '-', '*', '%', '^', '~', '<', '>', '[', '{', '}',
  ]);
  const KEYWORD_RE = /(return|typeof|instanceof|in|of|new|void|delete|yield|await|case|do|else)$/;
  const out: string[] = new Array(code.length);
  let i = 0;
  while (i < code.length) {
    const ch = code[i]!;
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      const start = i;
      i++;
      while (i < code.length) {
        if (code[i] === '\\') { i += 2; continue; }
        if (code[i] === quote) { i++; break; }
        i++;
      }
      for (let k = start; k < i; k++) out[k] = '#';
      continue;
    }
    if (ch === '/' && code[i + 1] === '/') {
      const start = i;
      while (i < code.length && code[i] !== '\n') i++;
      for (let k = start; k < i; k++) out[k] = '#';
      continue;
    }
    if (ch === '/' && code[i + 1] === '*') {
      const start = i;
      i += 2;
      while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) i++;
      i = Math.min(i + 2, code.length);
      for (let k = start; k < i; k++) out[k] = '#';
      continue;
    }
    if (ch === '/') {
      const trimmed = code.slice(0, i).trimEnd();
      const prevCh: string = trimmed.length ? trimmed[trimmed.length - 1]! : '';
      const looksLikeRegex = prevCh === '' || REGEX_PRECEDING.has(prevCh) || KEYWORD_RE.test(trimmed);
      if (looksLikeRegex) {
        const start = i;
        i++;
        let inClass = false;
        while (i < code.length) {
          const c = code[i];
          if (c === '\\') { i += 2; continue; }
          if (c === '[') { inClass = true; i++; continue; }
          if (c === ']') { inClass = false; i++; continue; }
          if (c === '/' && !inClass) { i++; break; }
          if (c === '\n') break;
          i++;
        }
        while (i < code.length && /[a-z]/i.test(code[i]!)) i++;
        for (let k = start; k < i; k++) out[k] = '#';
        continue;
      }
    }
    out[i] = ch;
    i++;
  }
  return out.join('');
}

function matchBrace(mask: string, openIdx: number): number {
  let depth = 1;
  let i = openIdx + 1;
  while (i < mask.length && depth > 0) {
    if (mask[i] === '{') depth++;
    else if (mask[i] === '}') depth--;
    i++;
  }
  if (depth !== 0) throw new Error(`unbalanced brace starting at index ${openIdx}`);
  return i;
}

/** Every `it(...)`/`test(...)` call's body text (brace-balanced, comments
 * and strings masked out so a brace inside a template literal never
 * mis-terminates the block). */
function extractItBodies(code: string): string[] {
  const mask = buildMask(code);
  const out: string[] = [];
  const re = /\b(it|test)\(\s*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(mask)) !== null) {
    const quoteIdx = m.index + m[0].length;
    const quote = code[quoteIdx];
    if (quote !== '"' && quote !== "'" && quote !== '`') continue;
    let i = quoteIdx + 1;
    while (i < code.length) {
      const ch = code[i];
      if (ch === '\\') { i += 2; continue; }
      if (ch === quote) { i++; break; }
      i++;
    }
    const braceIdx = mask.indexOf('{', i);
    if (braceIdx === -1) continue;
    const bodyEnd = matchBrace(mask, braceIdx);
    out.push(code.slice(braceIdx + 1, bodyEnd - 1));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Direction classifier -- the detector under test, exercised directly by
// both the population walk below AND the non-vacuity fixtures.
// ---------------------------------------------------------------------------

export interface DirectionFlags {
  readonly above: boolean;
  readonly below: boolean;
  readonly exact: boolean;
}

/** Classifies a single `it(...)` body's assertion direction(s) against
 * `name`. A body that never references `name` (word-boundary) contributes
 * nothing (all flags false). */
export function classifyItBody(body: string, name: string): DirectionFlags {
  const n = escapeRegExp(name);
  const references = new RegExp(`\\b${n}\\b`).test(body);
  if (!references) return { above: false, below: false, exact: false };

  const exact =
    new RegExp(`expect\\(\\s*${n}\\s*\\)\\.to(Be|Equal)\\(`).test(body) ||
    new RegExp(`\\.to(Be|Equal)\\(\\s*${n}\\s*\\)`).test(body);

  const above =
    new RegExp(`\\.toBeLessThan(OrEqual)?\\(\\s*${n}\\s*\\)`).test(body) ||
    new RegExp(`expect\\(\\s*${n}\\s*\\)\\.toBeGreaterThan(OrEqual)?\\(`).test(body);

  const belowComparator =
    new RegExp(`\\.toBeGreaterThan(OrEqual)?\\(\\s*${n}\\s*\\)`).test(body) ||
    new RegExp(`expect\\(\\s*${n}\\s*\\)\\.toBeLessThan(OrEqual)?\\(`).test(body);
  // A thrown replacement-line message is the alternate below-direction
  // idiom this codebase uses (control-font.scan.test.ts:258,
  // css-comment-copy-leak.scan.test.ts's new companion, etc.): the `it`
  // throws naming the exact `export const NAME = ${measured};` line to
  // paste in, rather than (or alongside) a `toBeGreaterThanOrEqual` call.
  const belowThrowMessage = new RegExp(
    `(export\\s+)?const\\s+${n}\\s*=\\s*\\$\\{`,
  ).test(body);

  return { above, below: belowComparator || belowThrowMessage, exact };
}

interface NameEvidence {
  readonly name: string;
  readonly declaringFiles: string[];
  readonly readingFiles: string[];
  readonly above: boolean;
  readonly below: boolean;
  readonly exact: boolean;
}

/** Per-file `it(...)` body cache, keyed by file `rel` path -- built ONCE
 * per file regardless of how many constant names are graded against it, so
 * grading the whole population costs one mask-build pass over the corpus
 * instead of one per (name, file) pair. Only files that reference at least
 * one population name are worth masking at all. */
function buildBodyCache(
  files: readonly SourceFile[],
  names: readonly string[],
): Map<string, { rel: string; bodies: string[] }> {
  const anyNameRe = new RegExp(`\\b(${names.map(escapeRegExp).join('|')})\\b`);
  const cache = new Map<string, { rel: string; bodies: string[] }>();
  for (const f of files) {
    if (!anyNameRe.test(f.content)) continue;
    cache.set(f.rel, { rel: f.rel, bodies: extractItBodies(f.content) });
  }
  return cache;
}

function gatherEvidence(
  files: readonly SourceFile[],
  bodyCache: ReadonlyMap<string, { rel: string; bodies: string[] }>,
  name: string,
): NameEvidence {
  const declaringFiles = findDeclaringFiles(files, name).map((f) => f.rel);
  let above = false;
  let below = false;
  let exact = false;
  const readingFiles: string[] = [];
  const nameRe = new RegExp(`\\b${escapeRegExp(name)}\\b`);
  for (const entry of bodyCache.values()) {
    let fileReads = false;
    for (const body of entry.bodies) {
      if (!nameRe.test(body)) continue;
      const flags = classifyItBody(body, name);
      if (flags.above || flags.below || flags.exact) fileReads = true;
      above = above || flags.above;
      below = below || flags.below;
      exact = exact || flags.exact;
    }
    if (fileReads) readingFiles.push(entry.rel);
  }
  return { name, declaringFiles, readingFiles, above, below, exact };
}

interface Offender {
  readonly name: string;
  readonly message: string;
}

function findOffenders(files: readonly SourceFile[], names: readonly string[]): Offender[] {
  const bodyCache = buildBodyCache(files, names);
  const offenders: Offender[] = [];
  for (const name of names) {
    const ev = gatherEvidence(files, bodyCache, name);
    const twoSided = ev.exact || (ev.above && ev.below);
    if (twoSided) continue;
    const declared = ev.declaringFiles.length > 0 ? ev.declaringFiles.join(', ') : '(no top-level declaration found)';
    const read = ev.readingFiles.length > 0 ? ev.readingFiles.join(', ') : '(no reading it()/test() block found)';
    offenders.push({
      name,
      message: `${name} declared at ${declared} -- read at ${read}, no BELOW-direction companion`,
    });
  }
  return offenders;
}

// ---------------------------------------------------------------------------
// Gate.
// ---------------------------------------------------------------------------

describe('every campaign ratchet is two-sided (DEC-808 wave-85 amendment, enforced)', () => {
  let files: SourceFile[];
  let offenders: Offender[];

  // KNOWN-SLOW (DEC-069, Amendment, wave 35, applied wave-37 task w37-h):
  // findOffenders() re-parses every walked test/app/src file's `it(...)`
  // bodies once PER population constant (~30+ constants x ~1400+ files) to
  // classify each block's assertion direction -- measured 19349-21346ms
  // across repeat standalone runs on this host (walkTsFiles itself is
  // ~230-270ms; the classification pass is the cost), and a full
  // `npm run test:fast` run at main `b69e12e73` observed this file taking
  // 35.6s overall with 3 of its 8 tests reported SKIPPED -- the 3 tests
  // that depend on this exact hook's population (this describe block has
  // exactly 3 `it`s), i.e. the pre-existing 30000ms timeout was itself
  // blowing under full-tier contention and vitest was skipping the
  // dependent tests as a consequence, not by deliberate design. An
  // explicit 60000ms floor (~1.7x the worst full-tier-observed run) turns
  // "silently times out and skips its own population's tests under load"
  // into a stated decision instead of a race against a margin that was
  // already too thin.
  beforeAll(() => {
    files = [...walkTsFiles(TEST_DIR), ...walkTsFiles(APP_SRC_DIR)];
    offenders = findOffenders(files, POPULATION);
  }, 60000);

  it('the derived population is non-empty and above a floor (guards against a broken import or a changed constant shape leaving this gate green over an empty set)', () => {
    expect(POPULATION.length).toBeGreaterThan(25);
    expect(CAMPAIGN_CONSTANT_NAMES.length).toBeGreaterThan(0);
    expect(TIER2_CEILING_NAMES.length).toBeGreaterThan(0);
    expect(Object.keys(OUT_OF_CAMPAIGN_SCOPE).length).toBeGreaterThan(0);
  });

  it('the file walk finds a non-trivial number of source files (guards against a bad root leaving zero files scanned)', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('every campaign ratchet constant carries a two-sided companion (may only shrink toward zero as offenders are closed)', () => {
    if (offenders.length > 0) {
      throw new Error(
        `${offenders.length} campaign ratchet constant(s) are one-sided -- a ceiling/floor with only ` +
          `the "no more than" (or "at least") direction, never a companion that fails when the ` +
          `measurement drifts stale below the constant. This gate seeds at zero: close each offender ` +
          `by appending an it() at the END of its owning describe block, never by editing an existing ` +
          `one:\n` +
          offenders.map((o) => `  ${o.message}`).join('\n'),
      );
    }
    expect(offenders.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// NON-VACUITY (DEC-967): synthetic fixtures written to a real tmpdir,
// exercised through the SAME classifyItBody/findOffenders functions the
// population walk above uses -- never validated by reading
// CAMPAIGN_CONSTANT_NAMES/TIER2_CEILING_NAMES back as their own evidence.
// ---------------------------------------------------------------------------

describe('non-vacuity: the detector discriminates one-sided from two-sided fixtures', () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'campaign-ratchet-two-sided-fixture-'));
  });

  it('a fabricated one-sided ratchet (ceiling-only) IS reported', () => {
    const oneSided = [
      'export const FIXTURE_ONE_SIDED_CEILING = 0;',
      '',
      "describe('fixture', () => {",
      "  it('never exceeds the ceiling', () => {",
      '    expect(measured.length).toBeLessThanOrEqual(FIXTURE_ONE_SIDED_CEILING);',
      '  });',
      '});',
      '',
    ].join('\n');
    const abs = join(dir, 'one-sided.fixture.test.ts');
    writeFileSync(abs, oneSided, 'utf8');
    const fixtureFiles: SourceFile[] = [{ abs, rel: 'one-sided.fixture.test.ts', content: oneSided }];
    const offenders = findOffenders(fixtureFiles, ['FIXTURE_ONE_SIDED_CEILING']);
    expect(offenders.length).toBe(1);
    expect(offenders[0]!.name).toBe('FIXTURE_ONE_SIDED_CEILING');
  });

  it('a fabricated two-sided pair (ceiling `it` + stale-below companion `it`) is NOT reported', () => {
    const twoSided = [
      'export const FIXTURE_TWO_SIDED_CEILING = 0;',
      '',
      "describe('fixture', () => {",
      "  it('never exceeds the ceiling', () => {",
      '    expect(measured.length).toBeLessThanOrEqual(FIXTURE_TWO_SIDED_CEILING);',
      '  });',
      "  it('the ceiling is not stale', () => {",
      '    if (measured.length < FIXTURE_TWO_SIDED_CEILING) {',
      '      throw new Error(`lower it: export const FIXTURE_TWO_SIDED_CEILING = ${measured.length};`);',
      '    }',
      '    expect(measured.length).toBeGreaterThanOrEqual(FIXTURE_TWO_SIDED_CEILING);',
      '  });',
      '});',
      '',
    ].join('\n');
    const abs = join(dir, 'two-sided.fixture.test.ts');
    writeFileSync(abs, twoSided, 'utf8');
    const fixtureFiles: SourceFile[] = [{ abs, rel: 'two-sided.fixture.test.ts', content: twoSided }];
    const offenders = findOffenders(fixtureFiles, ['FIXTURE_TWO_SIDED_CEILING']);
    expect(offenders.length).toBe(0);
  });

  it('a fabricated single-`it` EXACT-equality pin (both directions in one assertion) is NOT reported', () => {
    const exact = [
      'export const FIXTURE_EXACT_CEILING = 3;',
      '',
      "describe('fixture', () => {",
      "  it('pins the exact count', () => {",
      '    expect(FIXTURE_EXACT_CEILING).toBe(measured.length);',
      '  });',
      '});',
      '',
    ].join('\n');
    const abs = join(dir, 'exact.fixture.test.ts');
    writeFileSync(abs, exact, 'utf8');
    const fixtureFiles: SourceFile[] = [{ abs, rel: 'exact.fixture.test.ts', content: exact }];
    const offenders = findOffenders(fixtureFiles, ['FIXTURE_EXACT_CEILING']);
    expect(offenders.length).toBe(0);
  });

  it('a two-sided pair split across TWO files (declaration in a plain .ts module, companion `it`s in the .test.ts file that imports it -- STARVED_FLEX_TRACK_CEILING\'s real shape) is NOT reported', () => {
    const declFile = [
      'export const FIXTURE_CROSS_FILE_CEILING = 1;',
      '',
    ].join('\n');
    const testFile = [
      "import { FIXTURE_CROSS_FILE_CEILING } from './fixture-cross-file-decl';",
      "describe('fixture', () => {",
      "  it('never exceeds the ceiling', () => {",
      '    expect(measured.length).toBeLessThanOrEqual(FIXTURE_CROSS_FILE_CEILING);',
      '  });',
      "  it('the ceiling is not stale', () => {",
      '    expect(measured.length).toBeGreaterThanOrEqual(FIXTURE_CROSS_FILE_CEILING);',
      '  });',
      '});',
      '',
    ].join('\n');
    const declAbs = join(dir, 'fixture-cross-file-decl.ts');
    const testAbs = join(dir, 'fixture-cross-file.scan.test.ts');
    writeFileSync(declAbs, declFile, 'utf8');
    writeFileSync(testAbs, testFile, 'utf8');
    const fixtureFiles: SourceFile[] = [
      { abs: declAbs, rel: 'fixture-cross-file-decl.ts', content: declFile },
      { abs: testAbs, rel: 'fixture-cross-file.scan.test.ts', content: testFile },
    ];
    const offenders = findOffenders(fixtureFiles, ['FIXTURE_CROSS_FILE_CEILING']);
    expect(offenders.length).toBe(0);
  });

  it('a constant with no reading it() at all (declared but never asserted against) IS reported', () => {
    const orphan = 'export const FIXTURE_UNREAD_CEILING = 0;\n';
    const abs = join(dir, 'unread.fixture.test.ts');
    writeFileSync(abs, orphan, 'utf8');
    const fixtureFiles: SourceFile[] = [{ abs, rel: 'unread.fixture.test.ts', content: orphan }];
    const offenders = findOffenders(fixtureFiles, ['FIXTURE_UNREAD_CEILING']);
    expect(offenders.length).toBe(1);
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));
});
