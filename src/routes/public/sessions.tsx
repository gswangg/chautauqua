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
import { PublicSearchBox, PublicFilterSelectForm, PublicActiveFilters } from "./filters";
import { PublicEmptyState } from "./empty-state";
import { PUBLIC_PER_PAGE, hasMorePages } from "../../server/repo/public/bounds";
import { capitalizeFirst, countOf, plural, spellCount } from "../../domain/count-copy";
import { eventDays } from "../../domain/event-days";
import { embedKnobQuery } from "../../lib/embed-knobs";
import { DEC_919, DEC_489 } from "../../decisions";

void DEC_489;

void DEC_919;

// DEC-919 (wave 44 amendment): the day rail heading spells its own count
// ("Three days") instead of the bare noun the mock's <sc-for> placeholder
// implied -- see docs/design/Chautauqua Public and Portal.dc.html:103
// `Three days` (corrected from a prior wave's :91, which pointed at the
// aside's opening <section>, not the heading it introduces). Zero
// through ten get a spelled-out word (DEC-925: the shared
// src/domain/count-copy.ts spellCount, capitalized for a sentence head);
// anything longer falls back to the numeral.
function dayCountWord(n: number): string {
  return capitalizeFirst(spellCount(n));
}

function ScheduleRailSection(props: { event: PublicEvent }) {
  const { event } = props;
  return (
    <section class="chq-pub-rail-section">
      <h2 class="chq-pub-rail-heading">Your schedule</h2>
      <div class="chq-pub-rail-body">
        {/* G13 (frame 10--00, MAJOR): the scripted span carries the COUNT
            ALONE -- '4 saved in this browser · no account needed' -- never
            '4 picked' butted against the caption text. */}
        <span class="chq-pub-rail-caption">
          <span id="chq-ics-count">0</span> saved in this browser · no account needed
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
  // Frame anatomy lists EVERY day of the event, not just the days that
  // happen to already have a session scheduled -- a day with zero sessions
  // still reads "0 sessions" rather than vanishing from the index. DEC-277
  // (wave 60 amendment): eventDays throws loudly on a malformed range
  // instead of degrading to whatever dayCounts already carries -- there is
  // nothing to fall back from once the owner is fail-loud.
  const days = eventDays(event.startDate, event.endDate);
  const countByDay = new Map(dayCounts.map((d) => [d.day, d.count]));
  if (days.length === 0) return null;
  return (
    <section class="chq-pub-rail-section">
      <h2 class="chq-pub-rail-heading">
        {dayCountWord(days.length)} {plural(days.length, "day")}
      </h2>
      <div class="chq-pub-rail-body">
        {days.map((day) => (
          <div class="chq-pub-rail-day-row">
            <a href={`/e/${event.slug}/agenda?day=${day}`}>{formatDay(day)}</a>
            <span class="chq-pub-rail-day-count">
              {countOf(countByDay.get(day) ?? 0, "session")}
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
      <h2 class="chq-pub-rail-heading">Call for papers</h2>
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
  // v7 (design-pack v7 filter bar): day IS a sessions facet — "All days ▾"
  // in the bar; the SQL predicate has existed since DEC-634/DEC-774.
  activeDay?: string | null;
  items: PublicSession[];
  total: number;
  // v7 active-filter line: the unfiltered count for "9 of 18 sessions".
  // Equal to `total` when nothing is filtered (dispatch skips the extra
  // count query in that case).
  grandTotal?: number;
  page: number;
  perPage?: number;
  limit?: number | null;
  fields?: CardFields;
  // DEC-594: chromeless /embed rendering — the search form, track-filter
  // pills and 'Show more' link must all stay inside /embed/... instead of
  // pointing at the full-chrome /e/... surface.
  embed?: boolean;
  // DEC-489 (wave-54 amendment): the /embed-only accent knob — carried
  // forward onto every href this surface renders (filterQs/Show-more,
  // drill-ins) so page 2 of a customer's iframe doesn't revert to the
  // default accent. Never supplied by the /e/ route.
  accent?: string | null;
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
    activeDay: activeDayProp,
    grandTotal: grandTotalProp,
    page,
    perPage,
    limit,
    fields,
    embed,
    accent,
    dayCounts,
    cfpWindow,
  } = props;
  const activeDay = activeDayProp ?? null;
  const grandTotal = grandTotalProp ?? total;
  // DEC-433/477/487: parsePage clamps page to MAX_PUBLIC_PAGE, so once we're
  // at the cap there is no page+1 to link to — stop rendering 'Show more'
  // even if items.length < total. Also stop once the cumulative row ceiling
  // (MAX_PUBLIC_ROWS) would be reached by the next page: a large ?limit=
  // embed can hit it well before page reaches MAX_PUBLIC_PAGE, and linking
  // past it would point at a page identical to the current one.
  const hasMore = hasMorePages(items.length, total, page, perPage ?? PUBLIC_PER_PAGE);
  const basePath = surfacePath(event, "sessions", embed ? "/embed" : "/e");
  // DEC-289/DEC-489 (amended by design-pack v7): embed configuration params
  // are carried forward by filterQs (limit rides every composed href), and
  // `day` IS now part of the sessions knob table — the v7 bar's "All days"
  // facet over the DEC-634 SQL predicate.
  const activeRoom = activeRoomId ?? null;
  const activeFmt = activeFormat ?? null;
  // DEC-774: track/format/room filters all compose — every chip's href
  // (and the search form's hidden inputs) must preserve whichever of the
  // other two filters is currently active, overriding only its own axis.
  // `null` in an override clears that axis (the "All ..." chip); `undefined`
  // means "leave the active value alone".
  // DEC-489 (wave-54 amendment): the surface's `fields`/`accent` knobs,
  // carried forward onto every href filterQs composes (chips, Show-more)
  // when this render is inside /embed — the receiving route parses both
  // (dispatch.tsx), so a page-2 or filtered click must not silently revert
  // to the default fields/accent. Never emitted outside /embed: `fields`/
  // `accent` are configured-embed knobs, not user filters, so /e/ never
  // carries them at all.
  const activeFieldNames = fields ? (Object.keys(fields) as (keyof CardFields)[]).filter((k) => fields[k]) : [];
  const embedCarryQs = embed ? embedKnobQuery("sessions", { fields: activeFieldNames, accent }) : "";
  // DEC-151 (wave-59 amendment): the drill-in link into a session detail
  // carries this surface's active narrowing (day/trackId/format/roomId/q)
  // PLUS the embed-only fields/accent knobs above, through the SAME
  // embedKnobQuery encoder, so the detail page's Back link restores exactly
  // where the visitor was rather than the surface's bare default -- on both
  // /e and /embed.
  const detailCardCarryQs = embedKnobQuery("sessions", {
    trackId: activeTrackId,
    format: activeFmt,
    roomId: activeRoom,
    day: activeDay,
    q,
    fields: embed ? activeFieldNames : undefined,
    accent: embed ? accent : undefined,
  });
  function filterQs(override: {
    trackId?: string | null;
    format?: string | null;
    roomId?: string | null;
    day?: string | null;
    q?: string | null;
  }): string {
    const trackId = override.trackId !== undefined ? override.trackId : activeTrackId;
    const format = override.format !== undefined ? override.format : activeFmt;
    const roomId = override.roomId !== undefined ? override.roomId : activeRoom;
    const day = override.day !== undefined ? override.day : activeDay;
    const query = override.q !== undefined ? override.q : q;
    const parts: string[] = [];
    if (day) parts.push(`day=${encodeURIComponent(day)}`);
    if (trackId) parts.push(`trackId=${encodeURIComponent(trackId)}`);
    if (format) parts.push(`format=${encodeURIComponent(format)}`);
    if (roomId) parts.push(`roomId=${encodeURIComponent(roomId)}`);
    if (query) parts.push(`q=${encodeURIComponent(query)}`);
    if (limit) parts.push(`limit=${limit}`);
    if (embedCarryQs) parts.push(embedCarryQs);
    return parts.length > 0 ? `?${parts.join("&")}` : "";
  }
  // v7 filter bar: each select form carries every OTHER active param as
  // hidden inputs so facets compose (same idiom as agenda-controls.tsx).
  function hiddenCarry(exclude: "day" | "trackId" | "format" | "roomId") {
    return (
      <>
        {q ? <input type="hidden" name="q" value={q} /> : null}
        {activeDay && exclude !== "day" ? <input type="hidden" name="day" value={activeDay} /> : null}
        {activeTrackId && exclude !== "trackId" ? <input type="hidden" name="trackId" value={activeTrackId} /> : null}
        {activeFmt && exclude !== "format" ? <input type="hidden" name="format" value={activeFmt} /> : null}
        {activeRoom && exclude !== "roomId" ? <input type="hidden" name="roomId" value={activeRoom} /> : null}
        {limit ? <input type="hidden" name="limit" value={String(limit)} /> : null}
      </>
    );
  }
  const allEventDays = eventDays(event.startDate, event.endDate);
  const trackNameOf = new Map(tracks.map((t) => [t.id, t.name]));
  const roomNameOf = new Map((rooms ?? []).map((r) => [r.id, r.name]));
  // v7 active-filter line: one removable chip per active facet (search
  // included — it narrows the same list), each href clearing ONLY its axis.
  const activeChips: { label: string; clearHref: string }[] = [];
  if (activeDay) activeChips.push({ label: formatDay(activeDay), clearHref: `${basePath}${filterQs({ day: null })}` });
  if (activeTrackId)
    activeChips.push({ label: trackNameOf.get(activeTrackId) ?? "Track", clearHref: `${basePath}${filterQs({ trackId: null })}` });
  if (activeFmt) activeChips.push({ label: activeFmt, clearHref: `${basePath}${filterQs({ format: null })}` });
  if (activeRoom)
    activeChips.push({ label: roomNameOf.get(activeRoom) ?? "Room", clearHref: `${basePath}${filterQs({ roomId: null })}` });
  if (q) activeChips.push({ label: `“${q}”`, clearHref: `${basePath}${filterQs({ q: null })}` });
  // DEC-919 (wave 47 amendment): 'fresh' -- no facet in flight AND the
  // unfiltered total is 0 -- hides the filter bar entirely (there is
  // nothing to narrow yet) and never offers an escape link (there is no
  // filter to clear). Any facet in flight with zero matching rows is
  // 'filtered' instead, even if items.length === 0 too: the bar stays
  // mounted and the escape clears back to the bare surface path.
  const anyFilterActive = Boolean(q || activeDay || activeTrackId || activeFmt || activeRoom);
  const isFresh = !anyFilterActive && grandTotal === 0;
  return (
    <>
      <h1 class="chq-pub-surface-title">Sessions</h1>
      <div class="chq-pub-sessions-layout">
        <div class="chq-pub-sessions-list">
          {!isFresh ? (
            <>
              {/* EMB-02/DEC-919 (wave 40 amendment): the one .chq-pub-filter-row
                  -- the search box first, then every pill bar for this surface,
                  inline and wrapping instead of three separately ruled rows.
                  Hidden fields preserve the active track/format/room filters so
                  search composes with all three. */}
              {/* v7 filter bar ("one idiom, four surfaces"): ONE resting row —
                  search at the head, then a compact select per facet. No pill
                  rows ("four selects read as one control group; one pill row
                  plus two selects reads as five things"). Each select is its
                  own auto-submitting GET form carrying the other active params
                  (agenda-controls.tsx idiom). */}
              <div class="chq-pub-filter-row">
                <PublicSearchBox
                  action={basePath}
                  q={q}
                  hidden={
                    <>
                      {activeDay ? <input type="hidden" name="day" value={activeDay} /> : null}
                      {activeTrackId ? <input type="hidden" name="trackId" value={activeTrackId} /> : null}
                      {activeFmt ? <input type="hidden" name="format" value={activeFmt} /> : null}
                      {activeRoom ? <input type="hidden" name="roomId" value={activeRoom} /> : null}
                      {limit ? <input type="hidden" name="limit" value={String(limit)} /> : null}
                    </>
                  }
                />
                {/* day facet is /e/-site-only: DEC-489's embed rationale
                    survives v7 — day is not an embed knob and must not be
                    advertised there. */}
                {!embed && allEventDays.length > 1 ? (
                  <PublicFilterSelectForm
                    action={basePath}
                    name="day"
                    allLabel="All days"
                    options={allEventDays.map((d) => ({ value: d, label: formatDay(d) }))}
                    activeValue={activeDay}
                    hidden={hiddenCarry("day")}
                  />
                ) : null}
                <PublicFilterSelectForm
                  action={basePath}
                  name="trackId"
                  allLabel="All tracks"
                  options={tracks.map((t) => ({ value: t.id, label: t.name }))}
                  activeValue={activeTrackId}
                  hidden={hiddenCarry("trackId")}
                />
                {formatOptions && formatOptions.length > 0 ? (
                  <PublicFilterSelectForm
                    action={basePath}
                    name="format"
                    allLabel="All formats"
                    options={formatOptions.map((f) => ({ value: f, label: f }))}
                    activeValue={activeFmt}
                    hidden={hiddenCarry("format")}
                  />
                ) : null}
                {rooms && rooms.length > 0 ? (
                  <PublicFilterSelectForm
                    action={basePath}
                    name="roomId"
                    allLabel="All rooms"
                    options={rooms.map((r) => ({ value: r.id, label: r.name }))}
                    activeValue={activeRoom}
                    hidden={hiddenCarry("roomId")}
                  />
                ) : null}
              </div>
              <PublicActiveFilters
                total={total}
                grandTotal={grandTotal}
                noun="sessions"
                chips={activeChips}
                clearAllHref={`${basePath}${limit ? `?limit=${limit}` : ""}`}
              />
            </>
          ) : null}
          {/* DEC-919 (wave 47 amendment): one zero-state renderer for both
              the never-published ('fresh') and the zero-matches ('filtered')
              cases -- replaces the wave-44 single-sentence-no-split row. */}
          {items.length === 0 ? (
            isFresh ? (
              // G13 (frame 10--20): headline carries no trailing period at
              // the page-title scale (empty.css.ts).
              <PublicEmptyState
                variant="fresh"
                what="The programme is not out yet"
                reason="Sessions appear here once the schedule is published."
              />
            ) : (
              <PublicEmptyState
                variant="filtered"
                what="No sessions match your search."
                reason={`Filtered by ${activeChips.map((c) => c.label).join(", ")}.`}
                escapeHref={basePath}
                escapeLabel="Clear filters"
              />
            )
          ) : null}
          {/* w1-c (DEC-534): with the gutter's day label gone (now start
              time + room only, see SessionSchedule in ./cards), a list that
              spans more than one scheduled day needs a heading of its own
              so the day is still legible. Only rendered when no ?day=
              filter is already narrowing to a single day (activeDay unset)
              and the current page's items actually span >1 distinct
              scheduled day — a single-day page (or an all-unscheduled one)
              gets no headings. Unscheduled rows (day: null) never get a
              heading — the shared order (DEC-534, sessionOrderBy in the
              repo layer) always places them after every scheduled row, so
              they trail the last day's group with nothing above them. */}
          {(() => {
            const distinctDays = new Set(items.map((s) => s.day).filter((d): d is string => d !== null));
            const showDayHeadings = !activeDay && distinctDays.size > 1;
            let lastHeadingDay: string | null = null;
            return items.map((s) => {
              const showHeadingHere = showDayHeadings && s.day !== null && s.day !== lastHeadingDay;
              if (showHeadingHere) lastHeadingDay = s.day;
              return (
                <>
                  {showHeadingHere ? <h2 class="chq-pub-sessions-day-heading">{formatDay(s.day as string)}</h2> : null}
                  <SessionCard
                    session={s}
                    event={event}
                    from="sessions"
                    fields={fields}
                    embed={embed}
                    itinerary={!embed}
                    carry={detailCardCarryQs || undefined}
                  />
                </>
              );
            });
          })()}
          {hasMore ? (
            <p>
              <a
                class="chq-pub-accent-link"
                href={`${basePath}${filterQs({})}${filterQs({}) ? "&" : "?"}page=${page + 1}`}
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
