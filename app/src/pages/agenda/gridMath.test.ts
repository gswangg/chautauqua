import { describe, expect, it } from 'vitest';
import {
  clampBreakToWindow,
  gridRowEnd,
  gridRowToMinutes,
  minutesToGridRow,
  snapToGrid,
  totalGridRows,
} from './gridMath';

const DAY_START = 540; // 9:00am
const DAY_END = 1080; // 6:00pm
const GRID = 15;

describe('minutesToGridRow / gridRowToMinutes', () => {
  it('maps dayStartMin to row 2 (row 1 is the header)', () => {
    expect(minutesToGridRow(DAY_START, DAY_START, GRID)).toBe(2);
  });

  it('advances one row per grid increment', () => {
    expect(minutesToGridRow(DAY_START + GRID, DAY_START, GRID)).toBe(3);
    expect(minutesToGridRow(DAY_START + GRID * 4, DAY_START, GRID)).toBe(6);
  });

  it('round-trips through gridRowToMinutes', () => {
    const row = minutesToGridRow(645, DAY_START, GRID);
    expect(gridRowToMinutes(row, DAY_START, GRID)).toBe(645);
  });
});

describe('gridRowEnd', () => {
  it('computes the exclusive end row for a session span', () => {
    // 9:00-9:30 session -> starts row 2, spans two 15-min rows, ends at row 4
    expect(minutesToGridRow(540, DAY_START, GRID)).toBe(2);
    expect(gridRowEnd(570, DAY_START, GRID)).toBe(4);
  });
});

describe('totalGridRows', () => {
  it('computes the DEC-021 default grid size: 540..1080 at 15min -> 36 rows', () => {
    expect(totalGridRows(DAY_START, DAY_END, GRID)).toBe(36);
  });
});

describe('snapToGrid', () => {
  it('snaps to the nearest grid line', () => {
    expect(snapToGrid(547, DAY_START, DAY_END, GRID)).toBe(540);
    expect(snapToGrid(553, DAY_START, DAY_END, GRID)).toBe(555);
  });

  it('clamps below dayStartMin and above dayEndMin', () => {
    expect(snapToGrid(100, DAY_START, DAY_END, GRID)).toBe(DAY_START);
    expect(snapToGrid(2000, DAY_START, DAY_END, GRID)).toBe(DAY_END);
  });
});

describe('clampBreakToWindow (DEC-021 wave-34)', () => {
  it('returns null for a break fully before the day window (07:00-08:00 vs 09:00-18:00)', () => {
    expect(clampBreakToWindow(420, 480, DAY_START, DAY_END, GRID)).toBeNull();
  });

  it('returns null for a break fully after the day window (19:00-20:00 vs 09:00-18:00)', () => {
    expect(clampBreakToWindow(1140, 1200, DAY_START, DAY_END, GRID)).toBeNull();
  });

  it('returns a well-ordered rowStart < rowEnd for a break partially overlapping the start of the window', () => {
    // 08:30-09:30 overlaps the first 30 minutes of the day.
    const result = clampBreakToWindow(510, 570, DAY_START, DAY_END, GRID);
    expect(result).not.toBeNull();
    expect(result!.rowStart).toBeLessThan(result!.rowEnd);
    expect(result!.rowStart).toBe(minutesToGridRow(DAY_START, DAY_START, GRID));
    expect(result!.rowEnd).toBe(gridRowEnd(570, DAY_START, GRID));
  });

  it('returns a well-ordered rowStart < rowEnd for a break partially overlapping the end of the window', () => {
    // 17:30-18:30 overlaps the last 30 minutes of the day.
    const result = clampBreakToWindow(1050, 1110, DAY_START, DAY_END, GRID);
    expect(result).not.toBeNull();
    expect(result!.rowStart).toBeLessThan(result!.rowEnd);
    expect(result!.rowEnd).toBe(gridRowEnd(DAY_END, DAY_START, GRID));
  });

  it('handles an exactly-abutting break at the start boundary as no overlap (zero-width intersection)', () => {
    // Ends exactly when the day starts -> touches but does not intersect.
    expect(clampBreakToWindow(480, DAY_START, DAY_START, DAY_END, GRID)).toBeNull();
  });

  it('handles an exactly-abutting break at the end boundary as no overlap (zero-width intersection)', () => {
    // Starts exactly when the day ends -> touches but does not intersect.
    expect(clampBreakToWindow(DAY_END, DAY_END + 60, DAY_START, DAY_END, GRID)).toBeNull();
  });

  it('returns the full unclamped span for a break entirely inside the window', () => {
    const result = clampBreakToWindow(600, 630, DAY_START, DAY_END, GRID);
    expect(result).toEqual({
      rowStart: minutesToGridRow(600, DAY_START, GRID),
      rowEnd: gridRowEnd(630, DAY_START, GRID),
    });
  });
});

// formatMinutes/formatGutterTime moved to src/domain/clock.ts as
// clockHHMM/clockHMM (DEC-900 amendment, wave 60) — see
// test/clock.test.ts for their unit tests.
