// Palette closure scan (DEC-631 amendment, wave 5 / task w5-d).
//
// docs/design/README.md §Colour: "There is no red, and no third accent...
// Do not reintroduce a semantic red without revisiting it." §Accessibility:
// meaning is never carried by colour alone. The confirm-dialog danger fill
// (#7a2a1e / #5f2016) was exactly that -- a hex literal outside the README
// palette table, unseen by any scan for ~70 waves (findings wave 5). This
// test is the scan that would have caught it: every hex colour literal
// anywhere in the app's CSS/CSS-in-TS surfaces must be one of the palette's
// declared tokens.
//
// Population: every app/src/**/*.css file, every src/**/*.css.ts file (the
// Hono-JSX SSR surfaces' CSS-in-TS), and src/views/theme.ts (the SSR THEME_CSS
// string, DEC-371) -- enumerated via readdirSync (DEC-808 idiom), never a
// hand-listed manifest. rgba()/hsl() scrims are out of population: they carry
// no `#` literal for this regex to find, and a scrim's opacity channel is not
// a palette colour choice.
//
// Allowlist: the README §Colour table's 16 hexes, plus 4 neutrals declared in
// app/src/styles.css that the table itself doesn't enumerate (--chq-ink-strong
// #2E2A24, --chq-agenda-lattice #EDE9DD, --chq-disabled-bg #DDD8C8, and the
// merge-screen discarded-value colour #A8A392 named in the README's
// Typography-adjacent prose, DEC-021/DEC-372 amendments). Comparison is
// case-insensitive; block comments are stripped first so a hex literal named
// only in an explanatory comment (e.g. programme.css.ts's own "#fff/#000"
// prose) is never mistaken for a live declaration.
//
// Never allowlist a colour the palette does not contain, and never add an
// entry without a reason that cannot expire -- an offender found by this scan
// gets fixed to the nearest token, not excused.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url)); // app/src
const REPO_ROOT = join(HERE, '..', '..');
const SRC_DIR = join(REPO_ROOT, 'src');
const THEME_TS = join(SRC_DIR, 'views', 'theme.ts');

/** Every *.css file under app/src, enumerated rather than named (DEC-808). */
function allAppCssFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.css')) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

/** Every *.css.ts file under src (the Hono-JSX SSR CSS-in-TS surfaces). */
function allCssTsFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.css.ts')) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

/** Strips /* ... *\/ block comments so a comment quoting a hex (e.g.
 * documenting a rejected literal) is never mistaken for a live declaration. */
function stripBlockComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Every distinct #rgb/#rrggbb hex literal in `text`, lowercased.
 * rgba()/hsl() scrims carry no `#` and are naturally out of population. */
function hexLiterals(text: string): string[] {
  const out = new Set<string>();
  const re = /#(?:[0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.add(m[0].toLowerCase());
  }
  return [...out];
}

// README §Colour table (docs/design/README.md), plus the 4 neutrals already
// declared in app/src/styles.css that the table doesn't enumerate.
const ALLOWLIST = new Set<string>(
  [
    // README §Colour table
    '#F4F1E8',
    '#FAF8F2',
    '#EFEBDF',
    '#1B1D17',
    '#3F4237',
    '#565A4B',
    // Disabled: DEC-436's wave-25 amendment darkened this token #8E8A7A ->
    // #7D7869 (3:1 against --chq-disabled-bg and the page grounds). The
    // README §Colour table moved with it; #8E8A7A is no longer declared
    // anywhere, so this is the table mirrored, not a colour excused.
    '#7D7869',
    '#E1DDCE',
    '#D3CFC0',
    '#BAB6A6',
    '#CFC7B7',
    '#4E5C31',
    '#3C471F',
    '#F7F9F0',
    '#B5AFA2',
    '#3A3D32',
    // Neutrals declared in app/src/styles.css, not in the README table
    '#2E2A24',
    '#EDE9DD',
    '#DDD8C8',
    '#A8A392',
    // DEC-383 (wave-58 amendment) B8 "Interaction-states standard"
    // (docs/design/DESIGN-RULINGS.md:108-177) button hover/active table --
    // the pressed and secondary-hover tiers this ruling adds, not
    // previously declared anywhere in the token set.
    '#33401A', // --chq-brand-active (primary :active)
    '#E4DFD2', // --chq-secondary-hover
    '#DCD6C6', // --chq-secondary-active
    '#8E8A7A', // --chq-border-hover (input hover border; same value the
    // README's superseded pre-DEC-436 disabled tone used, now reused for a
    // different token per the B8 table's "Inputs and selects" row)
  ].map((h) => h.toLowerCase()),
);

const POPULATION: Array<{ label: string; path: string }> = [
  ...allAppCssFiles(HERE).map((path) => ({ label: relative(REPO_ROOT, path), path })),
  ...allCssTsFiles(SRC_DIR).map((path) => ({ label: relative(REPO_ROOT, path), path })),
  { label: relative(REPO_ROOT, THEME_TS), path: THEME_TS },
];

describe('palette closure scan (DEC-631 amendment, wave 5)', () => {
  it('scans a non-trivial number of files (vacuous-scan tripwire)', () => {
    expect(POPULATION.length).toBeGreaterThan(5);
  });

  it('flags a synthetic hex literal outside the palette (positive control)', () => {
    expect(hexLiterals('.chq-x { background: #7a2a1e; }').some((h) => !ALLOWLIST.has(h))).toBe(true);
  });

  it('does not flag a real palette hex (negative control)', () => {
    expect(hexLiterals('.chq-x { background: #4E5C31; }').every((h) => ALLOWLIST.has(h))).toBe(true);
  });

  it('every hex literal in app/src CSS + src CSS-in-TS resolves to a palette token', () => {
    const offenders: string[] = [];
    for (const { label, path } of POPULATION) {
      const text = stripBlockComments(readFileSync(path, 'utf-8'));
      for (const hex of hexLiterals(text)) {
        if (!ALLOWLIST.has(hex)) offenders.push(`${label}: ${hex}`);
      }
    }
    expect(
      offenders,
      `hex literals outside the docs/design/README.md §Colour palette (fix to the nearest token, never allowlist):\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
