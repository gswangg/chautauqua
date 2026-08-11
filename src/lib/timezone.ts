// Pure timezone conversion helper (DEC-002: Web APIs only, no node:/
// cloudflare/drizzle imports). Needed by the public schedule .ics export
// (DEC-022/DEC-007): schedule_slot stores day ('YYYY-MM-DD') + startMin/
// endMin as minutes-from-midnight IN THE EVENT'S TIMEZONE (DEC-010); .ics
// VEVENTs need UTC instants.
//
// DST-safe "wall-clock time in IANA zone -> UTC instant" algorithm
// (DEC-230). A single naive offset correction is not sufficient near a DST
// transition: the requested wall-clock fields either don't exist (spring-
// forward gap) or exist twice (fall-back overlap). We sample the zone's
// UTC offset a full day before and a full day after the requested wall
// time (DST transitions are always months apart, so these samples land
// cleanly on either side of any transition adjacent to the request) and
// build one candidate instant per offset. Each candidate is then verified
// by asking Intl.DateTimeFormat what offset actually applies AT that
// candidate instant:
//   - offsets agree (no nearby transition): return the (only) candidate.
//   - both candidates verify (fall-back overlap, wall time is ambiguous):
//     DEC-230 says resolve to the EARLIER instant (min of the two).
//   - only one candidate verifies: return it.
//   - neither candidate verifies (spring-forward gap, wall time doesn't
//     exist): DEC-230 says resolve FORWARD to the post-transition instant
//     (max of the two raw candidates).

const DAY_MS = 24 * 60 * 60 * 1000;

/** The IANA zone's UTC offset (in ms, positive east of UTC) at the real
 * instant `instantMs`. */
function offsetMsAt(instantMs: number, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(new Date(instantMs));
  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;
  const wallMs = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    map.hour === "24" ? 0 : Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );
  return wallMs - instantMs;
}

/** Converts a 'YYYY-MM-DD' day + minutes-from-midnight wall-clock pair in
 * `timeZone` to the corresponding UTC Date instant. */
export function zonedMinutesToUtc(day: string, minutes: number, timeZone: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) {
    throw new Error(`Invalid day '${day}' — expected 'YYYY-MM-DD'`);
  }
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;

  // The requested wall-clock fields, treated as a plain number (not yet a
  // real instant).
  const targetWallMs = Date.UTC(year, month - 1, date, hour, minute, 0);

  const offsetBefore = offsetMsAt(targetWallMs - DAY_MS, timeZone);
  const offsetAfter = offsetMsAt(targetWallMs + DAY_MS, timeZone);

  const candidateBefore = targetWallMs - offsetBefore;
  const candidateAfter = targetWallMs - offsetAfter;

  if (offsetBefore === offsetAfter) {
    // No DST transition near this wall-clock reading — single, unambiguous
    // instant.
    return new Date(candidateBefore);
  }

  const validBefore = offsetMsAt(candidateBefore, timeZone) === offsetBefore;
  const validAfter = offsetMsAt(candidateAfter, timeZone) === offsetAfter;

  if (validBefore && validAfter) {
    // Fall-back overlap: the wall-clock time occurs twice. DEC-230: resolve
    // to the EARLIER of the two instants.
    return new Date(Math.min(candidateBefore, candidateAfter));
  }
  if (validBefore) return new Date(candidateBefore);
  if (validAfter) return new Date(candidateAfter);

  // Spring-forward gap: the wall-clock time never occurs. DEC-230: resolve
  // FORWARD to the post-transition instant (the later of the two raw
  // candidates).
  return new Date(Math.max(candidateBefore, candidateAfter));
}
