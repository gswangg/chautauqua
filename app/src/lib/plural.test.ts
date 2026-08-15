import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { plural, countOf } from './plural';

describe('plural', () => {
  it('regular noun', () => {
    expect(plural(0, 'session')).toBe('sessions');
    expect(plural(1, 'session')).toBe('session');
    expect(plural(2, 'session')).toBe('sessions');
  });

  it('irregular noun uses the supplied plural form, never a guessed "s"', () => {
    expect(plural(0, 'person', 'people')).toBe('people');
    expect(plural(1, 'person', 'people')).toBe('person');
    expect(plural(2, 'person', 'people')).toBe('people');
  });
});

describe('countOf', () => {
  it('regular noun', () => {
    expect(countOf(0, 'session')).toBe('0 sessions');
    expect(countOf(1, 'session')).toBe('1 session');
    expect(countOf(2, 'session')).toBe('2 sessions');
  });

  it('irregular noun', () => {
    expect(countOf(0, 'person', 'people')).toBe('0 people');
    expect(countOf(1, 'person', 'people')).toBe('1 person');
    expect(countOf(2, 'person', 'people')).toBe('2 people');
  });

  it('multi-word singular (no bare "s" guess needed)', () => {
    expect(countOf(0, 'possible duplicate')).toBe('0 possible duplicates');
    expect(countOf(1, 'possible duplicate')).toBe('1 possible duplicate');
    expect(countOf(2, 'possible duplicate')).toBe('2 possible duplicates');
  });
});

// DEC-925/DEC-987 (broadened wave 52-c): a hand-copied pluralization
// ternary is banned anywhere under app/src except the one module that
// implements/documents the vocabulary (plural.ts) and this test. The
// original scan only banned the exact substring `? '' : 's'`; that left
// every OTHER spelling of the same ternary family untouched (a bare
// `'file'`/`'files'` pair, `'is'`/`'are'`, `'has'`/`'have'`, an uppercase
// `'S'` suffix, either arm order, either quote style). This scan matches
// the whole FAMILY: any ternary whose two arms are bare quoted string
// literals (no interpolation) that form a singular/plural relationship,
// either by a trailing s/es/S/ES suffix or by a known irregular
// noun/verb pair, in either arm order.
describe('no hand-copied pluralization ternaries outside plural.ts', () => {
  const APP_SRC = join(__dirname, '..');

  // plural.ts/plural.test.ts document and verify the pattern -- the one
  // allowed home for it. pages/overview/rows.ts is a SEPARATE, temporary
  // exclusion: it carries its own local `pluralize` helper and a
  // `need${count === 1 ? 's' : ''}` ternary at headlineText, and is owned
  // by the in-flight w51-e branch which is already rewriting that
  // function (headlineText's bare numeral). Remove this line once w51-e
  // lands and rows.ts goes through lib/plural like everything else.
  const ALLOWLIST = new Set(['lib/plural.ts', 'lib/plural.test.ts', 'pages/overview/rows.ts']);

  function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) out.push(...walk(full));
      else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
    }
    return out;
  }

  function isTestFile(rel: string): boolean {
    return /\.test\.tsx?$/.test(rel) || /\.render\.test\.tsx?$/.test(rel);
  }

  // Irregular noun/verb pairs that don't differ by a trailing s/es -- both
  // orders are checked by the caller, so each pair is listed once.
  const IRREGULAR_PAIRS: Array<[string, string]> = [
    ['is', 'are'],
    ['has', 'have'],
    ['was', 'were'],
    ['does', 'do'],
    ['needs', 'need'],
    ['it is', 'they are'],
    ['falls', 'fall'],
    ['stays', 'stay'],
    ['person', 'people'],
    ['child', 'children'],
  ];

  function normalize(s: string): string {
    return s.trim().toLowerCase();
  }

  function isSuffixPair(a: string, b: string): boolean {
    const na = normalize(a);
    const nb = normalize(b);
    if (na === nb) return false; // identical arms aren't a pluralization ternary
    return (
      nb === `${na}s` || nb === `${na}es` || na === `${nb}s` || na === `${nb}es`
    );
  }

  function isIrregularPair(a: string, b: string): boolean {
    const na = normalize(a);
    const nb = normalize(b);
    return IRREGULAR_PAIRS.some(
      ([x, y]) => (na === x && nb === y) || (na === y && nb === x),
    );
  }

  // CSS class name modifiers (e.g. 'chq-review-plan-status-open' vs
  // '...-opens') are kebab-case tokens, never natural-language copy --
  // exclude them so the scan doesn't flag a class name that happens to
  // share the noun-plus-s shape.
  function looksLikeClassName(s: string): boolean {
    return s.includes('-');
  }

  function isPluralizationTernary(a: string, b: string): boolean {
    if (looksLikeClassName(a) || looksLikeClassName(b)) return false;
    return isSuffixPair(a, b) || isIrregularPair(a, b);
  }

  // Matches `? '<arm1>' : '<arm2>'` (or with double quotes, either quote
  // style/order) where BOTH arms are bare literals -- no `${...}`
  // interpolation, no escaped quotes, so this only ever matches plain
  // string ternaries, never template expressions.
  const TERNARY_RE = /\?\s*(['"])([^'"$]*?)\1\s*:\s*(['"])([^'"$]*?)\3/g;

  function findOffenses(contents: string): string[] {
    const offenses: string[] = [];
    for (const match of contents.matchAll(TERNARY_RE)) {
      const arm1 = match[2] ?? '';
      const arm2 = match[4] ?? '';
      if (isPluralizationTernary(arm1, arm2)) {
        offenses.push(match[0]);
      }
    }
    return offenses;
  }

  const files = walk(APP_SRC)
    .map((f) => ({ full: f, rel: relative(APP_SRC, f) }))
    .filter(({ rel }) => !ALLOWLIST.has(rel) && !isTestFile(rel));

  it('scans a non-trivial number of files (vacuous-scan tripwire)', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('flags a synthetic hand-copied ternary (negative control)', () => {
    expect(findOffenses(`\`\${n} clash\${n === 1 ? '' : 'es'}\``)).toHaveLength(1);
    expect(findOffenses(`n === 1 ? 'file' : 'files'`)).toHaveLength(1);
    expect(findOffenses(`n === 1 ? 'files' : 'file'`)).toHaveLength(1);
    expect(findOffenses(`n === 1 ? "is" : "are"`)).toHaveLength(1);
    expect(findOffenses(`n === 1 ? 'S' : ''`)).toHaveLength(1); // reversed arm order, still a pair
    expect(findOffenses(`daysLeft === 1 ? '' : 'S'`)).toHaveLength(1);
    // not a pluralization pair -- must not false-positive
    expect(findOffenses(`isActive ? ' is-active' : ''`)).toHaveLength(0);
    expect(findOffenses(`destructive ? 'chq-btn-danger' : 'chq-btn-primary'`)).toHaveLength(0);
  });

  it('bans hand-copied pluralization ternaries in app/src', () => {
    const offenders: Array<{ file: string; matches: string[] }> = [];
    for (const { full, rel } of files) {
      const contents = readFileSync(full, 'utf8');
      const matches = findOffenses(contents);
      if (matches.length > 0) offenders.push({ file: rel, matches });
    }
    expect(offenders).toEqual([]);
  });
});
