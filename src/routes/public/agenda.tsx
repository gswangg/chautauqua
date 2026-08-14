// Agenda / schedule surfaces (time-grid rendering + itinerary picker).
// Split out of the former monolithic src/routes/public.tsx (contention
// decomposition) — no behavior change.

import type { PublicAgendaItem, PublicEvent, PublicTrack } from "../../server/repo/public";
import { MAX_ITINERARY_IDS, itineraryStorageKey, mergeItinerarySelection, mirrorItineraryCheckboxes } from "../../lib/itinerary";
import { publicRoomLabel } from "../../domain/schedule";
import { plural } from "../../domain/count-copy";
import { sessionDetailPath, surfacePath, type Surface, type SurfaceBase } from "./shell";
import { TrackChips, FormatChip, SpeakerNames, SessionDescription, ItineraryToggle, formatDay, formatMinutes } from "./cards";
import { PublicSearchBox, PublicFilterBar } from "./filters";
import { DEC_999 } from "../../decisions";

void DEC_999;

/** DEC-584 (wave 64 amendment): the public agenda's desktop room-lane
 * matrix is replaced by a time-row SEQUENCE — one row per DISTINCT start
 * minute in the day, ascending, each row pairing an 88px time cell with a
 * `repeat(auto-fit, minmax(228px, 1fr))` blocks container. `rooms`/
 * `roomPositions` reproduce DEC-563's producer-owned column order (room.
 * position asc, name asc, id asc, unroomed always last) — no longer to
 * pick a grid COLUMN, but to order same-start-time blocks deterministically
 * left-to-right regardless of item array order. */
function roomSortKeys(items: PublicAgendaItem[]): { roomNames: Map<string, string>; roomPositions: Map<string, number | null> } {
  const roomNames = new Map(items.map((i) => [i.roomId ?? "tbd", publicRoomLabel(i.roomName)]));
  const roomPositions = new Map(items.map((i) => [i.roomId ?? "tbd", i.roomId ? i.roomPosition : null]));
  return { roomNames, roomPositions };
}

function roomSortCompare(a: string, b: string, roomNames: Map<string, string>, roomPositions: Map<string, number | null>): number {
  if (a === "tbd" && b === "tbd") return 0;
  if (a === "tbd") return 1;
  if (b === "tbd") return -1;
  const posA = roomPositions.get(a) ?? null;
  const posB = roomPositions.get(b) ?? null;
  if (posA !== posB) {
    if (posA === null) return 1;
    if (posB === null) return -1;
    return posA - posB;
  }
  const nameCmp = (roomNames.get(a) ?? "").localeCompare(roomNames.get(b) ?? "");
  if (nameCmp !== 0) return nameCmp;
  return a.localeCompare(b);
}

/** Groups a day's items into ascending distinct-start-minute rows, each
 * row's items ordered by the same producer-owned room order as before. */
function groupByStartMinute(items: PublicAgendaItem[]): { startMin: number; items: PublicAgendaItem[] }[] {
  const { roomNames, roomPositions } = roomSortKeys(items);
  const byStart = new Map<number, PublicAgendaItem[]>();
  for (const item of items) {
    const list = byStart.get(item.startMin) ?? [];
    list.push(item);
    byStart.set(item.startMin, list);
  }
  return [...byStart.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([startMin, rowItems]) => ({
      startMin,
      items: [...rowItems].sort((x, y) => roomSortCompare(x.roomId ?? "tbd", y.roomId ?? "tbd", roomNames, roomPositions)),
    }));
}

/** Per-day time-row sequence (DEC-584 wave-64 amendment): one row per
 * distinct start minute, each row's blocks laid out as a wrapping grid
 * rather than fixed room columns — public density rarely has enough
 * concurrent sessions to justify a lane matrix, and clashes are an
 * organiser concept, not a public one (no clash indicators here). */
export function AgendaDayGrid(props: { day: string; items: PublicAgendaItem[]; event: PublicEvent; from: Surface; base?: SurfaceBase }) {
  const { day, items, event, from, base } = props;
  const rows = groupByStartMinute(items);

  return (
    // DEC-768: the day heading is owned by AgendaDay (the caller wrapping
    // both this grid and AgendaItemList below) -- rendering it here too
    // duplicated it in the DOM (both copies always present, only one
    // display:none'd per breakpoint). w1-i's formatDay() day label is kept
    // (it now reaches the DOM through that single owning heading).
    <section aria-label={`Agenda for ${formatDay(day)}`}>
      <div class="chq-pub-agenda-day-scroll">
        <div class="chq-pub-agenda-day">
          {rows.map((row) => (
            <div class="chq-pub-agenda-day-row">
              <div class="chq-pub-agenda-day-time">{formatMinutes(row.startMin)}</div>
              <div class="chq-pub-agenda-day-blocks">
                {row.items.map((item) => (
                  // DEC-602/DEC-584 (wave 64): the block is a content-sized
                  // card, not a grid-row/grid-column positioned box — no
                  // fixed height math, no lane geometry (single-lane
                  // matrix removed; overlap only mattered when rooms were
                  // columns sharing a row track).
                  <div class="chq-pub-agenda-block" id={`chq-agenda-${item.submissionId}`}>
                    <div class="chq-pub-agenda-block-head">
                      <span class="chq-pub-agenda-block-room">{publicRoomLabel(item.roomName)}</span>
                      <ItineraryToggle sessionId={item.submissionId} />
                    </div>
                    <div class="chq-pub-agenda-block-title">
                      <strong>
                        <a href={sessionDetailPath(event, item.submissionId, from, base)}>{item.title}</a>
                      </strong>
                    </div>
                    <div class="chq-pub-agenda-block-speakers">
                      <SpeakerNames speakers={item.speakers} />
                    </div>
                    <div class="chq-pub-agenda-block-meta">
                      <TrackChips tracks={item.tracks} />
                      <FormatChip format={item.format} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** DEC-584: phone (<700px) markup for a single agenda day. AgendaDayGrid's
 * absolutely-positioned room-column grid is unreadable as a horizontal
 * scroll-wall at 390px, so the phone breakpoint renders the SAME `items`
 * array as a single vertical list instead — start-time order, then room
 * position (DEC-563's producer-owned ordering, same tiebreak as the desktop
 * grid's room columns), then id. Room and track are rendered as visible
 * text/chip content here (not colour alone), same as the desktop grid. */
// DEC-602: shared list markup between /agenda's phone-only breakpoint and
// /schedule (which now renders this list at EVERY width, never the room-
// column grid). `showDescription`/`showDay` and the extra list/section
// classes are only turned on for /schedule; /agenda's phone list keeps its
// exact prior output.
function AgendaItemList(props: {
  day: string;
  items: PublicAgendaItem[];
  event: PublicEvent;
  from: Surface;
  itinerary?: boolean;
  showDescription?: boolean;
  showDay?: boolean;
  listClass?: string;
  sectionClass?: string;
  base?: SurfaceBase;
  // DEC-783: /schedule's per-day list groups rows that share a start time
  // under a time sub-header; /agenda's phone list (which reuses this same
  // component) leaves this off and keeps its exact prior output.
  groupByStart?: boolean;
}) {
  const { day, items, event, from, itinerary, showDescription, showDay, listClass, sectionClass, base, groupByStart } = props;
  const sorted = [...items].sort((a, b) => {
    if (a.startMin !== b.startMin) return a.startMin - b.startMin;
    const posA = a.roomId ? (a.roomPosition ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;
    const posB = b.roomId ? (b.roomPosition ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;
    if (posA !== posB) return posA - posB;
    return a.submissionId.localeCompare(b.submissionId);
  });
  let lastStart: number | null = null;
  return (
    // DEC-768: no h3 here either -- every caller of this list (AgendaDay,
    // ScheduleContent's per-day wrapper) owns its own single day heading.
    <section aria-label={`Agenda for ${formatDay(day)}`} class={sectionClass ?? "chq-pub-agenda-list-wrap"}>
      <ol class={listClass ?? "chq-pub-agenda-list"}>
        {sorted.map((item) => {
          const isNewGroup = groupByStart && item.startMin !== lastStart;
          if (isNewGroup) lastStart = item.startMin;
          return (
            <>
              {isNewGroup ? (
                <li class="chq-pub-schedule-time-subhead" aria-hidden="true">
                  {formatMinutes(item.startMin)}
                </li>
              ) : null}
              <li class="chq-pub-agenda-list-item" id={`chq-agenda-list-${item.submissionId}`} data-submission-id={item.submissionId}>
            <div class="chq-pub-agenda-list-time">
              {showDay ? `${formatDay(day)} · ` : ""}
              {formatMinutes(item.startMin)}–{formatMinutes(item.endMin)}
            </div>
            <div>
              <strong>
                <a class="chq-pub-agenda-list-title" href={sessionDetailPath(event, item.submissionId, from, base)}>
                  {item.title}
                </a>
              </strong>
            </div>
            <div class="chq-pub-agenda-list-room">{publicRoomLabel(item.roomName)}</div>
            <div>
              <TrackChips tracks={item.tracks} />
              <FormatChip format={item.format} />
            </div>
            {showDescription ? <SessionDescription description={item.description} /> : null}
            <div class="chq-pub-agenda-list-speakers">
              <SpeakerNames speakers={item.speakers} />
            </div>
            {itinerary ? (
              // DEC-783 / w1-i: the row control NAMES its state, and it does
              // so through the ONE shared ItineraryToggle the sessions list
              // card and the detail page already render (cards.tsx) — a
              // hand-copied Save/Saved span pair would drift from
              // ITINERARY_TOGGLE_LABEL. `.chq-pub-itinerary-row` keeps this
              // row's own layout (and carries its own :checked flip rules in
              // public.css.ts) instead of the pill's box styling.
              <ItineraryToggle sessionId={item.submissionId} wrapperClass="chq-pub-itinerary-row" />
            ) : null}
              </li>
            </>
          );
        })}
      </ol>
    </section>
  );
}

/** DEC-584: renders BOTH the desktop grid and the phone list for one day
 * from the same `items` array, switched at the 700px breakpoint purely by
 * CSS `display:none` (public.css.ts) so exactly one is in the a11y tree at
 * a time. */
function AgendaDay(props: { day: string; items: PublicAgendaItem[]; event: PublicEvent; from: Surface; base?: SurfaceBase }) {
  // DEC-584 (wave 64 amendment): the heading names the day's own density
  // ("<Weekday D Month> · N sessions · M rooms") rather than the bare day
  // label — counts are derived from THIS day's items, through the one
  // shared plural() helper (src/domain/count-copy), never hand-pluralised.
  const roomCount = new Set(props.items.map((i) => i.roomId ?? "tbd")).size;
  return (
    <div id={`chq-day-${props.day}`}>
      {/* DEC-768: the ONE heading for this day, owned here -- neither
          AgendaDayGrid nor AgendaItemList renders its own anymore. */}
      <h3>
        {formatDay(props.day)} · {props.items.length} {plural(props.items.length, "session")} · {roomCount} {plural(roomCount, "room")}
      </h3>
      <div class="chq-pub-agenda-desktop">
        <AgendaDayGrid {...props} />
      </div>
      <AgendaItemList {...props} />
    </div>
  );
}

export function groupByDay(items: PublicAgendaItem[]): Map<string, PublicAgendaItem[]> {
  const map = new Map<string, PublicAgendaItem[]>();
  for (const item of items) {
    const list = map.get(item.day) ?? [];
    list.push(item);
    map.set(item.day, list);
  }
  return map;
}

// DEC-919/DEC-835/DEC-851: the ONE param-composition rule for every
// itinerary-surface out-link (day pills, track/format pills, and the search
// form's hidden fields) — day, trackId, q and format all carry forward
// together unless an override says otherwise, reused by DaySwitcher below
// AND by ItinerarySearchForm's new track/format pill bars, rather than a
// second hand-written composition living next to the first.
function agendaQs(
  current: { day?: string | null; trackId?: string | null; q?: string | null; format?: string | null },
  override: { day?: string | null; trackId?: string | null; q?: string | null; format?: string | null } = {},
): string {
  const day = override.day !== undefined ? override.day : (current.day ?? null);
  const trackId = override.trackId !== undefined ? override.trackId : (current.trackId ?? null);
  const q = override.q !== undefined ? override.q : (current.q ?? null);
  const format = override.format !== undefined ? override.format : (current.format ?? null);
  const parts: string[] = [];
  if (day) parts.push(`day=${day}`);
  if (trackId) parts.push(`trackId=${encodeURIComponent(trackId)}`);
  if (q) parts.push(`q=${encodeURIComponent(q)}`);
  if (format) parts.push(`format=${encodeURIComponent(format)}`);
  return parts.length > 0 ? `?${parts.join("&")}` : "";
}

/** EMB-07: day switcher — one pill per event day. DEC-768: `renderedDays`
 * is the set of days that actually have a `#chq-day-<day>` section on THIS
 * page (so their pill can jump in-page); any day outside that set (e.g.
 * every other day on a `?day=`-filtered view) links out to `?day=<day>`
 * instead, or the switcher would dead-end on a filtered view arrived at
 * from the Sessions rail's day index. `activeDay` (the filter currently
 * applied, if any) is marked current. `base` keeps the out-link inside
 * /embed when this renders inside a chromeless embed (EMB-7: an embed's own
 * links must never break out of its iframe to a full-chrome /e/... href). */
function DaySwitcher(props: {
  days: string[];
  renderedDays: Set<string>;
  event: PublicEvent;
  surface: "agenda" | "schedule";
  base: SurfaceBase;
  activeDay?: string | null;
  trackId?: string | null;
  q?: string | null;
  format?: string | null;
}) {
  const { days, renderedDays, event, surface, base, activeDay, trackId, q, format } = props;
  if (days.length <= 1) return null;
  // DEC-783/DEC-851: a day jump must not silently drop the active
  // q/trackId/format filter — every out-link carries them forward
  // alongside ?day=, via the shared agendaQs composer above.
  // DEC-835: the day a visitor is reading is in the URL — every pill (on
  // the default unfiltered view AND a filtered one) emits a real
  // `?day=<day>` href, never a bare `#chq-day-<day>` anchor, so the URL
  // always reflects the day in view and a reload/share lands back on it.
  // The `#chq-day-<day>` section id is still appended as a fragment so an
  // already-rendered day's pill scrolls in place instead of a full reload.
  const current = { trackId: trackId ?? null, q: q ?? null, format: format ?? null };
  // DEC-885: a navigation control that never says where you are is a list
  // of links. On the ?day=-filtered view `activeDay` names it directly; on
  // the default unfiltered view no query param picks a day, but the page
  // still opens on ONE day -- the first day rendered top-to-bottom -- so
  // that first day is the one in view and gets aria-current, exactly one
  // pill either way.
  const effectiveActiveDay = activeDay ?? days[0] ?? null;
  return (
    <nav aria-label="Jump to day" class="chq-pub-day-switcher">
      {days.map((day) => {
        const isActive = day === effectiveActiveDay;
        const qs = agendaQs(current, { day });
        const href = renderedDays.has(day)
          ? `${surfacePath(event, surface, base)}${qs}#chq-day-${day}`
          : `${surfacePath(event, surface, base)}${qs}`;
        return (
          <a
            class={isActive ? "chq-pub-day-pill chq-pub-day-pill-active" : "chq-pub-day-pill"}
            href={href}
            aria-current={isActive ? "page" : undefined}
          >
            {formatDay(day)}
          </a>
        );
      })}
    </nav>
  );
}

// DEC-804/DEC-851/DEC-919: the itinerary surfaces (/agenda, /schedule) render
// the SAME PublicSearchBox + PublicFilterBar idiom the sessions list already
// uses — track/format used to be <select> dropdowns living inside this form
// (narrowing needed a submit); they are now pill bars like every other
// public surface, honoured server-side exactly the same way (DEC-783 covered
// q/trackId; DEC-851 added format). `activeDay` (and, now that they are no
// longer select values, activeTrackId/activeFormat too) are carried forward
// as hidden fields on the search box, and as query params on every pill
// href, via the shared agendaQs composer — a search/track/format/day pick
// never drops any of the others.
function ItinerarySearchForm(props: {
  event: PublicEvent;
  tracks: PublicTrack[];
  activeTrackId: string | null;
  activeDay: string | null;
  q: string | null;
  basePath: string;
  formatOptions?: string[];
  activeFormat?: string | null;
}) {
  const { tracks, activeTrackId, activeDay, q, basePath, formatOptions, activeFormat } = props;
  const current = { day: activeDay, trackId: activeTrackId, q, format: activeFormat ?? null };
  // DEC-919 (wave 40 amendment): one .chq-pub-filter-row -- the search box
  // first, then every pill bar for this surface, inline and wrapping,
  // shared by both AgendaContent and ScheduleContent (the /schedule surface
  // gets the same row as /agenda, not a bare, unwrapped search form).
  return (
    <div class="chq-pub-filter-row">
      <PublicSearchBox
        action={basePath}
        q={q}
        hidden={
          <>
            {activeTrackId ? <input type="hidden" name="trackId" value={activeTrackId} /> : null}
            {activeFormat ? <input type="hidden" name="format" value={activeFormat} /> : null}
            {activeDay ? <input type="hidden" name="day" value={activeDay} /> : null}
          </>
        }
      />
      <PublicFilterBar
        ariaLabel="Track filters"
        allLabel="All tracks"
        options={tracks.map((t) => ({ value: t.id, label: t.name }))}
        activeValue={activeTrackId}
        hrefFor={(v) => `${basePath}${agendaQs(current, { trackId: v })}`}
      />
      {formatOptions && formatOptions.length > 0 ? (
        <PublicFilterBar
          ariaLabel="Format filters"
          allLabel="All formats"
          options={formatOptions.map((f) => ({ value: f, label: f }))}
          activeValue={activeFormat ?? null}
          hrefFor={(v) => `${basePath}${agendaQs(current, { format: v })}`}
        />
      ) : null}
    </div>
  );
}

export function AgendaContent(props: {
  event: PublicEvent;
  tracks?: PublicTrack[];
  items: PublicAgendaItem[];
  total: number;
  embed?: boolean;
  allDays?: string[] | null;
  activeDay?: string | null;
  trackId?: string | null;
  q?: string | null;
  formatOptions?: string[];
  format?: string | null;
}) {
  const byDay = groupByDay(props.items);
  const renderedDays = new Set(byDay.keys());
  const days = props.allDays ?? [...renderedDays];
  const base: SurfaceBase = props.embed ? "/embed" : "/e";
  const basePath = surfacePath(props.event, "agenda", base);
  return (
    <>
      <h1 class="chq-pub-surface-title">Agenda</h1>
      <ItinerarySearchForm
        event={props.event}
        tracks={props.tracks ?? []}
        activeTrackId={props.trackId ?? null}
        activeDay={props.activeDay ?? null}
        q={props.q ?? null}
        basePath={basePath}
        formatOptions={props.formatOptions}
        activeFormat={props.format ?? null}
      />
      {byDay.size === 0 ? (
        <p>No sessions scheduled yet.</p>
      ) : (
        <>
          {props.items.length < props.total ? (
            <p>
              Showing the first {props.items.length} of {props.total} scheduled sessions.
            </p>
          ) : null}
          <DaySwitcher
            days={days}
            renderedDays={renderedDays}
            event={props.event}
            surface="agenda"
            base={base}
            activeDay={props.activeDay}
            trackId={props.trackId}
            q={props.q}
            format={props.format}
          />
          {[...renderedDays].map((day) => (
            <AgendaDay day={day} items={byDay.get(day) ?? []} event={props.event} from="agenda" base={base} />
          ))}
        </>
      )}
    </>
  );
}

/** Itinerary picker inline vanilla JS (DEC-022): reads/writes
 * localStorage chq_itinerary_<slug>, keeps the .ics download link's ?ids=
 * query in sync with the checked set. */
export function ItineraryScript(props: { eventSlug: string }) {
  const storageKey = itineraryStorageKey(props.eventSlug);
  // EMB-10/11: mergeItinerarySelection's own body references MAX_ITINERARY_IDS
  // as a free identifier -- .toString() embeds only the function's SOURCE,
  // never its closed-over module-level const, so the const must be emitted into
  // the IIFE below too. Without it every change handler throws before
  // localStorage.setItem ever runs and no pick persists.
  // NB: keep this explanation OUT of the emitted `js` string. The hostile-input
  // surface test (test/public-surface-hostile-input.test.ts) asserts no public
  // response body ever names a raw exception type, so a comment naming one
  // would fail it once shipped inside the inline script.
  const js = `(function(){
  var MAX_ITINERARY_IDS = ${MAX_ITINERARY_IDS};
  var __chqMerge = (${mergeItinerarySelection.toString()});
  var __chqMirror = (${mirrorItineraryCheckboxes.toString()});
  var key = ${JSON.stringify(storageKey)};
  var slug = ${JSON.stringify(props.eventSlug)};
  var stored = [];
  try { stored = JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { stored = []; }
  var boxes = document.querySelectorAll('.chq-itinerary-toggle');
  // DEC-584: the desktop grid and the phone list both render a
  // '.chq-itinerary-toggle' for every session (one is display:none at a
  // time, but both stay in the DOM), so the SAME submission id appears
  // twice in the raw NodeList -- dedupe before this list reaches
  // __chqMerge, or the itinerary is not the set of unique rendered ids.
  var allRenderedIds = [];
  Array.prototype.forEach.call(boxes, function(b){
    if (allRenderedIds.indexOf(b.value) === -1) { allRenderedIds.push(b.value); }
  });
  function currentIds(){
    return Array.prototype.filter.call(boxes, function(b){ return b.checked; }).map(function(b){ return b.value; });
  }
  function updateLink(ids){
    var link = document.getElementById('chq-ics-link');
    var count = document.getElementById('chq-ics-count');
    if (count) { count.textContent = ids.length + ' picked'; }
    if (!link) return;
    if (ids.length === 0) { link.setAttribute('aria-disabled', 'true'); link.removeAttribute('href'); return; }
    link.removeAttribute('aria-disabled');
    link.href = '/e/' + slug + '/schedule.ics?ids=' + encodeURIComponent(ids.join(','));
  }
  // DEC-602: 'Show only my picks' toggle (/schedule only -- no-ops
  // harmlessly if these elements aren't on the page). Filters the rendered
  // list to the stored ids, shows a live count and an honest empty state,
  // and drops a session the moment it's unchecked (see applyPicksFilter
  // call at the end of the change handler below).
  var picksOnly = document.getElementById('chq-picks-only');
  var picksCount = document.getElementById('chq-picks-only-count');
  var picksEmpty = document.getElementById('chq-picks-empty');
  var listItems = Array.prototype.slice.call(document.querySelectorAll('.chq-pub-agenda-list-item'));
  var daySections = Array.prototype.slice.call(document.querySelectorAll('.chq-pub-schedule-day'));
  function applyPicksFilter(){
    var ids = currentIds();
    if (picksCount) { picksCount.textContent = String(ids.length); }
    var on = !!(picksOnly && picksOnly.checked);
    Array.prototype.forEach.call(listItems, function(li){
      var id = li.getAttribute('data-submission-id');
      li.style.display = (!on || ids.indexOf(id) !== -1) ? '' : 'none';
    });
    Array.prototype.forEach.call(daySections, function(sec){
      var items = sec.querySelectorAll('.chq-pub-agenda-list-item');
      var anyVisible = Array.prototype.some.call(items, function(li){ return li.style.display !== 'none'; });
      sec.style.display = (on && !anyVisible) ? 'none' : '';
    });
    if (picksEmpty) { picksEmpty.hidden = !(on && ids.length === 0); }
  }
  Array.prototype.forEach.call(boxes, function(b){ b.checked = stored.indexOf(b.value) !== -1; });
  updateLink(stored);
  applyPicksFilter();
  if (picksOnly) { picksOnly.addEventListener('change', applyPicksFilter); }
  document.addEventListener('change', function(e){
    if (!e.target || !e.target.classList || !e.target.classList.contains('chq-itinerary-toggle')) return;
    // THE TRAP (DEC-584): currentIds() below is "every checked box" across
    // BOTH copies. Without mirroring first, unchecking only the visible
    // copy leaves the hidden copy's box still checked, so the id never
    // leaves currentIds() and the uncheck never persists. Mirror every box
    // sharing the changed input's value to its new checked state first.
    var states = Array.prototype.map.call(boxes, function(b){ return { value: b.value, checked: b.checked }; });
    var mirrored = __chqMirror(states, e.target.value, e.target.checked);
    Array.prototype.forEach.call(boxes, function(b, i){ b.checked = mirrored[i].checked; });
    var latestStored = [];
    try { latestStored = JSON.parse(localStorage.getItem(key) || '[]'); } catch (err) { latestStored = []; }
    var ids = __chqMerge(latestStored, allRenderedIds, currentIds());
    localStorage.setItem(key, JSON.stringify(ids));
    updateLink(ids);
    applyPicksFilter();
  });
})();`;
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}

export function ScheduleContent(props: {
  event: PublicEvent;
  tracks?: PublicTrack[];
  items: PublicAgendaItem[];
  total: number;
  embed?: boolean;
  allDays?: string[] | null;
  activeDay?: string | null;
  trackId?: string | null;
  q?: string | null;
  formatOptions?: string[];
  format?: string | null;
}) {
  const byDay = groupByDay(props.items);
  const renderedDays = new Set(byDay.keys());
  const days = props.allDays ?? [...renderedDays];
  const base: SurfaceBase = props.embed ? "/embed" : "/e";
  const basePath = surfacePath(props.event, "schedule", base);
  return (
    <>
      <h1 class="chq-pub-surface-title">My schedule</h1>
      <ItinerarySearchForm
        event={props.event}
        tracks={props.tracks ?? []}
        activeTrackId={props.trackId ?? null}
        activeDay={props.activeDay ?? null}
        q={props.q ?? null}
        basePath={basePath}
        formatOptions={props.formatOptions}
        activeFormat={props.format ?? null}
      />
      <p>
        Check sessions to build a personal itinerary. Your picks are saved in this browser and survive a reload.{" "}
        <a
          id="chq-ics-link"
          class="chq-pub-itinerary-cta"
          href={`/e/${props.event.slug}/schedule.ics`}
          aria-disabled="true"
          target={props.embed ? "_blank" : undefined}
          rel={props.embed ? "noopener" : undefined}
        >
          Download .ics
        </a>{" "}
        (<span id="chq-ics-count">0 picked</span>)
      </p>
      {byDay.size === 0 ? (
        <p>No sessions scheduled yet.</p>
      ) : (
        <>
          {props.items.length < props.total ? (
            <p>
              Showing the first {props.items.length} of {props.total} scheduled sessions.
            </p>
          ) : null}
          {/* DEC-602: EMB-09 -- /schedule is the LIST at every width, never
              the room-column grid AgendaDayGrid renders for /agenda. */}
          <label class="chq-pub-picks-toggle">
            <input type="checkbox" id="chq-picks-only" class="chq-pub-picks-only-input" />
            Show only my picks (<span id="chq-picks-only-count">0</span>)
          </label>
          <p id="chq-picks-empty" class="chq-pub-picks-empty" hidden>
            You have not picked any sessions yet. Check "Save" on a session below to add it.
          </p>
          <DaySwitcher
            days={days}
            renderedDays={renderedDays}
            event={props.event}
            surface="schedule"
            base={base}
            activeDay={props.activeDay}
            trackId={props.trackId}
            q={props.q}
            format={props.format}
          />
          {[...renderedDays].map((day) => (
            <div id={`chq-day-${day}`}>
              {/* DEC-768: AgendaItemList no longer renders its own heading
                  (only AgendaDay's grid+list pairing did that before) -- this
                  wrapper is the sole owner of the day heading here. */}
              <h2 class="chq-pub-section-title">{formatDay(day)}</h2>
              <AgendaItemList
                day={day}
                items={byDay.get(day) ?? []}
                event={props.event}
                from="schedule"
                itinerary
                showDescription
                showDay
                listClass="chq-pub-schedule-list"
                sectionClass="chq-pub-agenda-list-wrap chq-pub-schedule-day"
                base={base}
                groupByStart
              />
            </div>
          ))}
        </>
      )}
      <ItineraryScript eventSlug={props.event.slug} />
    </>
  );
}
