// Sessions surface (EMB-02 keyword search + track filter). Split out of the
// former monolithic src/routes/public.tsx (contention decomposition) — no
// behavior change.
//
// DEC-683: rebuilt to the mock's list + rail layout. The rail (Your
// schedule / day index / Call for papers) and the per-row Save control both
// stay OUT of /embed — a chromeless surface is closed both ways (DEC-672):
// no rail markup, no .chq-itinerary-toggle, no ItineraryScript, and no
// /submit or /e/ href anywhere in the embed output.

import type { PublicEvent, PublicSession, PublicTrack } from "../../server/repo/public";
import { formWindowState } from "../../lib/submit-core";
import { formatEventDateTime } from "../../lib/event-time";
import { dayLabelEndInstant } from "../../lib/timezone";
import { SessionCard, formatDay } from "./cards";
import { ItineraryScript } from "./agenda";
import { type CardFields } from "./query";
import { surfacePath } from "./shell";
import { PUBLIC_PER_PAGE, hasMorePages } from "../../server/repo/public/bounds";

function ScheduleRailSection(props: { event: PublicEvent }) {
  const { event } = props;
  return (
    <section class="chq-pub-rail-section">
      <h3 class="chq-pub-rail-heading">Your schedule</h3>
      <div class="chq-pub-rail-body">
        <span class="chq-pub-rail-caption">
          <span id="chq-ics-count">0 picked</span> · saved in this browser, no account needed
        </span>
        <a id="chq-ics-link" class="chq-pub-itinerary-cta" href={`/e/${event.slug}/schedule.ics`} aria-disabled="true">
          Download .ics
        </a>
      </div>
    </section>
  );
}

function DayIndexRailSection(props: { event: PublicEvent; dayCounts: { day: string; count: number }[] }) {
  const { event, dayCounts } = props;
  if (dayCounts.length === 0) return null;
  return (
    <section class="chq-pub-rail-section">
      <h3 class="chq-pub-rail-heading">Days</h3>
      <div class="chq-pub-rail-body">
        {dayCounts.map((d) => (
          <div class="chq-pub-rail-day-row">
            <a href={`/e/${event.slug}/agenda?day=${d.day}`}>{formatDay(d.day)}</a>
            <span class="chq-pub-rail-day-count">
              {d.count} session{d.count === 1 ? "" : "s"}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function CfpRailSection(props: { event: PublicEvent; cfpWindow: { openDate: number | null; closeDate: number | null } | null }) {
  const { event, cfpWindow } = props;
  if (!cfpWindow) return null;
  // DEC-683: "is the CFP open" goes through the SAME formWindowState
  // resolver the home hub uses (src/server/repo/public/home.ts) — never a
  // second date comparison here.
  const isOpen = formWindowState(cfpWindow.openDate, cfpWindow.closeDate, Date.now(), event.timezone) === "open";
  if (!isOpen) return null;
  return (
    <section class="chq-pub-rail-section">
      <h3 class="chq-pub-rail-heading">Call for papers</h3>
      <div class="chq-pub-rail-body">
        <span class="chq-pub-rail-caption">
          {cfpWindow.closeDate
            ? `Closes ${formatEventDateTime(dayLabelEndInstant(cfpWindow.closeDate, event.timezone), event.timezone)}`
            : "Open now · no close date set"}
        </span>
        <a class="chq-pub-rail-cfp-link" href={`/submit/${event.slug}`}>
          Submit a talk ›
        </a>
      </div>
    </section>
  );
}

export function SessionsContent(props: {
  event: PublicEvent;
  tracks: PublicTrack[];
  activeTrackId: string | null;
  // DEC-774: room/format chip filters, same shape/wiring as tracks.
  rooms?: { id: string; name: string }[];
  activeRoomId?: string | null;
  formatOptions?: string[];
  activeFormat?: string | null;
  q: string | null;
  items: PublicSession[];
  total: number;
  page: number;
  perPage?: number;
  limit?: number | null;
  fields?: CardFields;
  // DEC-594: chromeless /embed rendering — the search form, track-filter
  // pills and 'Show more' link must all stay inside /embed/... instead of
  // pointing at the full-chrome /e/... surface.
  embed?: boolean;
  // DEC-683: rail data. Both are only ever supplied when !embed — dispatch.tsx
  // skips the queries entirely for /embed rather than fetching-then-hiding.
  dayCounts?: { day: string; count: number }[];
  cfpWindow?: { openDate: number | null; closeDate: number | null } | null;
}) {
  const {
    event,
    tracks,
    activeTrackId,
    rooms,
    activeRoomId,
    formatOptions,
    activeFormat,
    q,
    items,
    total,
    page,
    perPage,
    limit,
    fields,
    embed,
    dayCounts,
    cfpWindow,
  } = props;
  // DEC-433/477/487: parsePage clamps page to MAX_PUBLIC_PAGE, so once we're
  // at the cap there is no page+1 to link to — stop rendering 'Show more'
  // even if items.length < total. Also stop once the cumulative row ceiling
  // (MAX_PUBLIC_ROWS) would be reached by the next page: a large ?limit=
  // embed can hit it well before page reaches MAX_PUBLIC_PAGE, and linking
  // past it would point at a page identical to the current one.
  const hasMore = hasMorePages(items.length, total, page, perPage ?? PUBLIC_PER_PAGE);
  const basePath = surfacePath(event, "sessions", embed ? "/embed" : "/e");
  // DEC-289/DEC-489: embed configuration params carried forward across the
  // search form and 'Show more' link exactly like trackId/q, so a configured
  // embed does not lose its configuration on page 2. `day` is not part of
  // the sessions surface's knob table (DEC-489) — it filters nothing here,
  // so the URL must not advertise it.
  const carryQs = limit ? `limit=${limit}&` : "";
  const activeRoom = activeRoomId ?? null;
  const activeFmt = activeFormat ?? null;
  // DEC-774: track/format/room filters all compose — every chip's href
  // (and the search form's hidden inputs) must preserve whichever of the
  // other two filters is currently active, overriding only its own axis.
  // `null` in an override clears that axis (the "All ..." chip); `undefined`
  // means "leave the active value alone".
  function filterQs(override: { trackId?: string | null; format?: string | null; roomId?: string | null }): string {
    const trackId = override.trackId !== undefined ? override.trackId : activeTrackId;
    const format = override.format !== undefined ? override.format : activeFmt;
    const roomId = override.roomId !== undefined ? override.roomId : activeRoom;
    const parts: string[] = [];
    if (trackId) parts.push(`trackId=${encodeURIComponent(trackId)}`);
    if (format) parts.push(`format=${encodeURIComponent(format)}`);
    if (roomId) parts.push(`roomId=${encodeURIComponent(roomId)}`);
    return parts.length > 0 ? `?${parts.join("&")}` : "";
  }
  return (
    <>
      <h2>Sessions</h2>
      <div class="chq-pub-sessions-layout">
        <div class="chq-pub-sessions-list">
          {/* EMB-02: plain GET search form, preserves the active track/format/
              room filters as hidden fields so search composes with all three. */}
          <form method="get" action={basePath} role="search">
            <label>
              Search
              <input type="search" name="q" value={q ?? ""} placeholder="Title or speaker name" />
            </label>
            {activeTrackId ? <input type="hidden" name="trackId" value={activeTrackId} /> : null}
            {activeFmt ? <input type="hidden" name="format" value={activeFmt} /> : null}
            {activeRoom ? <input type="hidden" name="roomId" value={activeRoom} /> : null}
            {limit ? <input type="hidden" name="limit" value={String(limit)} /> : null}
            <button type="submit">Search</button>
          </form>
          <nav aria-label="Track filters" class="chq-pub-filter-bar">
            <a class="chq-pub-pill" href={`${basePath}${filterQs({ trackId: null })}`} aria-current={activeTrackId === null ? "true" : undefined}>
              All tracks
            </a>
            {tracks.map((t) => (
              <a
                class="chq-pub-pill"
                href={`${basePath}${filterQs({ trackId: t.id })}`}
                aria-current={activeTrackId === t.id ? "true" : undefined}
              >
                {t.name}
              </a>
            ))}
          </nav>
          {formatOptions && formatOptions.length > 0 ? (
            <nav aria-label="Format filters" class="chq-pub-filter-bar">
              <a class="chq-pub-pill" href={`${basePath}${filterQs({ format: null })}`} aria-current={activeFmt === null ? "true" : undefined}>
                All formats
              </a>
              {formatOptions.map((f) => (
                <a
                  class="chq-pub-pill"
                  href={`${basePath}${filterQs({ format: f })}`}
                  aria-current={activeFmt === f ? "true" : undefined}
                >
                  {f}
                </a>
              ))}
            </nav>
          ) : null}
          {rooms && rooms.length > 0 ? (
            <nav aria-label="Room filters" class="chq-pub-filter-bar">
              <a class="chq-pub-pill" href={`${basePath}${filterQs({ roomId: null })}`} aria-current={activeRoom === null ? "true" : undefined}>
                All rooms
              </a>
              {rooms.map((r) => (
                <a
                  class="chq-pub-pill"
                  href={`${basePath}${filterQs({ roomId: r.id })}`}
                  aria-current={activeRoom === r.id ? "true" : undefined}
                >
                  {r.name}
                </a>
              ))}
            </nav>
          ) : null}
          <p>
            {items.length} of {total} session(s)
          </p>
          {items.map((s) => (
            <SessionCard session={s} event={event} from="sessions" fields={fields} embed={embed} itinerary={!embed} />
          ))}
          {hasMore ? (
            <p>
              <a
                href={`${basePath}?${activeTrackId ? `trackId=${activeTrackId}&` : ""}${
                  activeFmt ? `format=${encodeURIComponent(activeFmt)}&` : ""
                }${activeRoom ? `roomId=${encodeURIComponent(activeRoom)}&` : ""}${
                  q ? `q=${encodeURIComponent(q)}&` : ""
                }${carryQs}page=${page + 1}`}
              >
                Show more
              </a>
            </p>
          ) : null}
        </div>
        {/* DEC-672/DEC-683: the rail is chromeless-closed — /embed renders
            none of it (no <aside>, no /submit or /e/ hrefs). */}
        {!embed ? (
          <aside class="chq-pub-sessions-rail">
            <ScheduleRailSection event={event} />
            <DayIndexRailSection event={event} dayCounts={dayCounts ?? []} />
            <CfpRailSection event={event} cfpWindow={cfpWindow ?? null} />
          </aside>
        ) : null}
      </div>
      {!embed ? <ItineraryScript eventSlug={event.slug} /> : null}
    </>
  );
}
