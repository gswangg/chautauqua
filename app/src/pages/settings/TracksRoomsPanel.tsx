// Tracks & rooms panel (w4-h, DEC-032): list/add/rename/delete tracks with
// a color swatch input and rooms with capacity. Endpoints landed in w2-b's
// events.ts (GET/POST /events/:id/tracks|rooms, PATCH/DELETE /tracks|rooms/:id).
import { useEffect, useState } from 'react';
import { DelayedLoading } from '../../components/DelayedLoading';
import { apiDelete, apiList, apiPatch, apiPost, ApiError } from '../../lib/api';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import {
  validateRoomForm,
  validateTrackForm,
  type RoomForm,
  type RoomFormErrors,
  type TrackForm,
  type TrackFormErrors,
} from './formState';

interface Track {
  id: string;
  name: string;
  color: string | null;
}

interface Room {
  id: string;
  name: string;
  capacity: number | null;
}

const EMPTY_TRACK: TrackForm = { name: '', color: '' };
const EMPTY_ROOM: RoomForm = { name: '', capacity: '' };

export function TracksRoomsPanel() {
  const { eventId, loading: eventLoading, error: eventError } = useCurrentEvent();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);
  const [newTrack, setNewTrack] = useState<TrackForm>(EMPTY_TRACK);
  const [newRoom, setNewRoom] = useState<RoomForm>(EMPTY_ROOM);
  const [trackFieldErrors, setTrackFieldErrors] = useState<TrackFormErrors>({});
  const [roomFieldErrors, setRoomFieldErrors] = useState<RoomFormErrors>({});

  function reload(id: string) {
    apiList<Track>(`/events/${id}/tracks`)
      .then((res) => setTracks(res.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load tracks'));
    apiList<Room>(`/events/${id}/rooms`)
      .then((res) => setRooms(res.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load rooms'));
  }

  useEffect(() => {
    if (!eventId) return;
    reload(eventId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function addTrack() {
    if (!eventId) return;
    const errors = validateTrackForm(newTrack);
    setTrackFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    try {
      await apiPost(`/events/${eventId}/tracks`, {
        name: newTrack.name,
        color: newTrack.color || null,
      });
      setNewTrack(EMPTY_TRACK);
      reload(eventId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add track');
    }
  }

  async function renameTrack(track: Track, name: string) {
    if (!eventId) return;
    try {
      await apiPatch(`/tracks/${track.id}`, { name });
      reload(eventId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to rename track');
    }
  }

  async function deleteTrack(track: Track) {
    if (!eventId) return;
    try {
      await apiDelete(`/tracks/${track.id}`);
      reload(eventId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete track');
    }
  }

  async function addRoom() {
    if (!eventId) return;
    const errors = validateRoomForm(newRoom);
    setRoomFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    try {
      await apiPost(`/events/${eventId}/rooms`, {
        name: newRoom.name,
        capacity: newRoom.capacity.trim().length > 0 ? Number(newRoom.capacity) : null,
      });
      setNewRoom(EMPTY_ROOM);
      reload(eventId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add room');
    }
  }

  async function deleteRoom(room: Room) {
    if (!eventId) return;
    try {
      await apiDelete(`/rooms/${room.id}`);
      reload(eventId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete room');
    }
  }

  return (
    <section className="chq-settings-panel" aria-label="Tracks and rooms">
      <h2>Tracks &amp; rooms</h2>
      {eventLoading ? <DelayedLoading /> : null}
      {eventError || error ? <p role="alert">{eventError ?? error}</p> : null}

      <h3>Tracks</h3>
      <ul>
        {tracks.map((track) => (
          <li key={track.id}>
            <span
              className="chq-color-swatch"
              style={{ background: track.color ?? 'transparent' }}
              aria-hidden="true"
            />
            <input
              className="chq-input"
              value={track.name}
              onChange={(e) => renameTrack(track, e.target.value)}
              aria-label={`Track name for ${track.name}`}
            />
            <button type="button" className="chq-link-button" onClick={() => deleteTrack(track)}>
              Delete
            </button>
          </li>
        ))}
      </ul>
      <div>
        <input
          className="chq-input"
          placeholder="New track name"
          value={newTrack.name}
          onChange={(e) => setNewTrack({ ...newTrack, name: e.target.value })}
        />
        <input
          className="chq-input"
          type="color"
          value={newTrack.color || '#4f46e5'}
          onChange={(e) => setNewTrack({ ...newTrack, color: e.target.value })}
        />
        <button type="button" className="chq-btn chq-btn-primary" onClick={() => void addTrack()}>
          Add track
        </button>
        {trackFieldErrors.name ? <span role="alert">{trackFieldErrors.name}</span> : null}
        {trackFieldErrors.color ? <span role="alert">{trackFieldErrors.color}</span> : null}
      </div>

      <h3>Rooms</h3>
      <ul>
        {rooms.map((room) => (
          <li key={room.id}>
            {room.name} {room.capacity !== null ? `(capacity ${room.capacity})` : ''}
            <button type="button" className="chq-link-button" onClick={() => deleteRoom(room)}>
              Delete
            </button>
          </li>
        ))}
      </ul>
      <div>
        <input
          className="chq-input"
          placeholder="New room name"
          value={newRoom.name}
          onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
        />
        <input
          className="chq-input"
          placeholder="Capacity"
          value={newRoom.capacity}
          onChange={(e) => setNewRoom({ ...newRoom, capacity: e.target.value })}
        />
        <button type="button" className="chq-btn chq-btn-secondary" onClick={() => void addRoom()}>
          Add room
        </button>
        {roomFieldErrors.name ? <span role="alert">{roomFieldErrors.name}</span> : null}
        {roomFieldErrors.capacity ? <span role="alert">{roomFieldErrors.capacity}</span> : null}
      </div>
    </section>
  );
}
