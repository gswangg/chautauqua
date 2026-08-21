// task w18-a originally landed DEC-380's wave-18 resolution (data-chq-phone-head
// on PhoneAgenda's root, standing the shell header down so the PAGE'S OWN
// wordmark was the one left on screen). DEC-919 (wave-20 amendment,
// src/decisions-data/DEC-919.md) REVERSES that call: the shell header's
// wordmark is the frame's `:130` wordmark, and PhoneAgenda's copy stands
// down instead (via agenda.css's `/* phone-hidden: */`-receipted
// `.chq-phone-agenda-wordmark { display: none }`, not this attribute) --
// see DEC-919.md's own text for why resolution (a), the one this file used
// to pin, is REJECTED: it would strand `.chq-eventswitcher`, which has no
// phone rule anywhere in styles.css. This file now pins the CORRECTED
// shape: PhoneAgenda sets no header-region attribute at all.
//
// This file keeps two halves, mirroring
// app/src/pages/review/scorecard-phone-frames.test.ts's own split:
//
//   1. a REACT render pin -- mount PhoneAgenda through its real props and
//      assert the corrected attribute contract;
//   2. a SOURCE-SCAN pin on styles.css TEXT -- jsdom applies no @media, so
//      the still-live header-stand-down rule (Scorecard's contract, not
//      Agenda's) is checked by reading the stylesheet's own text, via
//      scorecard-phone-frames.test.ts's phoneRule/topLevelRuleBody idiom.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { ComponentProps } from 'react';
import { PhoneAgenda } from './PhoneAgenda';
import type { AgendaConflict, AgendaRoom, PlacedAgendaSession, UnscheduledAgendaSession } from './types';
// compile-checked provenance marker only (DEC-976 wave-126: the scribe
// overwrites this constant's string for OTHER rulings every wave, so the
// registry-text assertion below reads the durable .md amendment directly,
// never DEC_919's current string).
import { DEC_919 } from '../../../../src/decisions';
import { stripCssComments } from '../../../../test/helpers/strip-css-comments';

void DEC_919;

afterEach(() => {
  cleanup();
});

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');

const ROOMS: AgendaRoom[] = [{ id: 'r1', name: 'Room A' }];
const DAY = '2026-08-15';
const CONFLICTS: AgendaConflict[] = [];

function baseProps(overrides: Partial<ComponentProps<typeof PhoneAgenda>> = {}) {
  return {
    day: DAY,
    days: [DAY],
    onDayChange: vi.fn(),
    rooms: ROOMS,
    placed: [] as PlacedAgendaSession[],
    unscheduled: [] as UnscheduledAgendaSession[],
    conflicts: CONFLICTS,
    summary: { unplaced: 6, conflicts: 2, placed: 0, total: 6 },
    dayStartMin: 480,
    dayEndMin: 1020,
    gridMin: 15,
    onPlace: vi.fn(),
    onUnschedule: vi.fn(),
    onAutoSchedule: vi.fn(),
    autoScheduling: false,
    ...overrides,
  };
}

describe('DEC-919 wave-20 amendment: PhoneAgenda sets no header-region attribute', () => {
  it('the root element carries no data-chq-phone-head (that contract is Scorecard-only; Agenda draws a wordmark, so suppressing the shell header would strand .chq-eventswitcher)', () => {
    const { container } = render(<PhoneAgenda {...baseProps()} />);
    const root = container.querySelector('.chq-phone-agenda');
    expect(root).not.toBeNull();
    expect(root).not.toHaveAttribute('data-chq-phone-head');
  });

  it('the page still renders its own .chq-phone-agenda-wordmark markup once -- it is CSS-hidden at phone (jsdom applies no external stylesheet, so the node is present here even though agenda.css hides it on screen)', () => {
    render(<PhoneAgenda {...baseProps()} />);
    const wordmarks = screen.getAllByText('chautauqua');
    expect(wordmarks).toHaveLength(1);
    expect(wordmarks[0]).toHaveClass('chq-phone-agenda-wordmark');
  });
});

/** Mirrors scorecard-phone-frames.test.ts's phoneLayer/phoneRule pair
 * (:44-81 there) so a nested rule's own closing brace can never end the
 * @media scan early. */
function phoneLayer(css: string): string {
  const out: string[] = [];
  const opener = /@media\s*\(max-width:\s*\d+px\)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = opener.exec(css)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') depth -= 1;
      i += 1;
    }
    if (depth !== 0) throw new Error('unbalanced @media block');
    out.push(css.slice(start, i - 1));
  }
  if (out.length === 0) throw new Error('no max-width media block found');
  return out.join('\n');
}

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

function stripAnyMedia(css: string): string {
  return css.replace(/@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g, '');
}

function topLevelRuleBody(css: string, selector: string): string {
  const withoutMedia = stripAnyMedia(css);
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(withoutMedia);
  if (!m || m[1] === undefined) throw new Error(`no top-level rule for ${selector}`);
  return m[1];
}

const STYLES_CSS = stripCssComments(readFileSync(join(REPO_ROOT, 'app', 'src', 'styles.css'), 'utf-8'));
const PHONE_AGENDA_TSX = readFileSync(join(REPO_ROOT, 'app', 'src', 'pages', 'agenda', 'PhoneAgenda.tsx'), 'utf-8');
const DEC_919_MD = readFileSync(join(REPO_ROOT, 'src', 'decisions-data', 'DEC-919.md'), 'utf-8');

describe('the header-region contract still exists for its actual scope (Scorecard), read from styles.css text (jsdom applies no @media)', () => {
  it('.chq-shell:has([data-chq-phone-head]) .chq-header still sets display:none INSIDE a max-width phone block (Scorecard.tsx is still a live setter)', () => {
    expect(phoneRule(STYLES_CSS, '.chq-shell:has([data-chq-phone-head]) .chq-header')).toMatch(/display:\s*none/);
  });

  it('DEC-385 single-direction: the rule exists ONLY inside a max-width layer, never at top level (desktop keeps its header)', () => {
    expect(() => topLevelRuleBody(STYLES_CSS, '.chq-shell:has([data-chq-phone-head]) .chq-header')).toThrow();
    // control: the helper DOES find a real top-level rule in this sheet,
    // so the throw above is the absence of the rule, not a broken scan.
    expect(topLevelRuleBody(STYLES_CSS, '.chq-tabbar')).toMatch(/display:\s*none/);
  });

  it('PhoneAgenda.tsx sets neither data-chq-phone-head nor data-chq-phone-dock on its root', () => {
    expect(PHONE_AGENDA_TSX).not.toMatch(/className="chq-phone-agenda"[^>]*data-chq-phone-head/);
    expect(PHONE_AGENDA_TSX).not.toMatch(/className="chq-phone-agenda"[^>]*data-chq-phone-dock/);
  });

  it("src/decisions-data/DEC-919.md's wave-20 amendment (the durable, append-only home for this ruling) records the header-region reversal and rejects resolution (a)", () => {
    expect(DEC_919_MD).toMatch(/Amendment \(wave 20\): Agenda 390 draws exactly ONE wordmark/);
    expect(DEC_919_MD).toMatch(/REJECTED/);
    expect(DEC_919_MD).toMatch(/strand `\.chq-eventswitcher`/);
  });
});
