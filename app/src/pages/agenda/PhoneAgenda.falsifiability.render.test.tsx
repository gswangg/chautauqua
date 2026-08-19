// w51-b falsifiability batch A (items 2 and 3, DEC-358/DEC-069): the phone
// agenda's clash caption must be N-aware (derived from countOf, not a
// hardcoded "sessions in this slot"), and an armed session must offer
// "Place here anyway" on top of an already-occupied placed/clash slot, not
// only on the empty free runs. Both checks mount the real component and
// assert observable DOM output -- reverting either behavior in
// PhoneAgenda.tsx must turn one of these red.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { PhoneAgenda } from './PhoneAgenda';
import type { AgendaConflict, AgendaRoom, PlacedAgendaSession, UnscheduledAgendaSession } from './types';

afterEach(() => cleanup());

const ROOM: AgendaRoom = { id: 'room-1', name: 'Ballroom' };

function session(overrides: Partial<PlacedAgendaSession>): PlacedAgendaSession {
  return {
    submissionId: 'sub-default',
    ref: 'T-1',
    title: 'Default Talk',
    trackIds: [],
    speakers: [],
    roomId: ROOM.id,
    day: '2026-09-01',
    startMin: 540,
    endMin: 570,
    ...overrides,
  };
}

const NO_CONFLICTS: AgendaConflict[] = [];

function baseProps(overrides: {
  placed?: PlacedAgendaSession[];
  unscheduled?: UnscheduledAgendaSession[];
}) {
  return {
    day: '2026-09-01',
    days: ['2026-09-01'],
    onDayChange: vi.fn(),
    rooms: [ROOM],
    placed: overrides.placed ?? [],
    unscheduled: overrides.unscheduled ?? [],
    conflicts: NO_CONFLICTS,
    summary: { unplaced: 0, conflicts: 0, placed: 0, total: 0 },
    dayStartMin: 540,
    dayEndMin: 600,
    gridMin: 15,
    onPlace: vi.fn(),
    onUnschedule: vi.fn(),
    onAutoSchedule: vi.fn(),
    autoScheduling: false,
  };
}

describe('PhoneAgenda clash caption is N-aware', () => {
  it('reads "2 sessions in this slot" for a two-way clash', () => {
    const placed = [
      session({ submissionId: 'sub-1', ref: 'T-1', title: 'Talk One', startMin: 540, endMin: 570 }),
      session({ submissionId: 'sub-2', ref: 'T-2', title: 'Talk Two', startMin: 545, endMin: 575 }),
    ];
    render(<PhoneAgenda {...baseProps({ placed })} />);
    expect(screen.getByText('2 sessions in this slot')).toBeInTheDocument();
    expect(screen.queryByText('3 sessions in this slot')).not.toBeInTheDocument();
  });

  it('reads "3 sessions in this slot" for a three-way clash (proves the count is derived, not hardcoded)', () => {
    const placed = [
      session({ submissionId: 'sub-1', ref: 'T-1', title: 'Talk One', startMin: 540, endMin: 570 }),
      session({ submissionId: 'sub-2', ref: 'T-2', title: 'Talk Two', startMin: 545, endMin: 575 }),
      session({ submissionId: 'sub-3', ref: 'T-3', title: 'Talk Three', startMin: 550, endMin: 580 }),
    ];
    render(<PhoneAgenda {...baseProps({ placed })} />);
    expect(screen.getByText('3 sessions in this slot')).toBeInTheDocument();
    expect(screen.queryByText('2 sessions in this slot')).not.toBeInTheDocument();
  });
});

describe('PhoneAgenda "Place here anyway" on occupied slots', () => {
  it('offers "Place here anyway" on a placed (single) slot once a session is armed, and calls onPlace on tap', () => {
    const placed = [session({ submissionId: 'sub-1', ref: 'T-1', title: 'Talk One', startMin: 540, endMin: 570 })];
    const unscheduled: UnscheduledAgendaSession[] = [
      { submissionId: 'sub-99', ref: 'T-99', title: 'Waiting Talk', trackIds: [], speakers: [] },
    ];
    const props = baseProps({ placed, unscheduled });
    render(<PhoneAgenda {...props} />);

    // Nothing armed yet: no "Place here anyway" affordance anywhere.
    expect(screen.queryByText('Place here anyway')).not.toBeInTheDocument();

    // Open the unscheduled sheet and arm the waiting session.
    fireEvent.click(screen.getByText(/Unscheduled/));
    fireEvent.click(screen.getByText('Waiting Talk'));

    // Now armed: the already-occupied placed slot offers Place here anyway
    // alongside its existing card, not just the empty free runs.
    const placeAnywayButtons = screen.getAllByText('Place here anyway');
    expect(placeAnywayButtons.length).toBeGreaterThan(0);

    fireEvent.click(placeAnywayButtons[0]!);
    expect(props.onPlace).toHaveBeenCalledWith('sub-99', ROOM.id, 540, 570);
  });

  it('offers "Place here anyway" on a clash slot once a session is armed', () => {
    const placed = [
      session({ submissionId: 'sub-1', ref: 'T-1', title: 'Talk One', startMin: 540, endMin: 570 }),
      session({ submissionId: 'sub-2', ref: 'T-2', title: 'Talk Two', startMin: 545, endMin: 575 }),
    ];
    const unscheduled: UnscheduledAgendaSession[] = [
      { submissionId: 'sub-99', ref: 'T-99', title: 'Waiting Talk', trackIds: [], speakers: [] },
    ];
    render(<PhoneAgenda {...baseProps({ placed, unscheduled })} />);

    fireEvent.click(screen.getByText(/Unscheduled/));
    fireEvent.click(screen.getByText('Waiting Talk'));

    // The clash card's own "Place here anyway" sits alongside the "2
    // sessions in this slot" clash caption.
    expect(screen.getByText('2 sessions in this slot')).toBeInTheDocument();
    expect(screen.getAllByText('Place here anyway').length).toBeGreaterThan(0);
  });
});
