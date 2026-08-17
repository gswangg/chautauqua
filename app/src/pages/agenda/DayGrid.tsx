import type { DragEvent } from 'react';
import { Fragment, useEffect, useRef, useState } from 'react';
import type { AgendaConflict, AgendaRoom, AgendaTrack, PlacedAgendaSession } from './types';
import { SessionCard } from './SessionCard';
import { clusterConflictCaption } from './ConflictChip';
import {
  assignLanes,
  gridRowEnd,
  minutesToGridRow,
  snapToGrid,
  totalGridRows,
} from './gridMath';
import { clockHHMM, clockHMM } from '../../lib/clock';
import { countOf } from '../../lib/plural';
import type { ScheduleBreakRow } from './BreaksPanel';

export interface ArmedAgendaSession {
  submissionId: string;
  ref: string;
  title: string;
  durationMin: number;
}

interface DayGridProps {
  day: string;
  rooms: AgendaRoom[];
  tracks: AgendaTrack[];
  placed: PlacedAgendaSession[];
  conflicts: AgendaConflict[];
  /** The selected day's breaks (DEC-021 amendment, w67-b), rendered as
   * read-only full-width bands spanning every room column — see the render
   * block below. Optional/omittable so tests that don't exercise breaks
   * can keep passing no prop at all. */
  breaks?: ScheduleBreakRow[];
  dayStartMin: number;
  dayEndMin: number;
  gridMin: number;
  onDropPlace: (submissionId: string, roomId: string | null, startMin: number, endMin: number) => void;
  /** Keyboard/click placement path (DEC-570): the session currently armed
   * for click-to-place, if any. */
  armed: ArmedAgendaSession | null;
  /** Arms a placed card as the placement source (only fires when nothing is
   * currently armed — see handleCardSelect). */
  onArm: (session: ArmedAgendaSession) => void;
  /** Writes the currently-armed session into the given room/startMin slot
   * (empty cell button, or clicking an already-placed card while armed). */
  onPlaceAt: (roomId: string | null, startMin: number) => void;
}

/** DEC-021 amendment (w6-f): a placed card insets this many pixels inside
 * the column divider instead of sitting flush on it — see the laned-card
 * style below and .chq-day-grid-clash-card's matching CSS inset. */
const CARD_INSET_PX = 3.5;

const TBD_ROOM_ID = null;
const TBD_COL_ID = '__tbd__';
/** DEC-724: the trailing room-less column is no longer a permanent "TBD"
 * fixture — its header/accessible-name copy, everywhere it appears. */
const TBD_LABEL = 'No room yet';

interface OverlapItem {
  id: string;
  startMin: number;
  endMin: number;
}

/** Groups items into maximal connected overlap clusters (union-find over
 * pairwise time overlap) so any same-room clash of two or more sessions
 * (DEC-742, generalised by DEC-899/900) can be told apart from a lone
 * session — every cluster of size >= 2 merges into one inverted clash card,
 * regardless of N. */
function computeOverlapClusters(items: OverlapItem[]): OverlapItem[][] {
  const parent = new Map<string, string>();
  for (const item of items) parent.set(item.id, item.id);
  function find(x: string): string {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    let cur = x;
    while (parent.get(cur) !== root) {
      const next = parent.get(cur)!;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  }
  function union(a: string, b: string) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const a = items[i]!;
      const b = items[j]!;
      if (a.startMin < b.endMin && b.startMin < a.endMin) union(a.id, b.id);
    }
  }
  const groups = new Map<string, OverlapItem[]>();
  for (const item of items) {
    const root = find(item.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(item);
  }
  return [...groups.values()];
}

/** CSS grid: rooms as columns (plus a leading time-label column and, only
 * when needed, a trailing room-less column — DEC-724), 15-minute rows. Each
 * grid cell is a drop target; the drop's row/column determine the placed
 * startMin/roomId, preserving the dragged session's duration. */
export function DayGrid({
  day,
  rooms,
  tracks,
  placed,
  conflicts,
  breaks,
  dayStartMin,
  dayEndMin,
  gridMin,
  onDropPlace,
  armed,
  onArm,
  onPlaceAt,
}: DayGridProps) {
  const rows = totalGridRows(dayStartMin, dayEndMin, gridMin);
  const dayPlaced = placed.filter((s) => s.day === day);
  const dayBreaks = (breaks ?? []).filter((b) => b.day === day);
  const roomNameById = new Map(rooms.map((r) => [r.id, r.name]));

  // DEC-724/DEC-794: the room-less column only earns a place in the grid
  // when it has something to show — a placement without a room on the
  // visible day. Arming a session must never insert or remove this column
  // (that would reflow every room column's position mid-placement) — the
  // roomless-placement capability while armed and the column absent is
  // instead served by a standalone button below the grid (see the JSX tail).
  const dayHasNullRoom = dayPlaced.some((s) => s.roomId === null);
  const showTbdColumn = dayHasNullRoom;
  const columns = showTbdColumn ? [...rooms.map((r) => r.id), TBD_COL_ID] : rooms.map((r) => r.id);

  const roomKey = (roomId: string | null) => roomId ?? TBD_COL_ID;

  // DEC-742/DEC-899/900: any same-room cluster of two or more sessions
  // whose times overlap merges into ONE inverted clash card instead of N
  // side-by-side lanes — computed per room column via connected-component
  // clustering. DEC-557 amendment (wave 48): the TBD (room-less) column is
  // excluded — a "room clash" is meaningless without a room (schedule.ts
  // never emits room_overlap for a null roomId), so two overlapping
  // room-less sessions must fall through to the ordinary laned SessionCard
  // path instead of forming a card that can only mis-caption itself.
  const clashClusterSubmissionIds = new Set<string>();
  const clashClusters: PlacedAgendaSession[][] = [];
  for (const key of new Set(dayPlaced.map((s) => roomKey(s.roomId)))) {
    if (key === TBD_COL_ID) continue;
    const items = dayPlaced.filter((s) => roomKey(s.roomId) === key);
    const clusters = computeOverlapClusters(items.map((s) => ({ id: s.submissionId, startMin: s.startMin, endMin: s.endMin })));
    for (const cluster of clusters) {
      if (cluster.length < 2) continue;
      const sessions = cluster.map((c) => items.find((s) => s.submissionId === c.id)!);
      clashClusters.push(sessions);
      for (const s of sessions) clashClusterSubmissionIds.add(s.submissionId);
    }
  }

  // Overlapping blocks in the same room column render side-by-side via
  // assignLanes (DEC-140 pattern) so every card stays an independent drop
  // target for the pointer instead of the top card eating the click. Merged
  // clash clusters (DEC-742/899/900, above) are excluded here — they render
  // as their own full-width card instead of a lane.
  const lanesByRoom = new Map<string, ReturnType<typeof assignLanes<{ id: string; startMin: number; endMin: number }>>>();
  const lanedPlaced = dayPlaced.filter((s) => !clashClusterSubmissionIds.has(s.submissionId));
  for (const key of new Set(lanedPlaced.map((s) => roomKey(s.roomId)))) {
    const items = lanedPlaced
      .filter((s) => roomKey(s.roomId) === key)
      .map((s) => ({ id: s.submissionId, startMin: s.startMin, endMin: s.endMin }));
    lanesByRoom.set(key, assignLanes(items));
  }

  // DEC-903 (wave-63 amendment): the placed card currently mid-HTML5-drag,
  // tracked so (a) that card can take the B8 dragging treatment (opacity
  // only — no rotate/scale/shadow/border-width change) and (b) its ORIGIN
  // grid area can paint the well (#EFEBDF fill, 1px dashed #BAB6A6) while
  // it's away. Set from SessionCard's dragstart via onDragStateChange,
  // cleared on dragend AND on drop (a drop fires before some browsers'
  // dragend, so both paths clear it rather than relying on dragend alone).
  const [draggingId, setDraggingId] = useState<string | null>(null);

  function durationForDrag(e: DragEvent<Element>): number {
    const raw = e.dataTransfer.getData('application/x-chq-duration-min');
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
  }

  // USER-FILED (release night): the HTML5-drag placement gesture had NO
  // placement affordance at all — the "prospective slot ring + N MIN FREE"
  // readout built for the click-to-arm path (DEC-899/900) hangs off CSS
  // :hover, and a browser freezes :hover for the whole duration of a drag,
  // so dragging a card across the grid showed nothing about where it would
  // land. `dropTarget` is the slot the pointer is currently over DURING a
  // drag, tracked in React state (dragover fires throughout a drag, :hover
  // does not) so the same ring + free-minutes readout paints for the drag
  // path as for the armed path. dataTransfer payloads are unreadable in
  // dragover under the browsers' protected mode, so this deliberately keys
  // off the slot alone, never the dragged session's identity.
  const [dropTarget, setDropTarget] = useState<{ roomId: string | null; startMin: number } | null>(null);

  function isDropTarget(roomId: string | null, minutes: number): boolean {
    return dropTarget !== null && roomKey(dropTarget.roomId) === roomKey(roomId) && dropTarget.startMin === minutes;
  }

  function handleDragOver(e: DragEvent<Element>, roomId: string | null, rowStartMin: number) {
    e.preventDefault();
    // dragover fires many times per second over the same cell — return the
    // previous object when the slot is unchanged so React skips the
    // re-render instead of rebuilding the whole grid on every event.
    setDropTarget((prev) =>
      prev !== null && roomKey(prev.roomId) === roomKey(roomId) && prev.startMin === rowStartMin
        ? prev
        : { roomId, startMin: rowStartMin },
    );
  }

  /** Leaving the grid entirely (not merely crossing between two of its own
   * cells) drops the affordance — otherwise the last slot the pointer
   * touched stays lit while the card is dragged over the tray. */
  function handleGridDragLeave(e: DragEvent<HTMLDivElement>) {
    const next = e.relatedTarget as Node | null;
    if (next && e.currentTarget.contains(next)) return;
    setDropTarget(null);
  }

  // A drag can end anywhere (Esc, a drop outside the grid, a cancelled
  // drag) and those events never reach a cell's own handlers, so the
  // affordance is cleared at the document level too rather than relying on
  // the grid seeing the terminating event.
  useEffect(() => {
    function clearDragAffordance() {
      setDropTarget(null);
      setDraggingId(null);
    }
    document.addEventListener('dragend', clearDragAffordance);
    document.addEventListener('drop', clearDragAffordance);
    return () => {
      document.removeEventListener('dragend', clearDragAffordance);
      document.removeEventListener('drop', clearDragAffordance);
    };
  }, []);

  function handleDrop(e: DragEvent<Element>, roomId: string | null, rowStartMin: number) {
    e.preventDefault();
    setDraggingId(null);
    setDropTarget(null);
    const submissionId = e.dataTransfer.getData('text/plain');
    if (!submissionId) return;
    const duration = durationForDrag(e);
    const startMin = snapToGrid(rowStartMin, dayStartMin, dayEndMin - duration, gridMin);
    onDropPlace(submissionId, roomId, startMin, startMin + duration);
  }

  /** DEC-903: the same wording the twin cell button uses (occupied vs free),
   * computed for a PLACED card's own slot so clicking it while armed reads
   * consistently with clicking the cell underneath it — the click already
   * places the armed session there (handleCardSelect), this only makes the
   * accessible name say so. Returns undefined when nothing is armed (leaving
   * SessionCard's own default name untouched) and also when this card IS the
   * armed session itself — its own cell already renders as an ordinary free
   * cell-button with this exact string (occupancyCount excludes the armed
   * session from its own slot, DEC-769), so overriding here would produce a
   * second element with the same accessible name. */
  function armedPlacementLabel(session: PlacedAgendaSession): string | undefined {
    if (!armed || armed.submissionId === session.submissionId) return undefined;
    const clashCount = occupancyCount(session.roomId, session.startMin);
    const roomName = session.roomId === null ? TBD_LABEL : (roomNameById.get(session.roomId) ?? session.roomId);
    const timeLabel = clockHHMM(session.startMin);
    return clashCount === 0
      ? `Place ${armed.ref} at ${timeLabel} in ${roomName}`
      : `Place ${armed.ref} at ${timeLabel} in ${roomName} — will clash with ${countOf(clashCount, 'session')}`;
  }

  /** Counts placed sessions in this room covering this 15-minute row (DEC-570
   * occupied-cell detection; DEC-701 returns the count, not a boolean, so an
   * armed placement onto an occupied slot can name exactly how many sessions
   * it will clash with — never assumes a pair, since assignLanes already
   * proves a room can hold N > 2 overlapping sessions). DEC-769: the armed
   * session itself never counts against its own cell — placing it back onto
   * the slot it already occupies is not a clash, it's a no-op landing spot. */
  function occupancyCount(roomId: string | null, minutes: number): number {
    return dayPlaced.filter(
      (s) =>
        s.submissionId !== armed?.submissionId &&
        roomKey(s.roomId) === roomKey(roomId) &&
        s.startMin <= minutes &&
        minutes < s.endMin,
    ).length;
  }

  /** The open run of free minutes starting at this cell, capped at the day's
   * end and at the next occupied slot in this room (armed session excluded,
   * same as occupancyCount) — feeds the DEC-899/900 hover affordance's
   * "Place here · N MIN FREE" copy so the organiser sees how much room a
   * click here would land the armed session in. */
  function freeMinutesAt(roomId: string | null, minutes: number): number {
    const nextStart = dayPlaced
      .filter((s) => s.submissionId !== armed?.submissionId && roomKey(s.roomId) === roomKey(roomId) && s.startMin > minutes)
      .reduce((min, s) => Math.min(min, s.startMin), dayEndMin);
    return Math.max(0, nextStart - minutes);
  }

  // Focus management (DEC-724): after a successful click-to-place, focus
  // moves to the placed session's own cell; after Cancel/Escape clears
  // `armed` without a placement having happened, focus moves to the first
  // cell of the grid that was showing while armed. `justPlacedRef` is set
  // synchronously by the click handlers below, immediately before the
  // parent clears `armed`, so the effect (which fires after the next
  // commit, once the placement is reflected in `placed`) can tell the two
  // "armed -> null" transitions apart.
  const gridRef = useRef<HTMLDivElement | null>(null);
  const justPlacedRef = useRef<string | null>(null);
  const prevArmedRef = useRef<ArmedAgendaSession | null>(armed);

  useEffect(() => {
    const prevArmed = prevArmedRef.current;
    prevArmedRef.current = armed;
    if (!prevArmed || armed) return;
    const grid = gridRef.current;
    if (!grid) return;
    if (justPlacedRef.current) {
      const submissionId = justPlacedRef.current;
      justPlacedRef.current = null;
      grid.querySelector<HTMLElement>(`[data-submission-id="${submissionId}"]`)?.focus();
    } else {
      const firstColId = columns[0];
      if (firstColId === undefined) return;
      grid.querySelector<HTMLElement>(`[data-room-id="${firstColId}"][data-start-min="${dayStartMin}"]`)?.focus();
    }
  });

  function handleCardSelect(session: PlacedAgendaSession) {
    if (armed) {
      justPlacedRef.current = armed.submissionId;
      onPlaceAt(session.roomId, session.startMin);
    } else {
      onArm({ submissionId: session.submissionId, ref: session.ref, title: session.title, durationMin: session.endMin - session.startMin });
    }
  }

  function handleCellPlace(roomId: string | null, minutes: number) {
    if (!armed) return;
    justPlacedRef.current = armed.submissionId;
    onPlaceAt(roomId, minutes);
  }

  const gridTemplateColumns = `80px repeat(${columns.length}, minmax(140px, 1fr))`;
  // DEC-742: rows grow to fit a merged clash card's content (its inner
  // scroll/overflow rule is removed below) instead of staying pinned to a
  // single-line height every other row uses. DEC-900 amendment (wave 39,
  // LATTICE): the floor is 22px so two 15-minute rows settle at a uniform
  // 44px pitch matching the frames — see .chq-day-grid-time-label's trimmed
  // padding above, which keeps a labelled row's own min-content under this
  // floor too, so ordinary rows no longer alternate 24.0px/32.6px.
  const gridTemplateRows = `auto repeat(${rows}, minmax(22px, auto))`;

  const timeRowLabels = Array.from({ length: rows }, (_, i) => dayStartMin + i * gridMin);

  const gridClassName = armed ? 'chq-day-grid chq-day-grid-armed' : 'chq-day-grid';

  return (
    <>
    <div
      className={gridClassName}
      style={{ gridTemplateColumns, gridTemplateRows }}
      ref={gridRef}
      onDragLeave={handleGridDragLeave}
    >
      <div className="chq-day-grid-corner" style={{ gridColumn: 1, gridRow: 1 }} />
      {columns.map((colId, colIdx) => (
        <div
          key={colId}
          className={
            colId === TBD_COL_ID ? 'chq-day-grid-room-header chq-day-grid-room-header-tbd' : 'chq-day-grid-room-header'
          }
          style={{ gridColumn: colIdx + 2, gridRow: 1 }}
        >
          {colId === TBD_COL_ID ? TBD_LABEL : (roomNameById.get(colId) ?? colId)}
        </div>
      ))}

      {timeRowLabels.map((minutes, rowIdx) =>
        rowIdx % 2 === 0 ? (
          <div
            key={`label-${minutes}`}
            className="chq-day-grid-time-label"
            style={{ gridColumn: 1, gridRow: rowIdx + 2 }}
            aria-label={clockHMM(minutes)}
          >
            {clockHMM(minutes)}
          </div>
        ) : null,
      )}

      {timeRowLabels.map((minutes, rowIdx) =>
        columns.map((colId, colIdx) => {
          const roomId = colId === TBD_COL_ID ? TBD_ROOM_ID : colId;
          const roomName = colId === TBD_COL_ID ? TBD_LABEL : (roomNameById.get(colId) ?? colId);
          const cellStyle = { gridColumn: colIdx + 2, gridRow: rowIdx + 2 };
          // DEC-900 amendment (wave 39, LATTICE): the grid draws a rule at
          // every 15-minute line, but the 30-minute boundary — the bottom
          // edge of the second row in each labelled pair — gets its own
          // heavier rule so the lattice reads as 30-minute rows, not 36
          // identical hairlines. rowIdx is even at the row a label starts;
          // the boundary is the bottom edge of the row right before the
          // next label, i.e. every odd rowIdx.
          const boundaryClass = rowIdx % 2 === 1 ? ' chq-day-grid-cell-boundary' : '';
          // USER-FILED (release night): the slot the pointer is over mid-drag
          // takes the SAME ring/tint the armed path gives a :hover-ed slot,
          // plus the free-minutes readout — the drag gesture is otherwise
          // blind (see the dropTarget comment above).
          const dropTargetClass = isDropTarget(roomId, minutes) ? ' chq-day-grid-cell-drop-target' : '';
          if (armed) {
            const clashCount = occupancyCount(roomId, minutes);
            if (clashCount === 0) {
              const freeMin = freeMinutesAt(roomId, minutes);
              return (
                <button
                  key={`cell-${colId}-${minutes}`}
                  type="button"
                  className={`chq-day-grid-cell-btn${boundaryClass}${dropTargetClass}`}
                  style={cellStyle}
                  onDragOver={(e) => handleDragOver(e, roomId, minutes)}
                  onDrop={(e) => handleDrop(e, roomId, minutes)}
                  onClick={() => handleCellPlace(roomId, minutes)}
                  aria-label={`Place ${armed.ref} at ${clockHHMM(minutes)} in ${roomName}`}
                  data-room-id={colId}
                  data-start-min={minutes}
                >
                  <span className="chq-day-grid-cell-hover-label" aria-hidden="true">
                    {`Place here · ${freeMin} MIN FREE`}
                  </span>
                </button>
              );
            }
            // DEC-701/J9 warn-never-block: an occupied cell must still
            // accept a placement through the accessible (keyboard/click)
            // path, not just drag-drop — the accessible name states the
            // consequence up front instead of silently discarding the click.
            return (
              <button
                key={`cell-${colId}-${minutes}`}
                type="button"
                className={`chq-day-grid-cell-btn chq-day-grid-cell-btn-clash${boundaryClass}${dropTargetClass}`}
                style={cellStyle}
                onDragOver={(e) => handleDragOver(e, roomId, minutes)}
                onDrop={(e) => handleDrop(e, roomId, minutes)}
                onClick={() => handleCellPlace(roomId, minutes)}
                aria-label={`Place ${armed.ref} at ${clockHHMM(minutes)} in ${roomName} — will clash with ${countOf(clashCount, 'session')}`}
                data-room-id={colId}
                data-start-min={minutes}
              />
            );
          }
          // Not armed: the cell is a plain drop target. It still shows the
          // prospective-slot ring and its free-minutes run while a drag is
          // actually over it — the readout is computed from the same
          // freeMinutesAt() the armed path uses, so both placement gestures
          // read identically.
          return (
            <div
              key={`cell-${colId}-${minutes}`}
              className={`chq-day-grid-cell${boundaryClass}${dropTargetClass}`}
              style={cellStyle}
              tabIndex={-1}
              onDragOver={(e) => handleDragOver(e, roomId, minutes)}
              onDrop={(e) => handleDrop(e, roomId, minutes)}
              data-room-id={colId}
              data-start-min={minutes}
            >
              {dropTargetClass !== '' && (
                <span className="chq-day-grid-cell-hover-label" aria-hidden="true">
                  {`Place here · ${freeMinutesAt(roomId, minutes)} MIN FREE`}
                </span>
              )}
            </div>
          );
        }),
      )}

      {/* DEC-021 amendment (w67-b): breaks render as read-only full-width
          bands spanning every room column, positioned with the SAME
          gridMath helpers a placed card uses (start minute -> row offset,
          durationMin -> span) so a band and a card at the same minute line
          up exactly. Deliberately not a drop target/drag handle/click
          handler and carries no data-submission-id — the cells underneath
          stay live drop targets (J9 warn-never-block: the hand may still
          place a session over a break) and this band never enters the
          conflict engine, unscheduled tray, or state.ts's placement
          arithmetic. */}
      {dayBreaks.map((brk) => {
        const brkEndMin = brk.startMin + brk.durationMin;
        // DEC-021 amendment (w61-d): a break added before the event's dates
        // moved (or edited past the day's window) is never dropped from the
        // grid -- it is kept but flagged, clamped to the visible rows so it
        // paints inside the grid rather than spilling into a row that
        // doesn't exist, and muted per the B8 vocabulary rather than reading
        // as a normal band.
        const flagged = brk.startMin < dayStartMin || brkEndMin > dayEndMin;
        const clampedStart = Math.max(brk.startMin, dayStartMin);
        const clampedEnd = Math.min(brkEndMin, dayEndMin);
        const rowStart = minutesToGridRow(clampedStart, dayStartMin, gridMin);
        const rowEnd = gridRowEnd(clampedEnd, dayStartMin, gridMin);
        return (
          <div
            key={`break-${brk.id}`}
            className={`chq-agenda-break-band${flagged ? ' chq-agenda-break-band-flagged' : ''}`}
            style={{ gridColumn: `2 / span ${columns.length}`, gridRow: `${rowStart} / ${rowEnd}` }}
          >
            <span className="chq-agenda-break-band-label">
              {`${clockHHMM(brk.startMin)} · ${brk.label}${brk.location ? ` · ${brk.location}` : ''} · ${brk.durationMin} min${flagged ? ' · outside the day\'s hours' : ''}`}
            </span>
          </div>
        );
      })}

      {lanedPlaced.map((session) => {
        const colIdx = session.roomId === null ? columns.length - 1 : columns.indexOf(session.roomId);
        if (colIdx < 0) return null;
        const rowStart = minutesToGridRow(session.startMin, dayStartMin, gridMin);
        const rowEnd = gridRowEnd(session.endMin, dayStartMin, gridMin);
        const laned = lanesByRoom.get(roomKey(session.roomId))?.find((l) => l.item.id === session.submissionId);
        const lane = laned?.lane ?? 0;
        const laneCount = laned?.laneCount ?? 1;
        const isDragging = draggingId === session.submissionId;
        return (
          <Fragment key={session.submissionId}>
            {/* DEC-903 (wave-63 amendment): the dragged card's ORIGIN well —
                a lower-stacked sibling in the same grid area so it shows
                through the card above once the card takes opacity .6.
                Auto z-index (no explicit stacking) keeps it strictly under
                .chq-day-grid-placed-card's own named overlay tier regardless
                of DOM order. */}
            {isDragging && (
              <div
                className="chq-day-grid-origin-well"
                style={{ gridColumn: colIdx + 2, gridRow: `${rowStart} / ${rowEnd}` }}
              />
            )}
            <SessionCard
              session={session}
              conflicts={conflicts}
              className={`chq-day-grid-placed-card${isDragging ? ' chq-session-card-dragging' : ''}`}
              style={{
                gridColumn: colIdx + 2,
                gridRow: `${rowStart} / ${rowEnd}`,
                // DEC-021 amendment (w6-f): the card sits ~3.5px inset inside
                // the column divider rather than flush on it — the inset is
                // carved out of the lane width itself (not a plain margin
                // added on top) so a laned card's own right edge still lines
                // up with its lane neighbour instead of overflowing the
                // column.
                width: `calc((100% - ${CARD_INSET_PX}px) / ${laneCount})`,
                marginInlineStart: `calc(${CARD_INSET_PX}px + (100% - ${CARD_INSET_PX}px) / ${laneCount} * ${lane})`,
              }}
              onDragOver={(e) => handleDragOver(e, session.roomId, session.startMin)}
              onDrop={(e) => handleDrop(e, session.roomId, session.startMin)}
              onSelect={() => handleCardSelect(session)}
              selected={armed?.submissionId === session.submissionId}
              placed
              armedLabel={armedPlacementLabel(session)}
              onDragStateChange={(dragging) => setDraggingId(dragging ? session.submissionId : null)}
            />
          </Fragment>
        );
      })}

      {clashClusters.map((sessions) => {
        const colId = roomKey(sessions[0]!.roomId);
        const colIdx = columns.indexOf(colId);
        if (colIdx < 0) return null;
        const rowStart = Math.min(...sessions.map((s) => minutesToGridRow(s.startMin, dayStartMin, gridMin)));
        const rowEnd = Math.max(...sessions.map((s) => gridRowEnd(s.endMin, dayStartMin, gridMin)));
        // DEC-557 amendment (wave 48): the caption is read from the server's
        // conflict `kind`, never assumed — a same-room cluster whose
        // members happen to share no speaker still gets the room caption
        // (every cluster member shares the room by construction), but a
        // cluster whose overlap doesn't correspond to any recorded conflict
        // (can't happen for a room column, kept null-safe here anyway)
        // renders no caption rather than a fabricated one.
        const caption = clusterConflictCaption(
          conflicts,
          sessions.map((s) => s.submissionId),
        );
        return (
          <div
            key={`clash-${sessions.map((s) => s.submissionId).join('-')}`}
            className="chq-day-grid-clash-card"
            style={{ gridColumn: colIdx + 2, gridRow: `${rowStart} / ${rowEnd}` }}
            onDragOver={(e) => handleDragOver(e, sessions[0]!.roomId, sessions[0]!.startMin)}
            onDrop={(e) => handleDrop(e, sessions[0]!.roomId, sessions[0]!.startMin)}
          >
            {sessions.map((session) => (
              <button
                key={session.submissionId}
                type="button"
                className="chq-day-grid-clash-item"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', session.submissionId);
                  e.dataTransfer.setData('application/x-chq-duration-min', String(session.endMin - session.startMin));
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => handleDragOver(e, session.roomId, session.startMin)}
                onDrop={(e) => handleDrop(e, session.roomId, session.startMin)}
                onClick={() => handleCardSelect(session)}
                aria-label={`${session.ref}: ${session.title} (conflict)`}
                aria-pressed={armed?.submissionId === session.submissionId ? true : undefined}
                data-submission-id={session.submissionId}
                data-conflict="true"
              >
                <span className="chq-day-grid-clash-item-ref">{session.ref}</span>
                <span className="chq-day-grid-clash-item-title">{session.title}</span>
                {session.speakers.length > 0 && (
                  <span className="chq-day-grid-clash-item-speakers">{session.speakers.map((s) => s.name).join(', ')}</span>
                )}
              </button>
            ))}
            {caption !== null && <div className="chq-day-grid-clash-caption">{caption}</div>}
          </div>
        );
      })}
    </div>
    {armed && !showTbdColumn && (
      <button
        type="button"
        className="chq-day-grid-noroom-btn"
        onClick={() => handleCellPlace(TBD_ROOM_ID, dayStartMin)}
      >
        {`Place ${armed.ref} with ${TBD_LABEL.charAt(0).toLowerCase()}${TBD_LABEL.slice(1)}`}
      </button>
    )}
    </>
  );
}
