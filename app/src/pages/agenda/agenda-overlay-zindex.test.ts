// DEC-900 amendment (wave 72): gate-4 filed a P0-BROKEN -- arming the grid
// paints 20 slot-button borders straight through the lunch band, slicing
// "12:00 · LUNCH · FOYER · 60 MIN" into strips. `.chq-agenda-break-band` sat
// at z-index 4 (below the armed lattice's z-index 6) -- the SAME bug DEC-900
// had already patched per-instance for the clash card and the placed card
// (both hand-raised to 9). Fixed as the CLASS: agenda.css declares ONE named
// tier, `--chq-z-agenda-overlay`, and every element that paints over the
// grid's cell area takes exactly that value. A hardcoded overlay list goes
// stale, so this scan (a) asserts every KNOWN overlay class resolves its
// z-index to the token (never a literal) and (b) pins the TOTAL count of
// z-index declarations in the file, so a new overlay rule with its own
// literal -- which would silently paint below the lattice again -- fails
// this test until it's re-classified into the tier.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const RAW_CSS = readFileSync(join(HERE, 'agenda.css'), 'utf-8');
// Strip /* ... */ comments before scanning -- several of this file's own
// comments narrate past z-index literals ("z-index 6/7", "was a per-instance
// z-index: 4") which must not be mistaken for live declarations.
const CSS = RAW_CSS.replace(/\/\*[\s\S]*?\*\//g, '');

/** Extract the body of a single top-level rule by exact selector match
 * (mirrors agenda-armed-contrast.test.ts / agenda-card-geometry.test.ts). */
function ruleBody(css: string, selector: string): string {
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = ruleRe.exec(css)) !== null) {
    if (m[1]!.trim() === selector) return m[2]!;
  }
  throw new Error(`selector not found: ${selector}`);
}

function declValue(body: string, prop: string): string {
  const re = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+);`);
  const m = body.match(re);
  if (!m) throw new Error(`declaration ${prop} not found in rule body: ${body}`);
  return m[1]!.trim();
}

// Every element that paints over the grid's cell area, per the wave-72
// ruling: the merged clash card, a placed session card, a break band.
const OVERLAY_SELECTORS = [
  '.chq-day-grid-clash-card',
  '.chq-day-grid-placed-card',
  '.chq-agenda-break-band',
];

describe('agenda ONE overlay tier (DEC-900 amendment, wave 72)', () => {
  it('the tier token is declared once, on .chq-day-grid, at 9 (above the armed lattice\'s 6/7/8)', () => {
    const dayGridBody = ruleBody(CSS, '.chq-day-grid');
    expect(declValue(dayGridBody, '--chq-z-agenda-overlay')).toBe('9');
  });

  for (const selector of OVERLAY_SELECTORS) {
    it(`${selector} resolves its z-index to var(--chq-z-agenda-overlay), never a literal`, () => {
      const body = ruleBody(CSS, selector);
      expect(declValue(body, 'z-index')).toBe('var(--chq-z-agenda-overlay)');
    });
  }

  it('the break band keeps pointer-events: none so click-to-place still reaches the cell underneath (J9)', () => {
    const body = ruleBody(CSS, '.chq-agenda-break-band');
    expect(declValue(body, 'pointer-events')).toBe('none');
  });

  it('the armed lattice stays strictly below the overlay tier: 6 at rest, 7 focus-visible, 8 for its hover label', () => {
    expect(declValue(ruleBody(CSS, '.chq-day-grid-armed .chq-day-grid-cell-btn'), 'z-index')).toBe('6');
    expect(declValue(ruleBody(CSS, '.chq-day-grid-armed .chq-day-grid-cell-btn:focus-visible'), 'z-index')).toBe('7');
    expect(
      declValue(
        ruleBody(
          CSS,
          '.chq-day-grid-armed .chq-day-grid-cell-btn:hover .chq-day-grid-cell-hover-label,\n.chq-day-grid-armed .chq-day-grid-cell-btn:focus-visible .chq-day-grid-cell-hover-label',
        ),
        'z-index',
      ),
    ).toBe('8');
  });

  // The counted guard: a hardcoded overlay-selector list (OVERLAY_SELECTORS
  // above) goes stale the moment someone adds a new overlay without adding
  // it here too -- so this pins the TOTAL number of `z-index:` declarations
  // in the file, forcing a new one to be noticed and classified rather than
  // silently landing below the lattice with its own literal.
  // USER-FILED (release night): the ONE slot under the pointer mid-drag is
  // the single exception that must paint ABOVE the overlay tier -- a drop
  // target hidden behind the very card the organiser is dragging past is
  // the regression being fixed. It is expressed relative to the tier token
  // (never a literal 10/11), so re-tiering the overlays carries it along.
  it('the mid-drag drop target and its readout sit just above the overlay tier, via the token', () => {
    expect(declValue(ruleBody(CSS, '.chq-day-grid-cell-drop-target'), 'z-index')).toBe(
      'calc(var(--chq-z-agenda-overlay) + 1)',
    );
    expect(
      declValue(ruleBody(CSS, '.chq-day-grid-cell-drop-target .chq-day-grid-cell-hover-label'), 'z-index'),
    ).toBe('calc(var(--chq-z-agenda-overlay) + 2)');
  });

  it('pins the total count of z-index declarations in agenda.css', () => {
    const matches = CSS.match(/z-index\s*:/g) ?? [];
    // 10th/11th: the mid-drag drop target and its free-minutes readout
    // (user-filed release-night fix), classified in the test above.
    // Was 12: the delta-2 amendment had given .chq-agenda-armed-bar a
    // z-index: 3 so it could paint as an absolute OVERLAY on the day-tabs
    // strip. Eval D5 reverted that bar to DEC-794's in-flow form (it buried
    // the day pills and the clash note mid-placement), and an in-flow bar
    // stacks with no z-index at all -- so that declaration is GONE, not
    // re-tiered, and the count drops back to 11.
    expect(matches.length).toBe(11);
  });
});
