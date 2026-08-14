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
import { surfacePath, type Surface, type SurfaceBase } from "./shell";
import { formatDay } from "./cards";
import { AgendaDayGrid } from "./agenda-grid";
import { AgendaItemList } from "./agenda-list";
import { DaySwitcher, ItinerarySearchForm } from "./agenda-controls";
import { ItineraryScript } from "./agenda-itinerary-script";

export { AgendaDayGrid } from "./agenda-grid";
export { AgendaItemList } from "./agenda-list";
export { DaySwitcher, ItinerarySearchForm, agendaQs } from "./agenda-controls";
export { ItineraryScript } from "./agenda-itinerary-script";

/** DEC-584: renders BOTH the desktop grid and the phone list for one day
 * from the same `items` array, switched at the 700px breakpoint purely by
 * CSS `display:none` (public.css.ts) so exactly one is in the a11y tree at
 * a time. */
function AgendaDay(props: {
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
}) {
  // DEC-584 (wave 64 amendment): the heading names the day's own density
  // ("<Weekday D Month> · N sessions · M rooms") rather than the bare day
  // label — counts are derived from THIS day's items, through the one
  // shared plural() helper (src/domain/count-copy), never hand-pluralised.
  // Breaks are deliberately NOT counted: DEC-022's break is not a session.
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
  return (
    <>
      <h1 class="chq-pub-surface-title">Agenda</h1>
      <ItinerarySearchForm
        event={props.event}
        tracks={props.tracks ?? []}
        activeTrackId={props.highlightTrackId ?? null}
        activeDay={props.activeDay ?? null}
        q={props.q ?? null}
        basePath={basePath}
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
            trackId={props.highlightTrackId}
            q={props.q}
          />
          {[...renderedDays].map((day) => (
            <AgendaDay
              day={day}
              items={byDay.get(day) ?? []}
              event={props.event}
              from="agenda"
              base={base}
              breaks={props.breaksByDay?.get(day) ?? []}
              highlightTrackId={props.highlightTrackId ?? null}
            />
          ))}
        </>
      )}
    </>
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
  // the matching comment on AgendaContent above.
  highlightTrackId?: string | null;
  q?: string | null;
  breaksByDay?: Map<string, ScheduleBreak[]>;
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
        activeTrackId={props.highlightTrackId ?? null}
        activeDay={props.activeDay ?? null}
        q={props.q ?? null}
        basePath={basePath}
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
            trackId={props.highlightTrackId}
            q={props.q}
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
                breaks={props.breaksByDay?.get(day) ?? []}
              />
            </div>
          ))}
        </>
      )}
      <ItineraryScript eventSlug={props.event.slug} />
    </>
  );
}
