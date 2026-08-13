import type { DragEvent } from 'react';
import { useEffect, useRef } from 'react';
import type { AgendaConflict, AgendaRoom, AgendaTrack, PlacedAgendaSession } from './types';
import { SessionCard } from './SessionCard';
import { conflictKindLabel } from './ConflictChip';
import { assignLanes, formatMinutes, gridRowEnd, minutesToGridRow, snapToGrid, totalGridRows } from './gridMath';

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
 * pairwise time overlap) so a same-room clash of exactly two sessions
 * (DEC-742) can be told apart from a lone session or a 3+-way pile-up
 * (which keeps the existing side-by-side lane rendering — see the render
 * test proving a 3-way overlap still renders three separate cards). */
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
  const roomNameById = new Map(rooms.map((r) => [r.id, r.name]));

  // DEC-724: the room-less column only earns a place in the grid when it
  // has something to show — a placement without a room on the visible day,
  // or a session currently armed (so its "Place ... in No room yet" button
  // has somewhere to render).
  const dayHasNullRoom = dayPlaced.some((s) => s.roomId === null);
  const showTbdColumn = dayHasNullRoom || armed !== null;
  const columns = showTbdColumn ? [...rooms.map((r) => r.id), TBD_COL_ID] : rooms.map((r) => r.id);

  const roomKey = (roomId: string | null) => roomId ?? TBD_COL_ID;

  // DEC-742: a same-room pair whose times overlap merges into ONE inverted
  // clash card instead of two side-by-side lanes — computed per room column
  // via connected-component clustering so a 3+-way pile-up (a different,
  // pre-existing shape) is left alone.
  const clashPairSubmissionIds = new Set<string>();
  const clashPairs: PlacedAgendaSession[][] = [];
  for (const key of new Set(dayPlaced.map((s) => roomKey(s.roomId)))) {
    const items = dayPlaced.filter((s) => roomKey(s.roomId) === key);
    const clusters = computeOverlapClusters(items.map((s) => ({ id: s.submissionId, startMin: s.startMin, endMin: s.endMin })));
    for (const cluster of clusters) {
      if (cluster.length !== 2) continue;
      const sessions = cluster.map((c) => items.find((s) => s.submissionId === c.id)!);
      clashPairs.push(sessions);
      for (const s of sessions) clashPairSubmissionIds.add(s.submissionId);
    }
  }

  // Overlapping blocks in the same room column render side-by-side via
  // assignLanes (DEC-140 pattern) so every card stays an independent drop
  // target for the pointer instead of the top card eating the click. Merged
  // clash pairs (DEC-742, above) are excluded here — they render as their
  // own full-width card instead of a lane.
  const lanesByRoom = new Map<string, ReturnType<typeof assignLanes<{ id: string; startMin: number; endMin: number }>>>();
  const lanedPlaced = dayPlaced.filter((s) => !clashPairSubmissionIds.has(s.submissionId));
  for (const key of new Set(lanedPlaced.map((s) => roomKey(s.roomId)))) {
    const items = lanedPlaced
      .filter((s) => roomKey(s.roomId) === key)
      .map((s) => ({ id: s.submissionId, startMin: s.startMin, endMin: s.endMin }));
    lanesByRoom.set(key, assignLanes(items));
  }

  function durationForDrag(e: DragEvent<Element>): number {
    const raw = e.dataTransfer.getData('application/x-chq-duration-min');
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
  }

  function handleDragOver(e: DragEvent<Element>) {
    e.preventDefault();
  }

  function handleDrop(e: DragEvent<Element>, roomId: string | null, rowStartMin: number) {
    e.preventDefault();
    const submissionId = e.dataTransfer.getData('text/plain');
    if (!submissionId) return;
    const duration = durationForDrag(e);
    const startMin = snapToGrid(rowStartMin, dayStartMin, dayEndMin - duration, gridMin);
    onDropPlace(submissionId, roomId, startMin, startMin + duration);
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
  // scroll/overflow rule is removed below) instead of staying pinned to the
  // 24px single-line height every other row uses.
  const gridTemplateRows = `auto repeat(${rows}, minmax(24px, auto))`;

  const timeRowLabels = Array.from({ length: rows }, (_, i) => dayStartMin + i * gridMin);

  return (
    <div className="chq-day-grid" style={{ gridTemplateColumns, gridTemplateRows }} ref={gridRef}>
      <div className="chq-day-grid-corner" style={{ gridColumn: 1, gridRow: 1 }} />
      {columns.map((colId, colIdx) => (
        <div key={colId} className="chq-day-grid-room-header" style={{ gridColumn: colIdx + 2, gridRow: 1 }}>
          {colId === TBD_COL_ID ? TBD_LABEL : (roomNameById.get(colId) ?? colId)}
        </div>
      ))}

      {timeRowLabels.map((minutes, rowIdx) =>
        rowIdx % 2 === 0 ? (
          <div
            key={`label-${minutes}`}
            className="chq-day-grid-time-label"
            style={{ gridColumn: 1, gridRow: rowIdx + 2 }}
          >
            {formatMinutes(minutes)}
          </div>
        ) : null,
      )}

      {timeRowLabels.map((minutes, rowIdx) =>
        columns.map((colId, colIdx) => {
          const roomId = colId === TBD_COL_ID ? TBD_ROOM_ID : colId;
          const roomName = colId === TBD_COL_ID ? TBD_LABEL : (roomNameById.get(colId) ?? colId);
          const cellStyle = { gridColumn: colIdx + 2, gridRow: rowIdx + 2 };
          if (armed) {
            const clashCount = occupancyCount(roomId, minutes);
            if (clashCount === 0) {
              return (
                <button
                  key={`cell-${colId}-${minutes}`}
                  type="button"
                  className="chq-day-grid-cell-btn"
                  style={cellStyle}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, roomId, minutes)}
                  onClick={() => handleCellPlace(roomId, minutes)}
                  aria-label={`Place ${armed.ref} at ${formatMinutes(minutes)} in ${roomName}`}
                  data-room-id={colId}
                  data-start-min={minutes}
                />
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
                className="chq-day-grid-cell-btn chq-day-grid-cell-btn-clash"
                style={cellStyle}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, roomId, minutes)}
                onClick={() => handleCellPlace(roomId, minutes)}
                aria-label={`Place ${armed.ref} at ${formatMinutes(minutes)} in ${roomName} — will clash with ${clashCount} session${clashCount === 1 ? '' : 's'}`}
                data-room-id={colId}
                data-start-min={minutes}
              />
            );
          }
          return (
            <div
              key={`cell-${colId}-${minutes}`}
              className="chq-day-grid-cell"
              style={cellStyle}
              tabIndex={-1}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, roomId, minutes)}
              data-room-id={colId}
              data-start-min={minutes}
            />
          );
        }),
      )}

      {lanedPlaced.map((session) => {
        const colIdx = session.roomId === null ? columns.length - 1 : columns.indexOf(session.roomId);
        if (colIdx < 0) return null;
        const rowStart = minutesToGridRow(session.startMin, dayStartMin, gridMin);
        const rowEnd = gridRowEnd(session.endMin, dayStartMin, gridMin);
        const laned = lanesByRoom.get(roomKey(session.roomId))?.find((l) => l.item.id === session.submissionId);
        const lane = laned?.lane ?? 0;
        const laneCount = laned?.laneCount ?? 1;
        return (
          <SessionCard
            key={session.submissionId}
            session={session}
            tracks={tracks}
            conflicts={conflicts}
            className="chq-day-grid-placed-card"
            style={{
              gridColumn: colIdx + 2,
              gridRow: `${rowStart} / ${rowEnd}`,
              width: `calc(100% / ${laneCount})`,
              marginInlineStart: `calc(100% / ${laneCount} * ${lane})`,
            }}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, session.roomId, session.startMin)}
            onSelect={() => handleCardSelect(session)}
            selected={armed?.submissionId === session.submissionId}
          />
        );
      })}

      {clashPairs.map((sessions) => {
        const colId = roomKey(sessions[0]!.roomId);
        const colIdx = columns.indexOf(colId);
        if (colIdx < 0) return null;
        const rowStart = Math.min(...sessions.map((s) => minutesToGridRow(s.startMin, dayStartMin, gridMin)));
        const rowEnd = Math.max(...sessions.map((s) => gridRowEnd(s.endMin, dayStartMin, gridMin)));
        return (
          <div
            key={`clash-${sessions.map((s) => s.submissionId).join('-')}`}
            className="chq-day-grid-clash-card"
            style={{ gridColumn: colIdx + 2, gridRow: `${rowStart} / ${rowEnd}` }}
            onDragOver={handleDragOver}
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
                onDragOver={handleDragOver}
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
            <div className="chq-day-grid-clash-caption">{conflictKindLabel('room_overlap', sessions.length)}</div>
          </div>
        );
      })}
    </div>
  );
}
