// DEC-880/DEC-940: .chq-participation-menu-trigger sits after
// .chq-speakers-status(-*) in source order and, because ParticipationMenu.tsx
// puts both `chq-speakers-status chq-speakers-status-<mod>` and
// `chq-participation-menu-trigger` on one <button>, any declaration the
// trigger rule shares with those selectors wins the cascade at equal
// specificity. This has collided three times: `border: none` erased three of
// the four DEC-730 outlines; `background`/`padding`/`font` then erased the
// Complete fill, the shared box metrics and the 11px/700 type entirely. The
// fix is that the trigger rule declares NONE of background/padding/font/
// border -- only appearance + cursor, which nothing else in this family
// touches. jsdom does not apply an external stylesheet (see
// page-measure.test.ts / shell-geometry.test.ts), so this reads the
// stylesheet's own text and asserts on the declarations directly rather than
// rendering + measuring computed style.
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

const OUTLINE_MODIFIERS = ['chq-speakers-status-pending', 'chq-speakers-status-overdue', 'chq-speakers-status-none'];

describe('speakers.css participation chip vs. trigger reset (DEC-880/DEC-940)', () => {
  const css = readFileSync(CSS_PATH, 'utf-8');

  it('the trigger rule declares neither background, padding, font, nor border', () => {
    const body = topLevelRuleBody(css, '.chq-participation-menu-trigger');
    expect(body).not.toMatch(/\bbackground:/);
    expect(body).not.toMatch(/\bpadding:/);
    expect(body).not.toMatch(/\bfont(-\w+)?:/);
    expect(body).not.toMatch(/\bborder(-\w+)?:/);
  });

  it('the trigger rule still resets button chrome the chip does not want (appearance/cursor)', () => {
    const body = topLevelRuleBody(css, '.chq-participation-menu-trigger');
    expect(body).toMatch(/appearance:\s*none/);
    expect(body).toMatch(/cursor:\s*pointer/);
  });

  it('the base chip declares the shared box metrics and type every state needs', () => {
    const body = topLevelRuleBody(css, '.chq-speakers-status');
    expect(body).toMatch(/padding:\s*3px 8px/);
    expect(body).toMatch(/font-size:\s*11px/);
    expect(body).toMatch(/font-weight:\s*700/);
    expect(body).toMatch(/font-family:/);
  });

  it('Complete keeps a non-none background so its text is not invisible on the brand fill', () => {
    const body = topLevelRuleBody(css, '.chq-speakers-status-complete');
    expect(body).toMatch(/background:\s*var\(--chq-brand\)/);
    expect(body).not.toMatch(/background:\s*none/);
  });

  it.each(OUTLINE_MODIFIERS)('%s keeps a visible (non-none) border', (selector) => {
    const body = topLevelRuleBody(css, `.${selector}`);
    expect(body).toMatch(/border(-\w+)?:\s*1px/);
    expect(body).not.toMatch(/border:\s*none/);
  });

  it.each(STATUS_MODIFIERS)('%s still declares its own border', (selector) => {
    const body = topLevelRuleBody(css, `.${selector}`);
    expect(body).toMatch(/border(-\w+)?:/);
  });
});
