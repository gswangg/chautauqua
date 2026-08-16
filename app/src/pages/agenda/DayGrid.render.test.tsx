// DEC-557 amendment (wave 48): the merged clash card must read its
// conflict caption from the server's conflict `kind`, never assume
// 'room_overlap' -- and must never form at all in the room-less (TBD)
// column, since schedule.ts never emits a room_overlap for a null roomId.

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';

afterEach(cleanup);

import { DayGrid } from './DayGrid';
import type { AgendaConflict, AgendaRoom, AgendaTrack, PlacedAgendaSession } from './types';
import type { ScheduleBreakRow } from './BreaksPanel';
import { minutesToGridRow } from './gridMath';

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
        breakId: null,
        breakLabel: null,
        detail: 'room clash',
      },
      {
        kind: 'speaker_overlap',
        submissionIds: ['sub-1', 'sub-2'],
        day: '2026-08-13',
        roomId: null,
        speakerContactIds: ['ct-1'],
        breakId: null,
        breakLabel: null,
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
        breakId: null,
        breakLabel: null,
        detail: 'room clash',
      },
    ];
    const { container } = render(<DayGrid {...BASE_PROPS} placed={placed} conflicts={conflicts} />);
    expect(container.querySelector('.chq-day-grid-clash-caption')?.textContent).toBe('Two sessions in one room');
  });
});

function breakRow(overrides: Partial<ScheduleBreakRow> = {}): ScheduleBreakRow {
  return {
    id: 'brk-1',
    eventId: 'evt-1',
    day: '2026-08-13',
    label: 'Lunch',
    location: 'Foyer',
    startMin: 720,
    durationMin: 60,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

describe('DayGrid gutter rail (DEC-021 amendment, w6-f)', () => {
  it('reads unpadded 24h "H:MM" for both the visible label and its aria string, from one formatter', () => {
    const { container } = render(<DayGrid {...BASE_PROPS} placed={[]} conflicts={[]} />);
    const firstLabel = container.querySelector('.chq-day-grid-time-label');
    expect(firstLabel?.textContent).toBe('9:00');
    expect(firstLabel?.getAttribute('aria-label')).toBe('9:00');
    const labels = [...container.querySelectorAll('.chq-day-grid-time-label')].map((el) => el.textContent);
    expect(labels).not.toContain('09:00');
    expect(labels).toContain('9:30');
    expect(labels).toContain('10:00');
  });

  it('paints exactly 18 lattice boundary rules for the default 36-row (540..1080@15min) day', () => {
    const { container } = render(<DayGrid {...BASE_PROPS} placed={[]} conflicts={[]} />);
    const boundaries = container.querySelectorAll('.chq-day-grid-cell-boundary');
    // One boundary cell per 30-minute row pair, per room column (1 room here).
    expect(boundaries.length).toBe(18);
  });
});

describe('DayGrid breaks (DEC-021 amendment, w67-b)', () => {
  it('renders a break band with its label text at the row its start minute implies', () => {
    const { container } = render(<DayGrid {...BASE_PROPS} placed={[]} conflicts={[]} breaks={[breakRow()]} />);
    const band = container.querySelector('.chq-agenda-break-band');
    expect(band).not.toBeNull();
    expect(band?.textContent).toContain('Lunch');
    expect(band?.textContent).toContain('Foyer');
    expect(band?.textContent).toContain('60 min');
    const expectedRow = String(minutesToGridRow(720, BASE_PROPS.dayStartMin, BASE_PROPS.gridMin));
    expect((band as HTMLElement).style.gridRow.split(' / ')[0]).toBe(expectedRow);
  });

  it('is not interactive and leaves the cell underneath a live drop target', () => {
    const { container } = render(<DayGrid {...BASE_PROPS} placed={[]} conflicts={[]} breaks={[breakRow()]} />);
    const band = container.querySelector('.chq-agenda-break-band') as HTMLElement;
    expect(band.tagName).not.toBe('BUTTON');
    expect(band.onclick).toBeNull();
    expect(band.getAttribute('id')).toBeNull();
    // The underlying cell at the break's start minute is still present and
    // still carries its drop-target data attributes.
    const cell = container.querySelector('[data-room-id="room-1"][data-start-min="720"]');
    expect(cell).not.toBeNull();
  });

  it('renders no break band for a break on a different day', () => {
    const { container } = render(
      <DayGrid {...BASE_PROPS} placed={[]} conflicts={[]} breaks={[breakRow({ day: '2026-08-14' })]} />,
    );
    expect(container.querySelector('.chq-agenda-break-band')).toBeNull();
  });

  // w61-d: a break whose window falls outside the day's grid is kept, not
  // dropped -- clamped to the visible rows and flagged, exactly as the
  // add-row's copy promises.
  it('clamps a break that starts before the grid to the first visible row and flags it', () => {
    const { container } = render(
      <DayGrid
        {...BASE_PROPS}
        placed={[]}
        conflicts={[]}
        breaks={[breakRow({ startMin: 480, durationMin: 90 })]} // 8:00-9:30, grid starts at 9:00
      />,
    );
    const band = container.querySelector('.chq-agenda-break-band') as HTMLElement;
    expect(band).not.toBeNull();
    expect(band.classList.contains('chq-agenda-break-band-flagged')).toBe(true);
    expect(band.textContent).toContain("outside the day's hours");
    const expectedRow = String(minutesToGridRow(BASE_PROPS.dayStartMin, BASE_PROPS.dayStartMin, BASE_PROPS.gridMin));
    expect(band.style.gridRow.split(' / ')[0]).toBe(expectedRow);
  });

  it('clamps a break that runs past the grid end to the last visible row and flags it', () => {
    const { container } = render(
      <DayGrid
        {...BASE_PROPS}
        placed={[]}
        conflicts={[]}
        breaks={[breakRow({ startMin: 1060, durationMin: 60 })]} // ends at 1120, grid ends at 1080
      />,
    );
    const band = container.querySelector('.chq-agenda-break-band') as HTMLElement;
    expect(band.classList.contains('chq-agenda-break-band-flagged')).toBe(true);
    const expectedRowEnd = String(minutesToGridRow(BASE_PROPS.dayEndMin, BASE_PROPS.dayStartMin, BASE_PROPS.gridMin));
    expect(band.style.gridRow.split(' / ')[1]).toBe(expectedRowEnd);
  });

  it('does not flag a break entirely inside the day window', () => {
    const { container } = render(<DayGrid {...BASE_PROPS} placed={[]} conflicts={[]} breaks={[breakRow()]} />);
    const band = container.querySelector('.chq-agenda-break-band') as HTMLElement;
    expect(band.classList.contains('chq-agenda-break-band-flagged')).toBe(false);
    expect(band.textContent).not.toContain("outside the day's hours");
  });
});
