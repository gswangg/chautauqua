// DEC-140: pure lane-assignment for overlapping schedule blocks. Two blocks
// that occupy the same room and share any time overlap must render
// side-by-side (split into lanes) rather than stacked on top of one
// another, so every block's checkbox/link stays independently clickable
// (docs/eval-findings.md P1: "overlapping session blocks intercept the
// itinerary checkbox click"). Schema-free (DEC-002 pure-core) so it's
// plain-vitest testable and reusable by any SSR grid.

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

function overlaps(a: LaneInterval, b: LaneInterval): boolean {
  return a.startMin < b.endMin && b.startMin < a.endMin;
}

/**
 * Assigns each interval a `lane` (0-indexed column within its overlap
 * cluster) and a `laneCount` (the width, in lanes, of that cluster) so a
 * caller can render `left: lane/laneCount`, `width: 1/laneCount`. Intervals
 * that don't overlap anything get lane 0 / laneCount 1 (full width).
 *
 * Algorithm: classic interval-graph greedy coloring. Sort by start time,
 * assign each interval the lowest-numbered lane not held by any interval
 * still "active" (i.e. overlapping it) when it's placed. Then, for each
 * interval, laneCount is the max concurrent overlap size across its own
 * span (computed via a sweep), so lanes that free up early still get full
 * width credit within their own cluster's peak.
 */
export function assignLanes<T extends LaneInterval>(items: T[]): LanedInterval<T>[] {
  if (items.length === 0) return [];

  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  // Greedy lane assignment: lane[i] = lowest free lane among intervals that
  // overlap i, considering only earlier-starting intervals still active.
  const laneOf = new Map<string, number>();
  const active: T[] = []; // intervals whose lane is assigned and endMin > current start

  for (const item of sorted) {
    // Drop intervals from `active` that no longer overlap `item` (their end
    // is at or before this item's start).
    for (let i = active.length - 1; i >= 0; i -= 1) {
      if (active[i]!.endMin <= item.startMin) active.splice(i, 1);
    }
    const usedLanes = new Set(active.map((a) => laneOf.get(a.id)!));
    let lane = 0;
    while (usedLanes.has(lane)) lane += 1;
    laneOf.set(item.id, lane);
    active.push(item);
  }

  // laneCount per item: the peak concurrent overlap size across the item's
  // own span, via a sweep of start/end events. This guarantees every
  // interval in a connected overlap cluster reports a laneCount at least as
  // large as the max lane index used within its own span, so widths stay
  // consistent (no interval claims more width than the peak concurrency it
  // participates in).
  function peakConcurrencyDuring(target: T): number {
    let peak = 0;
    for (const other of sorted) {
      if (overlaps(target, other)) {
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
