// DEC-277 (wave 60 amendment): the ONE owner of "which calendar days does
// this event span?" -- inclusive [startDate, endDate] as 'YYYY-MM-DD' day
// labels. Pure core -- no imports, no node:/cloudflare -- so every reader
// (admin agenda payload, auto-schedule defaults, and both public surfaces)
// shares this instead of re-deriving it. event.startDate/endDate are
// isIsoDate-gated at write time (src/routes/api/events.ts), so a malformed
// or reversed range reaching this function is data corruption, not a public
// input to fail soft on -- THROW (DEC-012 treatment), never return [].

export function eventDays(startDate: string, endDate: string): string[] {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error(`eventDays: malformed date range '${startDate}'..'${endDate}'`);
  }
  if (end.getTime() < start.getTime()) {
    throw new Error(`eventDays: reversed date range '${startDate}'..'${endDate}'`);
  }
  const days: string[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += 24 * 60 * 60 * 1000) {
    days.push(new Date(t).toISOString().slice(0, 10));
  }
  return days;
}
