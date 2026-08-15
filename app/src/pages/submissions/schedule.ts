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
// DEC-900 amendment (wave 60): minutes-from-midnight -> zero-padded HH:MM
// clock time via the single owner.
import { clockHHMM } from '../../lib/clock';

export interface SubmissionScheduleSlot {
  day: string;
  startMin: number;
  endMin: number;
  roomName: string | null;
}

export function formatSubmissionScheduleLine(slot: SubmissionScheduleSlot): string {
  const dayLabel = formatDayLabel(slot.day);
  const timeLabel = `${clockHHMM(slot.startMin)}–${clockHHMM(slot.endMin)}`;
  const roomLabel = publicRoomLabel(slot.roomName);
  return `${dayLabel} · ${timeLabel} · ${roomLabel}`;
}
