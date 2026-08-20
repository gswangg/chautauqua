// COMMS cluster tier-2 sweep (task v12m-w12-n, DEC-393, DEC-937, DEC-989).
//
// PART 1 (row-action-anchor floor, docs/design/DESIGN-RULINGS.md`The 44px
// floor, and how it gets evaded`): 7 comms.css offenders measured on main
// `0c27bf92` via app/src/phone-tap-target-scan/anchor-floor.ts --
// .chq-bulkbar-actions, .chq-comms-history-head-actions,
// .chq-comms-preview-actions, .chq-comms-refusal-actions,
// .chq-comms-select-actions, .chq-comms-send-report-footer-actions,
// .chq-comms-template-actions. Three (bulkbar/preview/template) wrap only
// <button className="chq-btn ..."> children and are exempted; four
// (history-head/refusal/select/send-report-footer) wrap an <a>/<Link>
// child and get an element-selector rule that reaches it directly inside
// the terminal @media (max-width: 700px) block -- .chq-btn's own
// `display: inline-flex` does not satisfy the scan's literal
// `display: flex` predicate.
//
// PART 2 (companion-gap, docs/design/DEVIATIONS.md`Focus/hover ring
// GEOMETRY on bare-text controls: cancelled inline padding.`): 4 comms.css
// offenders measured via app/src/cancelled-padding-gap.scan.test.ts.
// cancelled-padding-face.scan.test.ts confirms none of comms.css's
// cancelled-padding members resolve to a painted face, so all four keep
// the idiom (DEC-937) and the declared phone gap is the frame's own
// rendered gap plus 2N: .chq-comms-editor-actions 9 -> 29,
// .chq-comms-blocked-list li 8 -> 28, .chq-comms-recent-sends
// .chq-section-head NONE -> 40 (restated at the shared .chq-section-head
// base's own gap:20, app/src/styles.css). .chq-comms-send-detail is
// `display: contents` (never a flex/grid box, one .chq-link-button child,
// no sibling to protect a gap against) so its member's cancelled padding
// is removed instead, per DEC-937's own escape: "a gap on a non-flex box
// is not a fix".
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEC_393, DEC_937, DEC_989 } from '../../../../src/decisions';

void DEC_393; // row-action-anchor + companion-gap lenses this file receipts
void DEC_937; // painted-face-first, frame-gap-plus-2N companion-gap rule
void DEC_989; // two-sided ratchet, lowered by the draining worker

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = join(HERE, 'comms.css');

function terminalPhoneBlock(css: string): string {
  const idx = css.lastIndexOf('@media (max-width: 700px)');
  if (idx === -1) throw new Error('comms.css: no terminal @media (max-width: 700px) block found');
  return css.slice(idx);
}

describe('comms.css tier-2 sweep (DEC-393, DEC-937, DEC-989, task v12m-w12-n)', () => {
  const css = readFileSync(CSS_PATH, 'utf-8');
  const phone = terminalPhoneBlock(css);

  describe('Part 1: row-action-anchor floor', () => {
    it('exempts the three button-only containers with a named tap-floor-exempt comment', () => {
      for (const token of ['chq-bulkbar-actions', 'chq-comms-preview-actions', 'chq-comms-template-actions']) {
        const re = new RegExp(`\\/\\*\\s*tap-floor-exempt:[^*]*\\*\\/\\s*[^{}]*\\.${token}\\b[^{}]*\\{`);
        expect(css, `${token} should carry a tap-floor-exempt comment`).toMatch(re);
      }
    });

    it('reaches the anchor in each of the four link-bearing containers, inside the phone block, with min-height:44px + flex-center + non-zero horizontal padding', () => {
      for (const token of [
        'chq-comms-history-head-actions',
        'chq-comms-refusal-actions',
        'chq-comms-select-actions',
        'chq-comms-send-report-footer-actions',
      ]) {
        const re = new RegExp(`\\.${token} a\\s*\\{([^}]*)\\}`);
        const match = phone.match(re);
        expect(match, `${token} a { ... } should exist in the phone block`).not.toBeNull();
        const body = match?.[1] ?? '';
        expect(body).toMatch(/min-height:\s*44px/);
        expect(body).toMatch(/display:\s*flex/);
        expect(body).toMatch(/align-items:\s*center/);
        expect(body).toMatch(/padding-inline:\s*[1-9]\d*px/);
      }
    });
  });

  describe('Part 2: cancelled-padding companion gap', () => {
    it('raises .chq-comms-editor-actions to 29px (9 desktop + 2*10) inside the phone block', () => {
      const match = phone.match(/\.chq-comms-editor-actions\s*\{([^}]*)\}/);
      expect(match).not.toBeNull();
      expect(match?.[1]).toMatch(/gap:\s*29px/);
    });

    it('raises .chq-comms-blocked-list li to 28px (8 desktop + 2*10) inside the phone block', () => {
      const match = phone.match(/\.chq-comms-blocked-list li\s*\{([^}]*)\}/);
      expect(match).not.toBeNull();
      expect(match?.[1]).toMatch(/gap:\s*28px/);
    });

    it('declares .chq-comms-recent-sends .chq-section-head at 40px (shared 20px base + 2*10) inside the phone block', () => {
      const match = phone.match(/\.chq-comms-recent-sends \.chq-section-head\s*\{([^}]*)\}/);
      expect(match).not.toBeNull();
      expect(match?.[1]).toMatch(/gap:\s*40px/);
    });

    it('drops the cancelled padding-inline/margin-inline pair from .chq-comms-send-detail > .chq-link-button (display:contents, single target, no adjacency)', () => {
      const match = phone.match(/\.chq-comms-send-detail > \.chq-link-button\s*\{([^}]*)\}/);
      expect(match).not.toBeNull();
      const body = match?.[1] ?? '';
      expect(body).not.toMatch(/padding-inline:/);
      expect(body).not.toMatch(/margin-inline:/);
      // still meets the 44px floor on its own
      expect(body).toMatch(/min-height:\s*44px/);
      expect(body).toMatch(/display:\s*flex/);
      expect(body).toMatch(/align-items:\s*center/);
    });

    it('the container the display:contents rule sits under really is display:contents (the reason no gap applies)', () => {
      const match = css.match(/\.chq-comms-send-detail\s*\{([^}]*)\}/);
      expect(match).not.toBeNull();
      expect(match?.[1]).toMatch(/display:\s*contents/);
    });
  });
});
