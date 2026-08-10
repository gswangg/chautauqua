import type { DragEvent } from 'react';
import type { AgendaConflict, AgendaRoom, AgendaTrack, PlacedAgendaSession } from './types';
import { SessionCard } from './SessionCard';
import { formatMinutes, gridRowEnd, minutesToGridRow, snapToGrid, totalGridRows } from './gridMath';

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
}: DayGridProps) {
  const rows = totalGridRows(dayStartMin, dayEndMin, gridMin);
  const columns = [...rooms.map((r) => r.id), '__tbd__'];
  const dayPlaced = placed.filter((s) => s.day === day);

  function durationForDrag(e: DragEvent<HTMLDivElement>): number {
    const raw = e.dataTransfer.getData('application/x-chq-duration-min');
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
  }

  function handleDrop(e: DragEvent<HTMLDivElement>, roomId: string | null, rowStartMin: number) {
    e.preventDefault();
    const submissionId = e.dataTransfer.getData('text/plain');
    if (!submissionId) return;
    const duration = durationForDrag(e);
    const startMin = snapToGrid(rowStartMin, dayStartMin, dayEndMin - duration, gridMin);
    onDropPlace(submissionId, roomId, startMin, startMin + duration);
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
          return (
            <div
              key={`cell-${colId}-${minutes}`}
              className="chq-day-grid-cell"
              style={{ gridColumn: colIdx + 2, gridRow: rowIdx + 2 }}
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
        return (
          <SessionCard
            key={session.submissionId}
            session={session}
            tracks={tracks}
            conflicts={conflicts}
            className="chq-day-grid-placed-card"
            style={{ gridColumn: colIdx + 2, gridRow: `${rowStart} / ${rowEnd}` }}
          />
        );
      })}
    </div>
  );
}
