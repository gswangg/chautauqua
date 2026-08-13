// Agenda / schedule surfaces (time-grid rendering + itinerary picker).
// Split out of the former monolithic src/routes/public.tsx (contention
// decomposition) — no behavior change.

import type { PublicAgendaItem, PublicEvent } from "../../server/repo/public";
import { MAX_ITINERARY_IDS, itineraryStorageKey, mergeItinerarySelection, mirrorItineraryCheckboxes } from "../../lib/itinerary";
import { assignLanes } from "../../lib/overlap-lanes";
import { publicRoomLabel } from "../../domain/schedule";
import { sessionDetailPath, surfacePath, type Surface, type SurfaceBase } from "./shell";
import { TrackChips, FormatChip, SpeakerNames, SessionDescription, formatDay, formatMinutes } from "./cards";

// DEC-602: shared row-map math. The hour-label column (grid-column 1) and
// every session block are positioned from the SAME dayStart/gridMin
// arithmetic so a label's row and a block's row can never drift apart —
// compute it once here, not twice in two places that claim "the same
// formula".
function rowForMinute(min: number, dayStart: number, gridMin: number): number {
  return Math.floor((min - dayStart) / gridMin) + 2;
}

function formatHourLabel(min: number): string {
  const h = Math.floor(min / 60);
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const ampm = h < 12 ? "AM" : "PM";
  return `${hour12} ${ampm}`;
}

/** Per-day time grid (DEC-022): CSS grid, rooms as columns, session blocks
 * positioned by grid-row from start/end minutes. */
export function AgendaDayGrid(props: { day: string; items: PublicAgendaItem[]; event: PublicEvent; from: Surface; base?: SurfaceBase }) {
  const { day, items, event, from, base } = props;
  const gridMin = 15;
  const dayStart = Math.min(...items.map((i) => i.startMin));
  const dayEnd = Math.max(...items.map((i) => i.endMin));
  // DEC-602: whole-hour marks that fall within this day's grid, positioned
  // via the SAME rowForMinute math the blocks use below.
  const hourMarks: number[] = [];
  for (let h = Math.ceil(dayStart / 60) * 60; h <= dayEnd; h += 60) {
    hourMarks.push(h);
  }
  const roomNames = new Map(items.map((i) => [i.roomId ?? "tbd", publicRoomLabel(i.roomName)]));
  const roomPositions = new Map(items.map((i) => [i.roomId ?? "tbd", i.roomId ? i.roomPosition : null]));
  // DEC-563: a room column's position is a producer-owned fact (schema
  // `room.position`), not the accident of which item happened to appear
  // first in the query result. The TBD/null-room column (no roomId) has no
  // producer-owned position and always sorts last.
  const rooms = [...new Set(items.map((i) => i.roomId ?? "tbd"))].sort((a, b) => {
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
  });

  // DEC-140: overlapping sessions in the same room column must render
  // side-by-side (lanes) rather than stacked, or the top block eats the
  // pointer events meant for the block(s) underneath it (docs/eval-
  // findings.md P1). Lanes are computed per-room since only sessions in the
  // same room column can visually collide.
  const laneByItem = new Map<string, { lane: number; laneCount: number }>();
  for (const roomId of rooms) {
    const roomItems = items
      .filter((i) => (i.roomId ?? "tbd") === roomId)
      .map((i) => ({ id: i.submissionId, startMin: i.startMin, endMin: i.endMin }));
    for (const laned of assignLanes(roomItems)) {
      laneByItem.set(laned.item.id, { lane: laned.lane, laneCount: laned.laneCount });
    }
  }

  return (
    // DEC-768: the day heading is owned by AgendaDay (the caller wrapping
    // both this grid and AgendaItemList below) -- rendering it here too
    // duplicated it in the DOM (both copies always present, only one
    // display:none'd per breakpoint).
    <section aria-label={`Agenda for ${formatDay(day)}`}>
      <div class="chq-pub-agenda-day-scroll">
        <div
          class="chq-pub-agenda-day"
          style={`grid-template-columns: 70px repeat(${rooms.length}, minmax(140px, 1fr)); grid-template-rows: auto repeat(${Math.ceil(
            (dayEnd - dayStart) / gridMin,
          )}, minmax(22px, auto));`}
        >
          <div style="grid-column:1;grid-row:1"></div>
          {rooms.map((roomId, idx) => (
            <div style={`grid-column:${idx + 2};grid-row:1;font-weight:600;background:#fff;padding:0.2rem`}>
              {roomNames.get(roomId)}
            </div>
          ))}
          {hourMarks.map((h) => (
            <div class="chq-pub-agenda-hour-label" style={`grid-column:1;grid-row:${rowForMinute(h, dayStart, gridMin)}`}>
              {formatHourLabel(h)}
            </div>
          ))}
          {items.map((item) => {
            const roomId = item.roomId ?? "tbd";
            const col = rooms.indexOf(roomId) + 2;
            const rowStart = rowForMinute(item.startMin, dayStart, gridMin);
            const rowSpan = Math.max(1, Math.ceil((item.endMin - item.startMin) / gridMin));
            const { lane, laneCount } = laneByItem.get(item.submissionId) ?? { lane: 0, laneCount: 1 };
            const laneStyle =
              laneCount > 1
                ? `width:calc(${100 / laneCount}% - 4px);margin-left:calc(${(100 / laneCount) * lane}% + 2px);position:relative;z-index:1`
                : "";
            return (
              // DEC-602: a grid block never contains an interactive control
              // (no itinerary checkbox here — that lives only in the
              // /schedule list, which no longer renders this grid at all).
              <div
                class="chq-pub-agenda-block"
                style={`grid-column:${col};grid-row:${rowStart} / span ${rowSpan};${laneStyle}`}
                id={`chq-agenda-${item.submissionId}`}
              >
                <div>
                  {formatMinutes(item.startMin)}–{formatMinutes(item.endMin)}
                </div>
                <TrackChips tracks={item.tracks} />
                <FormatChip format={item.format} />
                <div class="chq-pub-agenda-block-title">
                  <strong>
                    <a href={sessionDetailPath(event, item.submissionId, from, base)}>{item.title}</a>
                  </strong>
                </div>
                <div class="chq-pub-agenda-block-speakers">
                  <SpeakerNames speakers={item.speakers} />
                </div>
              </div>
            );
          })}
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
}) {
  const { day, items, event, from, itinerary, showDescription, showDay, listClass, sectionClass, base } = props;
  const sorted = [...items].sort((a, b) => {
    if (a.startMin !== b.startMin) return a.startMin - b.startMin;
    const posA = a.roomId ? (a.roomPosition ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;
    const posB = b.roomId ? (b.roomPosition ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;
    if (posA !== posB) return posA - posB;
    return a.submissionId.localeCompare(b.submissionId);
  });
  return (
    // DEC-768: no h3 here either -- every caller of this list (AgendaDay,
    // ScheduleContent's per-day wrapper) owns its own single day heading.
    <section aria-label={`Agenda for ${formatDay(day)}`} class={sectionClass ?? "chq-pub-agenda-list-wrap"}>
      <ol class={listClass ?? "chq-pub-agenda-list"}>
        {sorted.map((item) => (
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
              <label class="chq-pub-itinerary-row">
                <input type="checkbox" class="chq-itinerary-toggle" value={item.submissionId} />
                Add to itinerary
              </label>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** DEC-584: renders BOTH the desktop grid and the phone list for one day
 * from the same `items` array, switched at the 700px breakpoint purely by
 * CSS `display:none` (public.css.ts) so exactly one is in the a11y tree at
 * a time. */
function AgendaDay(props: { day: string; items: PublicAgendaItem[]; event: PublicEvent; from: Surface; base?: SurfaceBase }) {
  return (
    <div id={`chq-day-${props.day}`}>
      {/* DEC-768: the ONE heading for this day, owned here -- neither
          AgendaDayGrid nor AgendaItemList renders its own anymore. */}
      <h3>{formatDay(props.day)}</h3>
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
}) {
  const { days, renderedDays, event, surface, base, activeDay } = props;
  if (days.length <= 1) return null;
  return (
    <nav aria-label="Jump to day" class="chq-pub-day-switcher">
      {days.map((day) => {
        const isActive = activeDay ? day === activeDay : false;
        const href = renderedDays.has(day) ? `#chq-day-${day}` : `${surfacePath(event, surface, base)}?day=${day}`;
        return (
          <a class="chq-pub-day-pill" href={href} aria-current={isActive ? "page" : undefined}>
            {formatDay(day)}
          </a>
        );
      })}
    </nav>
  );
}

export function AgendaContent(props: {
  event: PublicEvent;
  items: PublicAgendaItem[];
  total: number;
  embed?: boolean;
  allDays?: string[] | null;
  activeDay?: string | null;
}) {
  const byDay = groupByDay(props.items);
  const renderedDays = new Set(byDay.keys());
  const days = props.allDays ?? [...renderedDays];
  const base: SurfaceBase = props.embed ? "/embed" : "/e";
  return (
    <>
      <h2>Agenda</h2>
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
  items: PublicAgendaItem[];
  total: number;
  embed?: boolean;
  allDays?: string[] | null;
  activeDay?: string | null;
}) {
  const byDay = groupByDay(props.items);
  const renderedDays = new Set(byDay.keys());
  const days = props.allDays ?? [...renderedDays];
  const base: SurfaceBase = props.embed ? "/embed" : "/e";
  return (
    <>
      <h2>My schedule</h2>
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
            You have not picked any sessions yet. Check "Add to itinerary" on a session below to add it.
          </p>
          <DaySwitcher
            days={days}
            renderedDays={renderedDays}
            event={props.event}
            surface="schedule"
            base={base}
            activeDay={props.activeDay}
          />
          {[...renderedDays].map((day) => (
            <div id={`chq-day-${day}`}>
              {/* DEC-768: AgendaItemList no longer renders its own heading
                  (only AgendaDay's grid+list pairing did that before) -- this
                  wrapper is the sole owner of the day heading here. */}
              <h3>{formatDay(day)}</h3>
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
              />
            </div>
          ))}
        </>
      )}
      <ItineraryScript eventSlug={props.event.slug} />
    </>
  );
}
