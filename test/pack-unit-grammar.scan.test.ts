// Pack size-unit grammar ratchet (DEC-937 wave-29 amendment, task w29-g).
//
// THE GAP: the pack's entire size grammar is bare px -- font-size takes 27
// distinct px values across the 13 docs/design/*.dc.html frames and gap
// takes 30, with no rem or em anywhere in the pack -- while the product
// declares rem/em font-size and gap literals (src/views/theme.ts's 7x
// `1rem`; src/routes/public/css/agenda.css.ts's 0.85rem/0.8rem;
// cards.css.ts's 0.8rem/1.3rem; programme.css.ts's 0.85rem/1.1rem/0.9rem;
// several 0.8x-0.9x em font-sizes; and gap literals in rem and em).
//
// THE RULING (DEC-937 wave-29): a size declaration is conformant when its
// COMPUTED px value at the 16px root is a value the pack draws for that
// property. `rem` is NOT banned -- `1rem` computes to 16px, which IS in the
// pack's font-size vocabulary, and pinning body copy to px would remove
// user font scaling; `0.85rem` (13.6px) is off-grid and IS the offender.
// An `em` literal, whose computed value depends on an inherited size this
// scan cannot resolve, is UNRESOLVED with that reason NAMED -- never
// silently ok, never an offender by default.
//
// POPULATION (DEC-808, readdirSync recursion, never hand-listed):
//   1. every `*.css` file under app/src/**, plus every SSR CSS module
//      under src/** via test/helpers/ssr-css-sources's ssrCssSources()
//      (that helper's own header explains why a `.css.ts` filename glob
//      is the wrong lens -- it misses src/views/theme.ts, a `.ts` module
//      that carries real rules under a plain-`.ts` name).
//   2. every `font-size:`/`gap:` declaration in that corpus, after
//      stripping comments with the SHARED string-aware
//      test/helpers/strip-css-comments.ts (DEC-613: never a private copy)
//      and stripping `@font-face { ... }` bodies (an asset declaration
//      naming a font FILE's own style, not screen typography -- the same
//      discriminator test/pack-declaration-vocabulary.scan.test.ts uses).
//
// VOCABULARY (derived at test time, never hand-listed): the value set each
// property's inline-style declarations take across the 13 `*.dc.html`
// frame files, restricted to the bare `<digits>px` grammar the pack
// actually draws.
//
// CLASSIFICATION, per declaration:
//   - `<digits>px`   -> px: on-grid if the literal is in the pack's set
//                       for that property, else OFFENDER.
//   - `<digits>rem`  -> computed px = literal * 16; on-grid if that
//                       computed value is in the pack's set, else
//                       OFFENDER (the offender is the off-grid SIZE, never
//                       the unit).
//   - `<digits>em`   -> UNRESOLVED, reason `em-inherits-unresolvable`
//                       (never counted as an offender, never silently ok).
//   - anything else (`var(...)`, `calc(...)`, a bare keyword/`inherit`, or
//     a multi-value shorthand like `16px 20px`) -> counted into its own
//     asserted OTHER total, so the population can never silently shrink
//     by reclassifying a real declaration as "not applicable".
//
// SETTLED EXCLUSIONS: grepped every offender's subject across
// src/decisions-data/ and decisions/ before seeding (DEC-967's "a
// citation is not an assertion" lesson run in the other direction --
// check before declaring, not after). DEC-990 already retuned
// `.chq-prog-title` off its old `1.6rem` to a flat `36px`/`26px` register
// (programme.css.ts's own task-w49-h comment cites it) -- that site is
// gone from the tree and is not among this ratchet's offenders. No
// standing ruling names any of the font-size/gap sites this ratchet finds
// off-grid; none is excluded.
//
// TWO-SIDED (DEC-808 wave-85 amendment): both ceilings fail above AND
// below the measured count. MEASURED by forcing each to -1 in a detached
// run and reading the printed roster back (recorded in
// docs/design/audit/pack-unit-grammar-v12.md, coordinates as bare-path +
// backtick-quote, never `path:line`).
//
// SCOPE THIS WAVE: MEASURE AND RECORD ONLY -- this lane moves no product
// byte. Both ceilings are registered in scripts/exit-predicate.ts's
// OUT_OF_CAMPAIGN_SCOPE (a freshly measured population must not move the
// campaign's convergence goalposts mid-stream, the same disposition
// DESKTOP_FLOOR_DIVERGENCE_CEILING and DRAWN_FIELD_LABEL_DIVERGENCE_CEILING
// already carry) until a later, separately-ruled lane drains it.
//
// NON-VACUITY (DEC-967 waves 103/143): the detector's ability to fire and
// discriminate px/rem/em/other is proved over a SYNTHETIC fixture this
// file writes to a tmpdir, never over a live product offender's identity.

import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
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

type GradedProperty = 'font-size' | 'gap';
const PROPERTIES: readonly GradedProperty[] = ['font-size', 'gap'];

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

function stripFontFace(css: string): string {
  return css.replace(/@font-face\s*\{[^{}]*\}/g, '');
}

interface Declaration {
  readonly property: GradedProperty;
  readonly value: string;
  readonly path: string;
}

/** Every `property: value;` declaration in `text`, after shared-stripper
 * comment removal and @font-face stripping, value trimmed. Terminator is
 * `;` for a CSS rule or an unescaped quote for a `style="..."` attribute
 * (the pack's .dc.html files routinely omit the trailing `;` on the last
 * declaration before the closing quote). */
function findDeclarations(text: string, path: string, property: GradedProperty): Declaration[] {
  const cleaned = stripFontFace(stripCssComments(text));
  const re = new RegExp(`${property}:\\s*([^;"']+)`, 'g');
  const out: Declaration[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned)) !== null) {
    out.push({ property, value: (m[1] as string).trim(), path });
  }
  return out;
}

const PX_RE = /^-?\d+(?:\.\d+)?px$/;
const REM_RE = /^-?\d+(?:\.\d+)?rem$/;
const EM_RE = /^-?\d+(?:\.\d+)?em$/;

/** Pack's derived px vocabulary, per property, restricted to the bare
 * `<digits>px` grammar the frames actually draw. */
function deriveVocabulary(sources: readonly Source[]): Record<GradedProperty, ReadonlySet<string>> {
  const vocab: Record<GradedProperty, Set<string>> = { 'font-size': new Set(), gap: new Set() };
  for (const s of sources) {
    for (const property of PROPERTIES) {
      for (const d of findDeclarations(s.text, s.path, property)) {
        if (PX_RE.test(d.value)) vocab[property].add(d.value);
      }
    }
  }
  return vocab;
}

type OffenderUnit = 'px' | 'rem';
interface Offender {
  readonly property: GradedProperty;
  readonly unit: OffenderUnit;
  readonly value: string;
  readonly computedPx: string;
  readonly path: string;
}

interface Unresolved {
  readonly property: GradedProperty;
  readonly value: string;
  readonly path: string;
  readonly reason: 'em-inherits-unresolvable';
}

interface GradeResult {
  readonly offenders: Offender[];
  readonly unresolved: Unresolved[];
  readonly otherTotal: number;
  readonly pxTotal: number;
  readonly remTotal: number;
}

/** `<digits>rem` -> its computed px string at the 16px root, e.g.
 * `0.85rem` -> `13.6px`, `1rem` -> `16px`. */
function computeRemPx(remValue: string): string {
  const n = parseFloat(remValue.slice(0, -3));
  const px = n * 16;
  return `${Number.isInteger(px) ? px : Math.round(px * 100) / 100}px`;
}

function grade(sources: readonly Source[], vocab: Record<GradedProperty, ReadonlySet<string>>): GradeResult {
  const offenders: Offender[] = [];
  const unresolved: Unresolved[] = [];
  let otherTotal = 0;
  let pxTotal = 0;
  let remTotal = 0;
  for (const s of sources) {
    for (const property of PROPERTIES) {
      for (const d of findDeclarations(s.text, s.path, property)) {
        if (PX_RE.test(d.value)) {
          pxTotal++;
          if (!vocab[property].has(d.value)) {
            offenders.push({ property, unit: 'px', value: d.value, computedPx: d.value, path: d.path });
          }
        } else if (REM_RE.test(d.value)) {
          remTotal++;
          const computedPx = computeRemPx(d.value);
          if (!vocab[property].has(computedPx)) {
            offenders.push({ property, unit: 'rem', value: d.value, computedPx, path: d.path });
          }
        } else if (EM_RE.test(d.value)) {
          unresolved.push({ property, value: d.value, path: d.path, reason: 'em-inherits-unresolvable' });
        } else {
          otherTotal++;
        }
      }
    }
  }
  return { offenders, unresolved, otherTotal, pxTotal, remTotal };
}

const PACK_VOCAB = deriveVocabulary(packSources());
const PRODUCT_SOURCES = productSources();
const RESULT = grade(PRODUCT_SOURCES, PACK_VOCAB);

/** Two-sided ratchets (DEC-808 wave-85 amendment shape): raised/lowered
 * only by a merge-train act, never a worker's edit mid-lane. MEASURE AND
 * RECORD ONLY this wave -- both are also registered in
 * scripts/exit-predicate.ts's OUT_OF_CAMPAIGN_SCOPE, not the campaign's
 * gating lists, until a later lane drains them (see this file's header
 * comment). */
export const PACK_UNIT_GRAMMAR_OFFENDERS_CEILING = 13;
export const PACK_UNIT_GRAMMAR_UNRESOLVED_CEILING = 6;

describe('pack size-unit grammar (DEC-937 wave-29)', () => {
  it('derives a non-empty pack source population (vacuous-population tripwire)', () => {
    expect(packSources().length).toBe(13);
  });

  it('derives a non-empty pack px vocabulary for both graded properties', () => {
    expect(PACK_VOCAB['font-size'].size).toBeGreaterThan(0);
    expect(PACK_VOCAB.gap.size).toBeGreaterThan(0);
  });

  it('never exceeds PACK_UNIT_GRAMMAR_OFFENDERS_CEILING (13) off-grid size declarations', () => {
    if (RESULT.offenders.length > PACK_UNIT_GRAMMAR_OFFENDERS_CEILING) {
      throw new Error(
        `${RESULT.offenders.length} product font-size/gap declarations compute to a px value ` +
          `outside the pack's derived vocabulary, above the ceiling of ` +
          `${PACK_UNIT_GRAMMAR_OFFENDERS_CEILING}. Offenders:\n` +
          RESULT.offenders
            .map((o) => `  ${o.property}: ${o.value} (=${o.computedPx}) [${o.unit}] (${o.path})`)
            .join('\n'),
      );
    }
    expect(RESULT.offenders.length).toBeLessThanOrEqual(PACK_UNIT_GRAMMAR_OFFENDERS_CEILING);
  });

  it('never sits BELOW PACK_UNIT_GRAMMAR_OFFENDERS_CEILING (13) without the ceiling being lowered to match', () => {
    if (RESULT.offenders.length < PACK_UNIT_GRAMMAR_OFFENDERS_CEILING) {
      throw new Error(
        `${RESULT.offenders.length} product declarations sit off-grid, below the ceiling of ` +
          `${PACK_UNIT_GRAMMAR_OFFENDERS_CEILING}. A stale ceiling licenses stagnation -- lower it ` +
          `by replacing the line:\n  export const PACK_UNIT_GRAMMAR_OFFENDERS_CEILING = ${RESULT.offenders.length};`,
      );
    }
    expect(RESULT.offenders.length).toBeGreaterThanOrEqual(PACK_UNIT_GRAMMAR_OFFENDERS_CEILING);
  });

  it('never exceeds PACK_UNIT_GRAMMAR_UNRESOLVED_CEILING (6) em declarations', () => {
    if (RESULT.unresolved.length > PACK_UNIT_GRAMMAR_UNRESOLVED_CEILING) {
      throw new Error(
        `${RESULT.unresolved.length} product font-size/gap declarations are \`em\`, above the ` +
          `unresolved ceiling of ${PACK_UNIT_GRAMMAR_UNRESOLVED_CEILING}. Unresolved:\n` +
          RESULT.unresolved.map((u) => `  ${u.property}: ${u.value} [${u.reason}] (${u.path})`).join('\n'),
      );
    }
    expect(RESULT.unresolved.length).toBeLessThanOrEqual(PACK_UNIT_GRAMMAR_UNRESOLVED_CEILING);
  });

  it('never sits BELOW PACK_UNIT_GRAMMAR_UNRESOLVED_CEILING (6) without the ceiling being lowered to match', () => {
    if (RESULT.unresolved.length < PACK_UNIT_GRAMMAR_UNRESOLVED_CEILING) {
      throw new Error(
        `${RESULT.unresolved.length} product declarations are \`em\`, below the ceiling of ` +
          `${PACK_UNIT_GRAMMAR_UNRESOLVED_CEILING}. Lower it by replacing the line:\n` +
          `  export const PACK_UNIT_GRAMMAR_UNRESOLVED_CEILING = ${RESULT.unresolved.length};`,
      );
    }
    expect(RESULT.unresolved.length).toBeGreaterThanOrEqual(PACK_UNIT_GRAMMAR_UNRESOLVED_CEILING);
  });

  it('counts every non-px/rem/em declaration into its own asserted OTHER total (population cannot silently shrink)', () => {
    // Measured on this branch: var(...)/calc(...)/keyword/multi-value
    // shorthand font-size and gap declarations across the product corpus.
    expect(RESULT.otherTotal).toBe(60);
  });

  it('names the off-grid rem font-size sites so a regression is traceable', () => {
    const fontSizeOffenders = RESULT.offenders
      .filter((o) => o.property === 'font-size')
      .map((o) => `${o.value}=${o.computedPx}`)
      .sort();
    expect(fontSizeOffenders).toEqual(
      ['0.8rem=12.8px', '0.8rem=12.8px', '0.85rem=13.6px', '0.85rem=13.6px', '0.9rem=14.4px', '1.1rem=17.6px', '1.3rem=20.8px'].sort(),
    );
  });

  it('names the off-grid px/rem gap sites so a regression is traceable', () => {
    const gapOffenders = RESULT.offenders
      .filter((o) => o.property === 'gap')
      .map((o) => o.value)
      .sort();
    expect(gapOffenders).toEqual(['29px', '29px', '29px', '29px', '29px', '92px'].sort());
  });

  it('never grades an em declaration as an offender (it is always unresolved, never silently ok)', () => {
    const emAsOffender = RESULT.offenders.filter((o) => EM_RE.test(o.value));
    expect(emAsOffender).toEqual([]);
  });

  it('`1rem` (16px, on-grid) is never an offender -- rem is not banned', () => {
    const remSixteen = RESULT.offenders.filter((o) => o.value === '1rem');
    expect(remSixteen).toEqual([]);
  });
});

describe('pack size-unit grammar -- detector non-vacuity (DEC-967, synthetic fixture only)', () => {
  it('fires on a synthetic px/rem/em/other mix without touching any product offender', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pack-unit-grammar-fixture-'));
    try {
      const cssDir = join(dir, 'app-src', 'widget');
      mkdirSync(cssDir, { recursive: true });
      writeFileSync(
        join(cssDir, 'widget.css'),
        [
          '/* a comment mentioning font-size: 0.85rem; must never count */',
          '.chq-fixture-a { font-size: 16px; }', // in vocab: not an offender
          '.chq-fixture-b { font-size: 13px; }', // not in vocab: px offender
          '.chq-fixture-c { font-size: 1rem; }', // computes to 16px, in vocab: not an offender
          '.chq-fixture-d { font-size: 0.85rem; }', // computes to 13.6px, not in vocab: rem offender
          '.chq-fixture-e { font-size: 0.9em; }', // unresolved, never an offender
          '.chq-fixture-f { gap: var(--chq-fixture-gap); }', // other: not px/rem/em
          '.chq-fixture-g { gap: 16px 20px; }', // multi-value shorthand: other
          '@font-face { font-family: "Fixture"; font-size: 0.85rem; }', // discriminated out
        ].join('\n'),
      );
      const designDir = join(dir, 'docs-design');
      mkdirSync(designDir, { recursive: true });
      writeFileSync(join(designDir, 'Fixture.dc.html'), '<div style="font-size:16px"></div><div style="font-size:16px"></div>');

      const fixtureProductSources: Source[] = listCssFiles(join(dir, 'app-src')).map((path) => ({
        path,
        text: readFileSync(path, 'utf8'),
      }));
      const fixturePackSources: Source[] = readdirSync(designDir, { withFileTypes: true })
        .filter((e) => e.isFile() && e.name.endsWith('.dc.html'))
        .map((e) => ({ path: join(designDir, e.name), text: readFileSync(join(designDir, e.name), 'utf8') }));

      const fixtureVocab = deriveVocabulary(fixturePackSources);
      expect(fixtureVocab['font-size']).toEqual(new Set(['16px']));

      const fixtureResult = grade(fixtureProductSources, fixtureVocab);
      expect(fixtureResult.offenders).toEqual([
        { property: 'font-size', unit: 'px', value: '13px', computedPx: '13px', path: join(cssDir, 'widget.css') },
        {
          property: 'font-size',
          unit: 'rem',
          value: '0.85rem',
          computedPx: '13.6px',
          path: join(cssDir, 'widget.css'),
        },
      ]);
      expect(fixtureResult.unresolved).toEqual([
        {
          property: 'font-size',
          value: '0.9em',
          path: join(cssDir, 'widget.css'),
          reason: 'em-inherits-unresolvable',
        },
      ]);
      // var(...) and the multi-value shorthand both land in OTHER, never
      // silently reclassified out of the population.
      expect(fixtureResult.otherTotal).toBe(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('computeRemPx-shaped sanity: 1rem is 16px and 0.85rem is 13.6px', () => {
    expect(computeRemPx('1rem')).toBe('16px');
    expect(computeRemPx('0.85rem')).toBe('13.6px');
  });

  it('statSync sanity check on a listed file (guards listCssFiles against a broken enumeration)', () => {
    const files = listCssFiles(APP_SRC);
    expect(files.length).toBeGreaterThan(0);
    for (const f of files.slice(0, 3)) {
      expect(statSync(f).isFile()).toBe(true);
    }
  });
});
