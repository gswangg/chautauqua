// Pure helpers for the /e/:eventSlug/schedule personal itinerary picker
// (DEC-022): localStorage key naming + parsing the comma-separated submission
// id list on GET .../schedule.ics?ids=. Kept schema-free (DEC-002) so it's
// plain-vitest testable without a DB.

// DEC-080: hard cap on the user-controlled ?ids= list accepted by the
// public, unauthenticated GET /e/:slug/schedule.ics route. No real personal
// itinerary exceeds this many sessions; an uncapped list is a free
// amplification vector on a no-login route, so the route fails loudly with
// a 400 beyond this cap rather than silently truncating.
export const MAX_ITINERARY_IDS = 300;

/** localStorage key for the itinerary picker: chq_itinerary_<slug>. */
export function itineraryStorageKey(eventSlug: string): string {
  return `chq_itinerary_${eventSlug}`;
}

/** Parses the ?ids=<comma-separated> query param into a deduped, order-
 * preserving list of non-empty ids. Malformed/empty input yields []. */
export function parseItineraryIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const part of raw.split(",")) {
    const id = part.trim();
    if (id.length === 0 || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}
