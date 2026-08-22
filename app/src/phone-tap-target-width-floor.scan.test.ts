// Width-half tap-floor lens (DEC-393/DEC-808 wave-26, task w26-j).
//
// THE GAP: DESIGN-RULINGS.md:189 rules the 44px floor as `min-height:44px`
// PLUS centred flex PLUS horizontal padding, "because without padding the
// hit box is only as wide as the text". `core.ts`'s `horizontalPaddingNonZero`
// -- the predicate every existing tap-floor scan uses to grade that third
// clause -- passes on ANY non-zero padding value. Proof in-tree:
// `app/src/pages/contacts/contacts.css:1270`'s
// `.chq-contacts-filter-rule-chip-dismiss` gave a bare `✕` `padding-inline:
// 4px` (a ~17px hit box) and passed every ceiling at 0; the repair at
// `contacts.css:1544` (`min-width: 44px`, inside the file's terminal
// `@media (max-width: 700px)` block) is a HAND fix with no instrument
// behind it.
//
// This is a WIDENING lens (DEC-808 protocol): it measures and FILES, it
// never fixes. See `./phone-tap-target-scan/width-floor.ts` for the
// population/predicate and `./phone-tap-target-scan/width-ceiling.ts` for
// the isolated ratchet constant (never a shared-file conflict, same
// precedent as `phone-overflow-scan/starved-track-ceiling.ts`).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  allCssFiles,
  allTsxFiles,
  stripTsxComments,
  tapTargetTagTokens,
} from './phone-tap-target-scan/core.js';
import {
  extractCssTsLiteral,
  ssrCssModuleFiles,
  ssrRouteTsxFiles,
} from './phone-tap-target-scan/ssr.js';
import {
  findGlyphOnlySites,
  findGlyphOnlySitesAcrossFiles,
  findWidthFloorOffenders,
  hasWidthFloor,
  SPA_CLASS_ATTR_RE,
  SPA_HAS_CLASS_ATTR_RE,
  SSR_CLASS_ATTR_RE,
  SSR_HAS_CLASS_ATTR_RE,
  tokenClearsWidthFloor,
} from './phone-tap-target-scan/width-floor.js';
import { WIDTH_FLOOR_OFFENDERS_CEILING } from './phone-tap-target-scan/width-ceiling.js';

const HERE = dirname(fileURLToPath(import.meta.url)); // app/src
const REPO_ROOT = join(HERE, '..', '..');
const ROUTES_ROOT = join(REPO_ROOT, 'src', 'routes');

const SPA_TSX_FILES = allTsxFiles(HERE);
const SPA_CSS_FILES = allCssFiles(HERE);
const SSR_TSX_FILES = ssrRouteTsxFiles(ROUTES_ROOT);
const SSR_CSS_MODULES = ssrCssModuleFiles(join(REPO_ROOT, 'src'));

function allCssTexts(): string[] {
  const spa = SPA_CSS_FILES.map((p) => readFileSync(p, 'utf-8'));
  const ssr = SSR_CSS_MODULES.map((p) => extractCssTsLiteral(readFileSync(p, 'utf-8')));
  return [...spa, ...ssr];
}

function allOffenders(): string[] {
  const spaSites = findGlyphOnlySitesAcrossFiles(SPA_TSX_FILES, REPO_ROOT, SPA_CLASS_ATTR_RE, SPA_HAS_CLASS_ATTR_RE);
  const ssrSites = findGlyphOnlySitesAcrossFiles(SSR_TSX_FILES, REPO_ROOT, SSR_CLASS_ATTR_RE, SSR_HAS_CLASS_ATTR_RE);
  const cssTexts = allCssTexts();
  return findWidthFloorOffenders([...spaSites, ...ssrSites], cssTexts);
}

describe('width-half tap-floor lens (DEC-393/DEC-808 wave-26)', () => {
  it('derives a non-empty population over the real tree (vacuous-population tripwire)', () => {
    expect(SPA_TSX_FILES.length).toBeGreaterThan(5);
    expect(SPA_CSS_FILES.length).toBeGreaterThan(5);
    expect(SSR_TSX_FILES.length).toBeGreaterThan(3);
    expect(SSR_CSS_MODULES.length).toBeGreaterThan(3);
    const spaSites = findGlyphOnlySitesAcrossFiles(
      SPA_TSX_FILES,
      REPO_ROOT,
      SPA_CLASS_ATTR_RE,
      SPA_HAS_CLASS_ATTR_RE,
    );
    expect(spaSites.length).toBeGreaterThan(0);
  }, 20000);

  it('the known-good, already-floored contacts filter-chip dismiss is IN the population and PASSES (a predicate that matches nothing cannot pass green)', () => {
    // The dismiss control's own file is found by walking the real SPA
    // population for the known token, rather than hand-naming its file
    // (forbidden anyway, see the brief).
    const spaSites = findGlyphOnlySitesAcrossFiles(
      SPA_TSX_FILES,
      REPO_ROOT,
      SPA_CLASS_ATTR_RE,
      SPA_HAS_CLASS_ATTR_RE,
    );
    const chip = spaSites.find((s) => s.tokens.includes('chq-contacts-filter-rule-chip-dismiss'));
    expect(chip, `expected a glyph-only site keyed on .chq-contacts-filter-rule-chip-dismiss among:\n${spaSites.map((s) => `${s.file}:${s.line} .${s.tokens.join('.')}`).join('\n')}`).toBeDefined();
    const cssTexts = allCssTexts();
    expect(tokenClearsWidthFloor('chq-contacts-filter-rule-chip-dismiss', cssTexts)).toBe(true);
  }, 20000);

  it('flags a synthetic glyph-only control with padding-only width (positive control)', () => {
    const tsx = `export const X = () => <button className="chq-x-fake-dismiss">✕</button>;`;
    const css = `
      @media (max-width: 700px) {
        .chq-x-fake-dismiss { min-height: 44px; display: flex; align-items: center; padding-inline: 4px; }
      }
    `;
    const sites = findGlyphOnlySites(stripTsxComments(tsx), SPA_CLASS_ATTR_RE, SPA_HAS_CLASS_ATTR_RE);
    expect(sites).toHaveLength(1);
    expect(sites[0]?.reason).toBe('single-glyph');
    expect(sites[0]?.tokens).toEqual(['chq-x-fake-dismiss']);
    expect(tokenClearsWidthFloor('chq-x-fake-dismiss', [css])).toBe(false);
    const offenders = findWidthFloorOffenders(
      sites.map((s) => ({ file: 'fixture.tsx', ...s })),
      [css],
    );
    expect(offenders).toHaveLength(1);
    expect(offenders[0]).toContain('chq-x-fake-dismiss');
  });

  it('does not flag a glyph-only control whose token declares min-width >=44px in a <=700px block (negative control: width floor clears)', () => {
    const css = `
      @media (max-width: 700px) {
        .chq-x-fake-close { min-height: 44px; min-width: 44px; display: flex; align-items: center; padding-inline: 4px; }
      }
    `;
    expect(hasWidthFloor('min-width: 44px')).toBe(true);
    expect(tokenClearsWidthFloor('chq-x-fake-close', [css])).toBe(true);
  });

  it('does not flag a glyph-only control carrying a named tap-floor-exempt comment (negative control: exemption clears)', () => {
    const css = `
      /* tap-floor-exempt: decorative drag handle, chrome not content */
      .chq-x-fake-handle { min-height: 44px; }
    `;
    expect(tokenClearsWidthFloor('chq-x-fake-handle', [css])).toBe(true);
  });

  it('does not include an ordinary text-labelled button in the population (negative control: population precision)', () => {
    const tsx = `export const X = () => <button className="chq-x-fake-save">Save</button>;`;
    const sites = findGlyphOnlySites(stripTsxComments(tsx), SPA_CLASS_ATTR_RE, SPA_HAS_CLASS_ATTR_RE);
    expect(sites).toHaveLength(0);
    // Same control is real population for the base height-floor scan --
    // proof this lens is narrower on purpose, not a hole in the tag grammar.
    expect(tapTargetTagTokens(stripTsxComments(tsx))).toContain('chq-x-fake-save');
  });

  it('does not include a two-letter/word icon button whose glyph is alphanumeric (negative control: single-glyph is non-alphanumeric only)', () => {
    const tsx = `export const X = () => <button className="chq-x-fake-ok">OK</button>;`;
    const sites = findGlyphOnlySites(stripTsxComments(tsx), SPA_CLASS_ATTR_RE, SPA_HAS_CLASS_ATTR_RE);
    expect(sites).toHaveLength(0);
  });

  it('includes an empty control with only an aria-label (positive control: empty-with-aria-label reason)', () => {
    const tsx = `export const X = () => <button className="chq-x-fake-icon" aria-label="Close"></button>;`;
    const sites = findGlyphOnlySites(stripTsxComments(tsx), SPA_CLASS_ATTR_RE, SPA_HAS_CLASS_ATTR_RE);
    expect(sites).toHaveLength(1);
    expect(sites[0]?.reason).toBe('empty-with-aria-label');
  });

  it('excludes a fully empty control with no aria-label at all (outside this population by construction)', () => {
    const tsx = `export const X = () => <button className="chq-x-fake-empty"></button>;`;
    const sites = findGlyphOnlySites(stripTsxComments(tsx), SPA_CLASS_ATTR_RE, SPA_HAS_CLASS_ATTR_RE);
    expect(sites).toHaveLength(0);
  });

  it('stays at or under the width-floor offender ceiling (one-sided ratchet: may only fall)', () => {
    const offenders = allOffenders();
    expect(
      offenders.length,
      `width-floor offenders (${offenders.length}, ceiling ${WIDTH_FLOOR_OFFENDERS_CEILING}):\n${offenders.join('\n')}`,
    ).toBeLessThanOrEqual(WIDTH_FLOOR_OFFENDERS_CEILING);
  }, 30000);

  it(`never falls below the offender ceiling (${WIDTH_FLOOR_OFFENDERS_CEILING}) without the ceiling being lowered to match (a stale ceiling licenses stagnation)`, () => {
    const offenders = allOffenders();
    if (offenders.length < WIDTH_FLOOR_OFFENDERS_CEILING) {
      throw new Error(
        `width-floor offenders (${offenders.length}) fell below the ` +
          `WIDTH_FLOOR_OFFENDERS_CEILING of ${WIDTH_FLOOR_OFFENDERS_CEILING}. This is the ratchet ` +
          `working: offenders got fixed. Lower the ceiling in ` +
          `./phone-tap-target-scan/width-ceiling.ts by replacing the line:\n` +
          `  export const WIDTH_FLOOR_OFFENDERS_CEILING = ${offenders.length};`,
      );
    }
    expect(offenders.length).toBeGreaterThanOrEqual(WIDTH_FLOOR_OFFENDERS_CEILING);
  }, 30000);
});
