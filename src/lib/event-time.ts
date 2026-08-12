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
