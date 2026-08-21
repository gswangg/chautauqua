// task w18-a: AGENDA 390 -- one wordmark, not two (DEC-380 wave-18
// amendment, src/decisions-data/DEC-380.md).
//
// VERIFIED DIVERGENCE at main 6aa65834: at 390 on /admin/agenda the app
// rendered TWO `chautauqua` wordmarks stacked -- the app-shell header's
// (App.tsx, .chq-wordmark) and this page's own (.chq-phone-agenda-wordmark).
// The 390x844 phone shell in docs/design/Chautauqua Agenda.dc.html (line
// 128) makes THIS page's bordered head band its first child, carrying the
// wordmark beside the page-specific "6 unplaced · 2 clash" counter -- no
// app-shell header above it anywhere in the frame. The strict citation with
// its receipt quote sits beside the assertion it backs, below. The fix: PhoneAgenda's
// root now carries data-chq-phone-head, the same header-region contract
// Scorecard.tsx already sets, so app/src/styles.css's
// `.chq-shell:has([data-chq-phone-head]) .chq-header { display: none; }`
// (inside its max-width:700px block) stands the shell header down.
//
// This file has two halves, mirroring
// app/src/pages/review/scorecard-phone-frames.test.ts's own split:
//
//   1. a REACT render pin -- mount PhoneAgenda through its real props and
//      assert the attribute contract + single-wordmark outcome directly;
//   2. a SOURCE-SCAN pin on styles.css TEXT -- jsdom applies no @media, so
//      the header-stand-down rule can only be checked by reading the
//      stylesheet's own text, copying scorecard-phone-frames.test.ts's
//      phoneRule/topLevelRuleBody idiom (:70-95 there) rather than
//      inventing a third implementation of the same brace-matcher.
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
// never DEC_380's current string).
import { DEC_380 } from '../../../../src/decisions';
import { stripCssComments } from '../../../../test/helpers/strip-css-comments';

void DEC_380;

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

describe('PhoneAgenda declares the header-region contract on its root', () => {
  it('the root element carries data-chq-phone-head', () => {
    const { container } = render(<PhoneAgenda {...baseProps()} />);
    const root = container.querySelector('.chq-phone-agenda');
    expect(root).not.toBeNull();
    expect(root).toHaveAttribute('data-chq-phone-head');
  });

  it('exactly one .chq-phone-agenda-wordmark renders -- the page draws its own, the shell header stands down beside it', () => {
    // docs/design/Chautauqua Agenda.dc.html:128 `border-bottom:1px solid #1B1D17; padding:14px 16px; flex-shrink:0; display:flex; flex-direction:column` -- the ONLY head band the frame draws for this screen.
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
const DEC_380_MD = readFileSync(join(REPO_ROOT, 'src', 'decisions-data', 'DEC-380.md'), 'utf-8');

describe('the header-region contract itself, read from styles.css text (jsdom applies no @media)', () => {
  it('.chq-shell:has([data-chq-phone-head]) .chq-header sets display:none INSIDE a max-width phone block', () => {
    expect(phoneRule(STYLES_CSS, '.chq-shell:has([data-chq-phone-head]) .chq-header')).toMatch(/display:\s*none/);
  });

  it('DEC-385 single-direction: the rule exists ONLY inside a max-width layer, never at top level (desktop keeps its header)', () => {
    expect(() => topLevelRuleBody(STYLES_CSS, '.chq-shell:has([data-chq-phone-head]) .chq-header')).toThrow();
    // control: the helper DOES find a real top-level rule in this sheet,
    // so the throw above is the absence of the rule, not a broken scan.
    expect(topLevelRuleBody(STYLES_CSS, '.chq-tabbar')).toMatch(/display:\s*none/);
  });

  it('PhoneAgenda.tsx sets data-chq-phone-head on its root, and its own return statement never sets data-chq-phone-dock (its footer is .chq-phone-footer, not the shell dock)', () => {
    expect(PHONE_AGENDA_TSX).toMatch(/className="chq-phone-agenda" data-chq-phone-head/);
    expect(PHONE_AGENDA_TSX).not.toMatch(/className="chq-phone-agenda"[^>]*data-chq-phone-dock/);
  });

  it("src/decisions-data/DEC-380.md's wave-18 amendment (the durable, append-only home for this ruling) records the header-region ruling and the no-capability-lost reasoning", () => {
    expect(DEC_380_MD).toMatch(/Amendment \(wave 18\): AGENDA 390 — one wordmark, not two/);
    expect(DEC_380_MD).toMatch(/PhoneAgenda's root carries `data-chq-phone-head`/);
    expect(DEC_380_MD).toMatch(/`\.chq-main:has\(\[data-chq-phone-dock\]\) ~ \.chq-tabbar` does not fire/);
  });
});
