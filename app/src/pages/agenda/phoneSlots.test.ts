import { describe, expect, it } from 'vitest';
import { buildPhoneSlots } from './phoneSlots';
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

function build(placed: PlacedAgendaSession[], roomId: string | null = ROOM) {
  return buildPhoneSlots({
    placed,
    day: DAY,
    roomId,
    dayStartMin: DAY_START_MIN,
    dayEndMin: DAY_END_MIN,
    gridMin: GRID_MIN,
    conflicts: [],
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
});
