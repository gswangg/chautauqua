// DEC-870: arming a session must never add a second direct child to
// .chq-agenda-layout — DayGrid returns a fragment (grid div + a
// conditional armed "no room" button), so the two must land inside ONE
// wrapper (.chq-agenda-main) alongside the Unscheduled tray, or the armed
// button becomes grid item #2 and pushes the tray to row 2, off-screen.
// This test renders the exact wrapper markup Agenda.tsx uses (DayGrid +
// UnscheduledTray inside .chq-agenda-layout) armed and unarmed, and pins
// the child count/order/nesting DEC-870 depends on.

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';

afterEach(cleanup);

import { DayGrid, type ArmedAgendaSession } from './DayGrid';
import { UnscheduledTray } from './UnscheduledTray';
import type { AgendaConflict, AgendaRoom, AgendaTrack, PlacedAgendaSession } from './types';

const ROOMS: AgendaRoom[] = [{ id: 'room-1', name: 'Room One' }];
const TRACKS: AgendaTrack[] = [];
const PLACED: PlacedAgendaSession[] = [];
const CONFLICTS: AgendaConflict[] = [];

const ARMED_SESSION: ArmedAgendaSession = {
  submissionId: 'sub-1',
  ref: 'SES-001',
  title: 'Talk One',
  durationMin: 30,
};

/** Mirrors the desktop branch of Agenda.tsx's `.chq-agenda-layout` render
 * (DayGrid wrapped in .chq-agenda-main + UnscheduledTray) so the test
 * exercises the same structural fragment-into-grid hazard the real page
 * hits, without pulling in the page's data-fetching/router dependencies. */
function AgendaLayoutHarness({ armed }: { armed: ArmedAgendaSession | null }) {
  return (
    <div className="chq-agenda-layout">
      <div className="chq-agenda-main">
        <DayGrid
          day="2026-08-13"
          rooms={ROOMS}
          tracks={TRACKS}
          placed={PLACED}
          conflicts={CONFLICTS}
          dayStartMin={540}
          dayEndMin={1080}
          gridMin={15}
          onDropPlace={() => {}}
          armed={armed}
          onArm={() => {}}
          onPlaceAt={() => {}}
        />
      </div>
      <UnscheduledTray
        sessions={[]}
        tracks={TRACKS}
        conflicts={CONFLICTS}
        unplacedReasons={[]}
        onDropUnschedule={() => {}}
        armed={armed}
        onArm={() => {}}
      />
    </div>
  );
}

function directChildClassNames(layout: Element): string[] {
  return Array.from(layout.children).map((el) => el.className);
}

describe('agenda layout does not evict the Unscheduled tray while armed', () => {
  it('unarmed: .chq-agenda-layout has exactly [.chq-agenda-main, .chq-unscheduled-tray]', () => {
    const { container } = render(<AgendaLayoutHarness armed={null} />);
    const layout = container.querySelector('.chq-agenda-layout')!;
    expect(directChildClassNames(layout)).toEqual(['chq-agenda-main', 'chq-unscheduled-tray']);
  });

  it('armed: .chq-agenda-layout STILL has exactly the same two direct children, in the same order', () => {
    const { container } = render(<AgendaLayoutHarness armed={ARMED_SESSION} />);
    const layout = container.querySelector('.chq-agenda-layout')!;
    expect(directChildClassNames(layout)).toEqual(['chq-agenda-main', 'chq-unscheduled-tray']);
  });

  it('armed: the "no room" placement control is a descendant of .chq-agenda-main, not a sibling of it', () => {
    const { container } = render(<AgendaLayoutHarness armed={ARMED_SESSION} />);
    const main = container.querySelector('.chq-agenda-main')!;
    const noRoomBtn = container.querySelector('.chq-day-grid-noroom-btn');
    expect(noRoomBtn).not.toBeNull();
    expect(main.contains(noRoomBtn)).toBe(true);
    // and it must not have escaped into .chq-agenda-layout as a direct child
    const layout = container.querySelector('.chq-agenda-layout')!;
    expect(Array.from(layout.children)).not.toContain(noRoomBtn);
  });
});

// w41: tray polish -- no drag-handle affordance on tray cards (click-to-place
// is the sanctioned path), and the tray footer hint collapses to one line.
describe('unscheduled tray polish (w41)', () => {
  const SESSION = {
    submissionId: 'sub-1',
    ref: 'SES-001',
    title: 'Talk One',
    trackIds: [],
    speakers: [],
  };

  it('tray cards render no ⋮⋮ drag-handle element or class', () => {
    const { container } = render(
      <UnscheduledTray
        sessions={[SESSION as never]}
        tracks={[]}
        conflicts={[]}
        unplacedReasons={[]}
        onDropUnschedule={() => {}}
        armed={null}
        onArm={() => {}}
      />,
    );
    // No dedicated drag-handle affordance markup/class -- the whole card
    // stays draggable (drag-back-to-unschedule still works, DEC-021), but
    // there is no separate ⋮⋮ handle element inside it.
    expect(container.querySelector('.chq-session-card-handle')).toBeNull();
    expect(container.textContent).not.toContain('⋮⋮');
  });

  it('tray footer hint is a single line naming click-to-place and drag-to-unschedule', () => {
    const { container } = render(
      <UnscheduledTray
        sessions={[SESSION as never]}
        tracks={[]}
        conflicts={[]}
        unplacedReasons={[]}
        onDropUnschedule={() => {}}
        armed={null}
        onArm={() => {}}
      />,
    );
    const hint = container.querySelector('.chq-unscheduled-tray-hint');
    expect(hint?.textContent).toBe('Click a session, then click a time slot · drag back to unschedule');
  });

  it('tray card states its duration as "· N min"', () => {
    const { container } = render(
      <UnscheduledTray
        sessions={[SESSION as never]}
        tracks={[]}
        conflicts={[]}
        unplacedReasons={[]}
        onDropUnschedule={() => {}}
        armed={null}
        onArm={() => {}}
      />,
    );
    expect(container.querySelector('.chq-unscheduled-tray-duration')?.textContent).toBe('· 30 min');
  });
});
