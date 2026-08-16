// Phone/schedule vertical list rendering for the public agenda surface.
// Split out of the former monolithic src/routes/public/agenda.tsx
// (contention decomposition, wave 66) — no behavior change.

import type { PublicAgendaItem, PublicEvent } from "../../server/repo/public";
import type { ScheduleBreak } from "../../server/repo/breaks"; // type-only; the public barrel re-exports the read path (getPublicBreaksByDay)
import { publicRoomLabel } from "../../domain/schedule";
import { sessionDetailPath, type Surface, type SurfaceBase } from "./shell";
import { TrackChips, FormatChip, SpeakerNames, SessionDescription, ItineraryToggle, formatDay } from "./cards";
import { clockHMM } from "../../domain/clock";
import { formatBreakLabel } from "./agenda-grid";
import { DEC_768 } from "../../decisions";

void DEC_768;

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
export function AgendaItemList(props: {
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
  // DEC-022 amendment (wave 63): breaks for this same day, interleaved into
  // the sorted list by startMin below.
  breaks?: ScheduleBreak[];
  // DEC-151 (wave-59 amendment): the surface's active narrowing, already
  // encoded via embedKnobQuery by the caller (AgendaContent) -- carried onto
  // every drill-in link so the detail page's Back link can restore it.
  carry?: string;
}) {
  const {
    day,
    items,
    event,
    from,
    itinerary,
    showDescription,
    showDay,
    listClass,
    sectionClass,
    base,
    groupByStart,
    breaks = [],
    carry,
  } = props;
  const sorted = [...items].sort((a, b) => {
    if (a.startMin !== b.startMin) return a.startMin - b.startMin;
    const posA = a.roomId ? (a.roomPosition ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;
    const posB = b.roomId ? (b.roomPosition ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;
    if (posA !== posB) return posA - posB;
    return a.submissionId.localeCompare(b.submissionId);
  });
  // Interleave breaks into the same time-ordered list, tagged so the
  // renderer below can tell a break row from a session row -- a break never
  // shares .chq-pub-agenda-list-item's markup (no title link, no speakers,
  // no itinerary toggle: DEC-022's hard boundary).
  type Row = { kind: "item"; item: PublicAgendaItem } | { kind: "break"; brk: ScheduleBreak };
  const rows: Row[] = [
    ...sorted.map((item): Row => ({ kind: "item", item })),
    ...breaks.map((brk): Row => ({ kind: "break", brk })),
  ].sort((a, b) => {
    const startA = a.kind === "item" ? a.item.startMin : a.brk.startMin;
    const startB = b.kind === "item" ? b.item.startMin : b.brk.startMin;
    if (startA !== startB) return startA - startB;
    // A break at the same start time as a session sorts first -- it reads
    // as the thing that clears before the session begins.
    return a.kind === b.kind ? 0 : a.kind === "break" ? -1 : 1;
  });
  let lastStart: number | null = null;
  return (
    // DEC-768: no h3 here either -- every caller of this list (AgendaDay,
    // ScheduleContent's per-day wrapper) owns its own single day heading.
    <section aria-label={`Agenda for ${formatDay(day)}`} class={sectionClass ?? "chq-pub-agenda-list-wrap"}>
      <ol class={listClass ?? "chq-pub-agenda-list"}>
        {rows.map((row) => {
          if (row.kind === "break") {
            const b = row.brk;
            return (
              <li class="chq-pub-agenda-break" aria-label={`Break: ${formatBreakLabel(b)}`}>
                {showDay ? `${formatDay(day)} · ` : ""}
                {clockHMM(b.startMin)} · {formatBreakLabel(b)}
              </li>
            );
          }
          const item = row.item;
          const isNewGroup = groupByStart && item.startMin !== lastStart;
          if (isNewGroup) lastStart = item.startMin;
          return (
            <>
              {isNewGroup ? (
                <li class="chq-pub-schedule-time-subhead" aria-hidden="true">
                  {clockHMM(item.startMin)}
                </li>
              ) : null}
              <li class="chq-pub-agenda-list-item" id={`chq-agenda-list-${item.submissionId}`} data-submission-id={item.submissionId}>
            <div class="chq-pub-agenda-list-time">
              {showDay ? `${formatDay(day)} · ` : ""}
              {clockHMM(item.startMin)}–{clockHMM(item.endMin)}
            </div>
            <div>
              <strong>
                <a class="chq-pub-agenda-list-title" href={sessionDetailPath(event, item.submissionId, from, base, carry)}>
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
