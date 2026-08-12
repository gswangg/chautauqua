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

/** Merges a checkbox-page toggle into the full stored itinerary (DEC-555).
 *
 * The schedule surface applies a `?day=` filter (DEC-489) before render, so
 * any given page only renders (and can only checkbox-toggle) a subset of the
 * full itinerary. Persisting `checkedIds` alone — the checked subset of the
 * boxes rendered on THIS page — silently wipes every pick from every other
 * day. This function keeps stored picks whose id was never rendered on the
 * current page untouched, and for the rendered subset takes exactly what the
 * page's checkboxes say now (so unchecking a rendered id removes it).
 *
 * Pure, DOM-free: `renderedIds` is the full set of `.chq-itinerary-toggle`
 * values on the current page; `checkedIds` is the subset currently checked. */
/** Mirrors an itinerary checkbox change across every rendered copy that
 * shares the same `value` (DEC-584: phone list and desktop grid render the
 * SAME session as two separate `.chq-itinerary-toggle` inputs below/above
 * the 700px breakpoint, and only one is visible at a time, but both stay in
 * the DOM). `ItineraryScript`'s change handler computes the new selection as
 * "every currently-checked box" (`currentIds`), so unchecking the visible
 * copy while the hidden copy is still checked leaves that id selected and
 * the removal never persists. This is the pure state transform the inline
 * script actually calls (embedded via `.toString()`, same pattern as
 * `mergeItinerarySelection`) before it re-derives `currentIds()` — every
 * box whose value matches `changedValue` is forced to `changedChecked`,
 * every other box passes through unchanged. Pure/DOM-free so it's
 * unit-testable without jsdom. */
export function mirrorItineraryCheckboxes<T extends { value: string; checked: boolean }>(
  boxes: T[],
  changedValue: string,
  changedChecked: boolean,
): T[] {
  return boxes.map((b) => (b.value === changedValue && b.checked !== changedChecked ? { ...b, checked: changedChecked } : b));
}

export function mergeItinerarySelection(
  stored: string[],
  renderedIds: string[],
  checkedIds: string[],
): string[] {
  const rendered = new Set(renderedIds);
  const kept = stored.filter((id) => !rendered.has(id));
  const seen = new Set(kept);
  const merged = [...kept];
  for (const id of checkedIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    merged.push(id);
  }
  return merged.slice(0, MAX_ITINERARY_IDS);
}
