// Desktop time-row grid rendering for the public agenda surface. Split out
// of the former monolithic src/routes/public/agenda.tsx (contention
// decomposition, wave 66) — no behavior change.

import type { PublicAgendaItem, PublicEvent } from "../../server/repo/public";
import type { ScheduleBreak } from "../../server/repo/breaks"; // type-only; the public barrel re-exports the read path (getPublicBreaksByDay)
import { publicRoomLabel } from "../../domain/schedule";
import { sessionDetailPath, type Surface, type SurfaceBase } from "./shell";
import { TrackChips, FormatChip, SpeakerNames, ItineraryToggle, formatDay, formatMinutes } from "./cards";
import { DEC_851, DEC_999 } from "../../decisions";

void DEC_999;
void DEC_851;

// DEC-022 amendment (wave 63): the ONE break copy formatter, shared by the
// desktop grid row and the phone list row so the two surfaces can never
// drift on wording. docs/design's copy shape ("LUNCH · FOYER · 60 MIN") is
// produced visually via text-transform:uppercase on .chq-pub-agenda-break
// (public.css.ts) -- the DOM text itself stays natural-case (matches the
// design handoff's own 'Lunch · Foyer' example), same convention
// .chq-pub-agenda-list-room already uses for room names.
export function formatBreakLabel(b: ScheduleBreak): string {
  const parts = [b.label];
  if (b.location) parts.push(b.location);
  return `${parts.join(" · ")} · ${b.durationMin} min`;
}

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

/** A desktop day is a SEQUENCE of rows in start-time order: either a set of
 * sessions sharing one start minute, or a break. DEC-022's break is not a
 * session, so it never becomes a block inside a session row -- it is its own
 * row (see the render below). */
type DayRow =
  | { kind: "sessions"; startMin: number; items: PublicAgendaItem[] }
  | { kind: "break"; startMin: number; brk: ScheduleBreak };

/** DEC-584 (wave 64 amendment) + DEC-022 amendment (wave 63): interleaves the
 * day's breaks into the distinct-start-minute session rows, ascending. When a
 * break starts at the same minute as a session it sorts FIRST -- the same
 * tiebreak AgendaItemList uses for the phone/schedule list, so the two
 * markups can never disagree about what comes first at 12:30. */
function buildDayRows(items: PublicAgendaItem[], breaks: ScheduleBreak[]): DayRow[] {
  const rows: DayRow[] = [
    ...groupByStartMinute(items).map((row): DayRow => ({ kind: "sessions", startMin: row.startMin, items: row.items })),
    ...breaks.map((brk): DayRow => ({ kind: "break", startMin: brk.startMin, brk })),
  ];
  return rows.sort((a, b) => {
    if (a.startMin !== b.startMin) return a.startMin - b.startMin;
    return a.kind === b.kind ? 0 : a.kind === "break" ? -1 : 1;
  });
}

/** Per-day time-row sequence (DEC-584 wave-64 amendment): one row per
 * distinct start minute, each row's blocks laid out as a wrapping grid
 * rather than fixed room columns — public density rarely has enough
 * concurrent sessions to justify a lane matrix, and clashes are an
 * organiser concept, not a public one (no clash indicators here). */
export function AgendaDayGrid(props: {
  day: string;
  items: PublicAgendaItem[];
  event: PublicEvent;
  from: Surface;
  base?: SurfaceBase;
  breaks?: ScheduleBreak[];
  // DEC-851 (wave 64 amendment): a track HIGHLIGHTS here, it never filters —
  // the grid renders exactly the same blocks with or without this value and
  // NEVER reflows; only the per-block classes below change.
  highlightTrackId?: string | null;
}) {
  const { day, items, event, from, base, breaks = [], highlightTrackId = null } = props;
  const rows = buildDayRows(items, breaks);

  return (
    // DEC-768: the day heading is owned by AgendaDay (the caller wrapping
    // both this grid and AgendaItemList below) -- rendering it here too
    // duplicated it in the DOM (both copies always present, only one
    // display:none'd per breakpoint). w1-i's formatDay() day label is kept
    // (it now reaches the DOM through that single owning heading).
    <section aria-label={`Agenda for ${formatDay(day)}`}>
      <div class="chq-pub-agenda-day-scroll">
        <div class="chq-pub-agenda-day">
          {rows.map((row) =>
            row.kind === "break" ? (
              // DEC-022 amendment + DEC-584 (wave 64): a break is a FULL-WIDTH
              // spanning quiet rule, never a block inside a session row and
              // never confined to one room -- so it is its own direct child of
              // the day's column flexbox, spanning the time cell's gutter too
              // (the wave-63 grid said the same thing as grid-column:1/-1; the
              // row-sequence layout needs no inline geometry to say it). The
              // start time is carried in the text because this layout has no
              // clock axis to position against, and it is the SAME text the
              // phone list renders. No id/href/interactive control: a break is
              // not a submission and has no detail page to link to.
              <div class="chq-pub-agenda-break">
                {formatMinutes(row.brk.startMin)} · {formatBreakLabel(row.brk)}
              </div>
            ) : (
              <div class="chq-pub-agenda-day-row">
                <div class="chq-pub-agenda-day-time">{formatMinutes(row.startMin)}</div>
                <div class="chq-pub-agenda-day-blocks">
                  {row.items.map((item) => {
                    // DEC-851 (wave 64 amendment): a block whose session does
                    // not carry the highlighted track recedes to a muted card
                    // via ONE extra class on the element already carrying
                    // .chq-pub-agenda-block — it is still rendered, still
                    // linked, and its Save control is never dimmed, because
                    // the reason it stays on screen is that you might still
                    // take it. No highlight selected => every block matches.
                    const matches = highlightTrackId == null || item.tracks.some((t) => t.id === highlightTrackId);
                    return (
                    // DEC-602/DEC-584 (wave 64): the block is a content-sized
                    // card, not a grid-row/grid-column positioned box — no
                    // fixed height math, no lane geometry (single-lane
                    // matrix removed; overlap only mattered when rooms were
                    // columns sharing a row track).
                    <div
                      class={matches ? "chq-pub-agenda-block" : "chq-pub-agenda-block chq-pub-agenda-block-muted"}
                      id={`chq-agenda-${item.submissionId}`}
                    >
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
                        <TrackChips tracks={item.tracks} highlightTrackId={highlightTrackId} />
                        <FormatChip format={item.format} />
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            ),
          )}
        </div>
      </div>
    </section>
  );
}
