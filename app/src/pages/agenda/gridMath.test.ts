import { describe, expect, it } from 'vitest';
import {
  formatMinutes,
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

describe('formatMinutes', () => {
  it('formats morning, noon, and afternoon times as zero-padded 24-hour HH:MM', () => {
    expect(formatMinutes(540)).toBe('09:00');
    expect(formatMinutes(720)).toBe('12:00');
    expect(formatMinutes(0)).toBe('00:00');
    expect(formatMinutes(1080)).toBe('18:00');
  });
});
