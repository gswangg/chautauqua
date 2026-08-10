// Pure CSS-grid coordinate math for the agenda day grid (DEC-021: rows are
// 15-minute increments; rooms are columns). No React/DOM here — plain
// functions so grid placement math is unit-testable in isolation.

/** Snaps a minutes-from-midnight value to the nearest grid line, clamped to
 * [dayStartMin, dayEndMin]. Used to quantize drag-drop drop points. */
export function snapToGrid(
  minutes: number,
  dayStartMin: number,
  dayEndMin: number,
  gridMin: number,
): number {
  const snapped = dayStartMin + Math.round((minutes - dayStartMin) / gridMin) * gridMin;
  return Math.min(Math.max(snapped, dayStartMin), dayEndMin);
}

/** 1-based CSS `grid-row-start` for a given minutes-from-midnight value.
 * Row 1 is the header row; time rows start at 2. */
export function minutesToGridRow(minutes: number, dayStartMin: number, gridMin: number): number {
  return 2 + Math.round((minutes - dayStartMin) / gridMin);
}

/** Inverse of minutesToGridRow: the minutes-from-midnight a CSS grid row
 * boundary represents. */
export function gridRowToMinutes(row: number, dayStartMin: number, gridMin: number): number {
  return dayStartMin + (row - 2) * gridMin;
}

/** Number of 15-minute time rows spanning a day's grid, excluding the header
 * row (e.g. 540..1080 at gridMin=15 -> 36 rows). */
export function totalGridRows(dayStartMin: number, dayEndMin: number, gridMin: number): number {
  return Math.round((dayEndMin - dayStartMin) / gridMin);
}

/** CSS `grid-row-end` value (exclusive) for a session spanning startMin..endMin. */
export function gridRowEnd(endMin: number, dayStartMin: number, gridMin: number): number {
  return minutesToGridRow(endMin, dayStartMin, gridMin);
}

/** Formats minutes-from-midnight as 'H:MMam/pm' for row labels and card times. */
export function formatMinutes(minutes: number): string {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h24 >= 12 ? 'pm' : 'am';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')}${period}`;
}
