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

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS = readFileSync(join(HERE, 'agenda.css'), 'utf-8');

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
