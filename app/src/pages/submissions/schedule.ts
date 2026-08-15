// DEC-828: format a placed submission's schedule_slot for SubmissionDetailPage as
// "day · start–end · room". day/startMin/endMin/roomName are already expressed in the
// owning event's timezone at the schema level (schedule_slot.day is 'YYYY-MM-DD',
// start/endMin are minutes-from-midnight, both event-local) -- no zone conversion
// happens client-side, unlike an epoch-ms instant. Reuses the app's one day-label
// formatter (dates.ts formatDayLabel) so this line reads identically to every other
// calendar-date display in the SPA. A null roomName falls back to the public "To be
// announced" wording (DEC-666: an internal shorthand is not public prose) -- never a
// dash -- so the organiser sees the same honest label a visitor would see.
import { formatDayLabel } from '../../lib/dates';
import { publicRoomLabel } from '../../lib/room-label';

export interface SubmissionScheduleSlot {
  day: string;
  startMin: number;
  endMin: number;
  roomName: string | null;
}

/** Render minutes-from-midnight as a zero-padded HH:MM clock time. */
function formatClockTime(minutesFromMidnight: number): string {
  const h = Math.floor(minutesFromMidnight / 60);
  const m = minutesFromMidnight % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatSubmissionScheduleLine(slot: SubmissionScheduleSlot): string {
  const dayLabel = formatDayLabel(slot.day);
  const timeLabel = `${formatClockTime(slot.startMin)}–${formatClockTime(slot.endMin)}`;
  const roomLabel = publicRoomLabel(slot.roomName);
  return `${dayLabel} · ${timeLabel} · ${roomLabel}`;
}
