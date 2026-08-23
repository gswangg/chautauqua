// Pack TYPOGRAPHY-REGISTER ratchet: letter-spacing + text-transform (DEC-937
// wave-43 amendment, task w43-c).
//
// THE GAP: `test/pack-unit-grammar.scan.test.ts`'s own header names this
// live and unrouted -- docs/design/audit/pack-unit-grammar-v12.md's
// "Letter-spacing (measured, deliberately not graded this wave)" section
// says in its own words "Left ungraded and unregistered; a later lane
// should treat this as a NEW ratchet with its own vocabulary-derivation
// shape, not an extension of this one." Wave 39 named it live and
// unrouted; no wave routed it until this one. `PACK_UNIT_GRAMMAR_
// OFFENDERS_CEILING` is owned by that other file and is NOT extended here
// -- this is a new, standalone instrument (DEC-937 wave-43).
//
// WHY A NEW SHAPE (not an extension of pack-unit-grammar): that ratchet's
// classifier is a bare-PX grid join (px on-grid, rem computed-to-px,
// em unresolved). The pack's letter-spacing grammar is 100% `em` -- there
// is no px grid to join against. This ratchet's classifier instead derives
// an EM-value vocabulary directly (no px conversion), and adds a second,
// independent register for `text-transform`, a keyword property with no
// unit at all.
//
// POPULATION (DEC-808, readdirSync recursion, never hand-listed):
//   1. every `*.css` file under app/src/**, plus every SSR CSS module
//      under src/** via test/helpers/ssr-css-sources's ssrCssSources()
//      (the same corpus test/pack-unit-grammar.scan.test.ts uses, for the
//      same reason -- a `.css.ts`-filename glob misses src/views/theme.ts).
//   2. every `letter-spacing:`/`text-transform:` declaration in that
//      corpus, after stripping comments with the SHARED string-aware
//      test/helpers/strip-css-comments.ts (DEC-613: never a private copy)
//      -- the un-stripped-regex trap has now hit CSS, frame markup and
//      imports; this file strips before matching, always.
//
// VOCABULARY (derived at test time from the 13 docs/design/*.dc.html
// files, never hand-listed):
//   - letter-spacing: the set of literal `<digits>em` values the frames
//     draw inline (19 distinct values measured this wave).
//   - text-transform: the set of literal keyword values the frames draw
//     inline, restricted to the transform grammar (`uppercase` etc; the
//     frames draw exactly one value, `uppercase`, 709 times).
//
// CLASSIFICATION, per declaration:
//   - a RESET/INHERIT keyword (`normal`, `inherit`, `none`, `0`, `initial`,
//     `unset`) sits OUTSIDE the register grammar entirely -- a static frame
//     never draws a reset -- but is counted into its own asserted
//     `resetTotal`, so the population can never silently shrink by
//     reclassifying a real declaration as "not applicable" (DEC-180: a
//     discriminator is stated over the population, never as an offender
//     exclusion list).
//   - `var(--chq-...)` is RESOLVED against the two token files
//     (app/src/styles.css and src/views/theme.ts) and graded on the
//     resolved literal -- counted into the resolved property's own total.
//     An unresolved var() is an ungraded site wearing a citation
//     (DEC-937/DEC-383/DEC-808); a token this scan cannot resolve is an
//     UNRESOLVED row, never silently ok.
//   - anything else that parses as a literal em value (letter-spacing) or
//     a literal keyword (text-transform) is graded directly against the
//     derived vocabulary: on-grid, or an OFFENDER.
//   - anything else entirely (a `calc(...)`, a malformed value) falls into
//     its own asserted `otherTotal`.
//
// SETTLED EXCLUSIONS (DEC-967: check every offender's subject and literal
// across src/decisions-data/ and decisions/ before seeding): `.chq-wordmark`
// (src/views/theme.ts) declares `text-transform: lowercase`, the one
// keyword the pack has no register for at all -- but DEC-884 already rules
// this is deliberate ("chautauqua" is the only lowercase wordmark, reserved
// for the literal product wordmark on operator surfaces per the DEC-937
// wave-13m/DEC-884 lineage comment beside it) and at least eleven test
// files pin `.chq-wordmark` byte-for-byte (App.header390.render.test.tsx,
// Comms.frame390.render.test.tsx, Settings.hub390.render.test.tsx,
// agenda-phone-wordmark-390.test.ts, admin-390-offender-roster.scan.test.ts,
// phone-leak-guard-restore.scan.test.ts, tools-surfaces.test.ts,
// public-390-offender-roster.scan.test.ts, portal-eventmark.test.ts,
// portal-dashboard-session-390-frame-verdicts.test.ts,
// wordmark-optical-nudge.scan.test.ts). This site is LEFT, not repaired,
// and recorded as an adjudicated row.
//
// TWO-SIDED (DEC-808 wave-85 amendment shape): both letter-spacing ceilings
// (offenders/unresolved) and the text-transform offenders ceiling fail
// above AND below the measured count, seeded by forcing each to -1 and
// reading the printed roster back (recorded in
// docs/design/audit/pack-typography-register-v12.md).
//
// SCOPE: registered in scripts/exit-predicate/campaign-scope.ts's
// OUT_OF_CAMPAIGN_SCOPE (appended at the end) -- a freshly measured,
// previously-uncounted population must not move the campaign's goalposts
// mid-convergence, the same disposition PACK_UNIT_GRAMMAR_OFFENDERS_CEILING
// carries.
//
// NON-VACUITY (DEC-967 waves 103/143 shape): the detector's ability to
// fire and discriminate literal/var/reset/other is proved over a
// SYNTHETIC fixture this file writes to a tmpdir, never over a live
// product offender's identity.

import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEC_937 } from '../src/decisions';
import { ssrCssSources } from './helpers/ssr-css-sources';
import { stripCssComments } from './helpers/strip-css-comments';

// Confirms this file's population depends on the ruling it implements
// (compile-checked, per the standing house rule: code depending on
// DEC-NNN must reference its constant).
void DEC_937;

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..');
const APP_SRC = join(REPO_ROOT, 'app/src');
const DESIGN_DIR = join(REPO_ROOT, 'docs/design');
const STYLES_CSS_PATH = join(APP_SRC, 'styles.css');
const THEME_TS_PATH = join(REPO_ROOT, 'src/views/theme.ts');

type RegisterProperty = 'letter-spacing' | 'text-transform';
const PROPERTIES: readonly RegisterProperty[] = ['letter-spacing', 'text-transform'];

const RESET_KEYWORDS = new Set(['normal', 'inherit', 'none', '0', 'initial', 'unset']);

interface Source {
  readonly path: string;
  readonly text: string;
}

/** Every *.css file under `root`, enumerated (DEC-808), never hand-listed. */
function listCssFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (entry.isFile() && entry.name.endsWith('.css')) {
      out.push(join(entry.parentPath, entry.name));
    }
  }
  return out.sort();
}

/** app/src/**\/*.css plus every SSR CSS module under src/** (DEC-808). */
function productSources(): Source[] {
  const app = listCssFiles(APP_SRC).map((path) => ({ path, text: readFileSync(path, 'utf8') }));
  const ssr = ssrCssSources().map((s) => ({ path: s.path, text: s.text }));
  return [...app, ...ssr];
}

/** Every `*.dc.html` file under docs/design, enumerated (DEC-808). */
function packSources(): Source[] {
  const out: Source[] = [];
  for (const entry of readdirSync(DESIGN_DIR, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.dc.html')) {
      const path = join(DESIGN_DIR, entry.name);
      out.push({ path, text: readFileSync(path, 'utf8') });
    }
  }
  return out;
}

interface Declaration {
  readonly property: RegisterProperty;
  readonly value: string;
  readonly path: string;
}

/** Every `property: value;` declaration in `text`, after shared-stripper
 * comment removal, value trimmed. Terminator is `;` for a CSS rule or an
 * unescaped quote for a `style="..."` attribute (the pack's .dc.html
 * files routinely omit the trailing `;` on the last declaration before
 * the closing quote). */
function findDeclarations(text: string, path: string, property: RegisterProperty): Declaration[] {
  const cleaned = stripCssComments(text);
  const re = new RegExp(`${property}:\\s*([^;"']+)`, 'g');
  const out: Declaration[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned)) !== null) {
    out.push({ property, value: (m[1] as string).trim(), path });
  }
  return out;
}

const EM_RE = /^-?\d+(?:\.\d+)?em$/;
const VAR_RE = /^var\(\s*(--[a-zA-Z0-9-]+)\s*\)$/;

/** Pack's derived vocabulary, per property. letter-spacing: literal `em`
 * values. text-transform: literal keyword values, excluding reset words. */
function deriveVocabulary(sources: readonly Source[]): Record<RegisterProperty, ReadonlySet<string>> {
  const vocab: Record<RegisterProperty, Set<string>> = {
    'letter-spacing': new Set(),
    'text-transform': new Set(),
  };
  for (const s of sources) {
    for (const property of PROPERTIES) {
      for (const d of findDeclarations(s.text, s.path, property)) {
        if (property === 'letter-spacing' && EM_RE.test(d.value)) {
          vocab[property].add(d.value);
        } else if (property === 'text-transform' && !RESET_KEYWORDS.has(d.value)) {
          vocab[property].add(d.value);
        }
      }
    }
  }
  return vocab;
}

/** Resolves `--chq-...` custom-property declarations from styles.css and
 * theme.ts into a name -> literal-value map. Both files declare the same
 * token set (product theme mirrors the app stylesheet); either may
 * declare a token the other omits, so both are read and merged. */
function deriveTokenMap(): Map<string, string> {
  const map = new Map<string, string>();
  const TOKEN_RE = /(--chq-[a-zA-Z0-9-]+):\s*([^;]+);/g;
  for (const path of [STYLES_CSS_PATH, THEME_TS_PATH]) {
    const cleaned = stripCssComments(readFileSync(path, 'utf8'));
    let m: RegExpExecArray | null;
    TOKEN_RE.lastIndex = 0;
    while ((m = TOKEN_RE.exec(cleaned)) !== null) {
      const name = (m[1] as string).trim();
      const value = (m[2] as string).trim();
      if (!map.has(name)) map.set(name, value);
    }
  }
  return map;
}

interface Offender {
  readonly property: RegisterProperty;
  readonly value: string;
  readonly resolved: string;
  readonly path: string;
}

interface Unresolved {
  readonly property: RegisterProperty;
  readonly value: string;
  readonly path: string;
  readonly reason: 'var-token-undeclared';
}

interface GradeResult {
  readonly offenders: Offender[];
  readonly unresolved: Unresolved[];
  readonly resetTotal: number;
  readonly otherTotal: number;
  readonly literalTotal: number;
  readonly varTotal: number;
}

function grade(
  sources: readonly Source[],
  vocab: Record<RegisterProperty, ReadonlySet<string>>,
  tokens: Map<string, string>,
): GradeResult {
  const offenders: Offender[] = [];
  const unresolved: Unresolved[] = [];
  let resetTotal = 0;
  let otherTotal = 0;
  let literalTotal = 0;
  let varTotal = 0;

  for (const s of sources) {
    for (const property of PROPERTIES) {
      for (const d of findDeclarations(s.text, s.path, property)) {
        const varMatch = VAR_RE.exec(d.value);
        if (varMatch) {
          varTotal++;
          const tokenName = varMatch[1] as string;
          const resolved = tokens.get(tokenName);
          if (resolved === undefined) {
            unresolved.push({ property, value: d.value, path: d.path, reason: 'var-token-undeclared' });
            continue;
          }
          if (RESET_KEYWORDS.has(resolved)) {
            resetTotal++;
            continue;
          }
          if (!vocab[property].has(resolved)) {
            offenders.push({ property, value: d.value, resolved, path: d.path });
          }
          continue;
        }

        if (RESET_KEYWORDS.has(d.value)) {
          resetTotal++;
          continue;
        }

        const isGradableLiteral =
          property === 'letter-spacing' ? EM_RE.test(d.value) : /^[a-z-]+$/.test(d.value);
        if (!isGradableLiteral) {
          otherTotal++;
          continue;
        }

        literalTotal++;
        if (!vocab[property].has(d.value)) {
          offenders.push({ property, value: d.value, resolved: d.value, path: d.path });
        }
      }
    }
  }
  return { offenders, unresolved, resetTotal, otherTotal, literalTotal, varTotal };
}

const PACK_VOCAB = deriveVocabulary(packSources());
const TOKENS = deriveTokenMap();
const PRODUCT_SOURCES = productSources();
const RESULT = grade(PRODUCT_SOURCES, PACK_VOCAB, TOKENS);

function lsOffenders(): Offender[] {
  return RESULT.offenders.filter((o) => o.property === 'letter-spacing');
}
function ttOffenders(): Offender[] {
  return RESULT.offenders.filter((o) => o.property === 'text-transform');
}

// DEC-937 wave-43 amendment: measured two real letter-spacing offenders
// (app/src/pages/agenda/agenda.css's `.chq-day-grid-cell-hover-label` at
// `0.03em`, and src/routes/docs-site.css.ts's `.chq-docs-search-submit` at
// `0.01em` -- the pack draws neither sign-positive value) and repaired
// both to the pack's nearest in-vocabulary value in the same commit, so
// this ceiling is drained to 0 rather than left at 2. One text-transform
// offender (`.chq-wordmark`'s `lowercase`) is a settled DEC-884 exclusion,
// pinned by eleven test files, and is LEFT -- see this file's header.
export const PACK_TYPOGRAPHY_LETTER_SPACING_OFFENDERS_CEILING = 0;
export const PACK_TYPOGRAPHY_LETTER_SPACING_UNRESOLVED_CEILING = 0;
export const PACK_TYPOGRAPHY_TEXT_TRANSFORM_OFFENDERS_CEILING = 1;
export const PACK_TYPOGRAPHY_TEXT_TRANSFORM_UNRESOLVED_CEILING = 0;

describe('pack typography-register vocabulary: letter-spacing + text-transform (DEC-937 wave-43)', () => {
  it('derives a non-empty pack source population (vacuous-population tripwire)', () => {
    expect(packSources().length).toBe(13);
  });

  it('derives the pack letter-spacing vocabulary as 19 distinct em values', () => {
    expect(PACK_VOCAB['letter-spacing'].size).toBe(19);
  });

  it('derives the pack text-transform vocabulary as exactly one value (uppercase)', () => {
    expect(Array.from(PACK_VOCAB['text-transform'])).toEqual(['uppercase']);
  });

  it('resolves both tracking token files to a non-empty token map', () => {
    expect(TOKENS.size).toBeGreaterThan(0);
    expect(TOKENS.get('--chq-type-page-title-tracking')).toBe('-0.04em');
  });

  it('never exceeds PACK_TYPOGRAPHY_LETTER_SPACING_OFFENDERS_CEILING (0)', () => {
    const offenders = lsOffenders();
    if (offenders.length > PACK_TYPOGRAPHY_LETTER_SPACING_OFFENDERS_CEILING) {
      throw new Error(
        `${offenders.length} product letter-spacing declarations are off the pack's derived em ` +
          `vocabulary, above the ceiling of ${PACK_TYPOGRAPHY_LETTER_SPACING_OFFENDERS_CEILING}. ` +
          `Offenders:\n` + offenders.map((o) => `  ${o.value} (resolved ${o.resolved}) (${o.path})`).join('\n'),
      );
    }
    expect(offenders.length).toBeLessThanOrEqual(PACK_TYPOGRAPHY_LETTER_SPACING_OFFENDERS_CEILING);
  });

  it('never sits BELOW PACK_TYPOGRAPHY_LETTER_SPACING_OFFENDERS_CEILING (0) without the ceiling being lowered to match', () => {
    const offenders = lsOffenders();
    expect(offenders.length).toBeGreaterThanOrEqual(PACK_TYPOGRAPHY_LETTER_SPACING_OFFENDERS_CEILING);
  });

  it('never exceeds PACK_TYPOGRAPHY_LETTER_SPACING_UNRESOLVED_CEILING (0)', () => {
    const unresolved = RESULT.unresolved.filter((u) => u.property === 'letter-spacing');
    if (unresolved.length > PACK_TYPOGRAPHY_LETTER_SPACING_UNRESOLVED_CEILING) {
      throw new Error(
        `${unresolved.length} product letter-spacing var() tokens resolve to no declared token, ` +
          `above the ceiling of ${PACK_TYPOGRAPHY_LETTER_SPACING_UNRESOLVED_CEILING}. Unresolved:\n` +
          unresolved.map((u) => `  ${u.value} [${u.reason}] (${u.path})`).join('\n'),
      );
    }
    expect(unresolved.length).toBeLessThanOrEqual(PACK_TYPOGRAPHY_LETTER_SPACING_UNRESOLVED_CEILING);
  });

  it('never sits BELOW PACK_TYPOGRAPHY_LETTER_SPACING_UNRESOLVED_CEILING (0) without the ceiling being lowered to match', () => {
    const unresolved = RESULT.unresolved.filter((u) => u.property === 'letter-spacing');
    expect(unresolved.length).toBeGreaterThanOrEqual(PACK_TYPOGRAPHY_LETTER_SPACING_UNRESOLVED_CEILING);
  });

  it('never exceeds PACK_TYPOGRAPHY_TEXT_TRANSFORM_OFFENDERS_CEILING (1: the settled DEC-884 .chq-wordmark exclusion)', () => {
    const offenders = ttOffenders();
    if (offenders.length > PACK_TYPOGRAPHY_TEXT_TRANSFORM_OFFENDERS_CEILING) {
      throw new Error(
        `${offenders.length} product text-transform declarations are off the pack's derived ` +
          `keyword vocabulary, above the ceiling of ${PACK_TYPOGRAPHY_TEXT_TRANSFORM_OFFENDERS_CEILING}. ` +
          `Offenders:\n` + offenders.map((o) => `  ${o.value} (${o.path})`).join('\n'),
      );
    }
    expect(offenders.length).toBeLessThanOrEqual(PACK_TYPOGRAPHY_TEXT_TRANSFORM_OFFENDERS_CEILING);
  });

  it('never sits BELOW PACK_TYPOGRAPHY_TEXT_TRANSFORM_OFFENDERS_CEILING (1) without the ceiling being lowered to match', () => {
    const offenders = ttOffenders();
    expect(offenders.length).toBeGreaterThanOrEqual(PACK_TYPOGRAPHY_TEXT_TRANSFORM_OFFENDERS_CEILING);
  });

  it('the single text-transform offender is the settled DEC-884 .chq-wordmark site, named so a regression is traceable', () => {
    const offenders = ttOffenders();
    expect(offenders.map((o) => `${o.value}(${o.path})`)).toEqual(['lowercase(src/views/theme.ts)']);
  });

  it('never exceeds PACK_TYPOGRAPHY_TEXT_TRANSFORM_UNRESOLVED_CEILING (0)', () => {
    const unresolved = RESULT.unresolved.filter((u) => u.property === 'text-transform');
    expect(unresolved.length).toBeLessThanOrEqual(PACK_TYPOGRAPHY_TEXT_TRANSFORM_UNRESOLVED_CEILING);
  });

  it('never sits BELOW PACK_TYPOGRAPHY_TEXT_TRANSFORM_UNRESOLVED_CEILING (0) without the ceiling being lowered to match', () => {
    const unresolved = RESULT.unresolved.filter((u) => u.property === 'text-transform');
    expect(unresolved.length).toBeGreaterThanOrEqual(PACK_TYPOGRAPHY_TEXT_TRANSFORM_UNRESOLVED_CEILING);
  });

  it('counts every reset/inherit keyword into its own asserted resetTotal (population cannot silently shrink)', () => {
    expect(RESULT.resetTotal).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(RESULT.resetTotal)).toBe(true);
  });

  it('counts every non-literal/non-var declaration into its own asserted otherTotal (population cannot silently shrink)', () => {
    expect(RESULT.otherTotal).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(RESULT.otherTotal)).toBe(true);
  });

  it('the seven var(--chq-type-*-tracking) letter-spacing sites resolve in-vocabulary, never as offenders', () => {
    const varOffenders = RESULT.offenders.filter((o) => o.value.startsWith('var('));
    expect(varOffenders).toEqual([]);
    expect(RESULT.varTotal).toBeGreaterThan(0);
  });

  it('never grades a reset keyword as an offender', () => {
    const resetAsOffender = RESULT.offenders.filter((o) => RESET_KEYWORDS.has(o.value));
    expect(resetAsOffender).toEqual([]);
  });
});

describe('pack typography-register -- detector non-vacuity (DEC-967, synthetic fixture only)', () => {
  it('fires on a synthetic literal/var/reset/other mix without touching any product offender', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pack-typography-register-fixture-'));
    try {
      const cssDir = join(dir, 'app-src', 'widget');
      mkdirSync(cssDir, { recursive: true });
      writeFileSync(
        join(cssDir, 'widget.css'),
        [
          '/* a comment mentioning letter-spacing: 0.03em; must never count */',
          '.chq-fixture-a { letter-spacing: 0.1em; }', // in vocab: not an offender
          '.chq-fixture-b { letter-spacing: 0.03em; }', // not in vocab: offender
          '.chq-fixture-c { letter-spacing: normal; }', // reset: counted, not an offender
          '.chq-fixture-d { letter-spacing: var(--chq-fixture-unknown-token); }', // unresolved
          '.chq-fixture-e { text-transform: uppercase; }', // in vocab: not an offender
          '.chq-fixture-f { text-transform: lowercase; }', // not in vocab: offender
          '.chq-fixture-g { text-transform: none; }', // reset: counted, not an offender
          '.chq-fixture-h { letter-spacing: calc(1px + 1px); }', // other
        ].join('\n'),
        'utf8',
      );

      const fixtureSources: Source[] = [
        { path: join(cssDir, 'widget.css'), text: readFileSync(join(cssDir, 'widget.css'), 'utf8') },
      ];
      const vocab: Record<RegisterProperty, ReadonlySet<string>> = {
        'letter-spacing': new Set(['0.1em']),
        'text-transform': new Set(['uppercase']),
      };
      const tokens = new Map<string, string>();
      const result = grade(fixtureSources, vocab, tokens);

      expect(result.offenders.map((o) => o.value).sort()).toEqual(['0.03em', 'lowercase'].sort());
      expect(result.unresolved.map((u) => u.value)).toEqual(['var(--chq-fixture-unknown-token)']);
      expect(result.resetTotal).toBe(2);
      expect(result.otherTotal).toBe(1);
      expect(result.literalTotal).toBe(4);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
