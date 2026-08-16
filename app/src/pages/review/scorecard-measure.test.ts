// DEC-939 (wave-57 amendment): the scorecard grid's two tracks + gap are an
// exact-sum identity against the page root's --chq-measure-wide token, not
// an independent ruler reading (820 + 300 + 60 = 1180). This test parses
// the reading track's max-width, the rail track's width and the gap out of
// scorecard.css, and --chq-measure-wide out of styles.css -- never
// hand-typed literals repeated in the assertion -- and asserts the derived
// sum equals the token. It also guards that each of the four numbers was
// actually found (a regex that silently matched nothing must fail loudly),
// and that the 900px single-column collapse rule still exists.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_SRC = join(HERE, '..', '..');
const SCORECARD_CSS = readFileSync(join(HERE, 'scorecard.css'), 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');
const STYLES_CSS = readFileSync(join(APP_SRC, 'styles.css'), 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');

function ruleBody(css: string, selector: string): string {
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = ruleRe.exec(css)) !== null) {
    if (m[1]!.trim() === selector) return m[2]!;
  }
  throw new Error(`selector not found: ${selector}`);
}

function requireMatch(source: string, re: RegExp, label: string): RegExpMatchArray {
  const m = source.match(re);
  if (!m) throw new Error(`expected to find ${label} but the pattern matched nothing`);
  return m;
}

function parseNumber(m: RegExpMatchArray, label: string): number {
  const raw = m[1];
  if (raw === undefined) throw new Error(`expected a captured number for ${label}`);
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`captured value for ${label} is not a finite number: ${raw}`);
  return n;
}

describe('scorecard grid measure arithmetic (DEC-939 wave-57 amendment)', () => {
  const gridBody = ruleBody(SCORECARD_CSS, '.chq-review-scorecard-grid');

  it('reading track max-width + rail track width + gap === --chq-measure-wide (derived identity)', () => {
    const columnsMatch = requireMatch(
      gridBody,
      /grid-template-columns:\s*minmax\(0,\s*(\d+)px\)\s+(\d+)px\s*;/,
      'grid-template-columns minmax(0, <reading>px) <rail>px'
    );
    const readingMax = parseNumber(columnsMatch, 'reading track max-width');
    const railWidthRaw = columnsMatch[2];
    if (railWidthRaw === undefined) throw new Error('expected a captured number for rail track width');
    const railWidth = Number(railWidthRaw);
    if (!Number.isFinite(railWidth)) throw new Error('rail track width is not a finite number');

    const gapMatch = requireMatch(gridBody, /gap:\s*(\d+)px\s*;/, 'grid gap');
    const gap = parseNumber(gapMatch, 'grid gap');

    const measureMatch = requireMatch(
      STYLES_CSS,
      /--chq-measure-wide:\s*(\d+)px\s*;/,
      '--chq-measure-wide token'
    );
    const measureWide = parseNumber(measureMatch, '--chq-measure-wide');

    // Guard: every one of the four numbers must have actually been found
    // (a regex that silently matched nothing would produce NaN/undefined
    // and must fail loudly above, not pass vacuously here).
    expect([readingMax, railWidth, gap, measureWide].every((n) => Number.isFinite(n))).toBe(true);

    expect(readingMax + railWidth + gap).toBe(measureWide);
  });

  it('still collapses to a single column at 900px', () => {
    const mediaBlockMatch = requireMatch(
      SCORECARD_CSS,
      /@media \(max-width:\s*900px\)\s*\{\s*\.chq-review-scorecard-grid\s*\{\s*grid-template-columns:\s*1fr\s*;\s*\}\s*\}/,
      '900px single-column collapse media query'
    );
    expect(mediaBlockMatch[0]).toContain('grid-template-columns: 1fr');
  });
});
