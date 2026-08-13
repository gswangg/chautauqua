// Pure date-formatting helper (DEC-002: Web APIs only, no node:/cloudflare
// import) — same purity rule as src/lib/timezone.ts. DEC-408: public CFP
// surfaces render dates in the event's own IANA timezone, never a bare UTC
// string — a UTC-labelled deadline is silently wrong for every speaker not
// in UTC. No fallback: an empty or invalid timeZone throws (fail loudly)
// rather than silently rendering in UTC.

/** Formats a UTC instant (epoch ms) as a human-readable string in the given
 * IANA timeZone, e.g. "Mon, 01 Mar 2027, 11:59 PM PST". Throws if `timeZone`
 * is empty or not a valid IANA zone identifier — there is no UTC fallback
 * (DEC-408). */
export function formatEventDateTime(ms: number, timeZone: string): string {
  if (!timeZone) {
    throw new Error("formatEventDateTime: timeZone must not be empty");
  }
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZoneName: "short",
    });
  } catch (err) {
    throw new Error(`formatEventDateTime: invalid timeZone '${timeZone}': ${(err as Error).message}`);
  }
  return formatter.format(new Date(ms));
}

/** Formats a UTC instant (epoch ms) as a date-only string (no time-of-day)
 * in the given IANA timeZone, e.g. "Tue, 02 Mar 2027" — DEC-413: the speaker
 * portal renders every date in the owning event's timezone, not UTC. Throws
 * if `timeZone` is empty or not a valid IANA zone identifier — there is no
 * UTC fallback, same contract as formatEventDateTime (DEC-408). */
export function formatEventDate(ms: number, timeZone: string): string {
  if (!timeZone) {
    throw new Error("formatEventDate: timeZone must not be empty");
  }
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch (err) {
    throw new Error(`formatEventDate: invalid timeZone '${timeZone}': ${(err as Error).message}`);
  }
  return formatter.format(new Date(ms));
}

/** Formats a UTC-midnight day label (epoch ms) as a date-only string, e.g.
 * "Sun, Mar 01, 2027" (en-US weekday/month-abbrev/day/year order) — DEC-522:
 * a date-only value (task due date, etc.) is a CALENDAR DAY, not an
 * instant. It must render as the same day everywhere,
 * regardless of viewer or event timezone, so this takes NO timezone
 * parameter and always reads the UTC calendar fields of `ms` (the value is
 * expected to already be UTC-midnight for that day). Use this ONLY for day
 * labels. True instants (createdAt, sentAt, submittedAt, uploadedAt) must
 * keep using formatEventDate/formatEventDateTime, which render in the
 * owning event's IANA timezone. Throws on a NaN/non-finite `ms`, matching
 * the fail-loudly contract of its neighbours above. */
export function formatCalendarDate(ms: number): string {
  if (!Number.isFinite(ms)) {
    throw new Error("formatCalendarDate: ms must be a finite number");
  }
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return formatter.format(new Date(ms));
}

/** Formats a `day` field (DEC-010: already the wall-clock 'YYYY-MM-DD' in
 * the owning event's own timezone — never re-zoned here) as a human label,
 * e.g. "Wed, May 12, 2027" — same DEC-522 "calendar day, not an instant"
 * rule as formatCalendarDate (no timeZone param, no toISOString: this is
 * the ONE formatter every public-surface day heading and schedule/detail
 * date label routes through, replacing the raw ISO string those surfaces
 * used to emit directly). This is the STRING-KEYED door onto
 * formatCalendarDate — the rendering itself lives there and only there, so
 * a day label reads identically whether its source is a 'YYYY-MM-DD' field
 * or a UTC-midnight epoch. Malformed input (not a parseable Y-M-D string)
 * returns the original string unchanged rather than throwing mid-render,
 * matching the public surfaces' fail-soft rendering contract for
 * organizer-entered scheduling data. */
export function formatEventDay(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) return day;
  return formatCalendarDate(Date.UTC(year, month - 1, date));
}

/** Day-of-month + month label (UTC calendar fields, DEC-522: startDate/
 * endDate are DAY LABELS, not instants — never rendered in any timezone but
 * UTC). en-GB gives British day-before-month order with no comma, e.g.
 * "12 May" / "12 May 2027". Internal to formatEventDayRange below. */
function dayMonthLabel(ms: number, withYear: boolean): string {
  return new Date(ms).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: withYear ? "numeric" : undefined,
    timeZone: "UTC",
  });
}

/** Day-of-month only, no month/year (for the "12" in "12-14 May 2027" when
 * both ends share a month — the month is printed exactly once). Internal to
 * formatEventDayRange below. */
function dayOnlyLabel(ms: number): string {
  return new Date(ms).toLocaleDateString("en-GB", { day: "numeric", timeZone: "UTC" });
}

/** THE single server-side calendar-day RANGE grammar (DEC-918): every
 * customer-facing surface that renders a startDate-endDate span (the public
 * event header, the anonymous home hub) routes through this one function.
 * British day-before-month order, no comma: a single label when the two
 * ends are the same day ("12 May 2027"), the month printed once when both
 * ends share it ("12-14 May 2027"), both months when they differ ("28
 * Apr-2 May 2027"). Takes UTC-midnight epoch ms for both ends, matching the
 * DEC-522 "calendar day, not an instant" contract of formatCalendarDate/
 * formatEventDay above — never re-zoned, always read from UTC calendar
 * fields. */
export function formatEventDayRange(startMs: number, endMs: number): string {
  if (startMs === endMs) return dayMonthLabel(startMs, true);
  const startDate = new Date(startMs);
  const endDate = new Date(endMs);
  const sameMonth = startDate.getUTCFullYear() === endDate.getUTCFullYear() && startDate.getUTCMonth() === endDate.getUTCMonth();
  if (sameMonth) return `${dayOnlyLabel(startMs)}–${dayMonthLabel(endMs, true)}`;
  return `${dayMonthLabel(startMs, false)}–${dayMonthLabel(endMs, true)}`;
}

/** CFP close date label (weekday + day + month, en-GB day-before-month
 * order, no comma), rendered in the event's own IANA timezone (DEC-408: a
 * real instant, never UTC-bare), e.g. "Sun 12 May". Callers own the
 * uppercasing and "N days left" arithmetic (root.tsx's closesLine) — only
 * the Intl formatting itself lives here, per DEC-918. */
export function formatEventCloseDateLabel(closeMs: number, timeZone: string): string {
  return new Date(closeMs).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone,
  });
}
