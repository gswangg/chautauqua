// Receipts for task w9-kg (DEC-393 amendment, Settings cluster classless
// anchor floor sweep). Five interactive anchors -- ExportsPanel's three
// download links and YourDataPanel's two "/docs/api" links -- carried no
// class at all, so no ratchet and no stylesheet reached them and at 390
// they sat at the UA's bare line box. Each is the SOLE interactive element
// in its cell/line (ROOMY per docs/design/audit/phone-tap-floor-links.md's
// taxonomy); DESIGN-RULINGS.md's blanket rule governs: min-height:44px +
// centred flex + horizontal padding, declared phone-only (DEC-385
// single-direction) inside settings.css's terminal max-width:700px block.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEC_393 } from '../../../../src/decisions';
import { phoneBlockText, stripCssComments } from '../../test-utils/phoneBlock';

void DEC_393; // this task's binding decision: the Settings cluster classless-anchor amendment

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

const NEW_SELECTORS = ['.chq-settings-exports-download', '.chq-settings-api-docs-link'];

describe('settings-tier2-anchor-floor receipts (task w9-kg, DEC-393 amendment)', () => {
  describe.each(NEW_SELECTORS)('%s', (selector) => {
    it('carries all three floor properties together, read from comment-stripped source', () => {
      const clean = stripCssComments(SETTINGS_CSS);
      const body = ruleBodyContaining(clean, `${selector} {`);
      expect(body).toMatch(/min-height:\s*44px/);
      expect(body).toMatch(/display:\s*flex/);
      expect(body).toMatch(/align-items:\s*center/);
      expect(body).toMatch(/padding-inline:\s*\d+px/);
    });

    it('sits inside the terminal @media (max-width: 700px) block, not at top level', () => {
      const block = phoneBlockText(SETTINGS_CSS);
      expect(block).toContain(`${selector} {`);

      // Negative control: the RAW (unstripped) source must not carry the
      // selector's declaration OUTSIDE the phone block -- i.e. there is
      // exactly one occurrence of the selector's opening brace in the raw
      // file, proving it was authored once, inside the block, and not
      // duplicated at top level.
      const rawOccurrences = SETTINGS_CSS.split(`${selector} {`).length - 1;
      expect(rawOccurrences).toBe(1);
    });
  });

  it('comment-strip positive control: a rule whose selector text appears ONLY inside a comment is not read as a declaration', () => {
    const fixture = `
      /* .chq-fixture-comment-only { min-height: 44px; } */
      .chq-fixture-comment-only-real {
        color: red;
      }
    `;
    const clean = stripCssComments(fixture);
    expect(clean).not.toContain('min-height: 44px');
    expect(() => ruleBodyContaining(clean, '.chq-fixture-comment-only {')).toThrow();
  });

  it('comment-strip negative control: a real declaration survives stripping unchanged', () => {
    const fixture = `
      /* prose mentioning .chq-fixture-real { min-height: 999px; } as an example */
      .chq-fixture-real {
        min-height: 44px;
      }
    `;
    const clean = stripCssComments(fixture);
    const body = ruleBodyContaining(clean, '.chq-fixture-real {');
    expect(body).toMatch(/min-height:\s*44px/);
    expect(clean).not.toContain('999px');
  });

  it('ExportsPanel.tsx renders all three download anchors with the exports class, hrefs and labels unchanged', () => {
    const panel = readFileSync(join(HERE, 'ExportsPanel.tsx'), 'utf-8');
    const matches = [...panel.matchAll(/<a className="chq-settings-exports-download"[^>]*>/g)];
    expect(matches).toHaveLength(3);
    expect(panel).toMatch(
      /<a className="chq-settings-exports-download" href=\{`\/api\/v1\/events\/\$\{eventId\}\/export\/\$\{kind\}\?format=csv`\}>Download CSV<\/a>/,
    );
    expect(panel).toMatch(
      /<a className="chq-settings-exports-download" href=\{`\/api\/v1\/events\/\$\{eventId\}\/export\/\$\{kind\}\?format=json`\}>Download JSON<\/a>/,
    );
    expect(panel).toMatch(
      /<a className="chq-settings-exports-download" href=\{`\/api\/v1\/events\/\$\{eventId\}\/exports\/showflow\.csv`\}>Download CSV<\/a>/,
    );
  });

  it('YourDataPanel.tsx renders both /docs/api anchors with the api-docs-link class, hrefs and label unchanged', () => {
    const panel = readFileSync(join(HERE, 'YourDataPanel.tsx'), 'utf-8');
    const matches = [...panel.matchAll(/<a className="chq-settings-api-docs-link" href="\/docs\/api">\{apiDocsDisplay\}<\/a>/g)];
    expect(matches).toHaveLength(2);
  });

  it('neither new class was applied to chq-btn (would change the desktop weight)', () => {
    const exportsPanel = readFileSync(join(HERE, 'ExportsPanel.tsx'), 'utf-8');
    const yourDataPanel = readFileSync(join(HERE, 'YourDataPanel.tsx'), 'utf-8');
    for (const src of [exportsPanel, yourDataPanel]) {
      expect(src).not.toMatch(/className="chq-btn[^"]*chq-settings-(exports-download|api-docs-link)/);
      expect(src).not.toMatch(/className="chq-settings-(exports-download|api-docs-link)[^"]*chq-btn/);
    }
  });
});
