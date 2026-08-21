// Pack declaration vocabulary ratchet (DEC-937, wave-20 task w20-a).
//
// DESIGN-RULINGS.md's own opening states the closed test: "anything not
// listed here and not in a frame is improvisation and should be flagged."
// No prior instrument ever asked that question at the level of a bare CSS
// PROPERTY VALUE -- every ledger so far grades a screen, a control label, or
// a caption. This scan grades two properties directly against the pack's
// own declared value set:
//
//   1. POPULATION -- every `font-style: <value>;` and
//      `border-radius: <value>;` declaration in product stylesheets, walked
//      via readdirSync (never a hand-listed file array, DEC-808):
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
//           cut of a variable font), not screen typography -- it is
//           stripped from the population before matching. src/views/theme.ts
//           carries the only two members, both `font-style: normal;`.
//        b. a `border-radius` value that is not a bare `<digits>px` token
//           (a percentage, a keyword, a `var(...)` reference, or a
//           multi-value shorthand) sits outside the pack's px-radius
//           grammar entirely -- it is not evaluated as a px-vocabulary
//           offender, but it IS counted, into its own asserted total below,
//           so the population can never silently shrink by reclassifying a
//           real declaration as "not applicable".
//
//   4. OFFENDER -- a product `font-style` value not in the pack's
//      `font-style` vocabulary (empty, per the vacuous-population tripwire
//      below -- so ANY product `font-style` declaration surviving
//      discriminator (a) is an offender), or a product `border-radius`
//      value that IS a bare `<digits>px` token but that token is not in the
//      pack's derived px-radius vocabulary.
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
import { DEC_937 } from '../src/decisions';
import { ssrCssSources } from './helpers/ssr-css-sources';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..');
const APP_SRC = join(REPO_ROOT, 'app/src');
const DESIGN_DIR = join(REPO_ROOT, 'docs/design');

// Confirms this file's population depends on the ruling it implements
// (compile-checked, per the standing house rule: code depending on
// DEC-NNN must reference its constant).
void DEC_937;

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
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Strips every `@font-face { ... }` block (discriminator (a) above) --
 * these declare a font FILE's own style, not screen typography, and are
 * assumed non-nested (a house-standard, single-level @font-face body). */
function stripFontFace(css: string): string {
  return css.replace(/@font-face\s*\{[^{}]*\}/g, '');
}

interface Declaration {
  readonly value: string;
  readonly path: string;
}

/** Every `property: value;` declaration in `text`, after comment- and
 * @font-face-stripping, value trimmed. */
function findDeclarations(text: string, path: string, property: 'font-style' | 'border-radius'): Declaration[] {
  const cleaned = stripFontFace(stripComments(text));
  // Terminator is `;` for a real CSS rule OR an unescaped quote for an
  // inline `style="..."` attribute (the pack's .dc.html files routinely
  // omit the trailing `;` on the LAST declaration before the closing
  // quote) -- `[^;"']+` stops at whichever comes first.
  const re = new RegExp(`${property}:\\s*([^;"']+)`, 'g');
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

interface Vocabulary {
  readonly fontStyleValues: ReadonlySet<string>;
  readonly fontStyleTotal: number;
  readonly radiusPxVocab: ReadonlySet<string>;
  readonly radiusPxTotal: number;
  readonly radiusOutOfGrammarTotal: number;
}

/** Derives the pack's declared value set for both properties from a set of
 * `.dc.html` sources (or a synthetic fixture with the same shape). */
function deriveVocabulary(sources: readonly ProductSources[]): Vocabulary {
  const fontStyleValues = new Set<string>();
  let fontStyleTotal = 0;
  const radiusPxVocab = new Set<string>();
  let radiusPxTotal = 0;
  let radiusOutOfGrammarTotal = 0;
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
  }
  return { fontStyleValues, fontStyleTotal, radiusPxVocab, radiusPxTotal, radiusOutOfGrammarTotal };
}

interface Offender {
  readonly property: 'font-style' | 'border-radius';
  readonly value: string;
  readonly path: string;
}

/** Finds every product declaration whose value sits outside `vocab`, per
 * the discriminators stated in this file's header comment. */
function findOffenders(sources: readonly ProductSources[], vocab: Vocabulary): Offender[] {
  const out: Offender[] = [];
  for (const s of sources) {
    for (const d of findDeclarations(s.text, s.path, 'font-style')) {
      if (!vocab.fontStyleValues.has(d.value)) {
        out.push({ property: 'font-style', value: d.value, path: d.path });
      }
    }
    for (const d of findDeclarations(s.text, s.path, 'border-radius')) {
      if (!PX_RE.test(d.value)) continue; // discriminator (b): out of grammar, not an offender
      if (!vocab.radiusPxVocab.has(d.value)) {
        out.push({ property: 'border-radius', value: d.value, path: d.path });
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

  it('never exceeds PACK_VOCABULARY_OFFENDERS_CEILING (0) declarations outside the pack vocabulary', () => {
    if (OFFENDERS.length > PACK_VOCABULARY_OFFENDERS_CEILING) {
      throw new Error(
        `${OFFENDERS.length} product font-style/border-radius declarations sit outside the pack's ` +
          `derived vocabulary, above the ceiling of ${PACK_VOCABULARY_OFFENDERS_CEILING}. ` +
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
          '@font-face { font-family: "Fixture"; font-style: italic; }', // discriminated out: not an offender
        ].join('\n'),
      );
      const designDir = join(dir, 'docs-design');
      mkdirSync(designDir, { recursive: true });
      writeFileSync(
        join(designDir, 'Fixture.dc.html'),
        '<div style="border-radius:4px"></div><div style="border-radius:4px"></div>',
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

      const fixtureOffenders = findOffenders(fixtureSources, fixtureVocab);
      expect(fixtureOffenders).toEqual([
        { property: 'font-style', value: 'normal', path: join(cssDir, 'widget.css') },
        { property: 'border-radius', value: '7px', path: join(cssDir, 'widget.css') },
      ]);
      // discriminates the in-vocabulary and out-of-grammar declarations
      // away from the offender list, and the comment-quoted italic away
      // from the population entirely.
      expect(fixtureOffenders.length).toBe(2);
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
