// Pure home-hub grouping/visibility logic (DEC-581). Web APIs only — no
// node:/cloudflare/drizzle imports (same purity contract as submit-core.ts,
// which this module may import). GET / is an ANONYMOUS surface: what a
// stranger may see is decided HERE, once, never re-derived in a SQL WHERE
// clause on some future surface. src/server/repo/public/home.ts fetches
// candidate rows and applies nothing but org scope + a bounded window;
// this module owns the privacy predicate and the grouping/ordering/state.

export interface HubEvent {
  id: string;
  name: string;
  slug: string;
  startDate: number | null;
  endDate: number | null;
  location: string | null;
  timezone: string;
  cfpCloseDate: number | null;
  cfpOpen: boolean;
  publishedSessionCount: number;
}

export interface HubSections {
  openCfp: HubEvent[];
  published: HubEvent[];
  past: HubEvent[];
}

export type HubState = "full" | "between_cycles" | "fresh";

/** Nulls-last ascending comparator over a nullable numeric field. */
function compareNullableAsc(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

/** Nulls-last descending comparator over a nullable numeric field — a null
 * still sorts LAST (not first) even though the direction flips, matching
 * "nulls last" as a single consistent rule across every hub sort. */
function compareNullableDesc(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

function compareId(a: HubEvent, b: HubEvent): number {
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

/** DEC-581: buckets candidate events into the sections a stranger may see,
 * and orders each section. An event that is neither an open CFP nor has any
 * published session is dropped SILENTLY — it never reaches any section,
 * regardless of its dates. Grouping precedence: past (the event has ended)
 * beats openCfp beats published, so a past event with a (stale, still-open)
 * CFP window lands in `past`, not `openCfp`. */
export function groupHubEvents(events: HubEvent[], nowMs: number): HubSections {
  const openCfp: HubEvent[] = [];
  const published: HubEvent[] = [];
  const past: HubEvent[] = [];

  for (const event of events) {
    if (!(event.cfpOpen || event.publishedSessionCount > 0)) continue;

    const end = event.endDate ?? event.startDate;
    if (end !== null && end < nowMs) {
      past.push(event);
    } else if (event.cfpOpen) {
      openCfp.push(event);
    } else {
      published.push(event);
    }
  }

  openCfp.sort(
    (a, b) =>
      compareNullableAsc(a.cfpCloseDate, b.cfpCloseDate) ||
      compareNullableAsc(a.startDate, b.startDate) ||
      compareId(a, b),
  );
  published.sort((a, b) => compareNullableAsc(a.startDate, b.startDate) || compareId(a, b));
  past.sort((a, b) => compareNullableDesc(a.startDate, b.startDate) || compareId(a, b));

  return { openCfp, published, past };
}

/** DEC-581: the hub's empty-state signal. 'fresh' — nothing has ever run
 * (no CFP, nothing published, nothing past). 'between_cycles' — there was a
 * past programme but nothing open or published right now. 'full' —
 * otherwise (something to show today). */
export function hubState(sections: HubSections): HubState {
  const { openCfp, published, past } = sections;
  if (openCfp.length === 0 && published.length === 0 && past.length === 0) return "fresh";
  if (openCfp.length === 0 && published.length === 0) return "between_cycles";
  return "full";
}
