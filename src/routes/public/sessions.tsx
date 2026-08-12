// Sessions surface (EMB-02 keyword search + track filter). Split out of the
// former monolithic src/routes/public.tsx (contention decomposition) — no
// behavior change.

import type { PublicEvent, PublicSession, PublicTrack } from "../../server/repo/public";
import { SessionCard } from "./cards";
import { type CardFields } from "./query";
import { PUBLIC_PER_PAGE, hasMorePages } from "../../server/repo/public/bounds";

export function SessionsContent(props: {
  event: PublicEvent;
  tracks: PublicTrack[];
  activeTrackId: string | null;
  q: string | null;
  items: PublicSession[];
  total: number;
  page: number;
  perPage?: number;
  day?: string | null;
  limit?: number | null;
  fields?: CardFields;
}) {
  const { event, tracks, activeTrackId, q, items, total, page, perPage, day, limit, fields } = props;
  // DEC-433/477/487: parsePage clamps page to MAX_PUBLIC_PAGE, so once we're
  // at the cap there is no page+1 to link to — stop rendering 'Show more'
  // even if items.length < total. Also stop once the cumulative row ceiling
  // (MAX_PUBLIC_ROWS) would be reached by the next page: a large ?limit=
  // embed can hit it well before page reaches MAX_PUBLIC_PAGE, and linking
  // past it would point at a page identical to the current one.
  const hasMore = hasMorePages(items.length, total, page, perPage ?? PUBLIC_PER_PAGE);
  const basePath = `/e/${event.slug}/sessions`;
  // DEC-289: embed configuration params carried forward across the search
  // form and 'Show more' link exactly like trackId/q, so a configured embed
  // does not lose its configuration on page 2.
  const carryQs = `${day ? `day=${encodeURIComponent(day)}&` : ""}${limit ? `limit=${limit}&` : ""}`;
  return (
    <>
      <h2>Sessions</h2>
      {/* EMB-02: plain GET search form, preserves the active track filter as
          a hidden field so search + track filtering compose. */}
      <form method="get" action={basePath} role="search">
        <label>
          Search
          <input type="search" name="q" value={q ?? ""} placeholder="Title or speaker name" />
        </label>
        {activeTrackId ? <input type="hidden" name="trackId" value={activeTrackId} /> : null}
        {day ? <input type="hidden" name="day" value={day} /> : null}
        {limit ? <input type="hidden" name="limit" value={String(limit)} /> : null}
        <button type="submit">Search</button>
      </form>
      <nav aria-label="Track filters" class="chq-pub-filter-bar">
        <a class="chq-pub-pill" href={basePath} aria-current={activeTrackId === null ? "true" : undefined}>
          All tracks
        </a>
        {tracks.map((t) => (
          <a
            class="chq-pub-pill"
            href={`${basePath}?trackId=${t.id}`}
            aria-current={activeTrackId === t.id ? "true" : undefined}
          >
            {t.name}
          </a>
        ))}
      </nav>
      <p>
        {items.length} of {total} session(s)
      </p>
      {items.map((s) => (
        <SessionCard session={s} event={event} from="sessions" fields={fields} />
      ))}
      {hasMore ? (
        <p>
          <a
            href={`${basePath}?${activeTrackId ? `trackId=${activeTrackId}&` : ""}${
              q ? `q=${encodeURIComponent(q)}&` : ""
            }${carryQs}page=${page + 1}`}
          >
            Show more
          </a>
        </p>
      ) : null}
    </>
  );
}
