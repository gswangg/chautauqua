// Public agenda rail (DEC-683 amendment, wave 67-d): the agenda surface's
// own designed rail, closing the two verified defects the sessions rail's
// comment (sessions.tsx, "until the agenda gains its own designed rail
// carrying the same link to the same route") and AgendaContent's missing
// ItineraryScript left open. Three sections in the shared
// .chq-pub-rail-section / .chq-pub-rail-heading / .chq-pub-rail-body
// vocabulary sessions.tsx's rail already established:
//   1. "Your schedule" -- the EXACT #chq-ics-count/#chq-ics-link ids
//      ItineraryScript drives, copied in shape from sessions.tsx's
//      ScheduleRailSection so the same inline script (now rendered by
//      AgendaContent too, see agenda.tsx) can update either surface's rail.
//   2. "Rooms in use today" -- per-room session counts for the rendered
//      day, each row an IN-PAGE ANCHOR at that room's first block
//      (`#chq-agenda-<submissionId>`, the id AgendaDayGrid already emits on
//      every block) -- never a `?roomId=` link, since DEC-851 deliberately
//      keeps room off this surface's facet set.
//   3. The printable programme out-link, relocated here from the sessions
//      rail's day index (sessions.tsx DEC-683 amendment wave 65 comment)
//      now that the agenda has somewhere of its own to carry it.
// Only ever rendered when `!embed` (DEC-672/683: the rail is chromeless-
// closed) -- see the call site in agenda.tsx's AgendaContent.

import type { PublicAgendaItem, PublicEvent } from "../../server/repo/public";
import { publicRoomLabel } from "../../domain/schedule";
import { countOf } from "../../domain/count-copy";

function ScheduleRailSection(props: { event: PublicEvent }) {
  const { event } = props;
  return (
    <section class="chq-pub-rail-section">
      <h2 class="chq-pub-rail-heading">Your schedule</h2>
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

interface RoomRailRow {
  roomKey: string;
  label: string;
  position: number | null;
  count: number;
  firstSubmissionId: string;
}

/** Groups the rendered day's items by room, counting sessions per room and
 * recording each room's first block (by start minute, then submission id)
 * so the rail row can anchor at the same block AgendaDayGrid renders that
 * id on. Room order matches the desktop grid's own room tiebreak (DEC-563
 * producer-owned position asc, name asc, id asc, unroomed always last) so
 * the rail and the grid can never disagree about room order. */
function roomsInUse(items: PublicAgendaItem[]): RoomRailRow[] {
  const sorted = [...items].sort(
    (a, b) => a.startMin - b.startMin || a.submissionId.localeCompare(b.submissionId),
  );
  const byRoom = new Map<string, RoomRailRow>();
  for (const item of sorted) {
    const key = item.roomId ?? "tbd";
    const existing = byRoom.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      byRoom.set(key, {
        roomKey: key,
        label: publicRoomLabel(item.roomName),
        position: item.roomId ? item.roomPosition : null,
        count: 1,
        firstSubmissionId: item.submissionId,
      });
    }
  }
  return [...byRoom.values()].sort((a, b) => {
    if (a.roomKey === "tbd" && b.roomKey === "tbd") return 0;
    if (a.roomKey === "tbd") return 1;
    if (b.roomKey === "tbd") return -1;
    if (a.position !== b.position) {
      if (a.position === null) return 1;
      if (b.position === null) return -1;
      return a.position - b.position;
    }
    const nameCmp = a.label.localeCompare(b.label);
    if (nameCmp !== 0) return nameCmp;
    return a.roomKey.localeCompare(b.roomKey);
  });
}

function RoomsRailSection(props: { items: PublicAgendaItem[] }) {
  const rows = roomsInUse(props.items);
  if (rows.length === 0) return null;
  return (
    <section class="chq-pub-rail-section">
      <h2 class="chq-pub-rail-heading">Rooms in use today</h2>
      <div class="chq-pub-rail-body">
        {rows.map((r) => (
          <div class="chq-pub-rail-day-row">
            <a href={`#chq-agenda-${r.firstSubmissionId}`}>{r.label}</a>
            <span class="chq-pub-rail-day-count">{countOf(r.count, "session")}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function AgendaRail(props: { event: PublicEvent; items: PublicAgendaItem[]; activeDay: string | null }) {
  const { event, items } = props;
  return (
    <aside class="chq-pub-agenda-rail">
      <ScheduleRailSection event={event} />
      <RoomsRailSection items={items} />
      {/* DEC-683 amendment (wave 67): the printable programme's one
          discoverability link, moved here off the sessions rail now that
          the agenda has its own designed rail to carry it. */}
      <a class="chq-pub-rail-programme-link" href={`/e/${event.slug}/programme`}>
        Printable programme ›
      </a>
    </aside>
  );
}

/** DEC-555 amendment (wave 1, task w1-d): /schedule's own rail -- "Take it
 * with you" (saved count + Download .ics, the EXACT #chq-ics-count/
 * #chq-ics-link ids ItineraryScript already drives) and an overlaps block
 * naming each clash. Both bodies start at the honest zero state and are
 * filled in by ItineraryScript's applyScheduleView() (agenda-itinerary-
 * script.tsx) once localStorage is read -- the server never knows which
 * sessions are saved (DEC-555: picks live client-side only). The overlaps
 * section starts `hidden` (no clashes known yet) so a no-JS visitor never
 * sees an empty "0 overlaps" block flash before script runs. */
export function ScheduleRail(props: { event: PublicEvent; embed?: boolean }) {
  const { event, embed } = props;
  return (
    <aside class="chq-pub-agenda-rail">
      <section class="chq-pub-rail-section">
        <h2 class="chq-pub-rail-heading">Take it with you</h2>
        <div class="chq-pub-rail-body">
          <span class="chq-pub-rail-caption">
            <span id="chq-ics-count">0 picked</span> saved in this browser · no account needed
          </span>
          {/* DEC-672: the .ics download always targets the real /e/... route
              (never /embed/...ics, which doesn't exist) -- inside /embed
              this is the one permitted same-origin exception (DEC-672's own
              test), so it opens in a new tab instead of breaking the iframe
              out from under the visitor. */}
          <a
            id="chq-ics-link"
            class="chq-pub-itinerary-cta"
            href={`/e/${event.slug}/schedule.ics`}
            aria-disabled="true"
            target={embed ? "_blank" : undefined}
            rel={embed ? "noopener" : undefined}
          >
            Download .ics
          </a>
          <span class="chq-pub-rail-caption">Clearing your browser data clears this list</span>
        </div>
      </section>
      <section class="chq-pub-rail-section" id="chq-schedule-overlaps-section" hidden>
        <h2 class="chq-pub-rail-heading" id="chq-schedule-overlaps-heading">
          0 overlaps
        </h2>
        <div class="chq-pub-rail-body" id="chq-schedule-overlaps-body" />
      </section>
    </aside>
  );
}
