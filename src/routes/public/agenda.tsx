// Agenda / schedule surfaces (time-grid rendering + itinerary picker).
// Split out of the former monolithic src/routes/public.tsx (contention
// decomposition) — no behavior change.

import type { PublicAgendaItem, PublicEvent } from "../../server/repo/public";
import { itineraryStorageKey } from "../../lib/itinerary";
import { assignLanes } from "../../lib/overlap-lanes";
import { sessionDetailPath, type Surface } from "./shell";
import { TrackChips, SpeakerNames, formatDay, formatMinutes } from "./cards";

/** Per-day time grid (DEC-022): CSS grid, rooms as columns, session blocks
 * positioned by grid-row from start/end minutes. */
export function AgendaDayGrid(props: { day: string; items: PublicAgendaItem[]; event: PublicEvent; from: Surface; itinerary?: boolean }) {
  const { day, items, event, from, itinerary } = props;
  const gridMin = 15;
  const dayStart = Math.min(...items.map((i) => i.startMin));
  const dayEnd = Math.max(...items.map((i) => i.endMin));
  const rooms = [...new Set(items.map((i) => i.roomId ?? "tbd"))];
  const roomNames = new Map(items.map((i) => [i.roomId ?? "tbd", i.roomName ?? "TBD"]));

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
    <section aria-label={`Agenda for ${day}`}>
      <h3>{day}</h3>
      <div class="chq-pub-agenda-day-scroll">
        <div
          class="chq-pub-agenda-day"
          style={`grid-template-columns: 70px repeat(${rooms.length}, minmax(140px, 1fr)); grid-template-rows: auto repeat(${Math.ceil(
            (dayEnd - dayStart) / gridMin,
          )}, 22px);`}
        >
          <div style="grid-column:1;grid-row:1"></div>
          {rooms.map((roomId, idx) => (
            <div style={`grid-column:${idx + 2};grid-row:1;font-weight:600;background:#fff;padding:0.2rem`}>
              {roomNames.get(roomId)}
            </div>
          ))}
          {items.map((item) => {
            const roomId = item.roomId ?? "tbd";
            const col = rooms.indexOf(roomId) + 2;
            const rowStart = Math.floor((item.startMin - dayStart) / gridMin) + 2;
            const rowSpan = Math.max(1, Math.ceil((item.endMin - item.startMin) / gridMin));
            const { lane, laneCount } = laneByItem.get(item.submissionId) ?? { lane: 0, laneCount: 1 };
            const laneStyle =
              laneCount > 1
                ? `width:calc(${100 / laneCount}% - 4px);margin-left:calc(${(100 / laneCount) * lane}% + 2px);position:relative;z-index:1`
                : "";
            return (
              <div
                class="chq-pub-agenda-block"
                style={`grid-column:${col};grid-row:${rowStart} / span ${rowSpan};${laneStyle}`}
                id={`chq-agenda-${item.submissionId}`}
              >
                <div>
                  {formatMinutes(item.startMin)}–{formatMinutes(item.endMin)}
                </div>
                <TrackChips tracks={item.tracks} />
                <div>
                  <strong>
                    <a href={sessionDetailPath(event, item.submissionId, from)}>{item.title}</a>
                  </strong>
                </div>
                <div>
                  <SpeakerNames speakers={item.speakers} />
                </div>
                {itinerary ? (
                  <label class="chq-pub-itinerary-row">
                    <input type="checkbox" class="chq-itinerary-toggle" value={item.submissionId} />
                    Add to itinerary
                  </label>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
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

/** EMB-07: day switcher — anchor links, one per event day, jumping to that
 * day's section. Deliberately just the nav wrapper around AgendaDayGrid;
 * AgendaDayGrid's internals (time grid, room columns) are untouched here. */
function DaySwitcher(props: { days: string[] }) {
  if (props.days.length <= 1) return null;
  return (
    <nav aria-label="Jump to day" class="chq-pub-day-switcher">
      {props.days.map((day) => (
        <a class="chq-pub-day-pill" href={`#chq-day-${day}`}>
          {formatDay(day)}
        </a>
      ))}
    </nav>
  );
}

export function AgendaContent(props: { event: PublicEvent; items: PublicAgendaItem[] }) {
  const byDay = groupByDay(props.items);
  const days = [...byDay.keys()];
  return (
    <>
      <h2>Agenda</h2>
      {byDay.size === 0 ? (
        <p>No sessions scheduled yet.</p>
      ) : (
        <>
          <DaySwitcher days={days} />
          {days.map((day) => (
            <div id={`chq-day-${day}`}>
              <AgendaDayGrid day={day} items={byDay.get(day) ?? []} event={props.event} from="agenda" />
            </div>
          ))}
        </>
      )}
    </>
  );
}

/** Itinerary picker inline vanilla JS (DEC-022): reads/writes
 * localStorage chq_itinerary_<slug>, keeps the .ics download link's ?ids=
 * query in sync with the checked set. */
function ItineraryScript(props: { eventSlug: string }) {
  const storageKey = itineraryStorageKey(props.eventSlug);
  const js = `(function(){
  var key = ${JSON.stringify(storageKey)};
  var slug = ${JSON.stringify(props.eventSlug)};
  var stored = [];
  try { stored = JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { stored = []; }
  var boxes = document.querySelectorAll('.chq-itinerary-toggle');
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
  Array.prototype.forEach.call(boxes, function(b){ b.checked = stored.indexOf(b.value) !== -1; });
  updateLink(stored);
  document.addEventListener('change', function(e){
    if (!e.target || !e.target.classList || !e.target.classList.contains('chq-itinerary-toggle')) return;
    var ids = currentIds();
    localStorage.setItem(key, JSON.stringify(ids));
    updateLink(ids);
  });
})();`;
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}

export function ScheduleContent(props: { event: PublicEvent; items: PublicAgendaItem[] }) {
  const byDay = groupByDay(props.items);
  const days = [...byDay.keys()];
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
        >
          Download .ics
        </a>{" "}
        (<span id="chq-ics-count">0 picked</span>)
      </p>
      {byDay.size === 0 ? (
        <p>No sessions scheduled yet.</p>
      ) : (
        <>
          <DaySwitcher days={days} />
          {days.map((day) => (
            <div id={`chq-day-${day}`}>
              <AgendaDayGrid
                day={day}
                items={byDay.get(day) ?? []}
                event={props.event}
                from="schedule"
                itinerary
              />
            </div>
          ))}
        </>
      )}
      <ItineraryScript eventSlug={props.event.slug} />
    </>
  );
}
