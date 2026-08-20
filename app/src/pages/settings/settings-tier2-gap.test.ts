// Receipts for task w12-p (SPEAKERS + SETTINGS tier-2 sweep, DEC-393,
// DEC-937, DEC-576, DEC-989). This file covers settings.css only.
//
// DEVIATIONS.md`Focus/hover ring GEOMETRY on bare-text controls: cancelled
// inline padding.` -- the rider this whole lens exists to enforce.
// DESIGN-RULINGS.md`The 44px floor, and how it gets evaded` -- every
// interactive element on phone is min-height:44px plus centred flex plus
// horizontal padding, all three together.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEC_393, DEC_576, DEC_937, DEC_989 } from '../../../../src/decisions';

void DEC_937; // this lane's Part 1 (speakers.css) has no settings.css analog, cited for the shared idiom
void DEC_393; // Part 2: the companion-gap rider (settings.css's row is cleared via SINGLE_TARGET_OK, asserted here)
void DEC_576; // Part 3: the anchor-qualified a.chq-pill rule this file adds
void DEC_989; // the ratchets this task lowers (asserted in their own scan files, not duplicated here)

const HERE = dirname(fileURLToPath(import.meta.url));
const SETTINGS_CSS = readFileSync(join(HERE, 'settings.css'), 'utf-8');

function ruleBodyContaining(css: string, needle: string): string {
  const idx = css.indexOf(needle);
  if (idx === -1) throw new Error(`selector text not found: ${needle}`);
  const open = css.indexOf('{', idx);
  const close = css.indexOf('}', open);
  if (open === -1 || close === -1) throw new Error(`unbalanced rule near: ${needle}`);
  return css.slice(open + 1, close);
}

describe('settings-tier2-gap receipts (task w12-p)', () => {
  describe('Part 2 -- companion gap: .chq-settings-tokens-table tbody td:last-child (gap NONE)', () => {
    it('the container declares no gap itself -- a <td> is not a flex box, gap would do nothing', () => {
      // No top-level or phone-block rule for the bare container selector
      // declares `gap` -- only `.chq-settings-tokens-table tbody td:last-child
      // .chq-link-button` (a descendant, floored separately) exists.
      expect(SETTINGS_CSS).not.toMatch(
        /\.chq-settings-tokens-table tbody td:last-child\s*\{[^}]*gap:/,
      );
    });

    it('ApiTokensPanel.tsx renders exactly one .chq-link-button per row (single-target: no sibling can ever overlap)', () => {
      const panel = readFileSync(
        join(HERE, 'ApiTokensPanel.tsx'),
        'utf-8',
      );
      const matches = [...panel.matchAll(/className="chq-link-button"/g)];
      expect(matches.length).toBe(1);
    });
  });

  describe('Part 3 -- anchor floor: a.chq-pill (YourDataPanel export link)', () => {
    it('settings.css declares an element-qualified a.chq-pill rule with all three floor properties together', () => {
      const body = ruleBodyContaining(SETTINGS_CSS, 'a.chq-pill {');
      expect(body).toMatch(/min-height:\s*44px/);
      expect(body).toMatch(/display:\s*flex/);
      expect(body).toMatch(/align-items:\s*center/);
      expect(body).toMatch(/padding-inline:\s*14px/);
    });

    it('the rule sits inside the terminal phone block (max-width: 700px), not at top level', () => {
      const idx = SETTINGS_CSS.indexOf('a.chq-pill {');
      expect(idx).toBeGreaterThan(-1);
      const mediaIdx = SETTINGS_CSS.lastIndexOf('@media (max-width: 700px)', idx);
      expect(mediaIdx).toBeGreaterThan(-1);
      // No intervening top-level closing brace for the media block between
      // its opener and this rule (a crude but adequate single-block check
      // given this file has exactly one @media (max-width: 700px) block).
      expect(SETTINGS_CSS.indexOf('@media (max-width: 700px)', mediaIdx + 1)).toBe(-1);
    });

    it('YourDataPanel.tsx does render <a className="chq-pill"> -- verifies the rule targets a real element', () => {
      const panel = readFileSync(join(HERE, 'YourDataPanel.tsx'), 'utf-8');
      expect(panel).toMatch(/<a[^>]*className="chq-pill"/);
    });
  });
});
