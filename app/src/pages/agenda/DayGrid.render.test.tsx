// DEC-557 amendment (wave 48): the merged clash card must read its
// conflict caption from the server's conflict `kind`, never assume
// 'room_overlap' -- and must never form at all in the room-less (TBD)
// column, since schedule.ts never emits a room_overlap for a null roomId.

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';

afterEach(cleanup);

import { DayGrid } from './DayGrid';
import type { AgendaConflict, AgendaRoom, AgendaTrack, PlacedAgendaSession } from './types';

const ROOMS: AgendaRoom[] = [{ id: 'room-1', name: 'Room One' }];
const TRACKS: AgendaTrack[] = [];

function session(overrides: Partial<PlacedAgendaSession>): PlacedAgendaSession {
  return {
    submissionId: 'sub-1',
    ref: 'SES-001',
    title: 'Talk One',
    trackIds: [],
    speakers: [],
    roomId: 'room-1',
    day: '2026-08-13',
    startMin: 540,
    endMin: 570,
    ...overrides,
  };
}

const BASE_PROPS = {
  day: '2026-08-13',
  rooms: ROOMS,
  tracks: TRACKS,
  dayStartMin: 540,
  dayEndMin: 1080,
  gridMin: 15,
  onDropPlace: () => {},
  armed: null,
  onArm: () => {},
  onPlaceAt: () => {},
};

describe('DayGrid clash cards', () => {
  it('renders NO clash card for two overlapping room-less sessions (no room_overlap can exist without a room)', () => {
    const placed: PlacedAgendaSession[] = [
      session({ submissionId: 'sub-1', roomId: null, startMin: 540, endMin: 570 }),
      session({ submissionId: 'sub-2', ref: 'SES-002', title: 'Talk Two', roomId: null, startMin: 550, endMin: 580 }),
    ];
    // No conflicts recorded -- room-less sessions never get a room_overlap.
    const conflicts: AgendaConflict[] = [];
    const { container } = render(<DayGrid {...BASE_PROPS} placed={placed} conflicts={conflicts} />);
    expect(container.querySelector('.chq-day-grid-clash-card')).toBeNull();
    expect(container.textContent).not.toContain('in one room');
  });

  it('renders the combined caption for a same-room pair that also shares a speaker', () => {
    const placed: PlacedAgendaSession[] = [
      session({ submissionId: 'sub-1', roomId: 'room-1', startMin: 540, endMin: 570 }),
      session({ submissionId: 'sub-2', ref: 'SES-002', title: 'Talk Two', roomId: 'room-1', startMin: 550, endMin: 580 }),
    ];
    const conflicts: AgendaConflict[] = [
      {
        kind: 'room_overlap',
        submissionIds: ['sub-1', 'sub-2'],
        day: '2026-08-13',
        roomId: 'room-1',
        speakerContactIds: [],
        detail: 'room clash',
      },
      {
        kind: 'speaker_overlap',
        submissionIds: ['sub-1', 'sub-2'],
        day: '2026-08-13',
        roomId: null,
        speakerContactIds: ['ct-1'],
        detail: 'speaker clash',
      },
    ];
    const { container } = render(<DayGrid {...BASE_PROPS} placed={placed} conflicts={conflicts} />);
    const card = container.querySelector('.chq-day-grid-clash-card');
    expect(card).not.toBeNull();
    expect(container.querySelector('.chq-day-grid-clash-caption')?.textContent).toBe('Room & speaker conflict');
  });

  it('renders the room caption for a same-room pair with no shared speaker', () => {
    const placed: PlacedAgendaSession[] = [
      session({ submissionId: 'sub-1', roomId: 'room-1', startMin: 540, endMin: 570 }),
      session({ submissionId: 'sub-2', ref: 'SES-002', title: 'Talk Two', roomId: 'room-1', startMin: 550, endMin: 580 }),
    ];
    const conflicts: AgendaConflict[] = [
      {
        kind: 'room_overlap',
        submissionIds: ['sub-1', 'sub-2'],
        day: '2026-08-13',
        roomId: 'room-1',
        speakerContactIds: [],
        detail: 'room clash',
      },
    ];
    const { container } = render(<DayGrid {...BASE_PROPS} placed={placed} conflicts={conflicts} />);
    expect(container.querySelector('.chq-day-grid-clash-caption')?.textContent).toBe('Two sessions in one room');
  });
});
