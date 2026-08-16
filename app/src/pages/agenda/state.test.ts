import { describe, expect, it } from 'vitest';
import { placeOptimistically, reconcileConflictsSummary, unscheduleOptimistically } from './state';
import type { AgendaPayload } from './types';

function basePayload(): AgendaPayload {
  return {
    days: ['2026-08-10'],
    rooms: [{ id: 'room-a', name: 'Room A' }],
    tracks: [{ id: 'track-1', name: 'Frontend', color: '#336699' }],
    placed: [],
    unscheduled: [
      {
        submissionId: 'sub-1',
        ref: 'SES-001',
        title: 'A great talk',
        trackIds: ['track-1'],
        speakers: [{ contactId: 'c1', name: 'Ada Lovelace' }],
      },
    ],
    conflicts: [],
    unplacedReasons: [],
    summary: { unplaced: 1, conflicts: 0, placed: 0, total: 1 },
  };
}

describe('placeOptimistically', () => {
  it('moves a session from unscheduled into placed at the given slot', () => {
    const next = placeOptimistically(basePayload(), 'sub-1', {
      day: '2026-08-10',
      startMin: 540,
      endMin: 600,
      roomId: 'room-a',
    });
    expect(next.unscheduled).toHaveLength(0);
    expect(next.placed).toEqual([
      {
        submissionId: 'sub-1',
        ref: 'SES-001',
        title: 'A great talk',
        trackIds: ['track-1'],
        speakers: [{ contactId: 'c1', name: 'Ada Lovelace' }],
        roomId: 'room-a',
        day: '2026-08-10',
        startMin: 540,
        endMin: 600,
      },
    ]);
  });

  it('moves an already-placed session to a new slot (drag between rooms/days)', () => {
    let state = placeOptimistically(basePayload(), 'sub-1', {
      day: '2026-08-10',
      startMin: 540,
      endMin: 600,
      roomId: 'room-a',
    });
    state = placeOptimistically(state, 'sub-1', {
      day: '2026-08-10',
      startMin: 600,
      endMin: 660,
      roomId: null,
    });
    expect(state.placed).toHaveLength(1);
    expect(state.placed[0]).toMatchObject({ startMin: 600, endMin: 660, roomId: null });
  });

  it('is a no-op when the submission is unknown', () => {
    const state = basePayload();
    const next = placeOptimistically(state, 'does-not-exist', {
      day: '2026-08-10',
      startMin: 540,
      endMin: 600,
      roomId: 'room-a',
    });
    expect(next).toBe(state);
  });
});

describe('unscheduleOptimistically', () => {
  it('moves a placed session back to the tray', () => {
    const placed = placeOptimistically(basePayload(), 'sub-1', {
      day: '2026-08-10',
      startMin: 540,
      endMin: 600,
      roomId: 'room-a',
    });
    const back = unscheduleOptimistically(placed, 'sub-1');
    expect(back.placed).toHaveLength(0);
    expect(back.unscheduled).toEqual([
      {
        submissionId: 'sub-1',
        ref: 'SES-001',
        title: 'A great talk',
        trackIds: ['track-1'],
        speakers: [{ contactId: 'c1', name: 'Ada Lovelace' }],
      },
    ]);
  });
});

describe('reconcileConflictsSummary', () => {
  it('replaces conflicts and summary, leaving placement arrays untouched', () => {
    const state = basePayload();
    const next = reconcileConflictsSummary(state, {
      conflicts: [
        {
          kind: 'room_overlap',
          submissionIds: ['sub-1', 'sub-2'],
          day: '2026-09-01',
          roomId: 'room-1',
          speakerContactIds: [],
          breakId: null,
          breakLabel: null,
          detail: 'double-booked',
        },
      ],
      summary: { unplaced: 0, conflicts: 1, placed: 1, total: 1 },
    });
    expect(next.conflicts).toHaveLength(1);
    expect(next.summary).toEqual({ unplaced: 0, conflicts: 1, placed: 1, total: 1 });
    expect(next.unscheduled).toBe(state.unscheduled);
  });
});
