// DEC-895 (wave 33): the phone agenda clash card's one-tap resolution --
// frame docs/design/Chautauqua Agenda.dc.html:171, the last child of the
// clash card, a filled #F4F1E8-on-#1B1D17 control at min-height:44px
// reading "Move DFC-047 to 11:30". Verified this wave as the pack's last
// unbuilt drawn CONTROL (scanned across all 53 phone frames).
//
// Computed client-side via the SAME nextFreeSlot scan
// buildConflictResolutionFor uses server-side (src/server/repo/overview/
// scheduling.ts), picking the LATER of the clashing pair, searching only
// the room it currently occupies, excluding it from `existing`, and never
// defaulting `blocked` to empty -- three cases below cover: renders and
// places correctly; renders nothing when the room has no free run left;
// renders nothing when a break covers the only free run (proves `blocked`
// is threaded, not defaulted).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ComponentProps } from 'react';
import { PhoneAgenda } from './PhoneAgenda';
import type { ScheduleBreakRow } from './BreaksPanel';
import type { AgendaConflict, AgendaRoom, PlacedAgendaSession, UnscheduledAgendaSession } from './types';

afterEach(() => {
  cleanup();
});

const HERE = dirname(fileURLToPath(import.meta.url));
const DESIGN_FILE = join(HERE, '../../../../docs/design/Chautauqua Agenda.dc.html');

/** Copied verbatim from app/src/pages/review/Scorecard.overall-390.render.test.tsx
 * (itself citing settings-phone-390.frames.test.ts's own `verbatimLine`). */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

it('frame Agenda.dc.html:171 draws the clash card\'s filled resolution control verbatim', () => {
  verbatimLine(
    171,
    '                <span style="background:#F4F1E8; color:#1B1D17; border-radius:5px; min-height:44px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:700">Move DFC-047 to 11:30</span>',
  );
});

const ROOMS: AgendaRoom[] = [{ id: 'r1', name: 'Room A' }];
const DAY = '2026-08-15';
const CONFLICTS: AgendaConflict[] = [];

function session(id: string, ref: string, title: string, startMin: number, endMin: number, roomId: string | null = 'r1'): PlacedAgendaSession {
  return {
    submissionId: id,
    ref,
    title,
    trackIds: [],
    speakers: [],
    roomId,
    day: DAY,
    startMin,
    endMin,
  };
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
    dayStartMin: 540, // 09:00
    dayEndMin: 720, // 12:00
    gridMin: 15,
    breaks: [] as ScheduleBreakRow[],
    onPlace: vi.fn(),
    onUnschedule: vi.fn(),
    onAutoSchedule: vi.fn(),
    autoScheduling: false,
    ...overrides,
  };
}

function breakRow(startMin: number, durationMin: number): ScheduleBreakRow {
  return {
    id: 'brk-1',
    eventId: 'evt-1',
    day: DAY,
    label: 'Lunch',
    location: null,
    startMin,
    durationMin,
    createdAt: 0,
    updatedAt: 0,
  };
}

describe('DEC-895: clash card one-tap resolution', () => {
  it('renders exactly one control naming the LATER session and the next free time; tapping it moves the later session; the earlier one is untouched', () => {
    // Clash 09:00-09:45 in Room A: earlier ends 09:30, LATER (DFC-047) runs
    // 09:15-09:45. Excluding the later session itself from `existing`
    // (DEC-895: it must not block its own search), the room's next free
    // grid slot is right after the EARLIER session ends -- 09:30.
    const earlier = session('earlier-id', 'DFC-010', 'Earlier Talk', 540, 570); // 09:00-09:30
    const later = session('later-id', 'DFC-047', 'Later Talk', 555, 585); // 09:15-09:45
    const onPlace = vi.fn();
    render(<PhoneAgenda {...baseProps({ placed: [earlier, later], onPlace })} />);

    const controls = screen.getAllByRole('button', { name: /^Move / });
    expect(controls).toHaveLength(1);
    expect(controls[0]).toHaveTextContent('Move DFC-047 to 9:30');

    // w16-qg (DEC-998): a fully-receipted, non-header citation into the
    // same frame the file's header names -- pays for the header-block
    // scope citation above. docs/design/Chautauqua Agenda.dc.html:171
    // receipted via verbatimLine below (the frame's own sample time
    // "11:30" is not graded, DEC-967; this fixture's real computed time
    // is asserted separately just above).
    verbatimLine(
      171,
      '                <span style="background:#F4F1E8; color:#1B1D17; border-radius:5px; min-height:44px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:700">Move DFC-047 to 11:30</span>',
    );

    fireEvent.click(controls[0]!);
    expect(onPlace).toHaveBeenCalledTimes(1);
    // moves the LATER session (later-id / DFC-047), into its own room, at
    // the next free slot (9:30-10:00, its own 30-min duration preserved).
    expect(onPlace).toHaveBeenCalledWith('later-id', 'r1', 570, 600);

    // the earlier session is untouched -- no click handler fired for it,
    // and its own card is still just the plain clash item, not a move
    // control.
    expect(screen.queryByRole('button', { name: /^Move DFC-010/ })).not.toBeInTheDocument();
  });

  it('renders NO control when the room has no free run left for the rest of the day', () => {
    // Room A is fully booked from 09:00 straight through to dayEndMin
    // (12:00): the clash pair PLUS a third session backfilling the only
    // gap that would otherwise be free.
    const earlier = session('earlier-id', 'DFC-010', 'Earlier Talk', 540, 570); // 09:00-09:30
    const later = session('later-id', 'DFC-047', 'Later Talk', 555, 585); // 09:15-09:45
    const filler = session('filler-id', 'DFC-099', 'Filler Talk', 585, 720); // 09:45-12:00 (fills the rest of the day)
    render(<PhoneAgenda {...baseProps({ placed: [earlier, later, filler] })} />);

    expect(screen.queryByRole('button', { name: /^Move / })).not.toBeInTheDocument();
  });

  it('renders NO control when a break covers the only free run left in the room (proves `blocked` is threaded, not defaulted)', () => {
    // Same clash pair as the first case above, where a control renders at
    // 09:30 (the room's free run after excluding the moving session
    // itself, 09:30-12:00) -- this time a break covers that ENTIRE run, so
    // nextFreeSlot must refuse it, same as autoSchedule would. If `blocked`
    // were silently defaulted to empty, this would wrongly render the same
    // "Move DFC-047 to 9:30" control the first case asserts.
    const earlier = session('earlier-id', 'DFC-010', 'Earlier Talk', 540, 570); // 09:00-09:30
    const later = session('later-id', 'DFC-047', 'Later Talk', 555, 585); // 09:15-09:45
    const lunch = breakRow(570, 150); // 09:30-12:00 -- the whole free run
    render(<PhoneAgenda {...baseProps({ placed: [earlier, later], breaks: [lunch] })} />);

    expect(screen.queryByRole('button', { name: /^Move / })).not.toBeInTheDocument();
  });
});
