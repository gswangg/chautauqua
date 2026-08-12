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
 * "Sun, 01 Mar 2026" — DEC-522: a date-only value (task due date, etc.) is a
 * CALENDAR DAY, not an instant. It must render as the same day everywhere,
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
