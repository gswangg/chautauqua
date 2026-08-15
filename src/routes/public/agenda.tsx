// Agenda / schedule surfaces (time-grid rendering + itinerary picker).
// Split out of the former monolithic src/routes/public.tsx (contention
// decomposition). Wave 66: further decomposed into agenda-grid.tsx
// (desktop time-row grid), agenda-list.tsx (phone/schedule list),
// agenda-controls.tsx (day switcher + search/highlight form) and
// agenda-itinerary-script.tsx (inline picker JS) — this file is now the
// orchestration layer (AgendaContent/ScheduleContent) plus a barrel
// re-export of the public surface (AgendaDayGrid, ItineraryScript) so every
// existing import path keeps working. No behavior change.

import type { PublicAgendaItem, PublicEvent, PublicTrack } from "../../server/repo/public";
import type { ScheduleBreak } from "../../server/repo/breaks"; // type-only; the public barrel re-exports the read path (getPublicBreaksByDay)
import { plural } from "../../domain/count-copy";
import { surfacePath, sessionDetailPath, type Surface, type SurfaceBase } from "./shell";
import { formatDay, formatStartTime24, SpeakerNames } from "./cards";
import { formatDayLong } from "../../lib/event-time";
import { publicRoomLabel } from "../../domain/schedule";
import { AgendaDayGrid } from "./agenda-grid";
import { AgendaItemList } from "./agenda-list";
import { DEC_768 } from "../../decisions";

void DEC_768;
// agendaQs is also re-exported below (barrel); this import is the local
// binding the agenda day-footer's "next day" out-link composes with.
import { DaySwitcher, ItinerarySearchForm, agendaQs } from "./agenda-controls";
import { ItineraryScript } from "./agenda-itinerary-script";
import { AgendaRail, ScheduleRail, realRoomsInUse } from "./agenda-rail";

export { AgendaDayGrid } from "./agenda-grid";
export { AgendaItemList } from "./agenda-list";
export { DaySwitcher, ItinerarySearchForm, agendaQs } from "./agenda-controls";
export { ItineraryScript } from "./agenda-itinerary-script";

/** DEC-584: renders BOTH the desktop grid and the phone list for one day
 * from the same `items` array, switched at the 700px breakpoint purely by
 * CSS `display:none` (public.css.ts) so exactly one is in the a11y tree at
 * a time. */
export function AgendaDay(props: {
  day: string;
  items: PublicAgendaItem[];
  event: PublicEvent;
  from: Surface;
  base?: SurfaceBase;
  breaks?: ScheduleBreak[];
  // DEC-851 (wave 64 amendment): plumbing only -- threaded through so the
  // grid's own block markup (owned separately) has the value it needs to
  // apply the highlight/muted class per block. Not consumed here.
  highlightTrackId?: string | null;
  // DEC-768 (wave 67 amendment): the single-day-default /agenda page now
  // names the day exactly once, on the page's own <h1> heading row (see
  // AgendaContent) -- this per-day heading is only still needed on a
  // multi-day render (e.g. an out-of-scope future caller), so AgendaContent
  // passes hideHeading=true whenever it renders exactly one day.
  hideHeading?: boolean;
  // DEC-584 amendment (wave 69): threaded through to BOTH AgendaDayGrid and
  // AgendaItemList -- the same condition (!embed) gates the desktop grid's
  // toggle, the phone list's toggle, the rail and ItineraryScript, so the
  // Save control renders in exactly the surfaces where its script does.
  itinerary?: boolean;
}) {
  // DEC-584 (wave 64 amendment): the heading names the day's own density
  // ("<Weekday D Month> · N sessions · M rooms") rather than the bare day
  // label — counts are derived from THIS day's items, through the one
  // shared plural() helper (src/domain/count-copy), never hand-pluralised.
  // Breaks are deliberately NOT counted: DEC-022's break is not a session.
  // DEC-851 amendment (wave 45), ONE READER: room count goes through
  // realRoomsInUse() (agenda-rail.tsx), the same reader AgendaContent's <h1>
  // and the rail's own room list use -- never a re-derivation, and never
  // counting the "tbd" (unroomed) bucket as a room.
  const roomCount = realRoomsInUse(props.items).length;
  return (
    <div id={`chq-day-${props.day}`}>
      {/* DEC-768: the ONE heading for this day, owned here -- neither
          AgendaDayGrid nor AgendaItemList renders its own anymore. Suppressed
          (wave 67 amendment) when AgendaContent already named the day once on
          the page's own <h1>. */}
      {props.hideHeading ? null : (
        <h3>
          {formatDay(props.day)} · {props.items.length} {plural(props.items.length, "session")} · {roomCount} {plural(roomCount, "room")}
        </h3>
      )}
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

export function AgendaContent(props: {
  event: PublicEvent;
  tracks?: PublicTrack[];
  items: PublicAgendaItem[];
  total: number;
  embed?: boolean;
  allDays?: string[] | null;
  activeDay?: string | null;
  // DEC-851 (wave 64 amendment): renamed from `trackId` -- this is a
  // render-level highlight now, never a filter predicate. Threaded through
  // to AgendaDay/AgendaDayGrid so the block-level highlight/muted styling
  // (olive edge, inverted chip, muted card) has the value it needs; the
  // class application itself lives in AgendaDayGrid's own block markup.
  highlightTrackId?: string | null;
  q?: string | null;
  // DEC-022 amendment (wave 63): breaks, keyed by the same 'YYYY-MM-DD' day
  // string groupByDay() below groups `items` on.
  breaksByDay?: Map<string, ScheduleBreak[]>;
}) {
  const byDay = groupByDay(props.items);
  const renderedDays = new Set(byDay.keys());
  const days = props.allDays ?? [...renderedDays];
  const base: SurfaceBase = props.embed ? "/embed" : "/e";
  const basePath = surfacePath(props.event, "agenda", base);
  // DEC-768 (wave 67 amendment): /agenda renders ONE day at a time -- the
  // dispatch layer already scoped `items`/`total` to `activeDay` (the
  // requested ?day= or, absent that, the first day with scheduled sessions),
  // so `renderedDays` here is 0 or 1 entries, never the whole event stacked.
  const activeDay = props.activeDay ?? null;
  const activeDayItems = activeDay ? (byDay.get(activeDay) ?? []) : [];
  // DEC-851 amendment (wave 45), ONE READER: M is the count of real
  // (non-"tbd") rooms in use on the active day, counted through
  // realRoomsInUse() (agenda-rail.tsx) -- the SAME reader AgendaDay's own
  // <h3> and the rail's room list use, so no two surfaces can ever disagree
  // about how many rooms are in play, or whether the unroomed bucket counts
  // as one.
  const roomCount = realRoomsInUse(activeDayItems).length;
  // The per-day <h3> AgendaDay renders is redundant once the page names the
  // day exactly once on this heading row -- suppressed whenever exactly one
  // day is rendered (always true on the current single-day-default surface)
  // AND the <h1> above actually names it. Without an activeDay the <h1>
  // falls back to the bare "Agenda" label, so the per-day heading is the
  // ONLY thing naming the day and must stay: DEC-768's amendment says the
  // day appears exactly once, which is a floor as much as a ceiling.
  const hideDayHeading = renderedDays.size <= 1 && activeDay !== null;
  const activeDayIndex = activeDay ? days.indexOf(activeDay) : -1;
  const nextDay = activeDayIndex >= 0 && activeDayIndex < days.length - 1 ? days[activeDayIndex + 1] : null;
  const lastEndMin = activeDayItems.length > 0 ? Math.max(...activeDayItems.map((i) => i.endMin)) : null;
  const switcherCurrent = { trackId: props.highlightTrackId ?? null, q: props.q ?? null };
  // DEC-885/DEC-683 (wave 67 amendment): the rail's "Rooms in use today"
  // section reads the SAME "day in view" rule DaySwitcher already applies
  // to aria-current -- the ?day= filter when present, else the first
  // rendered day top-to-bottom -- so the rail's room list never disagrees
  // with which day's blocks are actually on screen.
  const effectiveActiveDay = activeDay ?? days[0] ?? null;
  const railItems = effectiveActiveDay ? (byDay.get(effectiveActiveDay) ?? []) : [];
  return (
    <>
      <div class="chq-pub-title-row chq-pub-agenda-heading-row">
        <h1 class="chq-pub-surface-title">
          {activeDay
            ? `${formatDayLong(activeDay)} · ${activeDayItems.length} ${plural(activeDayItems.length, "session")} · ${roomCount} ${plural(roomCount, "room")}`
            : "Agenda"}
        </h1>
        <DaySwitcher
          days={days}
          renderedDays={renderedDays}
          event={props.event}
          surface="agenda"
          base={base}
          activeDay={props.activeDay}
          trackId={props.highlightTrackId}
          q={props.q}
        />
      </div>
      <div class="chq-pub-agenda-layout">
        {/* NOT .chq-pub-agenda-list -- that class is already owned by
            AgendaItemList's phone <ol> (display:none above 700px), so
            reusing it here would hide the entire agenda on desktop. */}
        <div class="chq-pub-agenda-col">
          <ItinerarySearchForm
            event={props.event}
            tracks={props.tracks ?? []}
            activeTrackId={props.highlightTrackId ?? null}
            activeDay={props.activeDay ?? null}
            q={props.q ?? null}
            basePath={basePath}
          />
          {byDay.size === 0 ? (
            // DEC-768: an honest empty state distinguishes "this day has no
            // matches for your search" (activeDay is set, the event DOES have
            // a schedule) from "nothing is scheduled at all" (no activeDay
            // exists because getPublicScheduleDayCounts came back empty) --
            // never claim the event has no schedule just because a search
            // narrowed one day to zero rows.
            <p>{activeDay ? `No sessions match your search on ${formatDay(activeDay)}.` : "No sessions scheduled yet."}</p>
          ) : (
            <>
              {props.items.length < props.total ? (
                <p>
                  Showing the first {props.items.length} of {props.total} scheduled sessions.
                </p>
              ) : null}
              {[...renderedDays].map((day) => (
                <AgendaDay
                  day={day}
                  items={byDay.get(day) ?? []}
                  event={props.event}
                  from="agenda"
                  base={base}
                  breaks={props.breaksByDay?.get(day) ?? []}
                  highlightTrackId={props.highlightTrackId ?? null}
                  hideHeading={hideDayHeading}
                  itinerary={!props.embed}
                />
              ))}
              {nextDay && lastEndMin !== null ? (
                <p class="chq-pub-agenda-day-footer">
                  Last session ends {formatStartTime24(lastEndMin)} ·{" "}
                  <a href={`${basePath}${agendaQs(switcherCurrent, { day: nextDay })}`}>{formatDay(nextDay)} ›</a>
                </p>
              ) : null}
            </>
          )}
        </div>
        {/* DEC-672/DEC-683 (wave 67 amendment): the rail is chromeless-
            closed -- /embed renders none of it (no <aside>, no /submit or
            /e/ hrefs, no ItineraryScript). */}
        {!props.embed ? (
          <AgendaRail
            event={props.event}
            items={railItems}
            activeDay={effectiveActiveDay}
            highlightTrackId={props.highlightTrackId ?? null}
            tracks={props.tracks ?? []}
          />
        ) : null}
      </div>
      {!props.embed ? <ItineraryScript eventSlug={props.event.slug} /> : null}
    </>
  );
}

// DEC-555 amendment (wave 1, task w1-d): frame 10--12 (new in pack v7,
// never previously built) -- the 1180 pair, main column lists the SAVED
// sessions (Remove, never Save -- every OTHER session-row control on the
// public surfaces reads Save/Saved, but /schedule's own rows never show an
// unsaved session at all, so there is nothing for a two-state label to
// name), "N saved · M overlaps" subtitle, "Browse all sessions ›", a
// two-line time/room gutter matching the sessions row (cards.tsx's
// .chq-pub-session-when shape), and the rail carries TAKE IT WITH YOU +
// an overlaps block (ScheduleRail, agenda-rail.tsx). DROPPED per the frame:
// the duplicate day-pill row (DaySwitcher), the "Show only my picks"
// checkbox (this view already shows only picks) and the highlight control
// (ItinerarySearchForm) -- none of the three appear in the mock.
//
// LOAD-BEARING (DEC-555): picks live in localStorage, so the server renders
// EVERY candidate row (exactly like before) -- ItineraryScript's
// applyScheduleView() is what hides the unsaved rows, fills the per-row
// clash marker and the subtitle/rail counts once it reads the stored ids. A
// day-filtered or row-capped render still never deletes a pick (the merge
// rule is untouched).
function ScheduleRow(props: { event: PublicEvent; item: PublicAgendaItem; day: string; base: SurfaceBase }) {
  const { event, item, day, base } = props;
  return (
    <div
      class="chq-pub-schedule-row"
      data-submission-id={item.submissionId}
      data-day={day}
      data-start-min={item.startMin}
      data-end-min={item.endMin}
      style="display:none"
    >
      <div class="chq-pub-schedule-row-gutter">
        <span class="chq-pub-schedule-row-time">
          {formatStartTime24(item.startMin)}–{formatStartTime24(item.endMin)}
        </span>
        <span class="chq-pub-schedule-row-room">{publicRoomLabel(item.roomName)}</span>
      </div>
      <div class="chq-pub-schedule-row-body">
        <a class="chq-pub-schedule-row-title" href={sessionDetailPath(event, item.submissionId, "schedule", base)}>
          {item.title}
        </a>
        <span class="chq-pub-schedule-row-speakers">
          <SpeakerNames speakers={item.speakers} />
        </span>
        <span class="chq-pub-schedule-row-clash" hidden />
      </div>
      <label class="chq-pub-schedule-remove">
        <input type="checkbox" class="chq-itinerary-toggle" value={item.submissionId} />
        <span>Remove</span>
      </label>
    </div>
  );
}

export function ScheduleContent(props: {
  event: PublicEvent;
  tracks?: PublicTrack[];
  items: PublicAgendaItem[];
  total: number;
  embed?: boolean;
  allDays?: string[] | null;
  activeDay?: string | null;
  // DEC-851 (wave 64 amendment): render-level highlight, not a filter -- see
  // the matching comment on AgendaContent above. Unused by this frame (the
  // highlight control was dropped -- kept on the prop shape so
  // dispatch.tsx's existing call site needs no change).
  highlightTrackId?: string | null;
  q?: string | null;
  breaksByDay?: Map<string, ScheduleBreak[]>;
}) {
  const byDay = groupByDay(props.items);
  const days = [...byDay.keys()].sort();
  const base: SurfaceBase = props.embed ? "/embed" : "/e";
  const sessionsPath = surfacePath(props.event, "sessions", base);
  return (
    <>
      <div class="chq-pub-schedule-layout">
        <div class="chq-pub-schedule-col">
          <div class="chq-pub-schedule-header">
            <div>
              <h1 class="chq-pub-surface-title">My schedule</h1>
              <span id="chq-schedule-subtitle" class="chq-pub-schedule-subtitle">
                0 saved · 0 overlaps
              </span>
            </div>
            {/* DEC-838: an out-link off this surface gets the shared accent-
                bound class, same as the "Show more"/"Back to" links. */}
            <a class="chq-pub-schedule-browse-link chq-pub-accent-link" href={sessionsPath}>
              Browse all sessions ›
            </a>
          </div>
          {byDay.size === 0 ? (
            <p>No sessions scheduled yet.</p>
          ) : (
            <>
              {props.items.length < props.total ? (
                <p>
                  Showing the first {props.items.length} of {props.total} scheduled sessions.
                </p>
              ) : null}
              <p id="chq-schedule-empty" class="chq-pub-picks-empty" hidden>
                You have not saved any sessions yet. Check "Save" on a session to add it here.
              </p>
              {days.map((day) => {
                const sorted = [...(byDay.get(day) ?? [])].sort(
                  (a, b) => a.startMin - b.startMin || a.submissionId.localeCompare(b.submissionId),
                );
                return (
                  <div class="chq-pub-schedule-day-group" data-day={day} style="display:none">
                    <div class="chq-pub-schedule-day-heading">
                      <h2 class="chq-pub-section-title">{formatDay(day)}</h2>
                      <span class="chq-pub-schedule-day-count">0</span>
                    </div>
                    {sorted.map((item) => (
                      <ScheduleRow event={props.event} item={item} day={day} base={base} />
                    ))}
                  </div>
                );
              })}
            </>
          )}
        </div>
        <ScheduleRail event={props.event} embed={props.embed} />
      </div>
      <ItineraryScript eventSlug={props.event.slug} />
    </>
  );
}
