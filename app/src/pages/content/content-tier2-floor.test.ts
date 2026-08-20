// app/src/pages/content/content-tier2-floor.test.ts — task v12m-w12-m,
// CONTENT cluster tier-2 sweep (DEC-393, DEC-989).
//
// Closes app/src/phone-tap-target.scan.test.ts's ANCHOR_FLOOR_OFFENDERS
// population's nine content.css rows (`.chq-bulkbar-actions`,
// `.chq-content-actions`, `.chq-content-comment-actions`,
// `.chq-content-detail-actions`, `.chq-content-files-header-actions`,
// `.chq-content-status-band-actions`, `.chq-content-summary-actions`,
// `.chq-content-worklist-col-actions`, `.chq-pill`) and
// app/src/phone-horizontal-overflow.scan.test.ts's one content.css row
// (`.chq-content-phone-select-toggle, .chq-content-phone-selecting-meta`).
//
// Every row is closed by a `tap-floor-exempt`/`overflow-exempt` comment,
// not a new phone rule: `app/src/phone-tap-target-scan/anchor-floor.ts`'s
// container-reach check (`selectorReachesAnchor`) can only credit a
// container selector that compounds with a known anchor token in the SAME
// selector text -- a container whose interactive children are exclusively
// `<button class="chq-btn ...">` (the row-action-anchor recipe,
// `docs/design/DESIGN-RULINGS.md`'s "The 44px floor, and how it gets
// evaded") can never satisfy that reach check however well-floored its
// button descendants already are (`.chq-content-actions .chq-btn` etc.,
// declared in content.css's terminal phone block; see
// content-phone-floor.test.ts for those assertions). This file pins the
// EXEMPTION receipts themselves -- the comment text, its placement
// immediately above a rule mentioning the token, and (for content-phone-
// select-toggle/-selecting-meta) that content.css's own two individual
// phone-scoped `overflow-exempt` rules for those selectors still stand,
// since the new top-level exemption sits beside them rather than replacing
// them.
//
// `.chq-content-detail-actions` is the one container among the nine that
// DOES wrap real anchors (two `<Link className="chq-content-detail-action-
// link">`, no `chq-btn`) -- already correctly floored via the bare
// `.chq-content-detail-action-link` selector (content-phone-floor.test.ts).
// The container-reach check still misses it because this codebase never
// compounds the container class with the anchor class in one selector
// (avoiding a second, competing declaration for the anchor's own
// selector/property pair) -- exempted here with that reasoning recorded.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const CSS_PATH = resolve(__dirname, 'content.css');
const CSS = readFileSync(CSS_PATH, 'utf-8');

/** Mirrors app/src/phone-tap-target-scan/core.ts's hasExemptionForToken:
 * a `tap-floor-exempt:` comment, containing no `*`, sitting ahead of (with
 * only non-brace text between) a selector mentioning `token`. */
function hasTapFloorExemption(css: string, token: string): boolean {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\/\\*\\s*tap-floor-exempt:[^*]*\\*\\/\\s*[^{}]*\\.${escaped}\\b[^{}]*\\{`);
  return re.test(css);
}

/** Mirrors app/src/phone-horizontal-overflow.scan.test.ts's EXEMPT_COMMENT_RE
 * shape applied to the text directly preceding a given selector's rule. */
function hasOverflowExemptionAbove(css: string, selectorLiteral: string): boolean {
  const idx = css.indexOf(selectorLiteral);
  expect(idx, `selector ${JSON.stringify(selectorLiteral)} not found in content.css`).toBeGreaterThan(-1);
  const before = css.slice(Math.max(0, idx - 700), idx);
  return /\/\*\s*overflow-exempt:\s*[^*]*\*\//.test(before);
}

describe('CONTENT cluster tier-2 sweep (DEC-393, DEC-989) — task v12m-w12-m', () => {
  describe('anchor-floor: button-only containers get a named tap-floor-exempt receipt', () => {
    const buttonOnlyTokens = [
      'chq-content-actions',
      'chq-content-comment-actions',
      'chq-content-files-header-actions',
      'chq-content-status-band-actions',
      'chq-content-summary-actions',
      'chq-content-worklist-col-actions',
    ];

    it.each(buttonOnlyTokens)('%s carries a tap-floor-exempt comment reaching its declaration', (token) => {
      expect(hasTapFloorExemption(CSS, token)).toBe(true);
    });

    it('every exemption names the child element kind it defers to (chq-btn descendant, or empty/inert for the header spacer)', () => {
      for (const token of buttonOnlyTokens) {
        const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`\\/\\*\\s*tap-floor-exempt:([^*]*)\\*\\/\\s*[^{}]*\\.${escaped}\\b`);
        const m = CSS.match(re);
        expect(m, `no exemption comment found for .${token}`).not.toBeNull();
        expect(m![1]).toMatch(token === 'chq-content-worklist-col-actions' ? /empty|inert/ : /chq-btn/);
      }
    });
  });

  describe('anchor-floor: chq-content-detail-actions (real Link children, closed by its anchor children)', () => {
    it('carries a tap-floor-exempt comment naming its own anchor children as already floored', () => {
      expect(hasTapFloorExemption(CSS, 'chq-content-detail-actions')).toBe(true);
      const re = /\/\*\s*tap-floor-exempt:([^*]*)\*\/\s*[^{}]*\.chq-content-detail-actions\b/;
      const m = CSS.match(re);
      expect(m).not.toBeNull();
      expect(m![1]).toMatch(/chq-content-detail-action-link/);
    });

    it('the anchor children it wraps carry the full flush-row-anchor recipe in the terminal phone block', () => {
      const block = CSS.slice(CSS.lastIndexOf('@media (max-width: 700px)'));
      const rule = block.match(/\.chq-content-detail-action-link\s*\{([^}]*)\}/);
      expect(rule).not.toBeNull();
      const body = rule![1]!;
      expect(body).toMatch(/min-height:\s*44px/);
      expect(body).toMatch(/display:\s*flex/);
      expect(body).toMatch(/align-items:\s*center/);
      expect(body).toMatch(/padding-inline:\s*10px/);
    });
  });

  describe('anchor-floor: shell-lane composition tokens (DEC-576, DEC-613)', () => {
    it('.chq-bulkbar-actions carries a composition tap-floor-exempt comment naming app/src/styles.css', () => {
      expect(hasTapFloorExemption(CSS, 'chq-bulkbar-actions')).toBe(true);
      const re = /\/\*\s*tap-floor-exempt:([^*]*)\*\/\s*[^{}]*\.chq-bulkbar-actions\b/;
      const m = CSS.match(re);
      expect(m).not.toBeNull();
      expect(m![1]).toMatch(/styles\.css/);
    });

    it('.chq-pill carries a DEC-576 composition tap-floor-exempt comment: content renders it only as button', () => {
      expect(hasTapFloorExemption(CSS, 'chq-pill')).toBe(true);
      const re = /\/\*\s*tap-floor-exempt:([^*]*)\*\/\s*[^{}]*\.chq-pill\b/;
      const m = CSS.match(re);
      expect(m).not.toBeNull();
      expect(m![1]).toMatch(/styles\.css/);
      expect(m![1]).toMatch(/button/);
    });

    it('content renders .chq-pill only on <button> tags, never <a>/<Link> (DEC-576 premise check)', () => {
      const tsxDir = resolve(__dirname);
      const { readdirSync } = require('node:fs') as typeof import('node:fs');
      const files = readdirSync(tsxDir).filter((f) => f.endsWith('.tsx') && !f.includes('.test.'));
      for (const f of files) {
        const src = readFileSync(resolve(tsxDir, f), 'utf-8');
        const anchorWithPill = /<(a|Link)\b[^>]*className\s*=\s*(\{[^}]*chq-pill[^}]*\}|"[^"]*chq-pill[^"]*")/;
        expect(anchorWithPill.test(src), `${f} renders .chq-pill on an <a>/<Link> -- DEC-576 exemption premise broken`).toBe(false);
      }
    });
  });

  describe('overflow: select-toggle/selecting-meta cascade-merge artifact (DEC-989)', () => {
    it('the joined desktop display:none rule carries its own overflow-exempt receipt', () => {
      expect(
        hasOverflowExemptionAbove(
          CSS,
          '.chq-content-phone-select-toggle,\n.chq-content-phone-selecting-meta {\n  display: none;\n}',
        ),
      ).toBe(true);
    });

    it("each selector's individual phone-scoped rule still carries its own frame-citing overflow-exempt receipt (unchanged by this task)", () => {
      expect(hasOverflowExemptionAbove(CSS, '.chq-content-phone-select-toggle {')).toBe(true);
      expect(hasOverflowExemptionAbove(CSS, '.chq-content-phone-selecting-all {')).toBe(true);
    });
  });
});
