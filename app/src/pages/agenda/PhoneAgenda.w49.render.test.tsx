// DEC-358 wave-49: falsifiability checks for items iii and iv of
// docs/eval-findings.md's batch-A remainder (re-homed unowned by
// task-w47-h; discharged here per task-w49-f).
//
// iii. Phone agenda N-aware clash caption -- PhoneAgenda.tsx:186. CONFIRMED
//      TRUE at this worker's own runtime: the clash block's flag text is
//      `${countOf(slot.sessions.length, 'session')} in this slot`, so it
//      reads "2 sessions in this slot" for a two-way clash and "3 sessions
//      in this slot" for a three-way clash -- never a fixed string. Asserted
//      at two different N.
// iv.  Phone agenda "Place here anyway" -- PhoneAgenda.tsx:167-176 (placed
//      slot) and :199-208 (clash slot). CONFIRMED TRUE: while a session is
//      armed, EVERY occupied slot (placed or clash) also renders a "Place
//      here anyway" control wired to the same `placeArmedAt(slot.startMin)`
//      the free-run control uses, which calls the real `onPlace` prop with
//      the armed session's id/duration and the occupied slot's own
//      startMin -- i.e. it actually performs the placement, not merely
//      renders a button. Asserted by clicking it and inspecting the
//      onPlace call args, for both a plain `placed` slot and a `clash` slot.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { ComponentProps } from 'react';
import { PhoneAgenda } from './PhoneAgenda';
import type { AgendaConflict, AgendaRoom, PlacedAgendaSession, UnscheduledAgendaSession } from './types';

afterEach(() => {
  cleanup();
});

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

describe('item iii: phone agenda clash caption is N-aware (PhoneAgenda.tsx:186)', () => {
  it('reads "2 sessions in this slot" for a two-way clash', () => {
    const placed = [session('s1', 'SES-1', 'Talk One', 540, 570), session('s2', 'SES-2', 'Talk Two', 555, 585)];
    render(<PhoneAgenda {...baseProps({ placed })} />);
    expect(screen.getByText('2 sessions in this slot')).toBeInTheDocument();
    expect(screen.queryByText('3 sessions in this slot')).not.toBeInTheDocument();
  });

  it('reads "3 sessions in this slot" for a three-way clash -- not the same fixed string as the two-way case', () => {
    const placed = [
      session('s1', 'SES-1', 'Talk One', 540, 570),
      session('s2', 'SES-2', 'Talk Two', 555, 585),
      session('s3', 'SES-3', 'Talk Three', 560, 590),
    ];
    render(<PhoneAgenda {...baseProps({ placed })} />);
    expect(screen.getByText('3 sessions in this slot')).toBeInTheDocument();
    expect(screen.queryByText('2 sessions in this slot')).not.toBeInTheDocument();
  });
});

describe('item iv: "Place here anyway" actually performs the placement (PhoneAgenda.tsx:167-176,199-208)', () => {
  it('on a plain placed slot, calls the real onPlace with the armed session and the occupied slot\'s own startMin', () => {
    const placedSession = session('placed-1', 'SES-1', 'Talk One', 540, 570); // 09:00-09:30
    const armedUnscheduled: UnscheduledAgendaSession = {
      submissionId: 'unsch-1',
      ref: 'SES-9',
      title: 'Unscheduled Talk',
      trackIds: [],
      speakers: [],
    };
    const onPlace = vi.fn();
    render(
      <PhoneAgenda
        {...baseProps({
          placed: [placedSession],
          unscheduled: [armedUnscheduled],
          onPlace,
        })}
      />,
    );

    // No "Place here anyway" control until something is armed.
    expect(screen.queryByText('Place here anyway')).not.toBeInTheDocument();

    // Arm the unscheduled session via the sheet.
    fireEvent.click(screen.getByRole('button', { name: /Unscheduled/ }));
    const sheet = screen.getByRole('dialog', { name: 'Unscheduled sessions' });
    fireEvent.click(within(sheet).getByText('Unscheduled Talk'));

    const placeAnyway = screen.getByText('Place here anyway');
    fireEvent.click(placeAnyway);

    expect(onPlace).toHaveBeenCalledTimes(1);
    // armed.durationMin defaults to 30 for a session armed from the
    // unscheduled sheet (DEC-380); the target startMin is the OCCUPIED
    // slot's own startMin (540), not some free run's.
    expect(onPlace).toHaveBeenCalledWith('unsch-1', 'r1', 540, 570);
  });

  it('on a clash slot, calls the real onPlace with the occupied clash slot\'s own startMin', () => {
    const clashA = session('clash-a', 'SES-1', 'Talk One', 540, 570);
    const clashB = session('clash-b', 'SES-2', 'Talk Two', 555, 585);
    const otherPlaced = session('other', 'SES-3', 'Talk Three', 660, 690); // 11:00-11:30, armed FROM this card
    const onPlace = vi.fn();
    render(
      <PhoneAgenda
        {...baseProps({
          placed: [clashA, clashB, otherPlaced],
          onPlace,
        })}
      />,
    );

    // Arm by tapping the already-placed "Talk Three" card (origin: 'placed').
    fireEvent.click(screen.getByText('Talk Three').closest('button')!);

    // The clash slot (start 540) now also offers "Place here anyway".
    const placeAnywayButtons = screen.getAllByText('Place here anyway');
    expect(placeAnywayButtons.length).toBeGreaterThan(0);
    fireEvent.click(placeAnywayButtons[0]!);

    expect(onPlace).toHaveBeenCalledTimes(1);
    // "other"'s own duration (690-660=30) is preserved when re-armed from a
    // placed card (origin 'placed' keeps endMin-startMin, DEC-380), and the
    // target startMin is the clash slot's own startMin (540).
    expect(onPlace).toHaveBeenCalledWith('other', 'r1', 540, 570);
  });
});
