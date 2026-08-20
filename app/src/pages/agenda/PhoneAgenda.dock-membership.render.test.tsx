// DEC-576 wave-114 amendment: pins the 390 dock's MEMBERSHIP, settling the
// mandate's deferred design question ("Whether [Publish schedule] belongs
// in the phone dock instead is a frame deviation needing a proper ruling
// later"). RULED (src/decisions-data/DEC-576.md, wave-114 amendment):
// Publish schedule stays OUT of the phone dock and remains in the desktop
// head's action row, which DEC-919 wave-7 re-lines as the phone head's own
// full-width action row rather than removing the capability. This file is
// the sole owner and pins the ruling at render level so it cannot be
// re-opened by accident: no test today asserted dock MEMBERSHIP (only
// agenda-phone-frame.test.ts's dock GEOMETRY, and PhoneAgenda.w49's arming
// behaviour).
//
// The frame's 390 dock draws exactly two `flex:1` controls at the 44px
// floor -- Unscheduled (bordered) and Auto-schedule (olive) -- no third
// control, no Publish. See the receipted per-assertion citations below for
// the frame line and its backtick literal.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ComponentProps } from 'react';
import { PhoneAgenda } from './PhoneAgenda';
import type { AgendaConflict, AgendaRoom, PlacedAgendaSession, UnscheduledAgendaSession } from './types';
import { DEC_576 } from '../../../../src/decisions'; // compile-checked: this file pins DEC_576's wave-114 amendment

afterEach(() => {
  cleanup();
});

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');

const ROOMS: AgendaRoom[] = [{ id: 'r1', name: 'Room A' }];
const DAY = '2026-08-15';
const CONFLICTS: AgendaConflict[] = [];

function session(id: string, ref: string, title: string, startMin: number, endMin: number): PlacedAgendaSession {
  return {
    submissionId: id,
    ref,
    title,
    trackIds: [],
    speakers: [],
    roomId: 'r1',
    day: DAY,
    startMin,
    endMin,
  };
}

function unscheduledSession(id: string, ref: string, title: string): UnscheduledAgendaSession {
  return { submissionId: id, ref, title, trackIds: [], speakers: [] };
}

function baseProps(overrides: Partial<ComponentProps<typeof PhoneAgenda>> = {}) {
  return {
    day: DAY,
    days: [DAY],
    onDayChange: vi.fn(),
    rooms: ROOMS,
    placed: [] as PlacedAgendaSession[],
    unscheduled: [] as UnscheduledAgendaSession[],
    conflicts: CONFLICTS,
    summary: { unplaced: 0, conflicts: 0, placed: 0, total: 0 },
    dayStartMin: 480, // 08:00
    dayEndMin: 1020, // 17:00
    gridMin: 15,
    onPlace: vi.fn(),
    onUnschedule: vi.fn(),
    onAutoSchedule: vi.fn(),
    autoScheduling: false,
    ...overrides,
  };
}

describe('DEC-576 wave-114: phone agenda dock membership is pinned at exactly two controls', () => {
  it('the DEC_576 constant (src/decisions.ts, compile-checked) states the ruling this file pins', () => {
    expect(DEC_576).toMatch(/Publish schedule stays in the agenda head/);
    expect(DEC_576).toMatch(/never enters the two-control dock/);
  });

  it('renders EXACTLY two interactive controls inside .chq-phone-footer-actions: Unscheduled (with its count) and Auto-schedule', () => {
    const unscheduled = [
      unscheduledSession('u1', 'SES-9', 'Unscheduled Talk One'),
      unscheduledSession('u2', 'SES-10', 'Unscheduled Talk Two'),
      unscheduledSession('u3', 'SES-11', 'Unscheduled Talk Three'),
    ];
    const { container } = render(<PhoneAgenda {...baseProps({ unscheduled })} />);

    const dock = container.querySelector('.chq-phone-footer-actions');
    expect(dock).not.toBeNull();

    const controls = within(dock as HTMLElement).getAllByRole('button');
    expect(controls).toHaveLength(2);

    // docs/design/Chautauqua Agenda.dc.html:198
    // `<span style="flex:1; ...">Unscheduled <span ...>6</span></span>`
    expect(controls[0]).toHaveAccessibleName('Unscheduled 3');
    // docs/design/Chautauqua Agenda.dc.html:198
    // `<span style="flex:1; background:#4E5C31; ...">Auto-schedule</span>`
    expect(controls[1]).toHaveAccessibleName('Auto-schedule');
  });

  it('carries the count through when the unscheduled set is empty -- "Unscheduled 0", not a bare label', () => {
    const { container } = render(<PhoneAgenda {...baseProps({ unscheduled: [] })} />);
    const dock = container.querySelector('.chq-phone-footer-actions');
    const controls = within(dock as HTMLElement).getAllByRole('button');
    // docs/design/Chautauqua Agenda.dc.html:198
    // `<span style="flex:1; ...">Unscheduled <span ...>6</span></span>`
    expect(controls[0]).toHaveAccessibleName('Unscheduled 0');
  });

  it('NO control anywhere inside the dock has an accessible name matching /publish/i -- the ruling this file pins', () => {
    const unscheduled = [unscheduledSession('u1', 'SES-9', 'Unscheduled Talk One')];
    const { container } = render(<PhoneAgenda {...baseProps({ unscheduled })} />);
    const dock = container.querySelector('.chq-phone-footer-actions');
    expect(dock).not.toBeNull();

    // docs/design/Chautauqua Agenda.dc.html:198
    // `<div style="display:flex; gap:8px">` wraps exactly two `flex:1`
    // children -- no third member. A control matching /publish/i landing
    // here would be the frame deviation DEC-576's wave-114 amendment closes.
    const controls = within(dock as HTMLElement).getAllByRole('button');
    expect(controls.every((control) => !/publish/i.test(control.textContent ?? ''))).toBe(true);
    for (const control of controls) {
      expect(control).not.toHaveAccessibleName(/publish/i);
    }

    // Belt-and-braces against a non-<button> control (e.g. a styled <a> or
    // <span role="button">) slipping a third member past the role query
    // above: no text node inside the dock at all should read "Publish".
    expect(within(dock as HTMLElement).queryByText(/publish/i)).not.toBeInTheDocument();
  });

  it('does not gain a third dock member while a session is armed (armed footer is a SEPARATE sibling band, not the dock)', () => {
    const placedSession = session('placed-1', 'SES-1', 'Talk One', 540, 570);
    const { container } = render(<PhoneAgenda {...baseProps({ placed: [placedSession] })} />);

    fireEvent.click(screen.getByText('Talk One').closest('button')!);

    const dock = container.querySelector('.chq-phone-footer-actions');
    expect(dock).not.toBeNull();
    const controls = within(dock as HTMLElement).getAllByRole('button');
    expect(controls).toHaveLength(2);
    expect(controls[1]).toHaveAccessibleName('Auto-schedule');
  });
});

describe('DEC-576 wave-114: Publish schedule stays reachable on phone -- "not in the dock" is never "not on phone" (DEC-919)', () => {
  // The desktop head action row (app/src/pages/Agenda.tsx), not the phone
  // dock (PhoneAgenda.tsx), is what carries Publish schedule at phone width
  // per the ruling -- DEC-919 wave-7's named remedy re-lines the head as
  // the phone head's own full-width action row rather than hiding the
  // capability. Agenda.tsx pulls in live routing/fetch dependencies well
  // outside this file's scope (see Agenda.render.test.tsx's mocked-fetch
  // harness), so this checks the two claims a full mount would check --
  // the control renders unconditionally, and no phone-width rule
  // display:none-gates it -- directly against the source both live in,
  // the same verification method app/src/frame-citation.scan.test.ts and
  // app/src/tautological-assertion.scan.test.ts already use for this repo.
  const agendaSource = readFileSync(join(REPO_ROOT, 'app', 'src', 'pages', 'Agenda.tsx'), 'utf-8');
  const agendaCss = readFileSync(join(REPO_ROOT, 'app', 'src', 'pages', 'agenda', 'agenda.css'), 'utf-8');

  it('Agenda.tsx renders "Publish schedule" as chq-btn-primary in the head action row, unconditionally (no isPhone/!isPhone gate)', () => {
    const match = agendaSource.match(
      /<button type="button" className="chq-btn chq-btn-primary" onClick=\{handlePublish\}[^>]*>\s*\{publishing \? 'Publishing\.\.\.' : 'Publish schedule'\}/,
    );
    expect(match).not.toBeNull();
  });

  it('the phone media block hides the head row\'s chq-btn-secondary (Auto-schedule, re-lined into the dock) but never targets chq-btn-primary (Publish schedule)', () => {
    const phoneBlockStart = agendaCss.indexOf('@media (max-width: 700px)');
    expect(phoneBlockStart).toBeGreaterThan(-1);
    // Strip comments first -- this block's own prose narrates the ruling
    // and mentions ".chq-btn-primary" and "display: none" by name (as
    // adjacent English sentences, never as a CSS rule), which would
    // otherwise false-positive a naive substring/regex scan of raw text.
    const phoneBlock = agendaCss
      .slice(phoneBlockStart)
      .replace(/\/\*[\s\S]*?\*\//g, '');

    // The only phone-width rule scoped to .chq-agenda-head-actions hides
    // its secondary (Auto-schedule) button -- confirming the re-line this
    // file's ruling relies on -- and no rule in the same block targets
    // chq-btn-primary (Publish schedule) for display:none.
    expect(phoneBlock).toMatch(/\.chq-agenda-head-actions \.chq-btn-secondary\s*\{\s*display:\s*none;/);
    expect(phoneBlock).not.toMatch(/\.chq-agenda-head-actions[^{]*\.chq-btn-primary[^{]*\{[^}]*display:\s*none/);
    expect(phoneBlock).not.toMatch(/\.chq-btn-primary[^{]*\{[^}]*display:\s*none/);
  });
});
