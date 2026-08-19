import type { RoomForm, TrackForm } from '../formState';
import { TRACK_SWATCHES } from './trackSwatches';
import { DEC_856 } from '../../../../../src/decisions';

export interface Track {
  id: string;
  name: string;
  color: string | null;
  submissionCount: number;
}

export interface Room {
  id: string;
  name: string;
  capacity: number | null;
  // DEC-896 amendment (wave 26): rides the /events/:id/rooms list response
  // (repo/events.ts listRoomsForEvent) so Remove can be disabled proactively
  // -- never a per-room follow-up request.
  sessionCount: number;
}

export const EMPTY_TRACK: TrackForm = { name: '', color: TRACK_SWATCHES[0].value };
export const EMPTY_ROOM: RoomForm = { name: '', capacity: '' };

/** Draft baseline for a track row -- same transform applied every time so
 * the dirty check (draft vs this baseline) never drifts from the loaded
 * record (a null color maps to the picker's own default, consistently). */
export function trackBaseline(track: Track): TrackForm {
  return { name: track.name, color: track.color ?? TRACK_SWATCHES[0].value };
}

export function roomBaseline(room: Room): RoomForm {
  return { name: room.name, capacity: room.capacity !== null ? String(room.capacity) : '' };
}

// DEC-856 (wave 65 amendment): a refusal's fields map is read by SHAPE --
// name/color/capacity are the keys this panel's own controls own (the
// server's "Invalid track"/"Invalid room" vocabulary, src/routes/api/
// events.ts:416-536); any other key still renders, labelled "<key>:
// <message>", rather than being dropped or collapsed into err.message.
export const TRACK_FIELD_KEYS: readonly string[] = ['name', 'color'];
export const ROOM_FIELD_KEYS: readonly string[] = ['name', 'capacity'];

void DEC_856;

export function unownedFieldEntries(
  errors: Record<string, string | undefined>,
  known: readonly string[],
): Array<[string, string]> {
  return Object.entries(errors).filter(
    (entry): entry is [string, string] => entry[1] !== undefined && !known.includes(entry[0]),
  );
}
