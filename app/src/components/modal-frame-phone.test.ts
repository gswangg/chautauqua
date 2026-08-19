// w6-d: ModalFrame's phone drill header.
//
// (a) The drawer's phone padding (styles.css) and the `.chq-drawer
//     .chq-modal-head` negative margin/padding it re-pairs to (this
//     module's modal-frame.css) must be the SAME number, derived from the
//     sheets themselves -- never hard-coded twice, or a future change to
//     one silently reopens the overhang/gutter-mismatch defect this task
//     fixed.
// (b) ModalFrame renders `.chq-phone-back` only when `backLink` is
//     supplied, carrying the literal label ContactDrawer passes.
// (c) `.chq-phone-back`'s 44px floor (styles.css) is declared inside a
//     max-width block, not at top level -- read-only, styles.css is out
//     of scope for this task.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ModalFrame } from './ModalFrame';

const HERE = dirname(fileURLToPath(import.meta.url));
const STYLES_CSS = readFileSync(join(HERE, '../styles.css'), 'utf-8');
const MODAL_FRAME_CSS = readFileSync(join(HERE, './modal-frame.css'), 'utf-8');

/** Comments stripped before any brace scanning -- a literal `{`/`}` inside
 * one would desynchronise a naive scan (mirrors contacts-phone-frames.test.ts). */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Concatenated bodies of every `@media (max-width: …)` block in `css`,
 * brace-matched so a nested rule can never end the block early. */
function phoneLayer(css: string): string {
  const clean = stripComments(css);
  const out: string[] = [];
  const opener = /@media\s*\(max-width:\s*\d+px\)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = opener.exec(clean)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < clean.length && depth > 0) {
      if (clean[i] === '{') depth += 1;
      else if (clean[i] === '}') depth -= 1;
      i += 1;
    }
    if (depth !== 0) throw new Error('unbalanced @media block');
    out.push(clean.slice(start, i - 1));
  }
  if (out.length === 0) throw new Error('no max-width media block found');
  return out.join('\n');
}

/** A single rule's declaration body, by selector, inside the phone layer
 * (whole selector-list membership, not substring). */
function phoneRule(css: string, selector: string): string {
  const layer = phoneLayer(css);
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = rule.exec(layer)) !== null) {
    const selectors = m[1]!
      .split(',')
      .map((s) => s.trim().replace(/\s+/g, ' '))
      .filter(Boolean);
    if (selectors.includes(selector)) return m[2]!;
  }
  throw new Error(`no phone rule for ${selector}`);
}

function topLevelRuleBody(css: string, selector: string): string {
  const withoutMedia = stripComments(css).replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\}[^{}]*)*\}/g, '');
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(withoutMedia);
  if (!m || m[1] === undefined) throw new Error(`no top-level rule for ${selector}`);
  return m[1];
}

function declValue(body: string, prop: string): string {
  const m = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+);?`).exec(body);
  if (!m) throw new Error(`no ${prop} declaration in: ${body}`);
  return m[1]!.trim();
}

afterEach(() => {
  cleanup();
});

describe('w6-d: drawer phone inset pairing (derived from the sheets, not hard-coded)', () => {
  it('the drawer padding, the head negative margin, and the head padding inset all share one number', () => {
    const drawerPadding = declValue(phoneRule(STYLES_CSS, '.chq-drawer'), 'padding');
    const insetPx = drawerPadding.match(/^(\d+)px$/);
    if (!insetPx) throw new Error(`expected a single px padding on .chq-drawer, got: ${drawerPadding}`);
    const inset = insetPx[1];

    const headBody = phoneRule(MODAL_FRAME_CSS, '.chq-drawer .chq-modal-head');
    const margin = declValue(headBody, 'margin');
    const padding = declValue(headBody, 'padding');

    expect(margin).toBe(`-${inset}px -${inset}px 0`);
    expect(padding).toBe(`0 ${inset}px 16px`);
  });

  it('.chq-modal (no drawer ancestor) keeps its 20px/26px pairing at every width -- untouched by the drawer fix', () => {
    expect(() => phoneRule(MODAL_FRAME_CSS, '.chq-modal .chq-modal-head')).toThrow();
    const desktop = topLevelRuleBody(MODAL_FRAME_CSS, '.chq-modal-head');
    expect(declValue(desktop, 'margin')).toBe('-20px -26px 0');
    expect(declValue(desktop, 'padding')).toBe('0 26px 16px');
  });
});

describe('w6-d: ModalFrame renders .chq-phone-back only when backLink is supplied', () => {
  it('renders no .chq-phone-back when backLink is omitted', () => {
    const { container } = render(
      createElement(ModalFrame, { title: 'No back link', onClose: vi.fn(), children: createElement('p', null, 'Body') }),
    );
    expect(container.querySelector('.chq-phone-back')).toBeNull();
  });

  it('renders no .chq-phone-back when backLink is explicitly null', () => {
    const { container } = render(
      createElement(ModalFrame, {
        title: 'Null back link',
        onClose: vi.fn(),
        backLink: null,
        children: createElement('p', null, 'Body'),
      }),
    );
    expect(container.querySelector('.chq-phone-back')).toBeNull();
  });

  it('renders .chq-phone-back as the first child of .chq-modal-head, firing its own onClick', () => {
    const onBack = vi.fn();
    render(
      createElement(ModalFrame, {
        title: 'Contact detail',
        onClose: vi.fn(),
        backLink: { label: '‹ Contacts', onClick: onBack },
        children: createElement('p', null, 'Body'),
      }),
    );

    const back = screen.getByRole('button', { name: '‹ Contacts' });
    expect(back).toHaveClass('chq-link-button');
    expect(back).toHaveClass('chq-phone-back');

    const head = back.closest('.chq-modal-head');
    expect(head).not.toBeNull();
    expect(head!.firstElementChild).toBe(back);

    back.click();
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('w6-d: .chq-phone-back visibility is single-direction (DEC-385)', () => {
  it('is hidden at top level in modal-frame.css', () => {
    const body = topLevelRuleBody(MODAL_FRAME_CSS, '.chq-modal-head .chq-phone-back');
    expect(declValue(body, 'display')).toBe('none');
  });

  it('is un-hidden (display: flex) inside a max-width phone block in modal-frame.css', () => {
    const body = phoneRule(MODAL_FRAME_CSS, '.chq-modal-head .chq-phone-back');
    expect(declValue(body, 'display')).toBe('flex');
  });

  it('declares no min-width media query in modal-frame.css', () => {
    expect(stripComments(MODAL_FRAME_CSS)).not.toMatch(/@media[^{]*min-width/);
  });
});

describe('w6-d: .chq-phone-back 44px floor is a phone-only token (styles.css, read-only)', () => {
  it('is declared inside a max-width block, never at top level', () => {
    expect(() => topLevelRuleBody(STYLES_CSS, '.chq-phone-back')).toThrow();

    const body = phoneRule(STYLES_CSS, '.chq-phone-back');
    expect(declValue(body, 'min-height')).toBe('44px');
    expect(declValue(body, 'display')).toBe('flex');
    expect(declValue(body, 'align-items')).toBe('center');
  });
});
