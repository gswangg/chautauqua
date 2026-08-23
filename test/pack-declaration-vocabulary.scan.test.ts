// Pack declaration vocabulary ratchet (DEC-937, wave-20 task w20-a; widened
// to font-weight/line-height by DEC-991's wave-29 amendment, task w29-f).
//
// DESIGN-RULINGS.md's own opening states the closed test: "anything not
// listed here and not in a frame is improvisation and should be flagged."
// No prior instrument ever asked that question at the level of a bare CSS
// PROPERTY VALUE -- every ledger so far grades a screen, a control label, or
// a caption. This scan grades four properties directly against the pack's
// own declared value set:
//
//   1. POPULATION -- every `font-style: <value>;`, `border-radius: <value>;`,
//      `font-weight: <value>;` and `line-height: <value>;` declaration in
//      product stylesheets, walked via readdirSync (never a hand-listed file
//      array, DEC-808):
//        a. every *.css file under app/src/**, recursively;
//        b. every SSR CSS module under src/** via
//           test/helpers/ssr-css-sources's ssrCssSources() (mirrors the
//           house idiom named in that helper's own header comment).
//      Comments (`/* ... */`) are stripped from each source's text before
//      matching, so a decision-note comment quoting CSS-shaped text is
//      never mistaken for a real declaration.
//
//   2. VOCABULARY -- derived from `docs/design/*.dc.html` at test time,
//      never hand-listed: the value set each property's inline-style
//      declarations take across the whole pack (readdirSync, DEC-808).
//
//   3. DISCRIMINATORS, stated as discriminators over the population and not
//      as an exclusion list of offenders (DEC-180):
//        a. a declaration inside an `@font-face { ... }` block is an ASSET
//           declaration (it names a font FILE's own style, e.g. the italic
//           cut of a variable font, or the `font-weight: 400 700;` variable-
//           weight RANGE a font file itself covers), not screen typography
//           -- it is stripped from the population before matching.
//           src/views/theme.ts and app/src/styles.css each carry one
//           `@font-face` block with a `font-weight: 400 <max>;` range.
//        b. a `border-radius` value that is not a bare `<digits>px` token
//           (a percentage, a keyword, a `var(...)` reference, or a
//           multi-value shorthand) sits outside the pack's px-radius
//           grammar entirely; likewise a `font-weight` value that is not a
//           bare `<digits>` token (`var(...)`, `inherit`) and a
//           `line-height` value that is not a bare `<digits>` or
//           `<digits>.<digits>` token (`var(...)`, `inherit`) sit outside
//           their respective grammars. None of these three is evaluated as
//           a vocabulary offender, but each IS counted, into its own
//           asserted total below, so the population can never silently
//           shrink by reclassifying a real declaration as "not applicable".
//        c. THE SHORTHAND/CUSTOM-PROPERTY HAZARD: a raw `${property}:`
//           substring search also fires inside a CSS custom property whose
//           OWN NAME happens to end with that property name, e.g.
//           `--chq-type-overview-headline-line-height: 1.2;` (overview.css)
//           ends in the literal substring `line-height:` and would be
//           misread as a `line-height` declaration with value `1.2` --
//           silently correct in this one case (1.2 is in-vocabulary either
//           way) but a false population member in general, and the exact
//           DEC-613 "second copy of a vocabulary" shape if a future custom
//           property's numeric suffix ever drifted out of vocabulary
//           unnoticed. `font: <weight> <size>/<line-height> <family>;`
//           shorthand is the same hazard in the other direction: it never
//           contains the literal substring `font-weight:` or `line-height:`
//           so a naive search both under- and over-counts depending on
//           which malformed substring it happens to catch. Both are closed
//           by one guard: every property match requires a non-word,
//           non-hyphen character (or start-of-string) immediately before
//           the property name (`(?<![\w-])`), so `-headline-line-height:`
//           can never be misread as `line-height:`, and `font-weight`/
//           `line-height` are matched only by their own exact literal
//           name, never as a substring of a longer token. Applied
//           uniformly to all four properties (verified to change nothing
//           for font-style/border-radius: no custom property in this tree
//           ends in either literal).
//
//   4. OFFENDER -- a product declaration whose value survives its
//      property's discriminators (a)-(c) above (i.e. is grammar-eligible)
//      but is not in the pack's derived vocabulary for that property.
//      font-style's pack vocabulary is empty (vacuous-population tripwire),
//      so ANY product `font-style` declaration surviving discriminator (a)
//      is an offender.
//
//   5. SETTLED EXCLUSIONS -- before any measured count becomes a ceiling,
//      every candidate offender's subject is grepped across
//      `src/decisions-data/` and `decisions/` (DEC-991's wave-29 amendment,
//      restating the wave-28 lesson: a new ledger's first measurement is
//      not a ceiling until its rows are checked against standing rulings).
//      A row a standing ruling settles is NOT counted as an offender; it is
//      recorded below in SETTLED_EXCLUSIONS, quoting that ruling VERBATIM,
//      with a resolution guard that throws loudly if the quote stops
//      resolving against the live decision doc (so a future edit to that
//      doc cannot silently strand the exclusion).
//
// RATCHET: PACK_VOCABULARY_OFFENDERS_CEILING is a single exported const,
// two-sided (fails above AND below, printing the exact replacement line --
// the ninth-and-counting saturated-ratchet-lie shape named in the wave-128
// field guide; this one is measured, not `= OFFENDERS.length`).
//
// NON-VACUITY (DEC-967 waves 103/143): the detector's ability to fire and
// discriminate is proved over a SYNTHETIC fixture this file writes to a
// tmpdir, never over a live product offender's identity -- the sentinel-
// eats-its-own-fix trap that has already bitten this campaign three times.
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEC_937, DEC_945, DEC_991 } from '../src/decisions';
import { ssrCssSources } from './helpers/ssr-css-sources';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..');
const APP_SRC = join(REPO_ROOT, 'app/src');
const DESIGN_DIR = join(REPO_ROOT, 'docs/design');

// Confirms this file's population depends on the rulings it implements
// (compile-checked, per the standing house rule: code depending on
// DEC-NNN must reference its constant).
void DEC_937;
void DEC_991;
void DEC_945;

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

/** Strips /* ... *\/ block comments so a comment quoting CSS-shaped text is
 * never mistaken for a real declaration. */
// v12m-w26-f (DEC-374 amendment): NOT converted to the shared, string-aware
// stripCssComments. productSources() composes ssrCssSources(), which reads
// every SSR `*_CSS`-exporting module whole-file -- raw TypeScript source,
// not extracted CSS-string content -- the same tool-input-domain hazard
// recorded in test/disabled-token-uses.scan.test.ts's carve-out note.
// Converting this call site was tried live: PACK_VOCAB (derived only from
// docs/design/*.dc.html, unaffected by this hazard) stayed correct, but the
// hazard is real and unmeasured for the PRODUCT side (src/routes/**/*.ts
// via ssrCssSources) -- several members of that population (e.g.
// src/routes/review/reviewer.ts) collapse to a small fraction of their real
// length under the shared stripper, per this wave's population-wide
// measurement. Left as the plain regex, which has no quote-tracking to
// desync, rather than risk a silent false negative in OFFENDERS.
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Strips every `@font-face { ... }` block (discriminator (a) above) --
 * these declare a font FILE's own style, not screen typography, and are
 * assumed non-nested (a house-standard, single-level @font-face body). */
function stripFontFace(css: string): string {
  return css.replace(/@font-face\s*\{[^{}]*\}/g, '');
}

type Property = 'font-style' | 'border-radius' | 'font-weight' | 'line-height';

interface Declaration {
  readonly value: string;
  readonly path: string;
}

/** Every `property: value;` declaration in `text`, after comment- and
 * @font-face-stripping, value trimmed. Discriminator (c) above: the
 * `(?<![\w-])` lookbehind requires the property name not be the tail of a
 * longer identifier (a custom property like
 * `--chq-type-overview-headline-line-height`), so a custom property whose
 * OWN NAME happens to end in a graded property's name is never misread as a
 * declaration of that property. */
function findDeclarations(text: string, path: string, property: Property): Declaration[] {
  const cleaned = stripFontFace(stripComments(text));
  // Terminator is `;` for a real CSS rule OR an unescaped quote for an
  // inline `style="..."` attribute (the pack's .dc.html files routinely
  // omit the trailing `;` on the LAST declaration before the closing
  // quote) -- `[^;"']+` stops at whichever comes first.
  const re = new RegExp(`(?<![\\w-])${property}:\\s*([^;"']+)`, 'g');
  const out: Declaration[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned)) !== null) {
    out.push({ value: (m[1] as string).trim(), path });
  }
  return out;
}

interface ProductSources {
  readonly path: string;
  readonly text: string;
}

/** app/src/**\/*.css plus every SSR CSS module under src/** (DEC-808). */
function productSources(): ProductSources[] {
  const app = listCssFiles(APP_SRC).map((path) => ({ path, text: readFileSync(path, 'utf8') }));
  const ssr = ssrCssSources().map((s) => ({ path: s.path, text: s.text }));
  return [...app, ...ssr];
}

/** Every `*.dc.html` file under docs/design, enumerated (DEC-808). */
function packSources(): ProductSources[] {
  const out: ProductSources[] = [];
  for (const entry of readdirSync(DESIGN_DIR, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.dc.html')) {
      const path = join(DESIGN_DIR, entry.name);
      out.push({ path, text: readFileSync(path, 'utf8') });
    }
  }
  return out;
}

const PX_RE = /^\d+px$/;
// Grammar (discriminator (b) above): font-weight is a bare integer token;
// line-height is a bare integer or decimal token (both unitless, per CSS
// and per every literal the pack itself draws -- measured: {400..800} for
// font-weight, {1, 1.04 ... 1.7} for line-height).
const WEIGHT_RE = /^\d+$/;
const LINE_HEIGHT_RE = /^\d+(?:\.\d+)?$/;

interface Vocabulary {
  readonly fontStyleValues: ReadonlySet<string>;
  readonly fontStyleTotal: number;
  readonly radiusPxVocab: ReadonlySet<string>;
  readonly radiusPxTotal: number;
  readonly radiusOutOfGrammarTotal: number;
  readonly weightVocab: ReadonlySet<string>;
  readonly weightTotal: number;
  readonly weightOutOfGrammarTotal: number;
  readonly lineHeightVocab: ReadonlySet<string>;
  readonly lineHeightTotal: number;
  readonly lineHeightOutOfGrammarTotal: number;
}

/** Derives the pack's declared value set for all four properties from a set
 * of `.dc.html` sources (or a synthetic fixture with the same shape). */
function deriveVocabulary(sources: readonly ProductSources[]): Vocabulary {
  const fontStyleValues = new Set<string>();
  let fontStyleTotal = 0;
  const radiusPxVocab = new Set<string>();
  let radiusPxTotal = 0;
  let radiusOutOfGrammarTotal = 0;
  const weightVocab = new Set<string>();
  let weightTotal = 0;
  let weightOutOfGrammarTotal = 0;
  const lineHeightVocab = new Set<string>();
  let lineHeightTotal = 0;
  let lineHeightOutOfGrammarTotal = 0;
  for (const s of sources) {
    for (const d of findDeclarations(s.text, s.path, 'font-style')) {
      fontStyleValues.add(d.value);
      fontStyleTotal++;
    }
    for (const d of findDeclarations(s.text, s.path, 'border-radius')) {
      if (PX_RE.test(d.value)) {
        radiusPxVocab.add(d.value);
        radiusPxTotal++;
      } else {
        radiusOutOfGrammarTotal++;
      }
    }
    for (const d of findDeclarations(s.text, s.path, 'font-weight')) {
      if (WEIGHT_RE.test(d.value)) {
        weightVocab.add(d.value);
        weightTotal++;
      } else {
        weightOutOfGrammarTotal++;
      }
    }
    for (const d of findDeclarations(s.text, s.path, 'line-height')) {
      if (LINE_HEIGHT_RE.test(d.value)) {
        lineHeightVocab.add(d.value);
        lineHeightTotal++;
      } else {
        lineHeightOutOfGrammarTotal++;
      }
    }
  }
  return {
    fontStyleValues,
    fontStyleTotal,
    radiusPxVocab,
    radiusPxTotal,
    radiusOutOfGrammarTotal,
    weightVocab,
    weightTotal,
    weightOutOfGrammarTotal,
    lineHeightVocab,
    lineHeightTotal,
    lineHeightOutOfGrammarTotal,
  };
}

interface Offender {
  readonly property: Property;
  readonly value: string;
  readonly path: string;
}

interface SettledExclusion {
  readonly property: Property;
  readonly value: string;
  /** Repo-relative paths of the ONLY sites this settlement covers -- scoped
   * by site, not just by value, so a coincidentally-identical value showing
   * up at a NEW, un-ruled site is never silently swept in under an old
   * ruling's name (that would be a vocabulary hole the settlement itself
   * creates). */
  readonly paths: readonly string[];
  /** The exact decision-doc file the verbatim quote must resolve against. */
  readonly decisionDoc: string;
  /** The verbatim quote from that doc backing the settlement. */
  readonly quote: string;
}

/** Rows a standing ruling already settles (point 5 of the header comment)
 * -- never counted as offenders. Each quote is checked to still resolve
 * against its decision doc by a describe block below (a resolution guard:
 * if the doc is ever edited to drop this quote, the guard throws loudly
 * rather than let the exclusion silently outlive its own citation). */
const SETTLED_EXCLUSIONS: readonly SettledExclusion[] = [
  {
    property: 'line-height',
    value: '1.63',
    paths: ['app/src/pages/not-found.css', 'src/routes/auth.css.ts'],
    decisionDoc: 'decisions/DEC-945.md',
    quote: '28px title, 15px/1.63 body, links in one flex row',
  },
];

function isSettled(property: Property, value: string, path: string): boolean {
  return SETTLED_EXCLUSIONS.some(
    (e) => e.property === property && e.value === value && e.paths.some((p) => path.endsWith(p)),
  );
}

/** Finds every product declaration whose value sits outside `vocab`, per
 * the discriminators stated in this file's header comment, excluding rows
 * SETTLED_EXCLUSIONS already dispositions. */
function findOffenders(sources: readonly ProductSources[], vocab: Vocabulary): Offender[] {
  const out: Offender[] = [];
  for (const s of sources) {
    for (const d of findDeclarations(s.text, s.path, 'font-style')) {
      if (isSettled('font-style', d.value, d.path)) continue;
      if (!vocab.fontStyleValues.has(d.value)) {
        out.push({ property: 'font-style', value: d.value, path: d.path });
      }
    }
    for (const d of findDeclarations(s.text, s.path, 'border-radius')) {
      if (!PX_RE.test(d.value)) continue; // discriminator (b): out of grammar, not an offender
      if (isSettled('border-radius', d.value, d.path)) continue;
      if (!vocab.radiusPxVocab.has(d.value)) {
        out.push({ property: 'border-radius', value: d.value, path: d.path });
      }
    }
    for (const d of findDeclarations(s.text, s.path, 'font-weight')) {
      if (!WEIGHT_RE.test(d.value)) continue; // discriminator (b): out of grammar, not an offender
      if (isSettled('font-weight', d.value, d.path)) continue;
      if (!vocab.weightVocab.has(d.value)) {
        out.push({ property: 'font-weight', value: d.value, path: d.path });
      }
    }
    for (const d of findDeclarations(s.text, s.path, 'line-height')) {
      if (!LINE_HEIGHT_RE.test(d.value)) continue; // discriminator (b): out of grammar, not an offender
      if (isSettled('line-height', d.value, d.path)) continue;
      if (!vocab.lineHeightVocab.has(d.value)) {
        out.push({ property: 'line-height', value: d.value, path: d.path });
      }
    }
  }
  return out;
}

const PACK_VOCAB = deriveVocabulary(packSources());
const PRODUCT_SOURCES = productSources();
const OFFENDERS = findOffenders(PRODUCT_SOURCES, PACK_VOCAB);
/** Two-sided ratchet (DEC-976/DEC-967 shape used by every prior ledger in
 * this campaign): raised only by a merge-train act, never a worker's edit
 * mid-lane; a stale ceiling below the measured count licenses stagnation
 * exactly as much as one above it licenses regression. */
export const PACK_VOCABULARY_OFFENDERS_CEILING = 0;

describe('pack declaration vocabulary (DEC-937)', () => {
  it('derives a non-empty pack source population (vacuous-population tripwire)', () => {
    expect(packSources().length).toBe(13);
  });

  it('derives the pack font-style vocabulary as the empty set', () => {
    expect(PACK_VOCAB.fontStyleValues).toEqual(new Set());
    expect(PACK_VOCAB.fontStyleTotal).toBe(0);
  });

  it('derives the pack border-radius px vocabulary exactly', () => {
    expect(PACK_VOCAB.radiusPxVocab).toEqual(new Set(['3px', '4px', '5px', '6px', '8px', '20px', '99px']));
    // Measured on this branch: 1193 literal <digits>px border-radius
    // declarations across the 13 frame files, plus 39 declarations (all
    // `border-radius:50%`) that sit outside the px grammar entirely --
    // discriminator (b) above counts them here rather than dropping them.
    expect(PACK_VOCAB.radiusPxTotal).toBe(1193);
    expect(PACK_VOCAB.radiusOutOfGrammarTotal).toBe(39);
  });

  it('derives the pack font-weight vocabulary exactly (DEC-991 wave-29)', () => {
    expect(PACK_VOCAB.weightVocab).toEqual(new Set(['400', '500', '600', '700', '800']));
    // Measured on this branch: 2556 literal <digits> font-weight
    // declarations across the 13 frame files; zero out-of-grammar (the
    // pack's inline styles never carry a `font-weight: var(...)` or
    // `font-weight: inherit`) -- asserted explicitly so a future frame
    // edit introducing one can't silently vanish from this population.
    expect(PACK_VOCAB.weightTotal).toBe(2556);
    expect(PACK_VOCAB.weightOutOfGrammarTotal).toBe(0);
  });

  it('derives the pack line-height vocabulary exactly (DEC-991 wave-29)', () => {
    expect(PACK_VOCAB.lineHeightVocab).toEqual(
      new Set([
        '1',
        '1.04',
        '1.05',
        '1.06',
        '1.07',
        '1.08',
        '1.1',
        '1.15',
        '1.2',
        '1.25',
        '1.3',
        '1.35',
        '1.4',
        '1.45',
        '1.5',
        '1.55',
        '1.6',
        '1.65',
        '1.7',
      ]),
    );
    // Measured on this branch: 658 literal <digits>[.<digits>] line-height
    // declarations across the 13 frame files; zero out-of-grammar.
    expect(PACK_VOCAB.lineHeightTotal).toBe(658);
    expect(PACK_VOCAB.lineHeightOutOfGrammarTotal).toBe(0);
  });

  it('never exceeds PACK_VOCABULARY_OFFENDERS_CEILING (0) declarations outside the pack vocabulary', () => {
    if (OFFENDERS.length > PACK_VOCABULARY_OFFENDERS_CEILING) {
      throw new Error(
        `${OFFENDERS.length} product font-style/border-radius/font-weight/line-height declarations sit ` +
          `outside the pack's derived vocabulary, above the ceiling of ${PACK_VOCABULARY_OFFENDERS_CEILING}. ` +
          `PACK_VOCABULARY_OFFENDERS_CEILING may only be RAISED (a merge-train act, never a worker's ` +
          `edit mid-lane), and only alongside a DESIGN-RULINGS.md/DEVIATIONS.md entry blessing the new ` +
          `value. Offenders:\n` +
          OFFENDERS.map((o) => `  ${o.property}: ${o.value} (${o.path})`).join('\n'),
      );
    }
    expect(OFFENDERS.length).toBeLessThanOrEqual(PACK_VOCABULARY_OFFENDERS_CEILING);
  });

  it('never sits BELOW PACK_VOCABULARY_OFFENDERS_CEILING (0) without the ceiling being lowered to match', () => {
    if (OFFENDERS.length < PACK_VOCABULARY_OFFENDERS_CEILING) {
      throw new Error(
        `${OFFENDERS.length} product declarations sit outside the pack vocabulary, below the ceiling ` +
          `of ${PACK_VOCABULARY_OFFENDERS_CEILING}. A stale ceiling licenses stagnation -- lower it by ` +
          `replacing the line:\n  export const PACK_VOCABULARY_OFFENDERS_CEILING = ${OFFENDERS.length};`,
      );
    }
    expect(OFFENDERS.length).toBeGreaterThanOrEqual(PACK_VOCABULARY_OFFENDERS_CEILING);
  });

  it('names the drained sites so a regression is traceable (font-style: italic)', () => {
    const italicPaths = OFFENDERS.filter((o) => o.property === 'font-style').map((o) => o.path);
    expect(italicPaths).toEqual([]);
  });

  it('names the drained sites so a regression is traceable (border-radius 999px/2px)', () => {
    const radiusOffenders = OFFENDERS.filter((o) => o.property === 'border-radius');
    expect(radiusOffenders).toEqual([]);
  });

  it('names the drained sites so a regression is traceable (font-weight: 900)', () => {
    // app/src/pages/contacts/contacts-panels.css's .chq-contacts-pipeline-
    // card-age-stale drew 900 (measured at main b2157a6e2); `Chautauqua
    // Contacts.dc.html`'s own AGE_STALE constant draws 800 for this exact
    // chip, so the pack's own vocabulary IS the frame's demand -- the
    // product byte moved to 800 rather than becoming a recorded offender
    // (docs/design/audit/pack-weight-leading-v12.md).
    const weightOffenders = OFFENDERS.filter((o) => o.property === 'font-weight');
    expect(weightOffenders).toEqual([]);
  });

  it('names the drained sites so a regression is traceable (line-height offenders beyond the settled 1.63)', () => {
    const lineHeightOffenders = OFFENDERS.filter((o) => o.property === 'line-height');
    expect(lineHeightOffenders).toEqual([]);
  });

  it('measures the product font-weight/line-height grammar totals exactly, so neither population can shrink silently', () => {
    let weightBare = 0;
    let weightOutOfGrammar = 0;
    let lineHeightBare = 0;
    let lineHeightOutOfGrammar = 0;
    for (const s of PRODUCT_SOURCES) {
      for (const d of findDeclarations(s.text, s.path, 'font-weight')) {
        if (WEIGHT_RE.test(d.value)) weightBare++;
        else weightOutOfGrammar++;
      }
      for (const d of findDeclarations(s.text, s.path, 'line-height')) {
        if (LINE_HEIGHT_RE.test(d.value)) lineHeightBare++;
        else lineHeightOutOfGrammar++;
      }
    }
    // Measured on this branch: 578 bare-integer font-weight declarations
    // (400/500/600/700/800, all in-vocabulary) plus 15 out-of-grammar
    // (`var(--chq-type-*-weight)` design-token references and two bare
    // `inherit`), and 174 bare line-height declarations (172 in-vocabulary
    // plus the 2 SETTLED `1.63` occurrences -- see wave-56 note below for
    // the site that grew this population from 173) plus 2 out-of-grammar
    // (one `var(--chq-type-overview-headline-line-height)`, one `inherit`).
    //
    // 576 -> 577 at the wave-31 merge train: task v12m-w31-a built the two
    // unbuilt v12 phone frame elements on Review "Plan editor · 390"
    // (DEC-745 wave-31 amendment) and its new phone-eyebrow rule in
    // app/src/pages/review/review.css declares one `font-weight: 800` --
    // an IN-vocabulary weight, so the total rises by exactly one and
    // `weightOutOfGrammar` is unmoved.
    //
    // 577 -> 578 (wave-36, task w36-b, DEC-937 amendment): re-measured while
    // re-deriving DEC-937's own stale citations; the merge train landed a
    // further in-vocabulary `font-weight` declaration somewhere in
    // PRODUCT_SOURCES between the two waves. Read directly off the scan
    // (`weightBare` above), never arithmetic from the prior pin. This total
    // is a two-sided exact count by design (neither population may shrink
    // silently), so it is re-measured, not relaxed, when a lane legitimately
    // adds a declaration.
    //
    // 173 -> 174 (wave-56, task w56-h): the landed v12 speakers reminder
    // card sign-off (`app/src/pages/speakers/speakers.css`'s
    // `.chq-speakers-remind-card-signature`, v12 frame :531) declares
    // `font-size: 15px; line-height: 1.6;` -- `1.6` is already in the
    // pack's derived line-height vocabulary (drawn elsewhere in this same
    // sheet), so the new declaration is IN-grammar and IN-vocabulary, never
    // an offender; it simply widens the counted population by one. Found by
    // diffing `git diff cd254baa7..HEAD` (the wave-29 commit that minted
    // this pin) for added `line-height:` declarations in product CSS, never
    // guessed.
    expect(weightBare).toBe(578);
    expect(weightOutOfGrammar).toBe(15);
    expect(lineHeightBare).toBe(174);
    expect(lineHeightOutOfGrammar).toBe(2);
  });
});

describe('pack declaration vocabulary -- SETTLED exclusions resolve against their own citation (DEC-991 wave-29)', () => {
  it('every SETTLED_EXCLUSIONS quote still resolves verbatim against its decision doc (resolution guard)', () => {
    expect(SETTLED_EXCLUSIONS.length).toBeGreaterThan(0);
    for (const exclusion of SETTLED_EXCLUSIONS) {
      const docPath = join(REPO_ROOT, exclusion.decisionDoc);
      const docText = readFileSync(docPath, 'utf8');
      if (!docText.includes(exclusion.quote)) {
        throw new Error(
          `SETTLED_EXCLUSIONS quote for ${exclusion.property}: ${exclusion.value} no longer resolves ` +
            `verbatim against ${exclusion.decisionDoc}. The doc changed under this exclusion -- re-derive ` +
            `the disposition from the live doc before trusting this settlement. Quote was:\n  "${exclusion.quote}"`,
        );
      }
    }
  });

  it('a settled line-height value is excluded from OFFENDERS but is still a real, counted product declaration', () => {
    const settledSites = PRODUCT_SOURCES.flatMap((s) => findDeclarations(s.text, s.path, 'line-height')).filter(
      (d) => d.value === '1.63',
    );
    // ssrCssSources() paths are repo-relative (see its own header comment);
    // app/src/**/*.css paths are absolute (listCssFiles's own contract) --
    // this scan's SETTLED_EXCLUSIONS.paths uses `endsWith`, so both forms
    // resolve against the same repo-relative suffix regardless.
    expect(settledSites.map((d) => d.path).sort()).toEqual(
      [join(APP_SRC, 'pages/not-found.css'), 'src/routes/auth.css.ts'].sort(),
    );
    expect(OFFENDERS.some((o) => o.property === 'line-height' && o.value === '1.63')).toBe(false);
  });
});

describe('pack declaration vocabulary -- detector non-vacuity (DEC-967, synthetic fixture only)', () => {
  it('fires on a synthetic in-vocabulary/out-of-vocabulary mix without touching any product offender', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pack-vocab-fixture-'));
    try {
      const cssDir = join(dir, 'app-src', 'widget');
      mkdirSync(cssDir, { recursive: true });
      writeFileSync(
        join(cssDir, 'widget.css'),
        [
          '/* a comment mentioning font-style: italic; must never count */',
          '.chq-fixture-a { border-radius: 4px; }', // in vocab: not an offender
          '.chq-fixture-b { border-radius: 7px; }', // not in vocab: offender
          '.chq-fixture-c { border-radius: 50%; }', // out of grammar: not an offender, not counted as in-vocab
          '.chq-fixture-d { font-style: normal; }', // not in (empty) vocab: offender
          '@font-face { font-family: "Fixture"; font-style: italic; font-weight: 400 700; }', // discriminated out: not an offender (either property)
          '.chq-fixture-e { font-weight: 700; }', // in vocab: not an offender
          '.chq-fixture-f { font-weight: 900; }', // not in vocab: offender
          '.chq-fixture-g { font-weight: var(--fixture-weight); }', // out of grammar: not an offender
          '.chq-fixture-h { line-height: 1.5; }', // in vocab: not an offender
          '.chq-fixture-i { line-height: 1.63; }', // not in vocab: offender (nothing settles it in this fixture)
          // discriminator (c) hazard: a custom property whose OWN NAME ends
          // in the graded property's name must never be misread as a
          // declaration of that property -- 1.99 is not in the fixture pack
          // vocabulary, so if the lookbehind guard were missing this would
          // wrongly surface as a `line-height: 1.99` offender.
          '.chq-fixture-j { --chq-fixture-widget-line-height: 1.99; }',
        ].join('\n'),
      );
      const designDir = join(dir, 'docs-design');
      mkdirSync(designDir, { recursive: true });
      writeFileSync(
        join(designDir, 'Fixture.dc.html'),
        '<div style="border-radius:4px; font-weight:700; line-height:1.5"></div>' +
          '<div style="border-radius:4px; font-weight:700; line-height:1.5"></div>',
      );

      const fixtureSources: ProductSources[] = listCssFiles(join(dir, 'app-src')).map((path) => ({
        path,
        text: readFileSync(path, 'utf8'),
      }));
      const fixturePackSources: ProductSources[] = readdirSync(designDir, { withFileTypes: true })
        .filter((e) => e.isFile() && e.name.endsWith('.dc.html'))
        .map((e) => ({ path: join(designDir, e.name), text: readFileSync(join(designDir, e.name), 'utf8') }));

      const fixtureVocab = deriveVocabulary(fixturePackSources);
      expect(fixtureVocab.fontStyleValues).toEqual(new Set());
      expect(fixtureVocab.radiusPxVocab).toEqual(new Set(['4px']));
      expect(fixtureVocab.weightVocab).toEqual(new Set(['700']));
      expect(fixtureVocab.lineHeightVocab).toEqual(new Set(['1.5']));

      const fixtureOffenders = findOffenders(fixtureSources, fixtureVocab);
      expect(fixtureOffenders).toEqual([
        { property: 'font-style', value: 'normal', path: join(cssDir, 'widget.css') },
        { property: 'border-radius', value: '7px', path: join(cssDir, 'widget.css') },
        { property: 'font-weight', value: '900', path: join(cssDir, 'widget.css') },
        { property: 'line-height', value: '1.63', path: join(cssDir, 'widget.css') },
      ]);
      // discriminates the in-vocabulary, out-of-grammar, @font-face-asset,
      // and custom-property-collision declarations away from the offender
      // list, and the comment-quoted italic away from the population
      // entirely -- including the SETTLED-shape 1.63 value, which IS an
      // offender in this fixture because nothing here settles it (the real
      // product SETTLED_EXCLUSIONS entry is exercised separately above).
      expect(fixtureOffenders.length).toBe(4);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('statSync sanity check on a listed file (guards listCssFiles against a broken enumeration)', () => {
    const files = listCssFiles(APP_SRC);
    expect(files.length).toBeGreaterThan(0);
    for (const f of files.slice(0, 3)) {
      expect(statSync(f).isFile()).toBe(true);
    }
  });
});
