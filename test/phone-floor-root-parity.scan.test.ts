// Twin-root native-control 44px floor parity scan (DEC-180 wave-53
// amendment, task w53-f).
//
// src/views/theme.ts:309 asserts, in prose, of its checkbox/radio
// appearance:none takeover: "Twin of the same takeover in
// app/src/styles.css's 'Native control styling' section -- the two
// stylesheet roots DEC-409 names must agree." Nothing has ever checked
// that sentence. Every existing tap-floor ratchet in this campaign grades
// ONE root's own selectors against the 44px floor; none compares the two
// roots to EACH OTHER, which is exactly how the wave-53 checkbox/radio
// hole (fourteen 18x18 tap targets on the unauthenticated CFP) survived
// every prior instrument -- each of them is blind to this population BY
// CONSTRUCTION.
//
// THE TWO ROOTS (never hand-listed beyond naming them, DEC-180): (a)
// app/src/styles.css, read directly -- the admin SPA's own stylesheet; (b)
// src/views/theme.ts's THEME_CSS export, reached through
// test/helpers/ssr-css-sources.ts's ssrCssSources() and matched by path --
// NOT a `src/**/*.css.ts` filename glob, which is the exact shape that
// silently drops theme.ts (it is plain .ts, not .css.ts, and does not
// live under src/routes); this campaign has already recorded that
// specific blindness twice (docs/design/audit/density-pairing-v12.md's
// wave-99 note; field guide wave-57 note on ssr-css-sources.ts's own
// header).
//
// FLOORED (per root): a rule declaring `min-height` or `height` >=44px
// that is EITHER (a) inside the sheet's ONE terminal
// `@media (max-width: 700px)` block -- guaranteed unique and textually
// terminal by test/phone-terminal-block.scan.test.ts; this file does not
// re-derive that guarantee a second time (DEC-613), it fails loudly if the
// precondition it depends on (`phoneMediaBlocks` returning exactly one
// block) does not hold -- OR (b) an UNCONDITIONAL top-level rule (no
// @media wrapper of ANY kind). DEC-385 is single-direction (narrow
// overrides wide via max-width queries ONLY), so an unconditional floor
// applies at every width including 390/phone, and nothing narrower can
// remove it; app/src/styles.css's `.chq-file`/`.chq-file::file-selector-
// button` floor is exactly this shape (declared once, outside any media
// query, styles.css:2065-2081) and would be a false offender against
// theme.ts's phone-scoped equivalent without this widening. A declaration
// living inside any OTHER @media condition (print, hover, ...) counts
// toward neither side -- neither root's *phone* geometry depends on those.
//
// CONTROL FAMILY: a small, source-derived classifier (never a hand-listed
// selector-to-selector correspondence table) bucketing a selector fragment
// into one of the native-control families BOTH roots' own prose names as a
// taken-over control: app/src/styles.css:1917's "Native control styling
// (DEC-577) -- file / date / select / check" section header, and
// theme.ts's own base-rule set (search/text/email/tel/url/password inputs,
// select, textarea, date, file (+ its ::file-selector-button pseudo),
// checkbox, radio, button/.chq-btn, .chq-nav). A selector fragment that
// matches none of these patterns is not a "control-family" selector under
// DEC-409/DEC-577 -- e.g. `.chq-pill`, `.chq-row-title`, `.chq-link-button`
// are SPA-only compound UI atoms neither root's native-control prose ever
// names, and grading them here would compare selectors the two roots never
// claimed were twins in the first place, reintroducing exactly the kind of
// undeserved-population noise DEC-967 warns against.
//
// EXISTENCE GUARD (the only exclusion this scan grants, and it is derived
// from source on every run, never asserted): a family is graded ONLY when
// its pattern occurs SOMEWHERE in BOTH roots' text (floored or not). Real
// example this scan's own run discovers: `date-input` never occurs as a
// distinct selector in app/src/styles.css -- dates are styled purely
// through the shared `.chq-input` class there (styles.css:2100's own
// comment: "same border/radius/height/typography as .chq-input (already
// applied via that shared class)"), never a standalone `input[type=date]`
// rule, so `date-input` is not a member of the compared population on that
// root and is excluded -- not because the floor is proven equivalent by
// fiat, but because the token this scan keys on genuinely does not render
// as its own selector there; grading it as "absent" would be a false
// offender against a naming-convention difference, not a real geometry
// gap. An excluded family is still visible in the printed report so a
// human can audit the exclusion itself.
//
// NON-VACUITY (DEC-967): two fabricated fixture root PAIRS are written to
// a real mkdtempSync directory and read back off disk -- one pair that
// genuinely diverges (must be reported by the exact same detector function
// the real-root scan uses) and one pair that agrees (must not be) -- plus
// a tripwire that the REAL population (both roots) is non-empty.
//
// REGISTRATION (DEC-180 wave-53 amendment): this ceiling ships PARKED --
// registered in OUT_OF_CAMPAIGN_SCOPE, not CAMPAIGN_CONSTANT_NAMES or
// TIER2_CEILING_NAMES -- because its one measured offender (the checkbox
// family) is the same live 44px-conformance defect a concurrent branch
// owns the repair for; this instrument is promoted to TIER2 once it reads
// 0 (the LINE_KEYED_CITATION_CEILING/PACK_UNIT_GRAMMAR disposition
// already used elsewhere in this file's sibling registry). This lane does
// not touch src/views/theme.ts, app/src/styles.css or
// src/views/form-render.tsx -- instrument only, no repair.

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { phoneMediaBlocks, splitMediaBlocks } from './helpers/css-media-blocks';
import { stripCssComments } from './helpers/strip-css-comments';
import { ssrCssSources } from './helpers/ssr-css-sources';

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, '..');

// ---------------------------------------------------------------------------
// Control-family classifier (order matters: earlier entries are checked
// first, so a more specific pattern -- e.g. the file-selector-button pseudo
// -- is not shadowed by the broader file-input pattern it is a substring
// company of).
// ---------------------------------------------------------------------------

const FAMILY_PATTERNS: ReadonlyArray<{ key: string; re: RegExp }> = [
  { key: 'checkbox', re: /input\[type=['"]?checkbox['"]?\]|\.chq-check(?:-hit)?\b/ },
  { key: 'radio', re: /input\[type=['"]?radio['"]?\]/ },
  {
    key: 'text-input',
    re: /input\[type=['"]?(?:search|text|email|tel|url|password)['"]?\]|\.chq-input\b/,
  },
  { key: 'date-input', re: /input\[type=['"]?date['"]?\]/ },
  { key: 'file-selector-button', re: /::file-selector-button|::-webkit-file-upload-button/ },
  { key: 'file-input', re: /input\[type=['"]?file['"]?\]|\.chq-file\b/ },
  { key: 'select', re: /(^|[\s>+~,])select\b|\.chq-select\b/ },
  { key: 'textarea', re: /(^|[\s>+~,])textarea\b|\.chq-textarea\b/ },
  {
    key: 'button',
    re: /(^|[\s>+~,])button\b|input\[type=['"]?submit['"]?\]|\.chq-btn\b(?!-)/,
  },
  { key: 'nav-link', re: /\.chq-nav\b/ },
];

function classify(selectorFragment: string): string | null {
  for (const { key, re } of FAMILY_PATTERNS) {
    if (re.test(selectorFragment)) return key;
  }
  return null;
}

/** Max declared `min-height`/`height` px value inside a rule body, 0 if
 * neither is declared (or declared in a non-px unit this scan does not
 * attempt to resolve -- e.g. `min-height: 0` is common and correctly not a
 * floor). */
function maxFlooredPx(body: string): number {
  const re = /(?:min-height|height)\s*:\s*(\d+(?:\.\d+)?)px/gi;
  let max = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const v = Number.parseFloat(m[1] ?? '0');
    if (v > max) max = v;
  }
  return max;
}

// ---------------------------------------------------------------------------
// Per-root analysis + cross-root divergence detector -- the ONE function
// exercised by both the real-root scan below and the fixture non-vacuity
// tests, so a fixture proving the detector's behaviour is proof about the
// same code path the real population uses (DEC-967).
// ---------------------------------------------------------------------------

interface RootAnalysis {
  /** every control family with >=1 selector fragment declaring a phone-
   * effective >=44px min-height/height floor (terminal phone block, or
   * unconditional top-level) */
  floored: Set<string>;
  /** every control family with >=1 selector fragment ANYWHERE in the root
   * (floored or not) -- the existence guard's population */
  present: Set<string>;
}

const RULE_RE = /([^{}]+)\{([^{}]*)\}/g;

function collectFamilies(text: string, floored: Set<string>, present: Set<string>): void {
  RULE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RULE_RE.exec(text))) {
    const selectorList = (m[1] ?? '').trim();
    if (!selectorList) continue;
    const body = m[2] ?? '';
    const floors44 = maxFlooredPx(body) >= 44;
    for (const frag of selectorList.split(',').map((s) => s.trim()).filter(Boolean)) {
      const family = classify(frag);
      if (!family) continue;
      present.add(family);
      if (floors44) floored.add(family);
    }
  }
}

/** Analyzes one root's raw CSS-ish text (a plain .css file's whole text, or
 * a *_CSS template literal's body/whole file -- either is safe: the phone
 * block is located by searching for the literal `@media (max-width: 700px)`
 * substring, and any JS wrapper (`import { X } from "y";`) sitting before it
 * has its own braces already closed by the time that substring is reached,
 * so it never perturbs the phone-block brace match; it can only ever mint a
 * harmless extra "rule" in the unconditional-top-level pass, which
 * `classify()` discards since it matches no control-family pattern). */
function analyzeRoot(rawCss: string): RootAnalysis {
  const clean = stripCssComments(rawCss);
  const phoneBodies = phoneMediaBlocks(clean);
  if (phoneBodies.length !== 1) {
    throw new Error(
      `expected exactly one terminal @media (max-width: 700px) block (guaranteed by ` +
        `test/phone-terminal-block.scan.test.ts) but found ${phoneBodies.length}`,
    );
  }
  const outside = splitMediaBlocks(clean).outside;

  const floored = new Set<string>();
  const present = new Set<string>();
  collectFamilies(phoneBodies[0] ?? '', floored, present);
  collectFamilies(outside, floored, present);
  return { floored, present };
}

export interface Divergence {
  family: string;
  flooredInA: boolean;
  flooredInB: boolean;
}

/** The detector: every control family present (anywhere) in BOTH roots
 * whose floored-ness disagrees between them. `rootA`/`rootB` are raw
 * CSS-ish text, never pre-parsed structures, so a fixture calling this
 * exercises the exact same parsing this file's real-root scan does. */
export function findDivergentFamilies(rootACss: string, rootBCss: string): Divergence[] {
  const a = analyzeRoot(rootACss);
  const b = analyzeRoot(rootBCss);
  const out: Divergence[] = [];
  for (const family of a.present) {
    if (!b.present.has(family)) continue; // existence guard
    const flooredInA = a.floored.has(family);
    const flooredInB = b.floored.has(family);
    if (flooredInA !== flooredInB) out.push({ family, flooredInA, flooredInB });
  }
  return out.sort((x, y) => x.family.localeCompare(y.family));
}

// ---------------------------------------------------------------------------
// Real roots.
// ---------------------------------------------------------------------------

const STYLES_CSS_PATH = join(REPO_ROOT, 'app', 'src', 'styles.css');
const STYLES_CSS_RAW = readFileSync(STYLES_CSS_PATH, 'utf-8');

const THEME_SOURCE = ssrCssSources().find((s) => s.path === 'src/views/theme.ts');
if (!THEME_SOURCE) {
  throw new Error(
    'src/views/theme.ts not found via ssrCssSources() -- the SSR root this scan grades no ' +
      'longer exports a *_CSS module the way this scan expects',
  );
}
const THEME_TS_RAW = THEME_SOURCE.text;

const REAL_DIVERGENCES = findDivergentFamilies(STYLES_CSS_RAW, THEME_TS_RAW);

// wave-53 (task w53-f, DEC-180 amendment): measured live against this
// branch. May only be LOWERED, and only in the same commit that closes the
// underlying 44px gap (this lane does not do that repair -- see the file
// header). Parked in OUT_OF_CAMPAIGN_SCOPE, not graded by the campaign exit
// predicate, per the same wave-53 amendment.
export const PHONE_FLOOR_ROOT_PARITY_CEILING = 1;

describe('twin-root native-control 44px floor parity (DEC-180 wave-53 amendment)', () => {
  it('the real population is non-empty on both sides (vacuity tripwire): at least one control family is graded, and each root independently floors at least one control family somewhere in its own text', () => {
    const a = analyzeRoot(STYLES_CSS_RAW);
    const b = analyzeRoot(THEME_TS_RAW);
    const compared = [...a.present].filter((f) => b.present.has(f));
    expect(compared.length).toBeGreaterThan(0);
    expect(a.floored.size).toBeGreaterThan(0);
    expect(b.floored.size).toBeGreaterThan(0);
  });

  it('positive control: a fabricated diverging fixture pair (checkbox floored via a wrapper label on one root, unfloored bare input on the other) is reported', () => {
    const scratchDir = mkdtempSync(join(tmpdir(), 'phone-floor-root-parity-diverge-'));
    try {
      const rootAPath = join(scratchDir, 'fixture-root-a.css');
      const rootBPath = join(scratchDir, 'fixture-root-b.css');
      writeFileSync(
        rootAPath,
        [
          "input[type='checkbox'] { width: 18px; height: 18px; }",
          '.chq-check-hit { display: inline-flex; align-items: center; }',
          '@media (max-width: 700px) {',
          '  .chq-check-hit { min-height: 44px; min-width: 44px; }',
          '}',
        ].join('\n'),
      );
      writeFileSync(
        rootBPath,
        [
          'input[type=checkbox] { width: 18px; height: 18px; }',
          '@media (max-width: 700px) {',
          '  input[type=text] { min-height: 44px; }',
          '}',
        ].join('\n'),
      );
      const divergences = findDivergentFamilies(
        readFileSync(rootAPath, 'utf-8'),
        readFileSync(rootBPath, 'utf-8'),
      );
      expect(divergences).toEqual([{ family: 'checkbox', flooredInA: true, flooredInB: false }]);
    } finally {
      rmSync(scratchDir, { recursive: true, force: true });
    }
  });

  it('negative control: a fabricated agreeing fixture pair (checkbox floored via the bare input on both roots) is not reported', () => {
    const scratchDir = mkdtempSync(join(tmpdir(), 'phone-floor-root-parity-agree-'));
    try {
      const rootAPath = join(scratchDir, 'fixture-root-a.css');
      const rootBPath = join(scratchDir, 'fixture-root-b.css');
      writeFileSync(
        rootAPath,
        [
          "input[type='checkbox'] { width: 18px; height: 18px; }",
          '@media (max-width: 700px) {',
          "  input[type='checkbox'] { min-height: 44px; }",
          '}',
        ].join('\n'),
      );
      writeFileSync(
        rootBPath,
        [
          'input[type=checkbox] { width: 18px; height: 18px; }',
          '@media (max-width: 700px) {',
          '  input[type=checkbox] { min-height: 44px; }',
          '}',
        ].join('\n'),
      );
      const divergences = findDivergentFamilies(
        readFileSync(rootAPath, 'utf-8'),
        readFileSync(rootBPath, 'utf-8'),
      );
      expect(divergences).toEqual([]);
    } finally {
      rmSync(scratchDir, { recursive: true, force: true });
    }
  });

  it(`never exceeds PHONE_FLOOR_ROOT_PARITY_CEILING (${PHONE_FLOOR_ROOT_PARITY_CEILING}) control families floored on one stylesheet root but not the other`, () => {
    if (REAL_DIVERGENCES.length > PHONE_FLOOR_ROOT_PARITY_CEILING) {
      const lines = REAL_DIVERGENCES.map(
        (d) =>
          `${d.family}: floored in app/src/styles.css=${d.flooredInA}, floored in ` +
          `src/views/theme.ts=${d.flooredInB}`,
      );
      throw new Error(
        `${REAL_DIVERGENCES.length} control families disagree between the two stylesheet roots, ` +
          `exceeding PHONE_FLOOR_ROOT_PARITY_CEILING of ${PHONE_FLOOR_ROOT_PARITY_CEILING}. ` +
          `PHONE_FLOOR_ROOT_PARITY_CEILING may only be RAISED (a new, real divergence), never to ` +
          `paper over one; repair belongs to the lane owning src/views/theme.ts / ` +
          `app/src/styles.css, not this instrument:\n${lines.join('\n')}`,
      );
    }
    expect(REAL_DIVERGENCES.length).toBeLessThanOrEqual(PHONE_FLOOR_ROOT_PARITY_CEILING);
  });

  it(`never sits BELOW PHONE_FLOOR_ROOT_PARITY_CEILING (${PHONE_FLOOR_ROOT_PARITY_CEILING}) without the ceiling being lowered to match (a stale ceiling licenses stagnation)`, () => {
    if (REAL_DIVERGENCES.length < PHONE_FLOOR_ROOT_PARITY_CEILING) {
      throw new Error(
        `only ${REAL_DIVERGENCES.length} control families disagree between the two stylesheet ` +
          `roots now, below PHONE_FLOOR_ROOT_PARITY_CEILING of ${PHONE_FLOOR_ROOT_PARITY_CEILING}. ` +
          `Lower the ceiling in the same commit that closed the gap by replacing the line:\n` +
          `  export const PHONE_FLOOR_ROOT_PARITY_CEILING = ${REAL_DIVERGENCES.length};`,
      );
    }
    expect(REAL_DIVERGENCES.length).toBeGreaterThanOrEqual(PHONE_FLOOR_ROOT_PARITY_CEILING);
  });
});
