// DEC-880: speakers.css:211 used to be `.chq-participation-menu-trigger {
// border: none }`, landing textually after the four
// `.chq-speakers-status-*` modifiers -- since the trigger button wraps one
// of those modifier chips, the `border: none` reset stomped three of the
// four DEC-730 participation states' outlines and only the filled
// Confirmed variant kept its border. jsdom does not apply an external
// stylesheet (see page-measure.test.ts / shell-geometry.test.ts), so this
// reads the stylesheet's own text and asserts on the declarations
// directly rather than rendering + measuring computed style.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = join(HERE, 'speakers.css');

/** Extracts a top-level (not inside an @media block) rule's declaration body by selector. */
function topLevelRuleBody(css: string, selector: string): string {
  const withoutMedia = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\}[^{}]*)*\}/g, '');
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = withoutMedia.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  const body = match?.[1];
  if (body === undefined) throw new Error(`no top-level rule found for ${selector}`);
  return body;
}

const STATUS_MODIFIERS = [
  'chq-speakers-status-complete',
  'chq-speakers-status-pending',
  'chq-speakers-status-overdue',
  'chq-speakers-status-none',
];

describe('speakers.css participation-menu-trigger reset (DEC-880)', () => {
  const css = readFileSync(CSS_PATH, 'utf-8');

  it('does not reset the trigger border', () => {
    const body = topLevelRuleBody(css, '.chq-participation-menu-trigger');
    expect(body).not.toMatch(/border:\s*none/);
  });

  it('only resets button chrome the chip does not want (appearance/background/padding/font/cursor)', () => {
    const body = topLevelRuleBody(css, '.chq-participation-menu-trigger');
    expect(body).toMatch(/appearance:\s*none/);
    expect(body).toMatch(/background:\s*none/);
    expect(body).toMatch(/padding:\s*0/);
    expect(body).toMatch(/font:\s*inherit/);
    expect(body).toMatch(/cursor:\s*pointer/);
  });

  it.each(STATUS_MODIFIERS)('%s still declares its own border', (selector) => {
    const body = topLevelRuleBody(css, `.${selector}`);
    expect(body).toMatch(/border(-\w+)?:/);
  });

  it('the three outline variants keep a visible border (not none)', () => {
    for (const selector of ['chq-speakers-status-pending', 'chq-speakers-status-overdue', 'chq-speakers-status-none']) {
      const body = topLevelRuleBody(css, `.${selector}`);
      expect(body).not.toMatch(/border:\s*none/);
    }
  });
});
