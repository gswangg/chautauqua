// w6-cf/DEC-989 amendment (wave-150 sweep): `.chq-review-criterion-row,
// .chq-review-criteria-head-row { grid-template-columns: 20px minmax(0, 1fr)
// 232px 128px 122px 62px; }` (review.css:981) totals 564px of fixed tracks
// plus 5x16px gaps -- 644px -- against the 358px phone budget. The sibling
// `.chq-review-criterion-row` is already re-lined to a wrapped flex card
// inside the terminal `@media (max-width: 700px)` block, but the shared
// declaration's OTHER selector, `.chq-review-criteria-head-row` (the
// aria-hidden column-header row, PlanEditor.tsx:1780), had no phone
// override at all and kept the starved six-track grid at 390. This pins
// the fix: hidden via `display: none` inside the same terminal block,
// following the established idiom `.chq-review-criteria-eyebrow` already
// uses one selector away. Source-scan style (`topLevelRuleBody`/phone-rule-
// body idiom, see settings-phone-drills.test.ts / speakers-css.test.ts) --
// no CSS parser dependency, matches the project's other phone-css scans.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = join(HERE, 'review.css');
const CSS = readFileSync(CSS_PATH, 'utf8');

/** Extracts the body of the LAST top-level occurrence of `selector` in the
 * file -- the terminal `@media (max-width: 700px)` block is appended after
 * every desktop declaration, so its rule (if any) is always the final
 * match in source order (same idiom as settings-phone-drills.test.ts's
 * `phoneRuleBody`). */
function lastRuleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'gm');
  const matches = [...css.matchAll(re)];
  const last = matches[matches.length - 1];
  if (!last || last[1] === undefined) throw new Error(`no rule found for ${selector} in review.css`);
  return last[1];
}

describe('review.css .chq-review-criteria-head-row phone re-line (DEC-989 amendment, w6-cf)', () => {
  it('desktop rule is untouched: the shared six-track grid still names both selectors (DEC-385, desktop frozen)', () => {
    const withoutMedia = CSS.replace(/@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g, '');
    const match = withoutMedia.match(/\.chq-review-criterion-row,\s*\n\.chq-review-criteria-head-row\s*\{([^}]*)\}/);
    const body = match?.[1];
    if (body === undefined) throw new Error('no top-level shared rule found for criterion-row/criteria-head-row');
    expect(body).toContain('grid-template-columns: 20px minmax(0, 1fr) 232px 128px 122px 62px');
  });

  it('the desktop declaration is starved at the 358px phone budget (564px fixed + 80px gap > 358px)', () => {
    const fixedTracks = [20, 232, 128, 122, 62];
    const fixedSum = fixedTracks.reduce((a, b) => a + b, 0);
    const gapCount = fixedTracks.length; // 5 gaps between 6 tracks
    const gap = 16;
    expect(fixedSum).toBe(564);
    expect(fixedSum + gapCount * gap).toBeGreaterThan(358);
  });

  it('the terminal phone block hides the head row instead of re-lining it (aria-hidden, no control removed)', () => {
    const body = lastRuleBody(CSS, '.chq-review-criteria-head-row');
    expect(body).toMatch(/display:\s*none/);
    // No fixed-track geometry should remain declared for this selector at
    // phone width -- display:none makes any grid-template-columns moot,
    // but asserting its absence keeps the rule from silently regaining a
    // starved template later (mirrors .chq-review-criteria-eyebrow's own
    // phone rule, which is display:none-only with no grid property).
    expect(body).not.toMatch(/grid-template-columns/);
  });

  it("the sibling row this shared declaration also styles, .chq-review-criterion-row, keeps its own established phone override (not touched by this task)", () => {
    const body = lastRuleBody(CSS, '.chq-review-criterion-row');
    expect(body).toMatch(/display:\s*flex/);
  });
});
