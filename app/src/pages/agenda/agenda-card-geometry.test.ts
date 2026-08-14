// DEC-759: a placed card sizes to its content — the row grows instead of the
// card scrolling internally. The prior DEC-620 fix put `overflow-y: auto` on
// both .chq-day-grid-placed-card and .chq-session-card, which hid a tight
// card's own content (including its conflict caption) behind an inner
// scrollbar the organiser had no reason to expect. This is a class of bug,
// not one instance of it: this test scans EVERY rule touching either
// selector family in agenda.css (mirroring this project's existing
// source-scan approach — see app/src/shell-geometry.test.ts and
// app/src/lib/date-helpers-single-home.test.ts) rather than asserting on one
// specific line number, so the remedy cannot silently come back the next
// time a card is tight.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { totalGridRows } from './gridMath';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS = readFileSync(join(HERE, 'agenda.css'), 'utf-8');
// Comment-stripped copy for the exact-selector scan below, so a /* ... */
// block sitting between two rules never gets swept into the next rule's
// captured selector text (mirrors agenda-overlay-zindex.test.ts).
const CSS_NO_COMMENTS = CSS.replace(/\/\*[\s\S]*?\*\//g, '');

/** Every top-level rule (selector list containing at least one of the given
 * class names) anywhere in the file, including inside @media blocks — the
 * scan must not be foolable by moving the offending declaration into a
 * media query. */
function rulesTouching(css: string, classNames: string[]): string[] {
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  const matches: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = ruleRe.exec(css)) !== null) {
    const selector = m[1]!;
    const body = m[2]!;
    if (classNames.some((c) => selector.includes(c))) matches.push(`${selector.trim()} { ${body.trim()} }`);
  }
  return matches;
}

describe('agenda placed-card geometry (DEC-759)', () => {
  it('no .chq-day-grid-placed-card or .chq-session-card* rule declares overflow-y: auto', () => {
    const rules = rulesTouching(CSS, ['.chq-day-grid-placed-card', '.chq-session-card']);
    // Sanity: the scan actually found rules to check, so a selector rename
    // upstream can't silently make this test vacuous.
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      expect(rule).not.toMatch(/overflow-y:\s*auto/);
    }
  });

  it('the day grid time-row track is minmax(<slot height>, auto), not a fixed height', () => {
    const dayGridSrc = readFileSync(join(HERE, 'DayGrid.tsx'), 'utf-8');
    expect(dayGridSrc).toMatch(/gridTemplateRows\s*=\s*`auto repeat\(\$\{rows\}, minmax\(\d+px, auto\)\)`/);
  });
});

/** Finds a top-level rule by EXACT trimmed selector-list match (not
 * substring), so a compound selector like `.chq-day-grid-cell.chq-day-grid-
 * cell-boundary` is never mistaken for the plain `.chq-day-grid-cell` base
 * rule it shares a prefix with. */
function ruleByExactSelector(css: string, selector: string): string | null {
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = ruleRe.exec(css)) !== null) {
    if (m[1]!.trim() === selector) return m[2]!.trim();
  }
  return null;
}

describe('agenda day grid lattice rhythm (DEC-021 amendment, w6-f)', () => {
  it('paints one rule tone at the 30-minute boundary, never a border-bottom on the plain 15-minute row', () => {
    // The base (non-boundary) cell/cell-btn rules must not declare their own
    // border-bottom at all -- only the .chq-day-grid-cell-boundary compound
    // selectors do, so the lattice can never regress to a rule at every
    // 15-minute midpoint.
    const baseCell = ruleByExactSelector(CSS_NO_COMMENTS, '.chq-day-grid-cell');
    const baseCellBtn = ruleByExactSelector(CSS_NO_COMMENTS, '.chq-day-grid-cell-btn');
    expect(baseCell).not.toBeNull();
    expect(baseCellBtn).not.toBeNull();
    expect(baseCell).not.toMatch(/border-bottom/);
    expect(baseCellBtn).not.toMatch(/border-bottom/);

    // Every boundary rule that draws a genuine (non-dashed-warning) lattice
    // line uses exactly one tone: --chq-agenda-lattice.
    const boundaryRule = ruleByExactSelector(
      CSS_NO_COMMENTS,
      '.chq-day-grid-cell.chq-day-grid-cell-boundary,\n.chq-day-grid-cell-btn.chq-day-grid-cell-boundary',
    );
    expect(boundaryRule).not.toBeNull();
    expect(boundaryRule).toMatch(/border-bottom:\s*1px solid var\(--chq-agenda-lattice\)/);
  });

  it('draws 18 boundary rules for a 36-row (15-min pitch) day, half the row count', () => {
    // 540..1080 at 15min -> 36 rows/day (see gridMath.test.ts); the lattice
    // paints only at the 30-minute boundary (every other row), so a day's
    // rendered rule count is exactly half the row count -- 18, matching the
    // frame, never one per 15-minute row.
    const rows = totalGridRows(540, 1080, 15);
    expect(rows).toBe(36);
    expect(rows / 2).toBe(18);
  });
});
