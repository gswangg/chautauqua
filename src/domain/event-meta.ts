// Event-meta line grammar, moved out of src/routes/public/shell.tsx verbatim
// (w48-a, DEC-037 wave-48 amendment) so mail surfaces can render the same
// "12-14 May 2027 · Moscone West, San Francisco" line the public shell's
// header already draws — no behavior change, byte-identical output. The
// parameter is widened to a structural subset of PublicEvent so both the
// public shell and mail callers can supply it without importing the whole
// server repo type.

import { formatEventDayRange } from "../lib/event-time";
import { DEC_037 } from "../decisions";

void DEC_037;

/** Parses a 'YYYY-MM-DD' day field (DEC-010) to a UTC-midnight epoch ms —
 * no formatting here, just field extraction; the rendering itself is
 * formatEventDayRange in src/lib/event-time.ts (DEC-918: one server-side
 * calendar-day grammar). Malformed input falls back to NaN, which
 * formatEventDayRange's Date arithmetic will surface as "Invalid Date"
 * rather than throwing mid-render — matching this surface's fail-soft
 * contract for organizer-entered scheduling data. DEC-037 wave-52
 * amendment: non-string input (missing/null/undefined day field) is also
 * malformed input, and honours the same NaN fallback rather than throwing
 * mid-render on `.split`. */
export function dayMs(iso: unknown): number {
  if (typeof iso !== "string") return NaN;
  const [year, month, date] = iso.split("-").map(Number);
  if (!year || !month || !date) return NaN;
  return Date.UTC(year, month - 1, date);
}

/** "12-14 May 2027 · Moscone West, San Francisco" style meta line (DEC-377:
 * every field here traces to PublicEvent's own startDate/endDate/location
 * columns, nothing illustrative; DEC-918: the range itself renders through
 * formatEventDayRange, the ONE server-side calendar-day grammar). DEC-037
 * wave-52 amendment: startDate/endDate are treated as possibly absent (the
 * same fixtures both submit-views.tsx's `hasEventDates` guard and this
 * amendment's own root-cause trace already anticipate) -- when either day
 * field is missing or empty, this returns the empty string rather than the
 * literal "Invalid Date" or a location-only line. The masthead/meta line is
 * decorative; every caller must skip rendering it when this is "". */
export function eventDatesLine(event: { startDate: string | null | undefined; endDate: string | null | undefined; location: string | null }): string {
  if (!event.startDate || !event.endDate) return "";
  const dates = formatEventDayRange(dayMs(event.startDate), dayMs(event.endDate));
  return event.location ? `${dates} · ${event.location}` : dates;
}
