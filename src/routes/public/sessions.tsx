// Sessions surface (EMB-02 keyword search + track filter). Split out of the
// former monolithic src/routes/public.tsx (contention decomposition) — no
// behavior change.

import type { PublicEvent, PublicSession, PublicTrack } from "../../server/repo/public";
import { SessionCard } from "./cards";

export function SessionsContent(props: {
  event: PublicEvent;
  tracks: PublicTrack[];
  activeTrackId: string | null;
  q: string | null;
  items: PublicSession[];
  total: number;
  page: number;
}) {
  const { event, tracks, activeTrackId, q, items, total, page } = props;
  const hasMore = items.length < total;
  const basePath = `/e/${event.slug}/sessions`;
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
        <button type="submit">Search</button>
      </form>
      <nav aria-label="Track filters">
        <a href={basePath} aria-current={activeTrackId === null ? "true" : undefined}>
          All
        </a>
        {tracks.map((t) => (
          <>
            {" · "}
            <a href={`${basePath}?trackId=${t.id}`} aria-current={activeTrackId === t.id ? "true" : undefined}>
              {t.name}
            </a>
          </>
        ))}
      </nav>
      <p>
        {items.length} of {total} session(s)
      </p>
      {items.map((s) => (
        <SessionCard session={s} event={event} from="sessions" />
      ))}
      {hasMore ? (
        <p>
          <a
            href={`${basePath}?${activeTrackId ? `trackId=${activeTrackId}&` : ""}${
              q ? `q=${encodeURIComponent(q)}&` : ""
            }page=${page + 1}`}
          >
            Show more
          </a>
        </p>
      ) : null}
    </>
  );
}
