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

// DEC-900 amendment (wave 60): minutes-from-midnight clock formatting moved
// to the single owner, src/domain/clock.ts, crossed here via
// app/src/lib/clock.ts. What was formatMinutes (zero-padded, card
// times/aria/toasts) is now clockHHMM; what was formatGutterTime (unpadded,
// the gutter rail) is now clockHMM — import them from '../../lib/clock'
// directly at each call site.

// DEC-140 side-by-side lane assignment, reimplemented locally: the SPA
// bundle (app/src, its own tsconfig `include`/vite root) can't reach across
// to the server's src/lib/overlap-lanes.ts pure-core module, so the same
// algorithm is duplicated here for the admin day grid. Two blocks in the
// same room that overlap in time must render side-by-side (split into
// lanes) rather than stacked, so every block's drag handle/drop target
// stays independently reachable by the pointer (warn-never-block, DEC-010:
// an organizer must still be able to see and act on both halves of a
// conflict).
export interface LaneInterval {
  id: string;
  startMin: number;
  endMin: number;
}

export interface LanedInterval<T extends LaneInterval> {
  item: T;
  lane: number;
  laneCount: number;
}

function intervalsOverlap(a: LaneInterval, b: LaneInterval): boolean {
  return a.startMin < b.endMin && b.startMin < a.endMin;
}

export function assignLanes<T extends LaneInterval>(items: T[]): LanedInterval<T>[] {
  if (items.length === 0) return [];

  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  const laneOf = new Map<string, number>();
  const active: T[] = [];

  for (const item of sorted) {
    for (let i = active.length - 1; i >= 0; i -= 1) {
      if (active[i]!.endMin <= item.startMin) active.splice(i, 1);
    }
    const usedLanes = new Set(active.map((a) => laneOf.get(a.id)!));
    let lane = 0;
    while (usedLanes.has(lane)) lane += 1;
    laneOf.set(item.id, lane);
    active.push(item);
  }

  function peakConcurrencyDuring(target: T): number {
    let peak = 0;
    for (const other of sorted) {
      if (intervalsOverlap(target, other)) {
        const laneIdx = laneOf.get(other.id)!;
        peak = Math.max(peak, laneIdx + 1);
      }
    }
    return peak;
  }

  return sorted.map((item) => ({
    item,
    lane: laneOf.get(item.id)!,
    laneCount: Math.max(1, peakConcurrencyDuring(item)),
  }));
}
