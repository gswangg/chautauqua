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

import type { PublicAgendaItem, PublicEvent, PublicTrack } from "../../server/repo/public";
import { publicRoomLabel } from "../../domain/schedule";
import { countOf } from "../../domain/count-copy";
import { clockHMM } from "../../domain/clock";
import { DEC_768 } from "../../decisions";

void DEC_768;

function ScheduleRailSection(props: { event: PublicEvent }) {
  const { event } = props;
  return (
    <section class="chq-pub-rail-section">
      <h2 class="chq-pub-rail-heading">Your schedule</h2>
      <div class="chq-pub-rail-body">
        {/* G13 (frames 10--00/01/12, MAJOR): the scripted span carries the
            COUNT ALONE -- "4 saved in this browser · no account needed" --
            never "4 picked" butted against " saved ...", the run-on the
            audit measured. ItineraryScript writes only the numeral. */}
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
 * the rail and the grid can never disagree about room order.
 *
 * DEC-851 amendment (wave 5): exported so every caller groups blocks by room
 * through this SAME grouping (keyed on roomId, an unassigned block folded
 * into one "tbd" bucket) instead of each computing its own definition. This
 * grouping is a superset of "rooms" -- it also carries the unroomed bucket
 * as a row, load-bearing for the grid's own tiebreak/ordering contract, so
 * this function stays unchanged. DEC-851 amendment (wave 45): the "tbd"
 * bucket is NOT a room -- callers that count or list rooms (never sessions)
 * must go through `realRoomsInUse()` below, the one reader that filters it
 * out, rather than re-deriving their own `roomKey !== "tbd"` filter. */
export function roomsInUse(items: PublicAgendaItem[]): RoomRailRow[] {
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

/** DEC-851 amendment (wave 45), ONE READER for "how many rooms are in play on
 * this day": `roomsInUse()` groups by roomId, folding every unassigned block
 * into a "tbd" bucket -- that bucket is a real ROW (it anchors to the first
 * unroomed block, DEC-851's own contract) but it is never a ROOM, so any
 * caller counting or listing rooms (never sessions) must filter it out here,
 * in this one place, rather than each caller re-deriving its own
 * `roomKey !== "tbd"` filter. */
export function realRoomsInUse(items: PublicAgendaItem[]): RoomRailRow[] {
  return roomsInUse(items).filter((r) => r.roomKey !== "tbd");
}

function RoomsRailSection(props: { items: PublicAgendaItem[] }) {
  const rows = realRoomsInUse(props.items);
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
        <span class="chq-pub-rail-caption">Jumps to that room's first session</span>
      </div>
    </section>
  );
}

/** DEC-851 amendment (wave 5): while a highlight is set, the rail's FIRST
 * block swaps from "Rooms in use today" to this section -- the room list is
 * no longer the most useful thing to lead with once an attendee has told the
 * page which track they are following. Rows are the matching day's blocks
 * in start-time order (room + time, the same anchor id AgendaDayGrid already
 * emits per block), never a re-derivation of the grid's own match rule
 * (AgendaDayGrid computes `matches` itself; this mirrors that exact
 * predicate -- `item.tracks.some((t) => t.id === trackId)` -- so the two
 * can never disagree about which blocks are "in" the highlight). */
function TrackHighlightRailSection(props: { items: PublicAgendaItem[]; trackId: string; trackName: string }) {
  const { items, trackId, trackName } = props;
  const matches = items
    .filter((item) => item.tracks.some((t) => t.id === trackId))
    .sort((a, b) => a.startMin - b.startMin || a.submissionId.localeCompare(b.submissionId));
  return (
    <section class="chq-pub-rail-section">
      <h2 class="chq-pub-rail-heading">
        {matches.length} in {trackName}
      </h2>
      <div class="chq-pub-rail-body">
        {matches.map((item) => (
          <div class="chq-pub-rail-day-row">
            <a href={`#chq-agenda-${item.submissionId}`}>
              {publicRoomLabel(item.roomName)} · {clockHMM(item.startMin)}
            </a>
          </div>
        ))}
        <span class="chq-pub-rail-caption">Jumps to that session</span>
      </div>
    </section>
  );
}

export function AgendaRail(props: {
  event: PublicEvent;
  items: PublicAgendaItem[];
  activeDay: string | null;
  // DEC-851 amendment (wave 5): threaded through so the rail can swap its
  // own first block on the same highlight AgendaDayGrid paints — a render-
  // level highlight, never a filter (DEC-851's wave-64 amendment), so
  // `items` itself is unchanged either way.
  highlightTrackId?: string | null;
  tracks?: PublicTrack[];
}) {
  const { event, items, highlightTrackId = null, tracks = [] } = props;
  // The highlighted track's name is resolved from the event's own track
  // list first (so the section still names it even on a day with zero
  // matches) and falls back to a matching item's own track name only if the
  // id is somehow absent from `tracks` (defensive, not expected).
  const highlightTrack = highlightTrackId
    ? (tracks.find((t) => t.id === highlightTrackId) ??
      items.flatMap((i) => i.tracks).find((t) => t.id === highlightTrackId) ??
      null)
    : null;
  return (
    <aside class="chq-pub-agenda-rail">
      <ScheduleRailSection event={event} />
      {highlightTrackId && highlightTrack ? (
        <TrackHighlightRailSection items={items} trackId={highlightTrackId} trackName={highlightTrack.name} />
      ) : (
        <RoomsRailSection items={items} />
      )}
      {/* DEC-683 amendment (wave 67), restructured wave 5 (DEC-851
          amendment): the printable programme link is now its own rail
          section (PRINT eyebrow, matching every other section's
          heading/body vocabulary) rather than a bare out-link -- and names
          what it links to instead of leaving that to the link text alone. */}
      {/* G13 (frames 10--01/02, MAJOR): the frames draw the description
          FIRST and the link beneath it, in the B8 tertiary register
          (rail.css.ts) -- not link-then-caption. */}
      <section class="chq-pub-rail-section">
        <h2 class="chq-pub-rail-heading">Print</h2>
        <div class="chq-pub-rail-body">
          <span class="chq-pub-rail-caption">A one-page version of all three days.</span>
          <a class="chq-pub-rail-programme-link" href={`/e/${event.slug}/programme`}>
            Printable programme ›
          </a>
        </div>
      </section>
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
            <span id="chq-ics-count">0</span> saved in this browser · no account needed
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
        {/* G13 (frame 10--12, MINOR): the frame closes the overlap rail
            with this reassurance line. */}
        <span class="chq-pub-rail-caption">Both are kept — nothing is removed for you.</span>
      </section>
    </aside>
  );
}
