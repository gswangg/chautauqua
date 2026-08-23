import { describe, expect, it } from 'vitest';
import { buildPhoneSlots, type PhoneBlockedInterval } from './phoneSlots';
import { clampBreakToWindow } from './gridMath';
import type { PlacedAgendaSession } from './types';

const DAY_START_MIN = 540;
const DAY_END_MIN = 1080;
const GRID_MIN = 15;
const DAY = '2026-06-01';
const ROOM = 'room-1';

function session(overrides: Partial<PlacedAgendaSession>): PlacedAgendaSession {
  return {
    submissionId: 'sub-x',
    ref: 'S-000',
    title: 'Untitled',
    trackIds: [],
    speakers: [],
    roomId: ROOM,
    day: DAY,
    startMin: 600,
    endMin: 630,
    ...overrides,
  };
}

function build(placed: PlacedAgendaSession[], roomId: string | null = ROOM, breaks: PhoneBlockedInterval[] = []) {
  return buildPhoneSlots({
    placed,
    day: DAY,
    roomId,
    dayStartMin: DAY_START_MIN,
    dayEndMin: DAY_END_MIN,
    gridMin: GRID_MIN,
    conflicts: [],
    breaks,
  });
}

describe('buildPhoneSlots', () => {
  it('with no placed sessions, produces a single free run spanning the whole day', () => {
    const slots = build([]);
    expect(slots).toEqual([{ startMin: DAY_START_MIN, endMin: DAY_END_MIN, kind: 'free', sessions: [] }]);
  });

  it('collapses consecutive empty grid rows into one free run either side of a placed session', () => {
    const s = session({ submissionId: 'sub-1', startMin: 600, endMin: 630 });
    const slots = build([s]);
    expect(slots).toEqual([
      { startMin: DAY_START_MIN, endMin: 600, kind: 'free', sessions: [] },
      { startMin: 600, endMin: 630, kind: 'placed', sessions: [s] },
      { startMin: 630, endMin: DAY_END_MIN, kind: 'free', sessions: [] },
    ]);
  });

  it('produces no leading/trailing free run when a session touches the day bounds', () => {
    const s = session({ submissionId: 'sub-1', startMin: DAY_START_MIN, endMin: DAY_END_MIN });
    const slots = build([s]);
    expect(slots).toEqual([{ startMin: DAY_START_MIN, endMin: DAY_END_MIN, kind: 'placed', sessions: [s] }]);
  });

  it('merges two overlapping sessions in the same room into a single clash run spanning their full union', () => {
    const a = session({ submissionId: 'sub-1', ref: 'S-001', startMin: 600, endMin: 660 });
    const b = session({ submissionId: 'sub-2', ref: 'S-002', startMin: 630, endMin: 690 });
    const slots = build([a, b]);
    expect(slots).toEqual([
      { startMin: DAY_START_MIN, endMin: 600, kind: 'free', sessions: [] },
      { startMin: 600, endMin: 690, kind: 'clash', sessions: [a, b] },
      { startMin: 690, endMin: DAY_END_MIN, kind: 'free', sessions: [] },
    ]);
  });

  it('transitively merges a three-way overlap chain into one clash run', () => {
    const a = session({ submissionId: 'sub-1', startMin: 600, endMin: 630 });
    const b = session({ submissionId: 'sub-2', startMin: 615, endMin: 645 });
    const c = session({ submissionId: 'sub-3', startMin: 630, endMin: 660 });
    const slots = build([a, b, c]);
    expect(slots).toEqual([
      { startMin: DAY_START_MIN, endMin: 600, kind: 'free', sessions: [] },
      { startMin: 600, endMin: 660, kind: 'clash', sessions: [a, b, c] },
      { startMin: 660, endMin: DAY_END_MIN, kind: 'free', sessions: [] },
    ]);
  });

  it('keeps back-to-back non-overlapping sessions as separate placed runs with no free gap between them', () => {
    const a = session({ submissionId: 'sub-1', startMin: 600, endMin: 630 });
    const b = session({ submissionId: 'sub-2', startMin: 630, endMin: 660 });
    const slots = build([a, b]);
    expect(slots).toEqual([
      { startMin: DAY_START_MIN, endMin: 600, kind: 'free', sessions: [] },
      { startMin: 600, endMin: 630, kind: 'placed', sessions: [a] },
      { startMin: 630, endMin: 660, kind: 'placed', sessions: [b] },
      { startMin: 660, endMin: DAY_END_MIN, kind: 'free', sessions: [] },
    ]);
  });

  it('filters by day and room, and treats a null roomId as the TBD column', () => {
    const inRoom = session({ submissionId: 'sub-1', roomId: ROOM, startMin: 600, endMin: 630 });
    const otherRoom = session({ submissionId: 'sub-2', roomId: 'room-2', startMin: 600, endMin: 630 });
    const otherDay = session({ submissionId: 'sub-3', roomId: ROOM, day: '2026-06-02', startMin: 600, endMin: 630 });
    const tbd = session({ submissionId: 'sub-4', roomId: null, startMin: 600, endMin: 630 });

    expect(build([inRoom, otherRoom, otherDay, tbd], ROOM)).toEqual([
      { startMin: DAY_START_MIN, endMin: 600, kind: 'free', sessions: [] },
      { startMin: 600, endMin: 630, kind: 'placed', sessions: [inRoom] },
      { startMin: 630, endMin: DAY_END_MIN, kind: 'free', sessions: [] },
    ]);

    expect(build([inRoom, otherRoom, otherDay, tbd], null)).toEqual([
      { startMin: DAY_START_MIN, endMin: 600, kind: 'free', sessions: [] },
      { startMin: 600, endMin: 630, kind: 'placed', sessions: [tbd] },
      { startMin: 630, endMin: DAY_END_MIN, kind: 'free', sessions: [] },
    ]);
  });

  it('a day with a break produces a blocked run carrying its note, with separate free runs either side (DEC-895 wave-32 amendment)', () => {
    const lunch: PhoneBlockedInterval = { day: DAY, startMin: 720, endMin: 780, note: 'Lunch · 60 min' };
    const slots = build([], ROOM, [lunch]);
    // docs/design/Chautauqua Agenda.dc.html:182-183 draws the frame's fourth
    // slot kind -- `<sc-if value="{{ slot.blocked }}">` holding `{{ slot.note
    // }}` -- and the frame's own demo data (same file) supplies
    // `{ time: '12:00', blocked: true, note: 'Lunch · 60 min' }` as what
    // populates it (DEC-895 wave-32 amendment).
    expect(slots).toEqual([
      { startMin: DAY_START_MIN, endMin: 720, kind: 'free', sessions: [] },
      { startMin: 720, endMin: 780, kind: 'blocked', sessions: [], note: 'Lunch · 60 min' },
      { startMin: 780, endMin: DAY_END_MIN, kind: 'free', sessions: [] },
    ]);
  });

  it('a break carves out of the free run between two placed sessions, keeping the free runs on either side separate', () => {
    const a = session({ submissionId: 'sub-1', startMin: 600, endMin: 630 });
    const b = session({ submissionId: 'sub-2', startMin: 780, endMin: 810 });
    const brk: PhoneBlockedInterval = { day: DAY, startMin: 690, endMin: 705, note: 'Break · 15 min' };
    const slots = build([a, b], ROOM, [brk]);
    expect(slots).toEqual([
      { startMin: DAY_START_MIN, endMin: 600, kind: 'free', sessions: [] },
      { startMin: 600, endMin: 630, kind: 'placed', sessions: [a] },
      { startMin: 630, endMin: 690, kind: 'free', sessions: [] },
      { startMin: 690, endMin: 705, kind: 'blocked', sessions: [], note: 'Break · 15 min' },
      { startMin: 705, endMin: 780, kind: 'free', sessions: [] },
      { startMin: 780, endMin: 810, kind: 'placed', sessions: [b] },
      { startMin: 810, endMin: DAY_END_MIN, kind: 'free', sessions: [] },
    ]);
  });

  it('a break outside the requested day is ignored', () => {
    const other: PhoneBlockedInterval = { day: '2026-06-02', startMin: 720, endMin: 780, note: 'Lunch · 60 min' };
    const slots = build([], ROOM, [other]);
    expect(slots).toEqual([{ startMin: DAY_START_MIN, endMin: DAY_END_MIN, kind: 'free', sessions: [] }]);
  });

  // DEC-021 wave-38: the desktop grid never draws a band for a break with no
  // intersection with [dayStartMin, dayEndMin) (clampBreakToWindow returns
  // null); the phone builder must agree exactly, rather than emitting a
  // phantom `blocked` run above/below the drawn day.
  describe('break clamping matches the desktop grid (DEC-021 wave-38)', () => {
    it('a break fully before the day window draws on neither surface', () => {
      const brk: PhoneBlockedInterval = { day: DAY, startMin: 400, endMin: 460, note: 'Early · 60 min' };
      expect(clampBreakToWindow(400, 460, DAY_START_MIN, DAY_END_MIN, GRID_MIN)).toBeNull();
      const slots = build([], ROOM, [brk]);
      expect(slots).toEqual([{ startMin: DAY_START_MIN, endMin: DAY_END_MIN, kind: 'free', sessions: [] }]);
    });

    it('a break fully after the day window draws on neither surface', () => {
      const brk: PhoneBlockedInterval = { day: DAY, startMin: 1100, endMin: 1160, note: 'Late · 60 min' };
      expect(clampBreakToWindow(1100, 1160, DAY_START_MIN, DAY_END_MIN, GRID_MIN)).toBeNull();
      const slots = build([], ROOM, [brk]);
      expect(slots).toEqual([{ startMin: DAY_START_MIN, endMin: DAY_END_MIN, kind: 'free', sessions: [] }]);
    });

    it('a break overlapping the start edge is clipped to the window, same as the desktop grid', () => {
      // 08:40-09:20 vs a 09:00-18:00 day: clips to 09:00-09:20.
      const brk: PhoneBlockedInterval = { day: DAY, startMin: 520, endMin: 560, note: 'Edge · 40 min' };
      const desktop = clampBreakToWindow(520, 560, DAY_START_MIN, DAY_END_MIN, GRID_MIN);
      expect(desktop).not.toBeNull();
      const slots = build([], ROOM, [brk]);
      expect(slots).toEqual([
        { startMin: DAY_START_MIN, endMin: 560, kind: 'blocked', sessions: [], note: 'Edge · 40 min' },
        { startMin: 560, endMin: DAY_END_MIN, kind: 'free', sessions: [] },
      ]);
    });

    it('a break overlapping the end edge is clipped to the window, same as the desktop grid', () => {
      // 17:40-18:20 vs a 09:00-18:00 day: clips to 17:40-18:00.
      const brk: PhoneBlockedInterval = { day: DAY, startMin: 1060, endMin: 1100, note: 'Edge · 40 min' };
      const desktop = clampBreakToWindow(1060, 1100, DAY_START_MIN, DAY_END_MIN, GRID_MIN);
      expect(desktop).not.toBeNull();
      const slots = build([], ROOM, [brk]);
      expect(slots).toEqual([
        { startMin: DAY_START_MIN, endMin: 1060, kind: 'free', sessions: [] },
        { startMin: 1060, endMin: DAY_END_MIN, kind: 'blocked', sessions: [], note: 'Edge · 40 min' },
      ]);
    });

    it('a break overlapping a session is clipped rather than emitted as a backwards-running row, and never swallows the surrounding free time', () => {
      const s = session({ submissionId: 'sub-1', startMin: 720, endMin: 780 }); // 12:00-13:00
      const brk: PhoneBlockedInterval = { day: DAY, startMin: 660, endMin: 750, note: 'Break · 90 min' }; // 11:00-12:30
      const slots = build([s], ROOM, [brk]);

      // Emitted list is strictly non-decreasing in time -- every row starts
      // no earlier than the previous row's end.
      for (let i = 1; i < slots.length; i += 1) {
        expect(slots[i]!.startMin).toBeGreaterThanOrEqual(slots[i - 1]!.endMin);
      }
      // Total coverage spans the whole day with no gap.
      expect(slots[0]!.startMin).toBe(DAY_START_MIN);
      expect(slots[slots.length - 1]!.endMin).toBe(DAY_END_MIN);
      for (let i = 1; i < slots.length; i += 1) {
        expect(slots[i]!.startMin).toBe(slots[i - 1]!.endMin);
      }
      // The break starts first (11:00 vs the session's 12:00), so it draws
      // in full and the later-starting session is clipped to where the
      // break ends -- no phantom overlap, no row running backwards.
      const blocked = slots.find((s2) => s2.kind === 'blocked');
      expect(blocked).toEqual({ startMin: 660, endMin: 750, kind: 'blocked', sessions: [], note: 'Break · 90 min' });
      const placed = slots.find((s2) => s2.kind === 'placed');
      expect(placed).toEqual({ startMin: 750, endMin: 780, kind: 'placed', sessions: [s] });
    });
  });
});
