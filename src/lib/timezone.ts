// Pure timezone conversion helper (DEC-002: Web APIs only, no node:/
// cloudflare/drizzle imports). Needed by the public schedule .ics export
// (DEC-022/DEC-007): schedule_slot stores day ('YYYY-MM-DD') + startMin/
// endMin as minutes-from-midnight IN THE EVENT'S TIMEZONE (DEC-010); .ics
// VEVENTs need UTC instants.
//
// Standard "wall-clock time in IANA zone -> UTC instant" algorithm: guess a
// UTC instant from the wall-clock fields, ask Intl.DateTimeFormat how that
// instant reads back in the target zone, and correct by the delta. Works
// across DST boundaries because Intl always reflects the zone's actual
// offset for that instant.

/** Converts a 'YYYY-MM-DD' day + minutes-from-midnight wall-clock pair in
 * `timeZone` to the corresponding UTC Date instant. */
export function zonedMinutesToUtc(day: string, minutes: number, timeZone: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) {
    throw new Error(`Invalid day '${day}' — expected 'YYYY-MM-DD'`);
  }
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;

  // Naive guess: treat the wall-clock fields as if they were already UTC.
  const naiveUtcMs = Date.UTC(year, month - 1, date, hour, minute, 0);

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
  const parts = dtf.formatToParts(new Date(naiveUtcMs));
  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;

  // How the naive-UTC instant actually reads in the target zone.
  const readBackMs = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    map.hour === "24" ? 0 : Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );

  const offsetMs = readBackMs - naiveUtcMs;
  return new Date(naiveUtcMs - offsetMs);
}
