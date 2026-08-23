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
// SCOPE WAVE 29: MEASURE AND RECORD ONLY -- that lane moved no product
// byte. Both ceilings are registered in scripts/exit-predicate.ts's
// OUT_OF_CAMPAIGN_SCOPE (a freshly measured population must not move the
// campaign's convergence goalposts mid-stream, the same disposition
// DESKTOP_FLOOR_DIVERGENCE_CEILING and DRAWN_FIELD_LABEL_DIVERGENCE_CEILING
// already carry).
//
// WAVE 35 (DEC-937 amendment, task w35-e): drained PACK_UNIT_GRAMMAR_
// OFFENDERS_CEILING from 13 to 6. All 7 off-grid font-size sites (each
// desktop-visible, none touching a frame-verdict-pinned selector) were
// repaired to the nearest on-grid computed px, expressed in rem to keep
// user font scaling. All 6 off-grid `gap` sites are LEFT and adjudicated,
// not repaired: 5 sit inside a phone `@media (max-width: …)`
// companion-gap register (DEC-385 single-direction responsive), which
// made them nominally eligible for unconditional repair -- but DEC-937's
// OWN wave-123 amendment already pins their exact value ("the declared
// phone gap becomes the frame's own rendered gap PLUS 2N") and three
// other test files assert it byte-for-byte, so rounding to the px grid
// would silently redraw the frame's own separation and redden a
// different, already-settled DEC-937 ruling. The 6th,
// `app/src/pages/submissions/detail.css`'s desktop `gap: 92px`, is a
// DEC-989 wave-42 measured frame pin; repairing it would move a green
// desktop frame verdict. Every adjudicated row is recorded in
// docs/design/audit/pack-unit-grammar-v12.md. Both ceilings stay in
// scripts/exit-predicate.ts's OUT_OF_CAMPAIGN_SCOPE (unchanged this wave
// -- that disposition is a separate, unruled decision).
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
  readonly line: number;
  /** Nearest enclosing `selector {` above this declaration in the cleaned
   * text, or null if none found -- a fact that survives an edit above the
   * declaration, unlike the line number (wave-56: the merge train moved
   * every RULED_LEFT site's line, none of its selectors). */
  readonly selector: string | null;
}

/** Every `property: value;` declaration in `text`, after shared-stripper
 * comment removal and @font-face stripping, value trimmed. Terminator is
 * `;` for a CSS rule or an unescaped quote for a `style="..."` attribute
 * (the pack's .dc.html files routinely omit the trailing `;` on the last
 * declaration before the closing quote). `line` is the 1-indexed line
 * number in `cleaned` -- valid against the ORIGINAL file because
 * stripCssComments preserves line counts and none of this ratchet's six
 * RULED_LEFT sites sits after an @font-face block (stripFontFace does NOT
 * preserve line counts, so this guarantee is local to those six sites, not
 * a general property of this function). */
function findDeclarations(text: string, path: string, property: GradedProperty): Declaration[] {
  const cleaned = stripFontFace(stripCssComments(text));
  const cleanedLines = cleaned.split('\n');
  const re = new RegExp(`${property}:\\s*([^;"']+)`, 'g');
  const out: Declaration[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned)) !== null) {
    const line = cleaned.slice(0, m.index).split('\n').length;
    const selector = findEnclosingSelector(cleanedLines, line - 1);
    out.push({ property, value: (m[1] as string).trim(), path, line, selector });
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
  readonly line: number;
  readonly selector: string | null;
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
            offenders.push({
              property,
              unit: 'px',
              value: d.value,
              computedPx: d.value,
              path: d.path,
              line: d.line,
              selector: d.selector,
            });
          }
        } else if (REM_RE.test(d.value)) {
          remTotal++;
          const computedPx = computeRemPx(d.value);
          if (!vocab[property].has(computedPx)) {
            offenders.push({
              property,
              unit: 'rem',
              value: d.value,
              computedPx,
              path: d.path,
              line: d.line,
              selector: d.selector,
            });
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

// -- RULED_LEFT (DEC-937/DEC-069 wave-49, task w49-b) ------------------------
// DEC-937 wave-35 amendment drained 7 of the 13 wave-29 offenders (all 7
// off-grid font-size sites, repaired). The remaining 6 -- all `gap` -- are
// each individually LEFT and adjudicated: repair is FORBIDDEN, not merely
// undone, because each site's exact off-grid value is the OUTPUT of a
// standing DEC-937 ruling a passing test pins byte-for-byte, or a DEC-989
// desktop frame-pin measurement. Classified OUT of the offender count here,
// never silently dropped from the population -- each row below is asserted
// (in the resolve-check `it` beneath this table) to still resolve to its
// cited sheet/selector/line/value in the live tree, so a pack re-cut or an
// accidental repair rots this table LOUDLY rather than silently widening
// what "ruled left" covers.
interface RuledLeftRow {
  /** repo-relative CSS sheet path */
  readonly sheetPath: string;
  readonly selector: string;
  readonly value: string;
  /** 1-indexed line of the `gap:` declaration in the CURRENT file */
  readonly line: number;
  readonly ruling: string;
}

const RULED_LEFT: readonly RuledLeftRow[] = [
  {
    sheetPath: 'app/src/pages/comms/comms.css',
    selector: '.chq-comms-editor-actions',
    value: '29px',
    line: 2509,
    ruling:
      "DEC-937 wave-35 amendment (companion-gap: desktop's own 9px + 2*10px cancelled-padding " +
      'compensation, DEC-937 wave-123 "the declared phone gap becomes the frame\'s own rendered gap ' +
      'PLUS 2N, never a bare 2N"), pinned byte-for-byte by app/src/pages/comms/comms-tier2-floor.test.ts.',
  },
  {
    sheetPath: 'app/src/pages/speakers/speakers.css',
    selector: '.chq-speakers-write-failure-actions',
    value: '29px',
    line: 2268,
    ruling:
      'DEC-937 wave-35 amendment (companion-gap: desktop 9px + 2*10px), pinned byte-for-byte by ' +
      'app/src/pages/speakers/speakers-tier2-gap.test.ts.',
  },
  {
    sheetPath: 'app/src/pages/speakers/speakers.css',
    selector: '.chq-speakers-head-actions',
    value: '29px',
    line: 2272,
    ruling:
      'DEC-937 wave-35 amendment (companion-gap: desktop 9px + 2*10px), pinned byte-for-byte by ' +
      'app/src/pages/speakers/speakers-tier2-gap.test.ts.',
  },
  {
    sheetPath: 'app/src/pages/speakers/speakers.css',
    selector: '.chq-speakers-pager-actions',
    value: '29px',
    line: 2276,
    ruling:
      'DEC-937 wave-35 amendment (companion-gap: desktop 9px + 2*10px), pinned byte-for-byte by ' +
      'app/src/pages/speakers/speakers-tier2-gap.test.ts and ' +
      'app/src/pages/speakers/speakers-pager-button-tap-floor.test.ts.',
  },
  {
    sheetPath: 'app/src/pages/speakers/task-view.css',
    selector: '.chq-taskview-actions',
    value: '29px',
    line: 441,
    ruling:
      'DEC-937 wave-35 amendment (companion-gap: desktop 9px + 2*10px), pinned byte-for-byte by ' +
      'app/src/pages/speakers/speakers-tier2-gap.test.ts.',
  },
  {
    sheetPath: 'app/src/pages/submissions/detail.css',
    selector: '.chq-detail-layout',
    value: '92px',
    line: 102,
    ruling:
      'DEC-989 wave-42 amendment, gate-3 desktop-frame-pin clause: frame 02 measured at 1600px -- ' +
      'body 700px + rail 320px + 92px gutter = 1112px, centred. Repairing to the pack\'s nearest ' +
      'drawn gap literal would shrink the rail gutter and move a green desktop frame verdict.',
  },
];

/** Nearest enclosing `selector {` line above `declLineIdx` (0-indexed), by
 * walking upward for a line ending in an open brace with no other brace
 * chars -- the same shape this ratchet's declarations are always drawn in. */
function findEnclosingSelector(lines: readonly string[], declLineIdx: number): string | null {
  for (let i = declLineIdx; i >= 0; i--) {
    const m = /^\s*([^{}]+)\{\s*$/.exec(lines[i] as string);
    if (m) return (m[1] as string).trim();
  }
  return null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** True when `o` matches a RULED_LEFT row (same sheet file, same ENCLOSING
 * SELECTOR, same literal gap value) -- classified OUT of the offender
 * count. Re-keyed wave-56: the merge train moved every RULED_LEFT site's
 * line number while leaving its selector and value untouched, so a
 * line-keyed join went stale under an edit that happened ABOVE the cited
 * declaration. Selector + value survive that edit; line is carried on the
 * row only as a human hint, never matched on. */
function isRuledLeft(o: Offender, ruledLeft: readonly RuledLeftRow[]): boolean {
  return ruledLeft.some(
    (r) =>
      o.property === 'gap' &&
      o.path === join(REPO_ROOT, r.sheetPath) &&
      o.selector === r.selector &&
      o.value === r.value,
  );
}

function classifyOffenders(
  offenders: readonly Offender[],
  ruledLeft: readonly RuledLeftRow[],
): { trueOffenders: Offender[]; ruledLeftMatches: Offender[] } {
  const trueOffenders: Offender[] = [];
  const ruledLeftMatches: Offender[] = [];
  for (const o of offenders) {
    if (isRuledLeft(o, ruledLeft)) ruledLeftMatches.push(o);
    else trueOffenders.push(o);
  }
  return { trueOffenders, ruledLeftMatches };
}

const { trueOffenders: TRUE_OFFENDERS, ruledLeftMatches: RULED_LEFT_MATCHES } = classifyOffenders(
  RESULT.offenders,
  RULED_LEFT,
);

/** Two-sided ratchets (DEC-808 wave-85 amendment shape): raised/lowered
 * only by a merge-train act, never a worker's edit mid-lane. */
// DEC-937/DEC-069 wave-49 (task w49-b): all 6 remaining offenders are
// RULED_LEFT (see table above) -- classification, not repair, drains this
// ceiling to 0. Promoted into the graded campaign registry in the same
// commit (scripts/exit-predicate/campaign-scope.ts: removed from
// OUT_OF_CAMPAIGN_SCOPE and its PARKED_FIDELITY_PROMISES row, appended to
// CAMPAIGN_CONSTANT_NAMES and TIER2_CEILING_NAMES).
export const PACK_UNIT_GRAMMAR_OFFENDERS_CEILING = 0;
export const PACK_UNIT_GRAMMAR_UNRESOLVED_CEILING = 6;

describe('pack size-unit grammar (DEC-937 wave-29)', () => {
  it('derives a non-empty pack source population (vacuous-population tripwire)', () => {
    expect(packSources().length).toBe(13);
  });

  it('derives a non-empty pack px vocabulary for both graded properties', () => {
    expect(PACK_VOCAB['font-size'].size).toBeGreaterThan(0);
    expect(PACK_VOCAB.gap.size).toBeGreaterThan(0);
  });

  it('never exceeds PACK_UNIT_GRAMMAR_OFFENDERS_CEILING (0) off-grid size declarations, after RULED_LEFT classification', () => {
    if (TRUE_OFFENDERS.length > PACK_UNIT_GRAMMAR_OFFENDERS_CEILING) {
      throw new Error(
        `${TRUE_OFFENDERS.length} product font-size/gap declarations compute to a px value outside ` +
          `the pack's derived vocabulary and are not RULED_LEFT, above the ceiling of ` +
          `${PACK_UNIT_GRAMMAR_OFFENDERS_CEILING}. Offenders:\n` +
          TRUE_OFFENDERS.map((o) => `  ${o.property}: ${o.value} (=${o.computedPx}) [${o.unit}] (${o.path}:${o.line})`).join(
            '\n',
          ),
      );
    }
    expect(TRUE_OFFENDERS.length).toBeLessThanOrEqual(PACK_UNIT_GRAMMAR_OFFENDERS_CEILING);
  });

  it('never sits BELOW PACK_UNIT_GRAMMAR_OFFENDERS_CEILING (0) without the ceiling being lowered to match', () => {
    if (TRUE_OFFENDERS.length < PACK_UNIT_GRAMMAR_OFFENDERS_CEILING) {
      throw new Error(
        `${TRUE_OFFENDERS.length} product declarations sit off-grid and un-ruled, below the ceiling of ` +
          `${PACK_UNIT_GRAMMAR_OFFENDERS_CEILING}. A stale ceiling licenses stagnation -- lower it ` +
          `by replacing the line:\n  export const PACK_UNIT_GRAMMAR_OFFENDERS_CEILING = ${TRUE_OFFENDERS.length};`,
      );
    }
    expect(TRUE_OFFENDERS.length).toBeGreaterThanOrEqual(PACK_UNIT_GRAMMAR_OFFENDERS_CEILING);
  });

  it('all 6 raw off-grid gap offenders are classified RULED_LEFT (none remain a true offender)', () => {
    expect(RULED_LEFT_MATCHES.length).toBe(6);
    expect(TRUE_OFFENDERS.filter((o) => o.property === 'gap')).toEqual([]);
  });

  it('RULED_LEFT rows each resolve to their cited sheet/selector/line/value in the current tree (anti-allowlist: a stale row fails loudly, never a bare "adjudicated" string)', () => {
    for (const row of RULED_LEFT) {
      const abs = join(REPO_ROOT, row.sheetPath);
      const lines = readFileSync(abs, 'utf8').split('\n');
      const declLine = lines[row.line - 1] ?? '';
      const valueRe = new RegExp(`gap:\\s*${escapeRegex(row.value)}\\s*;`);
      expect(
        valueRe.test(declLine),
        `${row.sheetPath}:${row.line} no longer declares \`gap: ${row.value}\` (saw: ${JSON.stringify(declLine)})`,
      ).toBe(true);
      const selector = findEnclosingSelector(lines, row.line - 1);
      expect(selector, `${row.sheetPath}:${row.line} -- expected enclosing selector \`${row.selector}\`, found ${JSON.stringify(selector)}`).toBe(
        row.selector,
      );
    }
  });

  it('a positive control: an offender NOT matching any RULED_LEFT row stays a true offender (synthetic fixture, never a live product count)', () => {
    const synthetic: Offender = {
      property: 'gap',
      unit: 'px',
      value: '29px',
      computedPx: '29px',
      path: join(REPO_ROOT, 'app/src/pages/comms/comms.css'),
      line: 1, // not the RULED_LEFT-cited line for this file
      selector: '.chq-comms-not-the-ruled-left-selector', // not the RULED_LEFT-cited selector
    };
    const { trueOffenders, ruledLeftMatches } = classifyOffenders([synthetic], RULED_LEFT);
    expect(trueOffenders).toEqual([synthetic]);
    expect(ruledLeftMatches).toEqual([]);
  });

  it('a synthetic offender matching a RULED_LEFT row (path+selector+value) is classified OUT of the offender count, even at a DIFFERENT line (wave-56: the join is line-blind by design)', () => {
    const row = RULED_LEFT[0] as RuledLeftRow;
    const synthetic: Offender = {
      property: 'gap',
      unit: 'px',
      value: row.value,
      computedPx: row.value,
      path: join(REPO_ROOT, row.sheetPath),
      line: row.line + 500, // deliberately wrong line -- selector+value still match
      selector: row.selector,
    };
    const { trueOffenders, ruledLeftMatches } = classifyOffenders([synthetic], RULED_LEFT);
    expect(trueOffenders).toEqual([]);
    expect(ruledLeftMatches).toEqual([synthetic]);
  });

  it('a synthetic offender at the RIGHT line but WRONG selector is NOT classified RULED_LEFT (line is a hint, never a match key)', () => {
    const row = RULED_LEFT[0] as RuledLeftRow;
    const synthetic: Offender = {
      property: 'gap',
      unit: 'px',
      value: row.value,
      computedPx: row.value,
      path: join(REPO_ROOT, row.sheetPath),
      line: row.line,
      selector: '.chq-some-other-selector',
    };
    const { trueOffenders, ruledLeftMatches } = classifyOffenders([synthetic], RULED_LEFT);
    expect(trueOffenders).toEqual([synthetic]);
    expect(ruledLeftMatches).toEqual([]);
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

  it('names the off-grid rem font-size sites so a regression is traceable (DEC-937 wave-35: all 7 repaired, none remain)', () => {
    const fontSizeOffenders = RESULT.offenders
      .filter((o) => o.property === 'font-size')
      .map((o) => `${o.value}=${o.computedPx}`)
      .sort();
    expect(fontSizeOffenders).toEqual([]);
  });

  it('names the off-grid px/rem gap sites so a regression is traceable (DEC-937 wave-35: all 6 adjudicated LEFT, none repaired -- each is pinned by another DEC-937 ruling or a desktop frame verdict)', () => {
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
        {
          property: 'font-size',
          unit: 'px',
          value: '13px',
          computedPx: '13px',
          path: join(cssDir, 'widget.css'),
          line: 3,
          selector: null,
        },
        {
          property: 'font-size',
          unit: 'rem',
          value: '0.85rem',
          computedPx: '13.6px',
          path: join(cssDir, 'widget.css'),
          line: 5,
          selector: null,
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
