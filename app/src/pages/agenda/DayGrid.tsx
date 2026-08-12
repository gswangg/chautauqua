import type { DragEvent } from 'react';
import type { AgendaConflict, AgendaRoom, AgendaTrack, PlacedAgendaSession } from './types';
import { SessionCard } from './SessionCard';
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

/** CSS grid: rooms as columns (plus a leading time-label column and a
 * trailing "TBD" room column), 15-minute rows. Each grid cell is a drop
 * target; the drop's row/column determine the placed startMin/roomId,
 * preserving the dragged session's duration. */
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
  const columns = [...rooms.map((r) => r.id), '__tbd__'];
  const dayPlaced = placed.filter((s) => s.day === day);
  const roomNameById = new Map(rooms.map((r) => [r.id, r.name]));

  // Overlapping blocks in the same room column render side-by-side via
  // assignLanes (DEC-140 pattern) so every card stays an independent drop
  // target for the pointer instead of the top card eating the click.
  const roomKey = (roomId: string | null) => roomId ?? '__tbd__';
  const lanesByRoom = new Map<string, ReturnType<typeof assignLanes<{ id: string; startMin: number; endMin: number }>>>();
  for (const key of new Set(dayPlaced.map((s) => roomKey(s.roomId)))) {
    const items = dayPlaced
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
   * proves a room can hold N > 2 overlapping sessions). */
  function occupancyCount(roomId: string | null, minutes: number): number {
    return dayPlaced.filter((s) => roomKey(s.roomId) === roomKey(roomId) && s.startMin <= minutes && minutes < s.endMin).length;
  }

  function handleCardSelect(session: PlacedAgendaSession) {
    if (armed) {
      onPlaceAt(session.roomId, session.startMin);
    } else {
      onArm({ submissionId: session.submissionId, ref: session.ref, title: session.title, durationMin: session.endMin - session.startMin });
    }
  }

  const gridTemplateColumns = `80px repeat(${columns.length}, minmax(140px, 1fr))`;
  const gridTemplateRows = `auto repeat(${rows}, 24px)`;

  const timeRowLabels = Array.from({ length: rows }, (_, i) => dayStartMin + i * gridMin);

  return (
    <div className="chq-day-grid" style={{ gridTemplateColumns, gridTemplateRows }}>
      <div className="chq-day-grid-corner" style={{ gridColumn: 1, gridRow: 1 }} />
      {rooms.map((room, colIdx) => (
        <div key={room.id} className="chq-day-grid-room-header" style={{ gridColumn: colIdx + 2, gridRow: 1 }}>
          {room.name}
        </div>
      ))}
      <div className="chq-day-grid-room-header" style={{ gridColumn: columns.length + 1, gridRow: 1 }}>
        TBD
      </div>

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
          const roomId = colId === '__tbd__' ? TBD_ROOM_ID : colId;
          const roomName = colId === '__tbd__' ? 'TBD' : (roomNameById.get(colId) ?? colId);
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
                  onClick={() => onPlaceAt(roomId, minutes)}
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
                onClick={() => onPlaceAt(roomId, minutes)}
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
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, roomId, minutes)}
              data-room-id={colId}
              data-start-min={minutes}
            />
          );
        }),
      )}

      {dayPlaced.map((session) => {
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
    </div>
  );
}
