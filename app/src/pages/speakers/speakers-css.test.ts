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

// DEC-730 amendment (wave 39): matrix header inverts the frame's emphasis --
// task TITLE gets sentence-case ink at ~15px, the DUE/REQUIRED second line
// keeps the shared 11px uppercase-muted register, and the header row closes
// with a 2px ink rule (docs/design/README.md: "one 2px rule per section").
describe('speakers.css matrix header register (DEC-730 amendment, wave 39)', () => {
  const css = readFileSync(CSS_PATH, 'utf-8');

  it('the task title is sentence-case ink at ~15px, not uppercase-muted', () => {
    const body = topLevelRuleBody(css, '.chq-speakers-task-title');
    expect(body).toMatch(/font-size:\s*15px/);
    expect(body).toMatch(/text-transform:\s*none/);
    expect(body).toMatch(/color:\s*var\(--chq-ink\)/);
  });

  it('the due/required line keeps the uppercase-muted micro-label register', () => {
    const body = topLevelRuleBody(css, '.chq-speakers-task-due');
    expect(body).toMatch(/text-transform:\s*uppercase/);
    expect(body).toMatch(/color:\s*var\(--chq-muted\)/);
  });

  it('the header row closes with a 2px ink rule, not the shared 1px hairline', () => {
    const body = topLevelRuleBody(css, '.chq-speakers-grid thead th');
    expect(body).toMatch(/border-bottom:\s*2px solid var\(--chq-ink\)/);
  });
});

// DEC-385: the toolbar's 13px control shrink is single-direction -- it is the
// BASE rule and the phone block restores the 44px tap target. Because
// `.chq-speakers-toolbar .chq-input` outranks the bare `.chq-input` phone
// rule in styles.css, dropping the restore here would silently shrink every
// toolbar control to a sub-44px target at 390px.
describe('speakers.css toolbar control shrink is max-width-only (DEC-385)', () => {
  const css = readFileSync(CSS_PATH, 'utf-8');

  it('declares no min-width media query anywhere', () => {
    expect(css.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/min-width\s*:\s*[0-9.]+px\s*\)/);
  });

  it('shrinks the toolbar controls at the top level, not inside a media block', () => {
    const body = topLevelRuleBody(css, '.chq-speakers-toolbar .chq-input,\n.chq-speakers-toolbar .chq-select');
    expect(body).toMatch(/font-size:\s*13px/);
    expect(body).toMatch(/min-height:\s*0/);
  });

  it('restores the 44px tap target for those same controls inside the 700px phone block', () => {
    const phone = css.match(/@media \(max-width: 700px\) \{([\s\S]*)\}\s*$/)?.[1];
    if (phone === undefined) throw new Error('no @media (max-width: 700px) block found in speakers.css');
    const restore = phone.match(
      /\.chq-speakers-toolbar \.chq-input,\s*\.chq-speakers-toolbar \.chq-select\s*\{([^}]*)\}/,
    )?.[1];
    if (restore === undefined) throw new Error('the phone block does not restate the toolbar control rule');
    expect(restore).toMatch(/min-height:\s*44px/);
  });
});
