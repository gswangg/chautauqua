// Pure home-hub grouping/visibility logic (DEC-581). Web APIs only — no
// node:/cloudflare/drizzle imports (same purity contract as submit-core.ts,
// which this module may import). GET / is an ANONYMOUS surface: what a
// stranger may see is decided HERE, once, never re-derived in a SQL WHERE
// clause on some future surface. src/server/repo/public/home.ts fetches
// candidate rows and applies nothing but org scope + a bounded window;
// this module owns the privacy predicate and the grouping/ordering/state.

import { dayLabelEndInstant } from "./timezone";

export interface HubEvent {
  id: string;
  name: string;
  slug: string;
  startDate: number;
  endDate: number;
  location: string | null;
  timezone: string;
  cfpCloseDate: number | null;
  cfpOpen: boolean;
  publishedSessionCount: number;
  // DEC-943: distinct track/format counts across the event's publicly
  // visible sessions (same visibleSessionConditions() predicate as
  // publishedSessionCount) -- used by the hub row's "shape" line (live
  // rows) vs "size" line (archive rows). Purely carried through this
  // module; grouping/ordering logic never reads them.
  trackCount: number;
  formatCount: number;
}

export interface HubSections {
  openCfp: HubEvent[];
  published: HubEvent[];
  past: HubEvent[];
}

export type HubState = "full" | "between_cycles" | "fresh";

/** Nulls-last ascending comparator over a nullable numeric field. Only
 * cfpCloseDate is ever nullable now (startDate/endDate are DB NOT NULL
 * columns, see schema.ts:116-117). */
function compareNullableAsc(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

function compareId(a: HubEvent, b: HubEvent): number {
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

/** DEC-581 amendment (w69-a): ONE definition of "a stranger may see this
 * event" — used by groupHubEvents' skip below, and reusable by any other
 * surface that needs the same predicate (e.g. the repo layer scoping its
 * shape-count queries). */
export function isHubVisible(e: { cfpOpen: boolean; publishedSessionCount: number }): boolean {
  return e.cfpOpen || e.publishedSessionCount > 0;
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
    if (!isHubVisible(event)) continue;

    // DEC-581 amendment (w69-a): endDate is a UTC-midnight DAY LABEL, not an
    // instant — expand to the last instant of that day in the OWNING
    // event's timezone (dayLabelEndInstant), never a raw `< nowMs` compare
    // against the day-label ms, or the event archives itself at 00:01 UTC
    // on its own final day.
    if (dayLabelEndInstant(event.endDate, event.timezone) < nowMs) {
      // DEC-581: an ended event with zero publicly visible sessions has no
      // programme to show — docs/design/README.md forbids a hub row whose
      // only action links a stranger to an empty page. It is dropped from
      // EVERY section, not reassigned to openCfp even if cfpOpen is still
      // (staler) true.
      if (event.publishedSessionCount > 0) past.push(event);
      continue;
    } else if (event.cfpOpen) {
      openCfp.push(event);
    } else {
      published.push(event);
    }
  }

  openCfp.sort(
    (a, b) => compareNullableAsc(a.cfpCloseDate, b.cfpCloseDate) || (a.startDate - b.startDate) || compareId(a, b),
  );
  published.sort((a, b) => (a.startDate - b.startDate) || compareId(a, b));
  past.sort((a, b) => (b.startDate - a.startDate) || compareId(a, b));

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
