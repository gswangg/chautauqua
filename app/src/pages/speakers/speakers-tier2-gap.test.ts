// Receipts for task w12-p (SPEAKERS + SETTINGS tier-2 sweep, DEC-393,
// DEC-937, DEC-576, DEC-989). This file covers speakers.css and
// task-view.css only -- speakers-css.test.ts is owned by a parallel lane
// (w12-r) this wave, so these receipts live in a new file rather than
// editing that pin.
//
// DEVIATIONS.md`Focus/hover ring GEOMETRY on bare-text controls: cancelled
// inline padding.` -- the rider this whole lens exists to enforce (a
// cancelled-padding family renders as adjacent siblings, the container
// owning their separation must add the cancelled padding back or the
// rendered gap closes).
// DESIGN-RULINGS.md`The 44px floor, and how it gets evaded` -- every
// interactive element on phone is min-height:44px plus centred flex plus
// horizontal padding, all three together, never assembled by inheritance
// alone.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEC_393, DEC_576, DEC_937, DEC_989 } from '../../../../src/decisions';

void DEC_937; // Part 1: the painted-face treatment (.chq-speaker-detail-actions a)
void DEC_393; // Part 2: the companion-gap rider this file's phone-only gap widenings satisfy
void DEC_576; // Part 3: bare .chq-pill stays unfloored, the anchor form takes its own rule
void DEC_989; // the ratchets this task lowers (asserted in their own scan files, not duplicated here)

const HERE = dirname(fileURLToPath(import.meta.url));
const SPEAKERS_CSS = readFileSync(join(HERE, 'speakers.css'), 'utf-8');
const TASK_VIEW_CSS = readFileSync(join(HERE, 'task-view.css'), 'utf-8');

/** Extracts the FIRST top-level-or-media rule body whose selector text
 * contains `needle` verbatim (comma-branch or descendant match), by
 * brace-balanced scan from the first occurrence of `needle` forward to the
 * next unmatched `{`/`}` pair -- adequate for this file's small, hand-
 * checked probe set. */
function ruleBodyContaining(css: string, needle: string): string {
  const idx = css.indexOf(needle);
  if (idx === -1) throw new Error(`selector text not found: ${needle}`);
  const open = css.indexOf('{', idx);
  const close = css.indexOf('}', open);
  if (open === -1 || close === -1) throw new Error(`unbalanced rule near: ${needle}`);
  return css.slice(open + 1, close);
}

describe('speakers-tier2-gap receipts (task w12-p)', () => {
  describe('Part 1 -- painted face: .chq-speaker-detail-actions a', () => {
    it('is no longer part of the cancelled-padding selector group (10px pair removed)', () => {
      const groupBody = ruleBodyContaining(
        SPEAKERS_CSS,
        '.chq-speakers-head-actions a,\n  .chq-speakers-pager-actions a,',
      );
      expect(groupBody).not.toMatch(/\.chq-speaker-detail-actions a/);
    });

    it('has its own dedicated rule flooring the anchor at 44px with the family\'s native 16px padding, no cancelled margin', () => {
      const body = ruleBodyContaining(SPEAKERS_CSS, '.chq-speaker-detail-actions a {');
      expect(body).toMatch(/min-height:\s*44px/);
      expect(body).toMatch(/display:\s*flex/);
      expect(body).toMatch(/align-items:\s*center/);
      expect(body).toMatch(/padding-inline:\s*16px/);
      expect(body).toMatch(/margin-inline:\s*0/);
      expect(body).not.toMatch(/padding-inline:\s*10px/);
      expect(body).not.toMatch(/margin-inline:\s*-10px/);
    });
  });

  describe('Part 2 -- companion gaps (rendered gap + 2*10 = +20)', () => {
    it('.chq-speaker-detail-logistics-actions: 8 -> 28', () => {
      const desktop = ruleBodyContaining(SPEAKERS_CSS, '.chq-speaker-detail-logistics-actions {\n  display: flex;');
      expect(desktop).toMatch(/gap:\s*8px/);
      const phone = ruleBodyContaining(SPEAKERS_CSS, '.chq-speaker-detail-logistics-actions {\n    gap:');
      expect(phone).toMatch(/gap:\s*28px/);
    });

    it('.chq-speakers-head-actions: 9 -> 29', () => {
      const phone = ruleBodyContaining(SPEAKERS_CSS, '.chq-speakers-head-actions {\n    gap:');
      expect(phone).toMatch(/gap:\s*29px/);
    });

    it('.chq-speakers-pager-actions: 9 -> 29', () => {
      const phone = ruleBodyContaining(SPEAKERS_CSS, '.chq-speakers-pager-actions {\n    gap:');
      expect(phone).toMatch(/gap:\s*29px/);
    });

    it('.chq-speakers-write-failure-actions: 9 -> 29', () => {
      const phone = ruleBodyContaining(SPEAKERS_CSS, '.chq-speakers-write-failure-actions {\n    gap:');
      expect(phone).toMatch(/gap:\s*29px/);
    });

    it('task-view.css .chq-taskview-actions: 9 -> 29', () => {
      const phone = ruleBodyContaining(TASK_VIEW_CSS, '.chq-taskview-actions {\n    gap:');
      expect(phone).toMatch(/gap:\s*29px/);
    });
  });

  describe('Part 3 -- anchor floor: bare .chq-pill cleared by composition exemption', () => {
    it('speakers.css carries a tap-floor-exempt comment directly above the only chq-pill-mentioning rule', () => {
      expect(SPEAKERS_CSS).toMatch(
        /\/\*\s*tap-floor-exempt:[^*]*\*\/\s*\.chq-speakers-filters \.chq-pill\.is-active\s*\{/,
      );
    });

    it('the exemption comment body contains no `*` (would truncate the comment)', () => {
      const m = SPEAKERS_CSS.match(/\/\*\s*tap-floor-exempt:([^*]*)\*\//);
      expect(m).not.toBeNull();
      expect((m as RegExpMatchArray)[1]).not.toMatch(/\*/);
    });

    it('speakers.css renders .chq-pill only as <button> (GridFilters.tsx), never <a> -- verifies the exemption\'s premise', () => {
      const gridFilters = readFileSync(join(HERE, 'GridFilters.tsx'), 'utf-8');
      expect(gridFilters).toMatch(/<button[\s\S]{0,80}chq-pill/);
      expect(gridFilters).not.toMatch(/<a[\s>][\s\S]{0,80}chq-pill/);
      expect(gridFilters).not.toMatch(/<Link[\s\S]{0,80}chq-pill/);
    });
  });
});
